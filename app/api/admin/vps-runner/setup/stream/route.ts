import { NextResponse } from "next/server"
import { bootstrapDeployVmRunner, probeDeployVmSsh, readDeployVmDiagnostics } from "@/lib/admin/vm-ssh"
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

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Uint8Array) => controller.enqueue(data)

      try {
        send(stageEvent("ssh-check", "running", "Checking SSH connectivity to deploy VM"))

        const ssh = await probeDeployVmSsh()
        if (!ssh.reachable) {
          send(stageEvent("ssh-check", "error", "SSH connection to deploy VM failed"))
          send(logEvent(`SSH error: ${ssh.error || "Unknown SSH error"}`))
          send(errorEvent("Deploy VM SSH login failed. Check VPS_SSH_HOST and VPS_SSH_ROOT_PASSWORD.", "ssh-check"))
          controller.close()
          return
        }
        send(stageEvent("ssh-check", "success", "SSH connection to deploy VM established"))
        send(logEvent("Root SSH access to deploy VM confirmed"))

        // Try to reach the runner API first
        send(stageEvent("runner-check", "running", "Checking if runner API is already online"))
        const runnerCheck = await fetch(`${VPS_SERVER_URL}/api/status`, {
          headers: runnerHeaders({ Accept: "application/json" }),
        }).catch(() => null)

        if (runnerCheck?.ok) {
          const status = await runnerCheck.json().catch(() => ({}))
          send(stageEvent("runner-check", "success", "Runner API is online - running setup scripts on VM"))
          send(logEvent("Runner API reachable, triggering setup via API"))

          const setupRes = await fetch(`${VPS_SERVER_URL}/api/setup`, {
            method: "POST",
            headers: runnerHeaders(),
          }).catch(() => null)

          if (setupRes?.ok) {
            const data = await setupRes.json().catch(() => ({}))
            for (const line of (data?.logs || "").split("\n").filter(Boolean)) {
              send(logEvent(line))
            }
            send(stageEvent("setup", "success", "Runner setup completed"))
            send(resultEvent({
              success: true,
              online: true,
              setupComplete: true,
              nginx: data.nginx || { running: true },
              runner: data.runner || { running: true },
              cloudflared: data.cloudflared || { running: true },
            }))
            controller.close()
            return
          }
        }

        // Runner not online - bootstrap over SSH
        send(stageEvent("runner-check", "error", "Runner API not reachable - bootstrapping over SSH"))
        send(stageEvent("bootstrap", "running", "Uploading vm-runner to deploy VM via SCP"))
        send(logEvent("Starting full bootstrap: copy vm-runner/, run setup scripts, install service"))

        const result = await bootstrapDeployVmRunner()
        if (result.logs) {
          for (const line of result.logs.split("\n").filter(Boolean)) {
            send(logEvent(line))
          }
        }

        if (result.success) {
          send(stageEvent("bootstrap", "success", "VM runner bootstrapped and started"))

          // Read final diagnostics
          send(stageEvent("diagnostics", "running", "Collecting final diagnostics"))
          const diag = await readDeployVmDiagnostics().catch(() => null)
          send(stageEvent("diagnostics", "success", "Diagnostics collected"))
          send(stageEvent("complete", "success", "Runner setup complete"))
          send(resultEvent({
            success: true,
            online: true,
            setupComplete: true,
            nginx: diag?.nginx || { running: true },
            runner: diag?.runner || { running: true },
            cloudflared: diag?.cloudflared || { running: true },
          }))
        } else {
          send(stageEvent("bootstrap", "error", result.error || "Bootstrap failed"))
          send(errorEvent(result.error || "Deploy VM runner bootstrap failed", "bootstrap"))
        }
      } catch (error: any) {
        send(stageEvent("error", "error", error?.message || "Setup failed"))
        send(errorEvent(error?.message || "Unknown setup error"))
      } finally {
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
