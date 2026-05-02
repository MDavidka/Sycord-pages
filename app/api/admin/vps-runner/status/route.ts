import { NextResponse } from "next/server"
import { ensureAdmin, requestRunner } from "../_utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type RunnerStatus = {
  success: boolean
  online: boolean
  version?: string
  uptimeSeconds?: number
  hostname?: string
  nodeVersion?: string
  npmVersion?: string
  cloudflared?: {
    installed: boolean
    running: boolean
    tunnelName?: string
  }
  proxy?: {
    type: "nginx" | "caddy"
    running: boolean
  }
  cpu?: {
    usagePercent: number
    cores: number
    loadAvg: number[]
  }
  memory?: {
    totalMb: number
    usedMb: number
    freeMb: number
    usagePercent: number
  }
  disk?: {
    totalGb: number
    usedGb: number
    freeGb: number
    usagePercent: number
  }
  websites?: {
    total: number
    running: number
    stopped: number
    failed: number
    healthy: number
    unhealthy: number
  }
  updatedAt?: string
  error?: string
}

const parseNumber = (value: unknown) => {
  if (typeof value === "number" && !Number.isNaN(value)) return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

const parseDiskValue = (value: unknown) => {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const cleaned = value.trim().replace(/GB|G|GiB/i, "")
    const parsed = Number.parseFloat(cleaned)
    return Number.isNaN(parsed) ? undefined : parsed
  }
  return undefined
}

const normalizeStatus = (data: any, ok: boolean): RunnerStatus => {
  if (!data || typeof data !== "object") {
    return {
      success: false,
      online: false,
      error: "Runner offline",
      updatedAt: new Date().toISOString(),
    }
  }

  const cpuRaw = data.cpu ?? data.cpuUsage ?? data.cpuPercent
  const cpuUsage = parseNumber(cpuRaw?.usagePercent ?? cpuRaw?.percent ?? cpuRaw)
  const cpuCores = parseNumber(cpuRaw?.cores ?? data.cpuCores ?? data.cores)
  const cpuLoadAvg = Array.isArray(cpuRaw?.loadAvg ?? data.loadAvg)
    ? (cpuRaw?.loadAvg ?? data.loadAvg)
        .map((entry: unknown) => parseNumber(entry))
        .filter((entry): entry is number => entry != null && !Number.isNaN(entry))
    : []
  const cpu =
    cpuUsage == null && cpuCores == null && cpuLoadAvg.length === 0
      ? undefined
      : {
          usagePercent: cpuUsage ?? 0,
          cores: cpuCores ?? 0,
          loadAvg: cpuLoadAvg as number[],
        }

  const memoryRaw = data.memory ?? data.mem
  const memoryTotal = parseNumber(memoryRaw?.totalMb ?? memoryRaw?.total ?? memoryRaw?.totalMB)
  const memoryUsed = parseNumber(memoryRaw?.usedMb ?? memoryRaw?.used ?? memoryRaw?.usedMB)
  const memoryFree = parseNumber(memoryRaw?.freeMb ?? memoryRaw?.free ?? memoryRaw?.freeMB)
  const memoryPercent = parseNumber(memoryRaw?.usagePercent ?? memoryRaw?.percent ?? memoryRaw?.usage)
  const memory =
    memoryTotal == null && memoryUsed == null && memoryFree == null && memoryPercent == null
      ? undefined
      : {
          totalMb: memoryTotal ?? 0,
          usedMb: memoryUsed ?? 0,
          freeMb: memoryFree ?? 0,
          usagePercent: memoryPercent ?? 0,
        }

  const diskRaw = data.disk
  const diskTotal = parseDiskValue(diskRaw?.totalGb ?? diskRaw?.total)
  const diskUsed = parseDiskValue(diskRaw?.usedGb ?? diskRaw?.used)
  const diskFree = parseDiskValue(diskRaw?.freeGb ?? diskRaw?.free)
  const diskPercent = parseNumber(diskRaw?.usagePercent ?? diskRaw?.percent ?? diskRaw?.usage)
  const disk =
    diskTotal == null && diskUsed == null && diskFree == null && diskPercent == null
      ? undefined
      : {
          totalGb: diskTotal ?? 0,
          usedGb: diskUsed ?? 0,
          freeGb: diskFree ?? 0,
          usagePercent: diskPercent ?? 0,
        }

  const cloudflaredRaw = data.cloudflared ?? data.cloudflare ?? null
  const tunnelRunning = data.tunnel ?? data.tunnelRunning ?? cloudflaredRaw?.running
  const cloudflared =
    cloudflaredRaw || tunnelRunning != null
      ? {
          installed: Boolean(cloudflaredRaw?.installed ?? cloudflaredRaw?.present ?? tunnelRunning != null),
          running: Boolean(cloudflaredRaw?.running ?? tunnelRunning),
          tunnelName: cloudflaredRaw?.tunnelName ?? data.tunnelName ?? undefined,
        }
      : undefined

  const proxyRaw = data.proxy
  const proxy =
    proxyRaw == null
      ? undefined
      : {
          type: proxyRaw.type === "caddy" ? "caddy" : "nginx",
          running: Boolean(proxyRaw.running ?? proxyRaw.active ?? proxyRaw.ok),
        }

  const websitesRaw = data.websites
  const websites =
    websitesRaw == null
      ? undefined
      : {
          total: parseNumber(websitesRaw.total) ?? 0,
          running: parseNumber(websitesRaw.running) ?? 0,
          stopped: parseNumber(websitesRaw.stopped) ?? 0,
          failed: parseNumber(websitesRaw.failed) ?? 0,
          healthy: parseNumber(websitesRaw.healthy) ?? 0,
          unhealthy: parseNumber(websitesRaw.unhealthy) ?? 0,
        }

  return {
    success: ok && (data.success ?? true),
    online: Boolean(data.online ?? data.success ?? ok),
    version: data.version ?? data.runnerVersion ?? data.flaskVersion ?? undefined,
    uptimeSeconds: parseNumber(data.uptimeSeconds ?? data.uptime) ?? undefined,
    hostname: data.hostname ?? undefined,
    nodeVersion: data.nodeVersion ?? undefined,
    npmVersion: data.npmVersion ?? undefined,
    cloudflared,
    proxy,
    cpu,
    memory,
    disk,
    websites,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
    error: data.error,
  }
}

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const result = await requestRunner("status")
  const normalized = normalizeStatus(result.data, result.ok)

  return NextResponse.json(normalized, { status: result.ok ? 200 : result.status })
}
