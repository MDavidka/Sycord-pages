import {
  bootstrapDeployVmRunner,
  generateRunnerToken,
  probeDeployVmSsh,
  readDeployVmDiagnostics,
  installCloudflared,
  runCloudflaredWithToken,
  getTunnelStatus,
  saveTunnelStateToDb,
  type VmSetupInput,
} from "@/lib/admin/vm-ssh"
import { cloudflareConfigured, provisionTunnel, getTunnelApiStatus, getCloudflareEnv } from "@/lib/admin/cloudflare-api"
import { proxyRunner, requireAdminResponse, runnerHeaders } from "../../_shared"

const VPS_SERVER_URL = process.env.VPS_SERVER_URL || "http://127.0.0.1:5050"

function event(chunk: string) {
  return new TextEncoder().encode(`${chunk}\n\n`)
}

function stageEvent(stage: string, status: string, message: string) {
  return event(`event: stage\ndata: ${JSON.stringify({ stage, status, message, timestamp: new Date().toISOString() })}`)
}

function logEvent(line: string) {
  return event(`event: log\ndata: ${JSON.stringify({ line, timestamp: new Date().toISOString() })}`)
}

function resultEvent(data: Record<string, unknown>) {
  return event(`event: result\ndata: ${JSON.stringify({ ...data, timestamp: new Date().toISOString() })}`)
}

function errorEvent(error: string, stage?: string) {
  return event(`event: error\ndata: ${JSON.stringify({ error, stage, timestamp: new Date().toISOString() })}`)
}

function tunnelEvent(type: string, data: Record<string, unknown>) {
  return event(`event: tunnel\ndata: ${JSON.stringify({ type, ...data, timestamp: new Date().toISOString() })}`)
}

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  return runSetupStream(defaultSshInput())
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const host = String(body.host || "").trim()
  const password = String(body.rootPassword || body.password || "")
  const port = Number(body.port || 22)
  const baseDomain = String(body.baseDomain || "sycord.site").trim()
  const skipCloudflare = body.skipCloudflare === true
  const resetTunnel = body.resetTunnel === true

  const sshInput: VmSetupInput | undefined = host && password
    ? { host, password, port, baseDomain, runnerToken: generateRunnerToken() }
    : undefined

  return runSetupStream(sshInput, skipCloudflare, resetTunnel)
}

function defaultSshInput(): VmSetupInput | undefined {
  return undefined
}

async function runSetupStream(sshInput?: VmSetupInput, skipCloudflare = false, resetTunnel = false) {
  const runnerUrl = sshInput?.host
    ? `http://${sshInput.host}:5050`
    : VPS_SERVER_URL

  const baseDomain = sshInput?.baseDomain || "sycord.site"

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Uint8Array) => controller.enqueue(data)
      let ssh: any = null

      try {
        send(stageEvent("ssh-check", "running", "Checking SSH connectivity to deploy VM"))
        const sshProbe = await probeDeployVmSsh(sshInput)
        if (!sshProbe.reachable) {
          send(stageEvent("ssh-check", "error", "SSH connection to deploy VM failed"))
          send(logEvent(`SSH error: ${sshProbe.error || "Unknown SSH error"}`))
          send(errorEvent(
            sshInput
              ? "SSH login failed. Check VM IP and root password."
              : "Deploy VM SSH login failed. Check VPS_SSH_HOST and VPS_SSH_ROOT_PASSWORD.",
            "ssh-check"
          ))
          controller.close()
          return
        }
        send(stageEvent("ssh-check", "success", "SSH connection established"))
        if (sshInput?.host) send(logEvent(`Connected to VM at ${sshInput.host}:${sshInput.port || 22}`))

        send(stageEvent("runner-check", "running", "Checking if runner API is online"))
        const runnerCheck = await fetch(`${runnerUrl}/api/status`, {
          headers: runnerHeaders({ Accept: "application/json" }),
        }).catch(() => null)

        if (runnerCheck?.ok) {
          const status = await runnerCheck.json().catch(() => ({}))
          send(stageEvent("runner-check", "success", "Runner API already online"))
          send(logEvent("Runner reachable — skipping full bootstrap"))

          if (!skipCloudflare) {
            send(stageEvent("cloudflare-check", "running", resetTunnel ? "Resetting and reconfiguring Cloudflare Tunnel" : "Setting up Cloudflare Tunnel"))
            await runCloudflareSetup(sshInput, baseDomain, send, controller, resetTunnel)
          }

          send(stageEvent("complete", "success", "Runner setup complete"))
          send(resultEvent({
            success: true,
            online: true,
            setupComplete: true,
            nginx: status.nginx || { running: true },
            runner: status.runner || { running: true },
            cloudflared: status.cloudflared || { running: true },
            runnerUrl,
            baseDomain,
          }))
          controller.close()
          return
        }

        send(stageEvent("runner-check", "error", "Runner not reachable — bootstrapping via SSH"))
        send(stageEvent("bootstrap", "running", "Uploading and installing vm-runner"))
        send(logEvent("Starting full bootstrap over SSH"))

        const result = await bootstrapDeployVmRunner(sshInput)
        if (result.logs) {
          for (const line of result.logs.split("\n").filter(Boolean)) {
            send(logEvent(line))
          }
        }

        if (!result.success) {
          send(stageEvent("bootstrap", "error", result.error || "Bootstrap failed"))
          send(errorEvent(result.error || "Runner bootstrap failed", "bootstrap"))
          controller.close()
          return
        }
        send(stageEvent("bootstrap", "success", "VM runner bootstrapped and started"))

        if (!skipCloudflare) {
          send(stageEvent("cloudflare-check", "running", resetTunnel ? "Resetting and reconfiguring Cloudflare Tunnel" : "Setting up Cloudflare Tunnel"))
          await runCloudflareSetup(sshInput, baseDomain, send, controller, resetTunnel)
        }

        send(stageEvent("diagnostics", "running", "Collecting final diagnostics"))
        const diag = await readDeployVmDiagnostics(sshInput).catch(() => null)
        send(stageEvent("diagnostics", "success", "Diagnostics collected"))
        send(stageEvent("complete", "success", "Runner setup complete"))
        send(resultEvent({
          success: true,
          online: true,
          setupComplete: true,
          nginx: diag?.nginx || { running: true },
          runner: diag?.runner || { running: true },
          cloudflared: diag?.cloudflared || { running: true },
          runnerUrl: result.runnerUrl,
          runnerToken: result.runnerToken,
          baseDomain,
        }))
      } catch (error: any) {
        send(stageEvent("error", "error", error?.message || "Setup failed"))
        send(errorEvent(error?.message || "Unknown setup error"))
      } finally {
        if (ssh) {
          try { ssh.dispose() } catch {}
        }
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}

async function runCloudflareSetup(
  sshInput: VmSetupInput | undefined,
  baseDomain: string,
  send: (data: Uint8Array) => void,
  controller: ReadableStreamDefaultController,
  reset = false,
) {
  let ssh: any = null
  try {
    // 1. Verify Cloudflare API credentials are present.
    if (!cloudflareConfigured()) {
      send(stageEvent("cloudflare-api", "error", "Cloudflare API not configured"))
      send(logEvent("[cloudflare] Missing CLOUDFLARE_API_KEY / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_ZONE_ID"))
      send(errorEvent(
        "Cloudflare API is not configured. Set CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ZONE_ID in the environment.",
        "cloudflare-api",
      ))
      return
    }

    const logs: string[] = []
    const emitLog = (line: string) => {
      logs.push(line)
      send(logEvent(line))
    }

    // 2. Provision the tunnel entirely via the Cloudflare API:
    //    create/reuse tunnel -> wildcard ingress -> wildcard DNS. No browser login.
    send(stageEvent("cloudflare-api", "running", "Provisioning Cloudflare Tunnel via API"))
    const provision = await provisionTunnel(baseDomain, emitLog)
    if (!provision.success || !provision.tunnel) {
      send(stageEvent("cloudflare-api", "error", provision.error || "Tunnel provisioning failed"))
      send(errorEvent(provision.error || "Failed to provision Cloudflare tunnel", "cloudflare-api"))
      return
    }
    send(stageEvent("cloudflare-api", "success", `Tunnel ready: ${provision.tunnel.id.slice(0, 8)}...`))
    send(stageEvent("cloudflare-dns", "success", `Wildcard DNS *.${baseDomain} pointed at the tunnel`))

    // 3. Install + run the token-based cloudflared service on the VM.
    send(stageEvent("cloudflare-service", "running", reset ? "Reinstalling cloudflared service on VM" : "Installing cloudflared service on VM"))
    const { NodeSSH } = await import("node-ssh")
    ssh = new NodeSSH()
    const host = sshInput?.host || process.env.VPS_SSH_HOST || process.env.VPS_HOST
    const password = sshInput?.password || process.env.VPS_SSH_ROOT_PASSWORD || process.env.VPS_ROOT_PSW
    const port = sshInput?.port || Number(process.env.VPS_SSH_PORT || "22")
    if (!host || !password) throw new Error("Missing VM host or root password")
    await ssh.connect({ host, username: process.env.VPS_USERNAME || "root", password, port })

    const installed = await installCloudflared(ssh, logs)
    logs.slice(-5).forEach((l) => send(logEvent(l)))
    if (!installed) {
      send(stageEvent("cloudflare-service", "error", "Failed to install cloudflared binary"))
      send(errorEvent("Failed to install cloudflared on the VM", "cloudflare-service"))
      return
    }

    const run = await runCloudflaredWithToken(ssh, provision.tunnel.token, logs)
    logs.slice(-8).forEach((l) => send(logEvent(l)))
    if (!run.success) {
      send(stageEvent("cloudflare-service", "error", run.error || "cloudflared service failed to start"))
      send(errorEvent(run.error || "cloudflared service failed to start", "cloudflare-service"))
      return
    }
    send(stageEvent("cloudflare-service", "success", "cloudflared running 24/7 via systemd"))

    // 4. Verify edge connectivity through the Cloudflare API.
    send(stageEvent("cloudflare-verify", "running", "Verifying tunnel connections to Cloudflare edge"))
    let apiStatus: { status: string; connections: number } | null = null
    const env = getCloudflareEnv()
    if (env) {
      for (let i = 0; i < 10; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        apiStatus = await getTunnelApiStatus(env, provision.tunnel.id)
        if (apiStatus && (apiStatus.status === "healthy" || apiStatus.connections > 0)) break
      }
    }
    const cliStatus = await getTunnelStatus(ssh, logs).catch(() => ({ running: false, info: "" }))
    const healthy = (apiStatus?.connections ?? 0) > 0 || apiStatus?.status === "healthy" || cliStatus.running
    send(stageEvent(
      "cloudflare-verify",
      healthy ? "success" : "error",
      healthy
        ? `Tunnel healthy (${apiStatus?.connections ?? 0} edge connections)`
        : "Tunnel installed but no edge connections yet — check VM firewall (outbound 7844)",
    ))
    send(tunnelEvent("status", {
      running: healthy,
      tunnelId: provision.tunnel.id,
      connections: apiStatus?.connections ?? 0,
      mode: "api",
    }))

    // 5. Persist state.
    await saveTunnelStateToDb(host, baseDomain, provision.tunnel.id)
  } catch (err: any) {
    send(logEvent(`[cloudflare] Setup error: ${err?.message || "Unknown"}`))
    send(stageEvent("cloudflare-error", "error", err?.message || "Cloudflare setup failed"))
  } finally {
    if (ssh) {
      try { ssh.dispose() } catch {}
    }
  }
}
