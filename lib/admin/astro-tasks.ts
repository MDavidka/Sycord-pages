import { withRootSsh, probeDeployVmSsh } from "@/lib/admin/vm-ssh"
import { logModerationAction } from "@/lib/moderator-audit"

export type AstroTaskCategory = "diagnostic" | "repair" | "benchmark"
export type AstroTaskRisk = "none" | "low" | "medium" | "high"

export interface AstroTaskDefinition {
  id: string
  name: string
  description: string
  category: AstroTaskCategory
  requiresApproval: boolean
  riskLevel: AstroTaskRisk
  command: string
  timeoutMs: number
}

export interface AstroTaskResult {
  taskId: string
  taskName: string
  category: AstroTaskCategory
  success: boolean
  stdout: string
  stderr: string
  exitCode: number | null
  durationMs: number
  executedAt: string
  error?: string | null
  metrics?: Record<string, unknown>
}

export interface SelfHealingProposal {
  id: string
  taskId: string
  title: string
  category: AstroTaskCategory
  riskLevel: AstroTaskRisk
  severity: "critical" | "warning" | "info"
  issueSummary: string
  recommendedFix: string
  requiresApproval: boolean
}

export interface BenchmarkResult {
  id: string
  profile: "synthetic_cpu_burst" | "io_throughput_probe" | "runner_latency_ping"
  name: string
  status: "queued" | "running" | "completed" | "failed"
  score: string | null
  details: Record<string, unknown>
  durationMs: number
  executedAt: string
  logs: string
  error?: string | null
}

export const ASTRO_ALLOWLISTED_TASKS: Record<string, AstroTaskDefinition> = {
  // Read-only diagnostic tasks
  check_disk_space: {
    id: "check_disk_space",
    name: "Disk Space Usage",
    description: "Inspect storage usage across root, /var, and /tmp mount points.",
    category: "diagnostic",
    requiresApproval: false,
    riskLevel: "none",
    command: "df -h / /var /tmp 2>&1",
    timeoutMs: 10_000,
  },
  check_memory_pressure: {
    id: "check_memory_pressure",
    name: "Memory Pressure & Swap",
    description: "Check RAM allocation, swap usage, and system paging activity.",
    category: "diagnostic",
    requiresApproval: false,
    riskLevel: "none",
    command: "free -m && echo '--- vmstat ---' && vmstat 1 2 2>&1",
    timeoutMs: 12_000,
  },
  check_systemd_journal: {
    id: "check_systemd_journal",
    name: "Runner Journal Logs",
    description: "Fetch the latest 50 lines from sycord-vm-runner systemd unit.",
    category: "diagnostic",
    requiresApproval: false,
    riskLevel: "none",
    command: "journalctl -u sycord-vm-runner -n 50 --no-pager 2>&1",
    timeoutMs: 15_000,
  },
  check_nginx_status: {
    id: "check_nginx_status",
    name: "Nginx Status & Config Test",
    description: "Verify Nginx configuration syntax and systemd service status.",
    category: "diagnostic",
    requiresApproval: false,
    riskLevel: "none",
    command: "nginx -t 2>&1 && systemctl status nginx --no-pager 2>&1",
    timeoutMs: 10_000,
  },
  check_network_sockets: {
    id: "check_network_sockets",
    name: "Network Sockets & Listeners",
    description: "Inspect active listening sockets across ports 80, 443, and 5050.",
    category: "diagnostic",
    requiresApproval: false,
    riskLevel: "none",
    command: "ss -tulpn 2>&1",
    timeoutMs: 10_000,
  },

  // Mutable repair tasks (require explicit approval)
  restart_runner_service: {
    id: "restart_runner_service",
    name: "Restart Sycord Runner Service",
    description: "Restart sycord-vm-runner daemon and confirm active status.",
    category: "repair",
    requiresApproval: true,
    riskLevel: "medium",
    command: "systemctl restart sycord-vm-runner && sleep 2 && systemctl is-active sycord-vm-runner 2>&1",
    timeoutMs: 20_000,
  },
  restart_nginx: {
    id: "restart_nginx",
    name: "Test & Restart Nginx",
    description: "Run nginx preflight configuration test and restart the reverse proxy.",
    category: "repair",
    requiresApproval: true,
    riskLevel: "medium",
    command: "nginx -t 2>&1 && systemctl restart nginx && systemctl is-active nginx 2>&1",
    timeoutMs: 20_000,
  },
  rotate_runner_logs: {
    id: "rotate_runner_logs",
    name: "Vacuum Journal & Rotate Logs",
    description: "Vacuum systemd journal to 100MB and run logrotate for runner logs.",
    category: "repair",
    requiresApproval: true,
    riskLevel: "low",
    command: "journalctl --vacuum-size=100M 2>&1 && (logrotate -f /etc/logrotate.d/sycord-runner 2>&1 || true)",
    timeoutMs: 25_000,
  },
  flush_pagecache: {
    id: "flush_pagecache",
    name: "Sync & Flush Page Cache",
    description: "Sync unwritten filesystem blocks and flush reclaimable kernel cache.",
    category: "repair",
    requiresApproval: true,
    riskLevel: "low",
    command: "sync && echo 1 > /proc/sys/vm/drop_caches && free -m 2>&1",
    timeoutMs: 15_000,
  },
  restart_cloudflared: {
    id: "restart_cloudflared",
    name: "Restart Cloudflare Tunnel",
    description: "Restart cloudflared service daemon and verify systemd active state.",
    category: "repair",
    requiresApproval: true,
    riskLevel: "low",
    command: "systemctl restart cloudflared 2>&1 && sleep 2 && systemctl is-active cloudflared 2>&1",
    timeoutMs: 20_000,
  },

  // Performance benchmark tasks
  synthetic_cpu_burst: {
    id: "synthetic_cpu_burst",
    name: "CPU Compute Burst (5s)",
    description: "Bounded single-core SHA256 hashing burst measuring raw iteration throughput.",
    category: "benchmark",
    requiresApproval: false,
    riskLevel: "none",
    command:
      "python3 -c \"import time, hashlib; t0=time.time(); c=0; data=b'sycord-prime-bench';\\nwhile time.time()-t0 < 5.0:\\n    data=hashlib.sha256(data).digest(); c+=1\\nelapsed=time.time()-t0\\nprint(f'BURST_RESULT: {c} iterations in {elapsed:.3f}s ({int(c/elapsed):,} iter/sec)')\" 2>&1",
    timeoutMs: 20_000,
  },
  io_throughput_probe: {
    id: "io_throughput_probe",
    name: "Disk I/O Sequential Write Probe",
    description: "64MB direct sequential block write to /tmp with sync, followed by read cleanup.",
    category: "benchmark",
    requiresApproval: false,
    riskLevel: "none",
    command:
      "dd if=/dev/zero of=/tmp/sycord-bench-io.tmp bs=1M count=64 conv=fdatasync 2>&1 && dd if=/tmp/sycord-bench-io.tmp of=/dev/null bs=1M count=64 2>&1 && rm -f /tmp/sycord-bench-io.tmp",
    timeoutMs: 25_000,
  },
  runner_latency_ping: {
    id: "runner_latency_ping",
    name: "Runner Endpoint Latency (10 probes)",
    description: "10 consecutive HTTP roundtrip measurements to http://127.0.0.1:5050/api/status.",
    category: "benchmark",
    requiresApproval: false,
    riskLevel: "none",
    command:
      "python3 -c \"import urllib.request, time; lats=[];\\nfor i in range(10):\\n    t0=time.time()\\n    try:\\n        with urllib.request.urlopen('http://127.0.0.1:5050/api/status', timeout=2) as r: pass\\n        lats.append((time.time()-t0)*1000)\\n    except Exception: lats.append(-1)\\nvalid=[l for l in lats if l >= 0]\\nif valid:\\n    print(f'PROBE_RESULT: {len(valid)}/10 passed. min={min(valid):.1f}ms avg={sum(valid)/len(valid):.1f}ms max={max(valid):.1f}ms')\\nelse:\\n    print('PROBE_RESULT: 0/10 passed, runner endpoint unresponsive')\" 2>&1",
    timeoutMs: 30_000,
  },
}

const MAX_OUTPUT_BYTES = 64 * 1024 // 64KB

function truncateOutput(str: string): string {
  if (str.length <= MAX_OUTPUT_BYTES) return str
  return `${str.slice(0, MAX_OUTPUT_BYTES)}\n\n[... Truncated: output exceeded 64KB limit ...]`
}

/**
 * Execute an allowlisted task against the Ubuntu VM via SSH.
 */
export async function executeAstroTask(
  taskId: string,
  options: {
    moderatorEmail: string
    approved?: boolean
    reason?: string
  },
): Promise<AstroTaskResult> {
  const definition = ASTRO_ALLOWLISTED_TASKS[taskId]
  if (!definition) {
    throw new Error(`Task '${taskId}' is not in the secure allowlist. Arbitrary command execution is disallowed.`)
  }

  if (definition.requiresApproval && !options.approved) {
    throw new Error(`Task '${definition.name}' requires explicit moderator approval before execution.`)
  }

  const startTime = Date.now()
  const executedAt = new Date().toISOString()

  // First probe VM SSH reachability
  const probe = await probeDeployVmSsh()
  if (!probe.reachable) {
    const durationMs = Date.now() - startTime
    return {
      taskId: definition.id,
      taskName: definition.name,
      category: definition.category,
      success: false,
      stdout: "",
      stderr: probe.error || "VM SSH unreachable",
      exitCode: -1,
      durationMs,
      executedAt,
      error: `SSH host unreachable: ${probe.error || "Connection refused"}`,
    }
  }

  try {
    const rawResult = await withRootSsh(async (ssh) => {
      // Timeout promise wrapper
      const execPromise = ssh.execCommand(definition.command)
      const timeoutPromise = new Promise<{ stdout: string; stderr: string; code: number }>((_, reject) => {
        setTimeout(() => reject(new Error(`Command timed out after ${definition.timeoutMs / 1000}s`)), definition.timeoutMs)
      })

      return (await Promise.race([execPromise, timeoutPromise])) as {
        stdout: string
        stderr: string
        code: number | null
      }
    })

    const durationMs = Date.now() - startTime
    const success = (rawResult.code ?? 0) === 0
    const stdout = truncateOutput(rawResult.stdout || "")
    const stderr = truncateOutput(rawResult.stderr || "")

    // Parse metric extracts if available
    const metrics: Record<string, unknown> = {}
    if (definition.id === "synthetic_cpu_burst") {
      const match = stdout.match(/BURST_RESULT:\s+([^\n]+)/)
      if (match) metrics.burst = match[1].trim()
    } else if (definition.id === "runner_latency_ping") {
      const match = stdout.match(/PROBE_RESULT:\s+([^\n]+)/)
      if (match) metrics.latencySummary = match[1].trim()
    }

    // Record audit log
    const auditAction =
      definition.category === "repair"
        ? "astro_self_heal"
        : definition.category === "benchmark"
          ? "astro_benchmark"
          : "astro_task_run"

    await logModerationAction({
      moderatorEmail: options.moderatorEmail,
      action: auditAction as any,
      targetType: "system",
      targetId: definition.id,
      targetIdentifier: definition.name,
      details: {
        taskId: definition.id,
        category: definition.category,
        durationMs,
        exitCode: rawResult.code,
        success,
        approved: options.approved ?? false,
        reason: options.reason || "",
      },
      reason: options.reason || `Executed Astro task: ${definition.name}`,
    })

    return {
      taskId: definition.id,
      taskName: definition.name,
      category: definition.category,
      success,
      stdout,
      stderr,
      exitCode: rawResult.code,
      durationMs,
      executedAt,
      metrics,
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime
    const errorMsg = err?.message || "Task execution failed"

    await logModerationAction({
      moderatorEmail: options.moderatorEmail,
      action: "astro_task_run",
      targetType: "system",
      targetId: definition.id,
      targetIdentifier: definition.name,
      details: {
        taskId: definition.id,
        durationMs,
        success: false,
        error: errorMsg,
      },
      reason: `Failed Astro task: ${definition.name}`,
    })

    return {
      taskId: definition.id,
      taskName: definition.name,
      category: definition.category,
      success: false,
      stdout: "",
      stderr: errorMsg,
      exitCode: -1,
      durationMs,
      executedAt,
      error: errorMsg,
    }
  }
}

/**
 * Classify anomalies and generate safe self-healing repair proposals.
 */
export function classifyVmAnomalies(vmStatus: Record<string, any> | null): SelfHealingProposal[] {
  if (!vmStatus) return []
  const proposals: SelfHealingProposal[] = []

  // Check Sycord VM Runner
  const runnerRunning = Boolean(vmStatus.runner?.running)
  if (!runnerRunning) {
    proposals.push({
      id: "proposal_runner_down",
      taskId: "restart_runner_service",
      title: "Restart Sycord Runner Service",
      category: "repair",
      riskLevel: "medium",
      severity: "critical",
      issueSummary: "Sycord VM runner is down or not listening on port 5050.",
      recommendedFix: "Restart sycord-vm-runner systemd unit and verify socket responsiveness.",
      requiresApproval: true,
    })
  }

  // Check Nginx reverse proxy
  const nginxRunning = Boolean(vmStatus.nginx?.running)
  if (!nginxRunning) {
    proposals.push({
      id: "proposal_nginx_down",
      taskId: "restart_nginx",
      title: "Verify & Restart Nginx",
      category: "repair",
      riskLevel: "medium",
      severity: "critical",
      issueSummary: "Nginx reverse proxy is inactive or port 80 is unavailable.",
      recommendedFix: "Run nginx syntax verification and restart the nginx service.",
      requiresApproval: true,
    })
  }

  // Check Memory pressure
  const memPercent =
    typeof vmStatus.mem?.percent === "number"
      ? vmStatus.mem.percent
      : typeof vmStatus.memory === "number"
        ? vmStatus.memory
        : null

  if (memPercent !== null && memPercent >= 85) {
    proposals.push({
      id: "proposal_memory_pressure",
      taskId: "flush_pagecache",
      title: "Sync & Flush Page Cache",
      category: "repair",
      riskLevel: "low",
      severity: memPercent >= 92 ? "critical" : "warning",
      issueSummary: `Memory pressure high (${memPercent.toFixed(1)}% observed).`,
      recommendedFix: "Flush unwritten dirty pages and drop kernel pagecache to release inactive memory.",
      requiresApproval: true,
    })
  }

  // Check Disk capacity
  const diskPercent =
    typeof vmStatus.disk?.percent === "number"
      ? vmStatus.disk.percent
      : typeof vmStatus.disk === "number"
        ? vmStatus.disk
        : null

  if (diskPercent !== null && diskPercent >= 80) {
    proposals.push({
      id: "proposal_disk_full",
      taskId: "rotate_runner_logs",
      title: "Vacuum Journal & Rotate Runner Logs",
      category: "repair",
      riskLevel: "low",
      severity: diskPercent >= 90 ? "critical" : "warning",
      issueSummary: `Disk usage at ${diskPercent.toFixed(1)}%. Logs and journal may be consuming volume capacity.`,
      recommendedFix: "Vacuum systemd journal to 100MB and rotate runner log files.",
      requiresApproval: true,
    })
  }

  // Check Cloudflared tunnel
  const cloudflaredRunning = Boolean(vmStatus.cloudflared?.running)
  if (!cloudflaredRunning && vmStatus.online) {
    proposals.push({
      id: "proposal_cloudflared_down",
      taskId: "restart_cloudflared",
      title: "Restart Cloudflare Tunnel",
      category: "repair",
      riskLevel: "low",
      severity: "warning",
      issueSummary: "Cloudflared tunnel daemon is inactive or process terminated.",
      recommendedFix: "Restart cloudflared systemd service unit and monitor connection.",
      requiresApproval: true,
    })
  }

  return proposals
}
