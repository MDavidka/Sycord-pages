// Coolify MCP proxy for Syra — server-side Coolify API bridge.
// POST /api/ai/coolify  { action, applicationUuid?, deploymentUuid?, command?, force?, envs? }

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { requireAdmin } from "@/lib/is-admin"
import { checkRateLimit } from "@/lib/security/rate-limit"
import { formatCoolifyMcpForAI, runCoolifyMcpAction, type CoolifyMcpAction } from "@/lib/deploy/coolify-mcp-actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

const ALLOWED: CoolifyMcpAction[] = [
  "health",
  "version",
  "list_projects",
  "create_project",
  "list_servers",
  "list_applications",
  "get_application",
  "deploy_application",
  "restart_application",
  "stop_application",
  "start_application",
  "list_deployments",
  "get_deployment",
  "get_application_logs",
  "bulk_update_envs",
  "execute_command",
]

/** Destructive / privileged actions require admin (not just any signed-in user). */
const ADMIN_ONLY: CoolifyMcpAction[] = [
  "create_project",
  "deploy_application",
  "restart_application",
  "stop_application",
  "start_application",
  "bulk_update_envs",
  "execute_command",
]

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const rate = checkRateLimit(`coolify-mcp:${userId}`, { limit: 30, windowMs: 60_000 })
  if (!rate.allowed) {
    return Response.json(
      { error: "Rate limit exceeded" },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSec) } },
    )
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const action = String(body?.action || "") as CoolifyMcpAction
  if (!ALLOWED.includes(action)) {
    return Response.json(
      { error: `Invalid action. Allowed: ${ALLOWED.join(", ")}` },
      { status: 400 },
    )
  }

  if (ADMIN_ONLY.includes(action)) {
    try {
      await requireAdmin()
    } catch {
      return Response.json({ error: "Forbidden: admin required for this Coolify action" }, { status: 403 })
    }
  }

  const result = await runCoolifyMcpAction({
    action,
    uuid: body?.uuid,
    applicationUuid: body?.applicationUuid || body?.applicationId,
    deploymentUuid: body?.deploymentUuid || body?.deploymentId,
    force: Boolean(body?.force),
    command: body?.command,
    name: body?.name,
    description: body?.description,
    envs: Array.isArray(body?.envs) ? body.envs : undefined,
  })

  return Response.json({
    summary: formatCoolifyMcpForAI(result),
    ...result,
  })
}
