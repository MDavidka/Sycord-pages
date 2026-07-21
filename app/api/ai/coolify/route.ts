// Coolify MCP proxy for Syra — server-side Coolify API bridge.
// POST /api/ai/coolify  { action, applicationUuid?, deploymentUuid?, command?, force?, envs? }

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

export async function POST(req: Request): Promise<Response> {
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
