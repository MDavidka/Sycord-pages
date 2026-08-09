import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject, getProjectOwnerUserId } from "@/lib/project-id"
import {
  getMcpProvider,
  resolveOAuthClientId,
  resolveOAuthClientSecret,
} from "@/lib/mcp-providers"
import {
  buildAuthorizeUrl,
  createMcpOAuthNonce,
  mcpOAuthCallbackUrl,
  signMcpOAuthState,
} from "@/lib/mcp-oauth"
import { prepareOAuthConnection } from "@/lib/mcp-connections"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Start OAuth for a durable project connection. The state is bound to the
 * connection record rather than trusting a project/provider pair on callback.
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = (searchParams.get("projectId") || "").trim()
  const addon = (searchParams.get("addon") || "").trim()
  const integrationMode = searchParams.get("integrationMode") === "true"
  if (!projectId || !addon) {
    return Response.json({ message: "projectId and addon are required." }, { status: 400 })
  }

  const provider = getMcpProvider(addon)
  if (!provider || provider.authType !== "oauth") {
    return Response.json({ message: "This MCP does not use OAuth." }, { status: 400 })
  }

  const clientId = resolveOAuthClientId(provider)
  const clientSecret = resolveOAuthClientSecret(provider)
  if (!clientId || !clientSecret) {
    return Response.json(
      {
        message: `OAuth is not configured for ${provider.name}. Set ${provider.oauthClientIdEnv} and ${provider.oauthClientSecretEnv} (or shared Google/GitHub client envs).`,
        needsConfig: true,
        provider: provider.id,
      },
      { status: 503 },
    )
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, projectId)
  if (!project) return Response.json({ message: "Project not found" }, { status: 404 })
  if (getProjectOwnerUserId(project, session.user.id) !== session.user.id) {
    return Response.json({ message: "Only the project owner can manage MCP connections." }, { status: 403 })
  }

  const nonce = createMcpOAuthNonce()
  const expiresAt = Date.now() + 15 * 60 * 1000

  let connectionId = "env-mode"
  if (!integrationMode) {
    const connection = await prepareOAuthConnection(
      db,
      session.user.id,
      projectId,
      provider,
      nonce,
      expiresAt,
    )
    connectionId = connection.connectionId
  }

  const origin = new URL(request.url).origin
  const redirectUri = mcpOAuthCallbackUrl(origin)
  const state = signMcpOAuthState({
    connectionId,
    projectId,
    providerId: provider.id,
    addon: provider.id,
    userId: session.user.id,
    nonce,
    integrationMode: integrationMode || undefined,
  })
  const authorizeUrl = buildAuthorizeUrl({ provider, clientId, redirectUri, state })
  if (!authorizeUrl) return Response.json({ message: "Failed to build authorize URL." }, { status: 500 })

  if (searchParams.get("format") === "json") {
    return Response.json({
      ok: true,
      authorizeUrl,
      redirectUri,
      provider: provider.id,
      connectionId,
    })
  }
  return Response.redirect(authorizeUrl, 302)
}
