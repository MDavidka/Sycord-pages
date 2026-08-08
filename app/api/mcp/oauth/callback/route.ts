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
  exchangeOAuthCode,
  mcpOAuthCallbackUrl,
  verifyMcpOAuthState,
} from "@/lib/mcp-oauth"
import {
  completeMcpConnection,
  consumeOAuthConnectionState,
} from "@/lib/mcp-connections"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function popupHtml(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c")
  const errorDetail = payload.errorDescription || payload.error || ""
  const statusHtml = payload.ok
    ? "Connected — you can close this window."
    : `Connection failed.${errorDetail ? `<br><small style="opacity:.7;word-break:break-word">${String(errorDetail).replace(/</g, "&lt;").replace(/>/g, "&gt;")}</small>` : ""}`
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>MCP connection</title></head>
<body style="background:#111;color:#eee;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0;padding:1rem">
  <p style="text-align:center;max-width:360px">${statusHtml}</p>
  <script>
    (function () {
      var payload = ${json};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'sycord-mcp-oauth', ...payload }, window.location.origin);
        }
      } catch (e) {}
      setTimeout(function () { window.close(); }, ${payload.ok ? 600 : 3000});
    })();
  </script>
</body></html>`
}

function htmlResponse(payload: Record<string, unknown>, status: number) {
  return new Response(popupHtml(payload), {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  })
}

/** Completes a one-time OAuth authorization into an encrypted connection. */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = (url.searchParams.get("code") || "").trim()
  const stateRaw = (url.searchParams.get("state") || "").trim()
  const oauthError = url.searchParams.get("error")

  if (oauthError) {
    return htmlResponse(
      {
        ok: false,
        error: oauthError,
        errorDescription: url.searchParams.get("error_description") || undefined,
      },
      400,
    )
  }

  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return htmlResponse({ ok: false, error: "unauthorized" }, 401)
  if (!code) return htmlResponse({ ok: false, error: "missing_code" }, 400)

  let state
  try {
    state = verifyMcpOAuthState(stateRaw)
  } catch {
    state = null
  }
  if (!state || state.userId !== session.user.id) {
    return htmlResponse({ ok: false, error: "invalid_state" }, 400)
  }

  const provider = getMcpProvider(state.providerId)
  if (!provider || provider.authType !== "oauth") {
    return htmlResponse({ ok: false, error: "unknown_provider" }, 400)
  }

  const clientId = resolveOAuthClientId(provider)
  const clientSecret = resolveOAuthClientSecret(provider)
  if (!clientId || !clientSecret) {
    return htmlResponse({ ok: false, error: "oauth_not_configured" }, 503)
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, state.projectId)
  if (!project) return htmlResponse({ ok: false, error: "project_not_found" }, 404)
  if (getProjectOwnerUserId(project, session.user.id) !== session.user.id) {
    return htmlResponse({ ok: false, error: "project_owner_required" }, 403)
  }

  const connection = await consumeOAuthConnectionState(db, state, state.nonce)
  if (!connection) return htmlResponse({ ok: false, error: "oauth_state_consumed_or_expired" }, 400)

  let exchanged
  try {
    exchanged = await exchangeOAuthCode({
      provider,
      code,
      redirectUri: mcpOAuthCallbackUrl(url.origin),
      clientId,
      clientSecret,
    })
  } catch (error: any) {
    return htmlResponse({ ok: false, addon: provider.id, error: error?.message || "token_exchange_failed" }, 502)
  }
  if (!exchanged.credentials) {
    return htmlResponse({ ok: false, error: exchanged.error || "token_exchange_failed", addon: provider.id }, 400)
  }

  try {
    const result = await completeMcpConnection({
      db,
      connection,
      project,
      credentials: exchanged.credentials,
    })
    if (!result.ok) {
      return htmlResponse(
        { ok: false, addon: provider.id, projectId: state.projectId, error: result.error || "connection_sync_failed" },
        200,
      )
    }
    return htmlResponse(
      {
        ok: true,
        addon: provider.id,
        projectId: state.projectId,
        connectionId: result.connection.connectionId,
      },
      200,
    )
  } catch (error: any) {
    return htmlResponse(
      { ok: false, addon: provider.id, error: error?.message || "connection_failed" },
      500,
    )
  }
}
