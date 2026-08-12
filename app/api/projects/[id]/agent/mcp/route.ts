import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { getProjectOwnerUserId } from "@/lib/project-id"
import { getMcpProvider } from "@/lib/mcp-providers"
import {
  completeMcpConnection,
  clearRemoteMcpCredentials,
  disconnectMcpConnection,
  ensureMcpConnection,
  getMcpConnection,
  listMcpConnections,
  migrateLegacyMcpCredentials,
  type McpCredentialSet,
} from "@/lib/mcp-connections"
import {
  syteAgentMcpDisconnect,
  syteAgentMcpList,
  syteAgentMcpRegister,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function loadOwnedWorkspace(projectId: string, userId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) return { error: Response.json({ message: "Project not found" }, { status: 404 }) }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return { error: Response.json({ message: workspace.error, needsCreate: true }, { status: 409 }) }
  }
  return { db, project, ownerId: getProjectOwnerUserId(project, userId), uuid: workspace.uuid }
}

function isMcpConnected(addon: { status?: string; connected?: boolean; enabled?: boolean }): boolean {
  if (addon.connected === true || addon.enabled === true) return true
  const status = (addon.status || "").toLowerCase()
  return status === "connected" || status === "enabled" || status === "active" || status === "running"
}

function mergeConnectionState(addons: any[], connections: any[]) {
  const byProvider = new Map(connections.map((connection) => [connection.providerId, connection]))
  const merged = addons.map((addon) => {
    const connection = byProvider.get(addon.id)
    if (!connection) return { ...addon, connected: isMcpConnected(addon) }
    return {
      ...addon,
      connected: connection.status === "connected",
      connectionStatus: connection.status,
      connectionId: connection.connectionId,
      lastError: connection.lastError || undefined,
    }
  })
  const remoteIds = new Set(addons.map((addon) => String(addon.id)))
  for (const connection of connections) {
    if (remoteIds.has(connection.providerId)) continue
    const provider = getMcpProvider(connection.providerId)
    if (!provider) continue
    merged.push({
      id: provider.id,
      name: provider.name,
      description: provider.description,
      connected: connection.status === "connected",
      status: connection.status,
      connectionStatus: connection.status,
      connectionId: connection.connectionId,
      authType: provider.authType,
      logo: provider.logo,
      envKeys: provider.envKeys,
      lastError: connection.lastError || undefined,
    })
  }
  return merged
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { id: projectId } = await params
  if (!projectId) return Response.json({ message: "Project ID is required." }, { status: 400 })

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error

  // Move credentials created by the old env endpoint into encrypted connections.
  try {
    await migrateLegacyMcpCredentials(loaded.db, loaded.ownerId, projectId)
  } catch (error) {
    console.error("[MCP] Legacy credential migration failed:", error)
  }
  const connections = await listMcpConnections(loaded.db, loaded.ownerId, projectId)
  const listed = await syteAgentMcpList(loaded.uuid)
  // A credential-backed integration can be valid even when Syte has not
  // registered a corresponding remote MCP addon. Do not turn that state into
  // a 502 or “addon not found”; the durable local connection is authoritative.
  const addons = listed.ok ? listed.data?.addons || [] : []

  return Response.json({
    ok: true,
    uuid: loaded.uuid,
    addons: mergeConnectionState(addons, connections),
    connections,
    remoteAddonError: listed.ok ? undefined : listed.error || "Remote addon unavailable",
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ message: "Unauthorized" }, { status: 401 })
  const { id: projectId } = await params
  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    return Response.json({ message: "Invalid JSON body" }, { status: 400 })
  }

  const action = typeof body.action === "string" ? body.action.trim().toLowerCase() : ""
  if (!projectId || !action) return Response.json({ message: "Project ID and action are required." }, { status: 400 })

  const loaded = await loadOwnedWorkspace(projectId, session.user.id)
  if ("error" in loaded) return loaded.error
  if (loaded.ownerId !== session.user.id) {
    return Response.json({ message: "Only the project owner can manage MCP connections." }, { status: 403 })
  }

  const addon = typeof body.addon === "string" ? body.addon.trim() : typeof body.name === "string" ? body.name.trim() : ""
  const provider = addon ? getMcpProvider(addon) : undefined

  if (action === "connect") {
    if (!provider) return Response.json({ message: "A known MCP provider is required." }, { status: 400 })
    if (provider.authType === "oauth") {
      return Response.json({ message: "Use the OAuth connection flow for this provider." }, { status: 400 })
    }

    const credentials: McpCredentialSet = provider.authType === "api_key"
      ? {
          apiKeys:
            body.credentials && typeof body.credentials === "object" && !Array.isArray(body.credentials)
              ? Object.fromEntries(
                  Object.entries(body.credentials as Record<string, unknown>).filter(
                    ([key, value]) => provider.envKeys?.includes(key) && typeof value === "string",
                  ),
                ) as Record<string, string>
              : {},
        }
      : {}
    const connection = await ensureMcpConnection(loaded.db, loaded.ownerId, projectId, provider)
    try {
      const result = await completeMcpConnection({
        db: loaded.db,
        connection,
        project: loaded.project,
        credentials,
      })
      if (!result.ok) return Response.json({ ok: false, message: result.error, connection: result.connection }, { status: 502 })
      return Response.json({ ok: true, action, addon: provider.id, connection: result.connection })
    } catch (error: any) {
      return Response.json({ ok: false, message: error?.message || "Failed to connect MCP" }, { status: 400 })
    }
  }

  if (action === "disconnect") {
    if (!provider) return Response.json({ message: "A known MCP provider is required." }, { status: 400 })
    const connection = await getMcpConnection(loaded.db, loaded.ownerId, projectId, provider.id)
    if (!connection) {
      const cleared = await clearRemoteMcpCredentials(loaded.uuid, provider.id)
      const disconnected = await syteAgentMcpDisconnect(loaded.uuid, provider.id)
      if (!cleared.ok || !disconnected.ok) {
        return Response.json({ ok: false, message: cleared.error || disconnected.error || "Failed to disconnect MCP provider" }, { status: 502 })
      }
      return Response.json({ ok: true, action, addon: provider.id, connection: null })
    }
    const result = await disconnectMcpConnection(loaded.db, connection, loaded.project)
    if (!result.ok) return Response.json({ ok: false, message: result.error }, { status: 502 })
    return Response.json({ ok: true, action, addon: provider.id })
  }

  if (action === "register") {
    const name = typeof body.name === "string" ? body.name.trim() : ""
    const command = typeof body.command === "string" ? body.command.trim() : ""
    if (!name || !command) return Response.json({ message: "name and command are required to register MCP." }, { status: 400 })

    if (body.env !== undefined) {
      return Response.json({ message: "Custom MCP environment values must be provisioned through a server-side connection." }, { status: 400 })
    }
    const args = Array.isArray(body.args) ? body.args.filter((value): value is string => typeof value === "string") : undefined
    const description = typeof body.description === "string" ? body.description.trim() : undefined
    const registered = await syteAgentMcpRegister(loaded.uuid, { name, command, args, description })
    if (!registered.ok) return Response.json({ ok: false, message: registered.error || "Failed to register MCP addon." }, { status: registered.status || 502 })
    return Response.json({ ok: true, action: "register", addon: registered.data?.addon || null })
  }

  return Response.json({ message: 'action must be "connect", "disconnect", or "register".' }, { status: 400 })
}
