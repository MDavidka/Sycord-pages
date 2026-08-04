import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import {
  syteAgentConnectionConnect,
  syteAgentConnectionDisconnect,
  syteAgentConnectionList,
  syteAgentConnectionRegister,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/projects/[id]/agent/connection
 * → GET /api/agent_mcp?uuid=
 *
 * POST /api/projects/[id]/agent/connection
 * body:
 *   { action: "connect"|"disconnect", addon }
 *   { action: "register", name, command, args?, env?, description? }
 *
 * Docs: https://sycord.site/api/#agent
 */
async function loadOwnedWorkspace(projectId: string, userId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) return { error: Response.json({ message: "Project not found" }, { status: 404 }) }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return {
      error: Response.json({ message: workspace.error, needsCreate: true }, { status: 409 }),
    }
  }
  return { uuid: workspace.uuid }
}

function isConnectionConnected(addon: {
  status?: string
  connected?: boolean
  enabled?: boolean
}): boolean {
  if (addon.connected === true || addon.enabled === true) return true
  const status = (addon.status || "").toLowerCase()
  return status === "connected" || status === "enabled" || status === "active" || status === "running"
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  if (!projectId) {
    return Response.json({ message: "Project ID is required." }, { status: 400 })
  }

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error

  const listed = await syteAgentConnectionList(loaded.uuid)
  if (!listed.ok) {
    return Response.json(
      { message: listed.error || "Failed to list connection addons." },
      { status: listed.status || 502 },
    )
  }

  const addons = (listed.data?.addons || []).map((addon) => ({
    ...addon,
    connected: isConnectionConnected(addon),
  }))

  return Response.json({
    ok: true,
    uuid: loaded.uuid,
    addons,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  let body: {
    action?: unknown
    addon?: unknown
    name?: unknown
    command?: unknown
    args?: unknown
    env?: unknown
    description?: unknown
  } | null = null
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : ""
  if (!projectId || !action) {
    return Response.json({ message: "Project ID and action are required." }, { status: 400 })
  }

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error

  if (action === "connect" || action === "disconnect") {
    const addon =
      (typeof body?.addon === "string" && body.addon.trim()) ||
      (typeof body?.name === "string" && body.name.trim()) ||
      ""
    if (!addon) {
      return Response.json({ message: "addon is required." }, { status: 400 })
    }

    const result =
      action === "connect"
        ? await syteAgentConnectionConnect(loaded.uuid, addon)
        : await syteAgentConnectionDisconnect(loaded.uuid, addon)

    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.error || `Failed to ${action} connection addon.` },
        { status: result.status || 502 },
      )
    }

    const listed = await syteAgentConnectionList(loaded.uuid)
    const addons = listed.ok
      ? (listed.data?.addons || []).map((item) => ({
          ...item,
          connected: isConnectionConnected(item),
        }))
      : undefined

    return Response.json({
      ok: true,
      uuid: loaded.uuid,
      action,
      addon,
      addons,
    })
  }

  if (action === "register") {
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const command = typeof body?.command === "string" ? body.command.trim() : ""
    if (!name || !command) {
      return Response.json({ message: "name and command are required to register connection." }, { status: 400 })
    }

    const args = Array.isArray(body?.args)
      ? body.args.filter((v): v is string => typeof v === "string")
      : undefined
    const env =
      body?.env && typeof body.env === "object" && !Array.isArray(body.env)
        ? Object.fromEntries(
            Object.entries(body.env as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined
    const description = typeof body?.description === "string" ? body.description.trim() : undefined

    const registered = await syteAgentConnectionRegister(loaded.uuid, {
      name,
      command,
      args,
      env,
      description,
    })
    if (!registered.ok) {
      return Response.json(
        { ok: false, message: registered.error || "Failed to register connection addon." },
        { status: registered.status || 502 },
      )
    }

    const listed = await syteAgentConnectionList(loaded.uuid)
    const addons = listed.ok
      ? (listed.data?.addons || []).map((item) => ({
          ...item,
          connected: isConnectionConnected(item),
        }))
      : undefined

    return Response.json({
      ok: true,
      uuid: loaded.uuid,
      action: "register",
      addon: registered.data?.addon || null,
      addons,
    })
  }

  return Response.json(
    { message: 'action must be "connect", "disconnect", or "register".' },
    { status: 400 },
  )
}

  const addons = (listed.data?.addons || []).map((addon) => ({
    ...addon,
    connected: isConnectionConnected(addon),
  }))

  return Response.json({
    ok: true,
    uuid: loaded.uuid,
    addons,
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params
  let body: {
    action?: unknown
    addon?: unknown
    name?: unknown
    command?: unknown
    args?: unknown
    env?: unknown
    description?: unknown
  } | null = null
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const action = typeof body?.action === "string" ? body.action.trim().toLowerCase() : ""
  if (!projectId || !action) {
    return Response.json({ message: "Project ID and action are required." }, { status: 400 })
  }

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error

  if (action === "connect" || action === "disconnect") {
    const addon =
      (typeof body?.addon === "string" && body.addon.trim()) ||
      (typeof body?.name === "string" && body.name.trim()) ||
      ""
    if (!addon) {
      return Response.json({ message: "addon is required." }, { status: 400 })
    }

    const result =
      action === "connect"
        ? await syteAgentConnectionConnect(loaded.uuid, addon)
        : await syteAgentConnectionDisconnect(loaded.uuid, addon)

    if (!result.ok) {
      return Response.json(
        { ok: false, message: result.error || `Failed to ${action} connection addon.` },
        { status: result.status || 502 },
      )
    }

    const listed = await syteAgentConnectionList(loaded.uuid)
    const addons = listed.ok
      ? (listed.data?.addons || []).map((item) => ({
          ...item,
          connected: isConnectionConnected(item),
        }))
      : undefined

    return Response.json({
      ok: true,
      uuid: loaded.uuid,
      action,
      addon,
      addons,
    })
  }

  if (action === "register") {
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    const command = typeof body?.command === "string" ? body.command.trim() : ""
    if (!name || !command) {
      return Response.json({ message: "name and command are required to register connection." }, { status: 400 })
    }

    const args = Array.isArray(body?.args)
      ? body.args.filter((v): v is string => typeof v === "string")
      : undefined
    const env =
      body?.env && typeof body.env === "object" && !Array.isArray(body.env)
        ? Object.fromEntries(
            Object.entries(body.env as Record<string, unknown>).filter(
              (entry): entry is [string, string] => typeof entry[1] === "string",
            ),
          )
        : undefined
    const description = typeof body?.description === "string" ? body.description.trim() : undefined

    const registered = await syteAgentConnectionRegister(loaded.uuid, {
      name,
      command,
      args,
      env,
      description,
    })
    if (!registered.ok) {
      return Response.json(
        { ok: false, message: registered.error || "Failed to register connection addon." },
        { status: registered.status || 502 },
      )
    }

    const listed = await syteAgentConnectionList(loaded.uuid)
    const addons = listed.ok
      ? (listed.data?.addons || []).map((item) => ({
          ...item,
          connected: isConnectionConnected(item),
        }))
      : undefined

    return Response.json({
      ok: true,
      uuid: loaded.uuid,
      action: "register",
      addon: registered.data?.addon || null,
      addons,
    })
  }

  return Response.json(
    { message: 'action must be "connect", "disconnect", or "register".' },
    { status: 400 },
  )
}
