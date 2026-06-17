import {
  bootstrapDeployVmRunner,
  generateRunnerToken,
  probeDeployVmSsh,
  readDeployVmDiagnostics,
  installCloudflared,
  checkCloudflaredLogin,
  startCloudflaredLogin,
  pollCloudflaredCert,
  createCloudflaredTunnel,
  writeCloudflaredConfig,
  installCloudflaredService,
  getTunnelStatus,
  saveTunnelStateToDb,
  getTunnelStateFromDb,
  registerCloudflaredWildcardDns,
  resetCloudflaredTunnel,
  type VmSetupInput,
} from "@/lib/admin/vm-ssh"
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

async function getSshClient(sshInput?: VmSetupInput) {
  const { NodeSSH } = await import("node-ssh")
  const ssh = new NodeSSH()
  const host = sshInput?.host || process.env.VPS_SSH_HOST
  const password = sshInput?.password || process.env.VPS_SSH_ROOT_PASSWORD
  const port = sshInput?.port || Number(process.env.VPS_SSH_PORT || "22")
  if (!host || !password) throw new Error("Missing VM host or root password")
  await ssh.connect({ host, username: "root", password, port })
  return ssh
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
  try {
    const ssh = await getSshClient(sshInput)
    const logs: string[] = []
    const emitLog = (line: string) => {
      logs.push(line)
      send(logEvent(line))
    }

    if (reset) {
      emitLog("[cloudflare] === FULL TUNNEL RESET ===")
      const resetResult = await resetCloudflaredTunnel(ssh, baseDomain, logs)
      if (!resetResult.success) {
        send(stageEvent("cloudflare-error", "error", resetResult.error || "Reset failed"))
        send(tunnelEvent("login-needed", { url: null }))
        return
      }
      send(stageEvent("cloudflare-tunnel-reset", "success", "Tunnel reset and rebuilt successfully"))
      send(tunnelEvent("status", { running: true, reset: true }))

      await saveTunnelStateToDb(
        sshInput?.host || process.env.VPS_SSH_HOST || "",
        baseDomain,
        resetResult.tunnelId || "",
        resetResult.credentialsPath || "",
      )
      return
    }

    const state = await getTunnelStateFromDb()
    if (state?.configured) {
      emitLog("[cloudflare] Existing tunnel configuration found, verifying...")
      const status = await getTunnelStatus(ssh, logs)
      if (status.running) {
        send(stageEvent("cloudflare-check", "success", "Cloudflare Tunnel already running"))
        send(tunnelEvent("status", { running: true, info: status.info, alreadySetup: true }))
        ssh.dispose()
        return
      }
      emitLog("[cloudflare] Tunnel not running — reconfiguring...")
    }

    send(stageEvent("cloudflare-install", "running", "Installing cloudflared"))
    const installed = await installCloudflared(ssh, logs)
    if (!installed) {
      send(stageEvent("cloudflare-install", "error", "Failed to install cloudflared"))
      ssh.dispose()
      return
    }
    send(stageEvent("cloudflare-install", "success", "Cloudflared installed"))

    const { loggedIn } = await checkCloudflaredLogin(ssh, logs)
    if (!loggedIn) {
      send(stageEvent("cloudflare-auth", "running", "Starting Cloudflare authentication"))
      const login = await startCloudflaredLogin(ssh, logs)
      if (login.loginUrl) {
        send(tunnelEvent("login-needed", { url: login.loginUrl }))
        send(logEvent(`[cloudflare] Open this URL to authenticate: ${login.loginUrl}`))
        send(stageEvent("cloudflare-auth", "running", "Waiting for Cloudflare authentication — open the link shown above"))

        let certReady = false
        for (let i = 0; i < 90; i++) {
          await new Promise(resolve => setTimeout(resolve, 2000))
          const { ready } = await pollCloudflaredCert(ssh, logs)
          if (ready) {
            certReady = true
            break
          }
          if (i % 3 === 0) {
            send(logEvent(`[cloudflare] Waiting for browser authentication... (${Math.round((i + 1) * 2)}s elapsed)`))
          }
          // Every 15 seconds, send a keepalive so the connection doesn't timeout
          if (i % 7 === 0 && i > 0) {
            send(tunnelEvent("polling", { elapsed: Math.round((i + 1) * 2) }))
          }
        }

        if (!certReady) {
          send(stageEvent("cloudflare-auth", "error", "Authentication timed out — retry setup"))
          send(tunnelEvent("login-timeout", { message: "Cloudflare authentication timed out after 120s. Re-run setup to try again." }))
          ssh.dispose()
          return
        }
      }
      send(stageEvent("cloudflare-auth", "success", "Cloudflare authenticated"))
    }

    send(stageEvent("cloudflare-tunnel", "running", "Creating Cloudflare Tunnel"))
    const tunnel = await createCloudflaredTunnel(ssh, logs)
    if (!tunnel) {
      send(stageEvent("cloudflare-tunnel", "error", "Failed to create tunnel"))
      ssh.dispose()
      return
    }
    send(stageEvent("cloudflare-tunnel", "success", `Tunnel created: ${tunnel.tunnelId.slice(0, 8)}...`))

    send(stageEvent("cloudflare-config", "running", "Writing Cloudflare config"))
    const configOk = await writeCloudflaredConfig(ssh, tunnel.tunnelId, tunnel.credentialsPath, baseDomain, logs)
    if (!configOk) {
      send(stageEvent("cloudflare-config", "error", "Failed to write config"))
      ssh.dispose()
      return
    }
    send(stageEvent("cloudflare-config", "success", "Config written"))

    send(stageEvent("cloudflare-dns", "running", `Registering wildcard DNS *.${baseDomain}...`))
    const dnsResult = await registerCloudflaredWildcardDns(ssh, tunnel.tunnelId, baseDomain, logs)
    if (dnsResult.success) {
      send(stageEvent("cloudflare-dns", "success", `Wildcard DNS *.${baseDomain} registered`))
    } else {
      send(stageEvent("cloudflare-dns", "error", `DNS registration: ${dnsResult.detail}`))
    }

    send(stageEvent("cloudflare-service", "running", "Installing and starting Cloudflare service"))
    const serviceOk = await installCloudflaredService(ssh, logs)
    if (serviceOk) {
      send(stageEvent("cloudflare-service", "success", "Cloudflare Tunnel service running 24/7"))
      send(tunnelEvent("status", { running: true, info: "Tunnel active" }))
    } else {
      send(stageEvent("cloudflare-service", "error", "Service install failed — check logs"))
    }

    await saveTunnelStateToDb(
      sshInput?.host || process.env.VPS_SSH_HOST || "",
      baseDomain,
      tunnel.tunnelId,
      tunnel.credentialsPath,
    )

    ssh.dispose()
  } catch (err: any) {
    send(logEvent(`[cloudflare] Setup error: ${err?.message || "Unknown"}`))
    send(stageEvent("cloudflare-error", "error", err?.message || "Cloudflare setup failed"))
  }
}
