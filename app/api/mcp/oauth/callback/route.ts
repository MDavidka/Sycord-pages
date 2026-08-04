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
import { syteAgentMcpConnect, syteAgentMcpRegister, syteSetEnv, useSyteWorkspace } from '@/lib/deploy/syte-client'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function popupHtml(payload: Record<string, unknown>) {
  const json = JSON.stringify(payload).replace(/</g, '\\u003c')
  const errorDetail = payload.connectError || payload.errorDescription || payload.error || ''
  const statusHtml = payload.ok
    ? 'Connected — you can close this window.'
    : `Connection failed.${errorDetail ? `<br><small style="opacity:.7;word-break:break-word">${String(errorDetail).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</small>` : ''}`
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>MCP connected</title></head>
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
      }),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }

  if (!session?.user?.id) {
    return new Response(popupHtml({ ok: false, error: 'unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const state = verifyMcpOAuthState(stateRaw)
  if (!state || state.userId !== session.user.id) {
    return new Response(popupHtml({ ok: false, error: 'invalid_state' }), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (!code) {
    return new Response(popupHtml({ ok: false, error: 'missing_code' }), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const provider = getMcpProvider(state.addon)
  if (!provider || provider.authType !== 'oauth') {
    return new Response(popupHtml({ ok: false, error: 'unknown_provider' }), {
      status: 400,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const clientId = resolveOAuthClientId(provider)
  const clientSecret = resolveOAuthClientSecret(provider)
  if (!clientId || !clientSecret) {
    return new Response(popupHtml({ ok: false, error: 'oauth_not_configured' }), {
      status: 503,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, state.projectId)
  if (!project) {
    return new Response(popupHtml({ ok: false, error: 'project_not_found' }), {
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
      popupHtml({ ok: false, error: exchanged.error || 'token_exchange_failed', addon: provider.id }),
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
        // OAuth providers are not Syte built-ins — register as a custom stdio
        // addon first, then connect. Without registration Syte returns
        // "MCP addon not found: <id>".
        const spec = provider.mcpRegisterSpec
        if (spec) {
          // Build per-workspace env snapshot from the tokens we just synced.
          const envForAddon: Record<string, string> = {}
          for (const key of spec.envKeys) {
            if (exchanged.tokens[key]) envForAddon[key] = exchanged.tokens[key]
          }
          const registered = await syteAgentMcpRegister(workspace.uuid, {
            name: provider.id,
            command: spec.command,
            args: spec.args,
            env: Object.keys(envForAddon).length ? envForAddon : undefined,
            description: provider.description,
          })
          if (!registered.ok) {
            connectError = registered.error || 'Failed to register MCP addon on Syte.'
          }
        }

        if (!connectError) {
          const connected = await syteAgentMcpConnect(workspace.uuid, provider.id)
          if (!connected.ok) {
            connectError = connected.error || 'Failed to enable MCP addon on Syte.'
          }
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
      // Expose under both keys so listeners that check `error` also get the detail.
      ...(connectError ? { error: connectError } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
