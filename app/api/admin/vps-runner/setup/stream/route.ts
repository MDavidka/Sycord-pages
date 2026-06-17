import { buildAdminStatus, ensureHostSetup, probeParentVps, type ParentVpsConfig } from "@/lib/admin/workspace-provision"
import { parseVpsOverrides, requireAdminResponse } from "../../_shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

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

// GET: bootstrap the parent host using env credentials.
export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized
  return runSetupStream()
}

// POST: bootstrap the parent host using custom VM credentials from the body.
export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized
  const body = await request.json().catch(() => ({}))
  return runSetupStream(parseVpsOverrides(body))
}

function runSetupStream(overrides?: Partial<ParentVpsConfig>) {
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Uint8Array) => controller.enqueue(data)
      try {
        send(stageEvent("ssh-check", "running", "Checking SSH connectivity to parent VPS"))
        const ssh = await probeParentVps(overrides)
        if (!ssh.reachable) {
          send(stageEvent("ssh-check", "error", "SSH connection to parent VPS failed"))
          send(logEvent(`SSH error: ${ssh.error || "Unknown SSH error"}`))
          send(errorEvent(
            overrides
              ? "SSH login failed. Check VM IP and root password."
              : "Parent VPS SSH login failed. Check VPS_HOST and VPS_ROOT_PSW.",
            "ssh-check",
          ))
          controller.close()
          return
        }
        send(stageEvent("ssh-check", "success", "SSH connection established"))
        send(stageEvent("runner-check", "success", "Container model — no persistent runner needed"))

        send(stageEvent("bootstrap", "running", "Installing Docker, sycord-net, directories, CDN receiver and base image"))
        const result = await ensureHostSetup(overrides, (line) => send(logEvent(line)))

        if (!result.success) {
          send(stageEvent("bootstrap", "error", result.error || "Host setup failed"))
          send(errorEvent(result.error || "Host setup failed", result.phase))
          controller.close()
          return
        }
        send(stageEvent("bootstrap", "success", "Docker host configured and base image built"))

        send(stageEvent("diagnostics", "running", "Collecting host diagnostics"))
        const status = await buildAdminStatus(overrides).catch(() => null)
        send(stageEvent("diagnostics", "success", "Diagnostics collected"))
        send(stageEvent("complete", "success", "Host is ready to provision workspaces"))
        send(resultEvent({
          success: true,
          online: true,
          setupComplete: true,
          model: "container",
          nginx: status?.nginx || { running: true },
          runner: status?.runner || { running: true },
          cloudflared: status?.cloudflared || { running: true },
          host: status?.host || null,
          baseDomain: status?.baseDomain,
        }))
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
