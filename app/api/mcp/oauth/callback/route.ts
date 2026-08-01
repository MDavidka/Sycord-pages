import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import clientPromise from '@/lib/torso'
import { getOwnedProject } from '@/lib/project-chat-session'
import {
  getMcpProvider,
  resolveOAuthClientId,
  resolveOAuthClientSecret,
} from '@/lib/mcp-providers'
import {
  exchangeOAuthCode,
  mcpOAuthCallbackUrl,
  verifyMcpOAuthState,
} from '@/lib/mcp-oauth'
import { requireSyteWorkspaceUuid } from '@/lib/deploy/syte-workspace'
import { syteAgentMcpConnect, syteSetEnv, useSyteWorkspace } from '@/lib/deploy/syte-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Extract the origin that opened this popup.
 * The Referer header contains the origin of the page that initiated the OAuth flow.
 */
function getOpenerOrigin(request: Request): string {
  const referer = request.headers.get('referer') || ''
  if (referer) {
    try {
      const url = new URL(referer)
      return url.origin
    } catch {
      // Invalid referer, fall through
    }
  }
  // Fallback: use request origin
  const url = new URL(request.url)
  return url.origin
}

function popupHtml(payload: Record<string, unknown>, openerOrigin?: string) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  const targetOrigin = openerOrigin ? JSON.stringify(openerOrigin) : "'*'"
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>MCP connected</title></head>
<body style="background:#111;color:#eee;font:14px system-ui;display:grid;place-items:center;height:100vh;margin:0">
  <p>${payload.ok ? 'Connected — you can close this window.' : 'Connection failed.'}</p>
  <script>
    (function () {
      var payload = ${json};
      var targetOrigin = ${targetOrigin};
      try {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage({ type: 'sycord-mcp-oauth', ...payload }, targetOrigin);
        }
      } catch (e) {
        console.error('[v0] postMessage failed:', e.message);
      }
      setTimeout(function () { window.close(); }, 1200);
    })();
  </script>
</body></html>`
}

async function upsertProjectEnvVars(
  userId: string,
  projectId: string,
  tokens: Record<string, string>,
  integration: string,
) {
  const client = await clientPromise
  const db = client.db()
  for (const [key, value] of Object.entries(tokens)) {
    if (!key || !value) continue
    await db.collection('users').updateOne(
      { id: userId, 'projects._id': projectId },
      { $pull: { 'projects.$.envVars': { key } } as any },
    )
    await db.collection('users').updateOne(
      { id: userId, 'projects._id': projectId },
      {
        $push: {
          'projects.$.envVars': {
            key,
            value,
            integration,
            addedAt: new Date(),
          },
        } as any,
      },
    )
  }
}

/**
 * GET /api/mcp/oauth/callback?code=&state=
 * Completes MCP OAuth, stores tokens on the project, and enables the Syte MCP addon.
 */
export async function GET(request: Request) {
  const openerOrigin = getOpenerOrigin(request)
  const session = await getServerSession(authOptions)
  const url = new URL(request.url)
  const code = (url.searchParams.get('code') || '').trim()
  const stateRaw = (url.searchParams.get('state') || '').trim()
  const oauthError = url.searchParams.get('error')

  if (oauthError) {
    return new Response(
      popupHtml({
        ok: false,
        error: oauthError,
        errorDescription: url.searchParams.get('error_description') || undefined,
      }, openerOrigin),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  if (!session?.user?.id) {
    return new Response(popupHtml({ ok: false, error: 'unauthorized' }, openerOrigin), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const state = verifyMcpOAuthState(stateRaw)
  if (!state || state.userId !== session.user.id) {
    return new Response(popupHtml({ ok: false, error: 'invalid_state' }, openerOrigin), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (!code) {
    return new Response(popupHtml({ ok: false, error: 'missing_code' }, openerOrigin), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const provider = getMcpProvider(state.addon)
  if (!provider || provider.authType !== 'oauth') {
    return new Response(popupHtml({ ok: false, error: 'unknown_provider' }, openerOrigin), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const clientId = resolveOAuthClientId(provider)
  const clientSecret = resolveOAuthClientSecret(provider)
  if (!clientId || !clientSecret) {
    return new Response(popupHtml({ ok: false, error: 'oauth_not_configured' }, openerOrigin), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, state.projectId)
  if (!project) {
    return new Response(popupHtml({ ok: false, error: 'project_not_found' }, openerOrigin), {
      status: 404,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const redirectUri = mcpOAuthCallbackUrl(url.origin)
  const exchanged = await exchangeOAuthCode({
    provider,
    code,
    redirectUri,
    clientId,
    clientSecret,
  })
  if (exchanged.error || Object.keys(exchanged.tokens).length === 0) {
    return new Response(
      popupHtml({ ok: false, error: exchanged.error || 'token_exchange_failed', addon: provider.id }, openerOrigin),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  await upsertProjectEnvVars(session.user.id, state.projectId, exchanged.tokens, provider.id)

  // The agent runtime reads MCP credentials from the workspace environment,
  // so sync OAuth tokens before enabling the addon. Storing them only in the
  // Pages project document makes OAuth look complete while the agent still
  // cannot authenticate its MCP tools.
  let connectError: string | undefined
  if (!useSyteWorkspace()) {
    connectError = 'Syte workspace is not configured.'
  } else {
    const workspace = await requireSyteWorkspaceUuid(project, state.projectId)
    if (!('error' in workspace)) {
      const synced = await syteSetEnv(workspace.uuid, exchanged.tokens, true)
      if (!synced.ok) {
        connectError = synced.error || 'Failed to sync MCP credentials to Syte.'
      } else {
        const connected = await syteAgentMcpConnect(workspace.uuid, provider.id)
        if (!connected.ok) {
          connectError = connected.error || 'Failed to enable MCP addon on Syte.'
        }
      }
    } else {
      connectError = workspace.error
    }
  }

  return new Response(
    popupHtml({
      ok: !connectError,
      addon: provider.id,
      projectId: state.projectId,
      connectError,
    }, openerOrigin),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
