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
  const isError = !payload.ok
  const errorMsg = payload.connectError || payload.error || ''
  const displayError = String(errorMsg).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${isError ? 'MCP Connection Failed' : 'MCP Connected'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0a;
    color: #e0e0e0;
    font: 14px system-ui, -apple-system, sans-serif;
    display: grid;
    place-items: center;
    height: 100vh;
    padding: 20px;
  }
  .container {
    width: 100%;
    max-width: 500px;
    border-radius: 8px;
    padding: 24px;
  }
  .success {
    background: #1a3a1a;
    border: 1px solid #2d5a2d;
  }
  .error {
    background: #3a1a1a;
    border: 1px solid #5a2d2d;
  }
  .status {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    font-size: 16px;
    font-weight: 500;
  }
  .icon {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
  }
  .success .icon { background: #4a7c4a; color: #7eff7e; }
  .error .icon { background: #7c4a4a; color: #ff7e7e; }
  .message {
    margin-bottom: 16px;
    line-height: 1.5;
  }
  .success .message { color: #9cff9c; }
  .error .message { color: #ff9c9c; }
  .error-details {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 4px;
    padding: 12px;
    margin: 16px 0;
    font-size: 12px;
    color: #aaa;
    font-family: 'Monaco', 'Courier New', monospace;
    max-height: 200px;
    overflow-y: auto;
    word-break: break-all;
  }
  .debug-info {
    font-size: 12px;
    color: #666;
    margin-top: 16px;
    border-top: 1px solid #333;
    padding-top: 12px;
  }
  .closing {
    font-size: 12px;
    color: #888;
    margin-top: 12px;
  }
</style>
</head>
<body>
  <div class="container ${isError ? 'error' : 'success'}">
    <div class="status">
      <div class="icon">${isError ? '✕' : '✓'}</div>
      <span>${isError ? 'Connection Failed' : 'Connected Successfully'}</span>
    </div>
    <div class="message">
      ${isError ? 'MCP OAuth connection encountered an error:' : 'MCP OAuth tokens were received and synced to Sycord.'}
    </div>
    ${isError ? '<div class="error-details"><strong>Error:</strong> ' + displayError + '</div>' : ''}
    <div class="debug-info">
      <strong>Details:</strong><br>
      Addon: ${payload.addon || 'unknown'}<br>
      Project: ${payload.projectId || 'unknown'}<br>
      Timestamp: ${new Date().toISOString()}
    </div>
    <div class="closing">
      <em>Window closing in <span id="counter">2</span> seconds...</em>
    </div>
  </div>
  <script>
    (function () {
      var payload = ${json};
      var targetOrigin = ${targetOrigin};
      var counter = 2;
      
      // Update counter
      var counterEl = document.getElementById('counter');
      setInterval(function() {
        counter--;
        if (counterEl) counterEl.textContent = Math.max(0, counter);
      }, 1000);
      
      // Send message to opener
      try {
        if (window.opener && !window.opener.closed) {
          console.log('[v0-popup] Sending message:', payload);
          window.opener.postMessage({ type: 'sycord-mcp-oauth', ...payload }, targetOrigin);
        } else {
          console.warn('[v0-popup] No opener or opener is closed');
        }
      } catch (e) {
        console.error('[v0-popup] postMessage failed:', e.message);
      }
      
      // Close after 2 seconds
      setTimeout(function () {
        window.close();
      }, 2000);
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
  const requestId = Math.random().toString(36).slice(2, 9)
  console.log(`[MCP-OAuth-${requestId}] Callback initiated from origin: ${openerOrigin}`)
  
  const session = await getServerSession(authOptions)
  const url = new URL(request.url)
  const code = (url.searchParams.get('code') || '').trim()
  const stateRaw = (url.searchParams.get('state') || '').trim()
  const oauthError = url.searchParams.get('error')

  console.log(`[MCP-OAuth-${requestId}] Session user: ${session?.user?.id || 'none'}, has code: ${!!code}, has state: ${!!stateRaw}`)

  if (oauthError) {
    const errorMsg = `OAuth provider error: ${oauthError} - ${url.searchParams.get('error_description') || 'no description'}`
    console.error(`[MCP-OAuth-${requestId}] ${errorMsg}`)
    return new Response(
      popupHtml({
        ok: false,
        error: errorMsg,
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
  console.log(`[MCP-OAuth-${requestId}] Exchanging OAuth code for tokens...`)
  const exchanged = await exchangeOAuthCode({
    provider,
    code,
    redirectUri,
    clientId,
    clientSecret,
  })
  if (exchanged.error || Object.keys(exchanged.tokens).length === 0) {
    const errorMsg = `Token exchange failed: ${exchanged.error || 'no tokens received'}`
    console.error(`[MCP-OAuth-${requestId}] ${errorMsg}`)
    return new Response(
      popupHtml({ ok: false, error: errorMsg, addon: provider.id }, openerOrigin),
      { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    )
  }
  console.log(`[MCP-OAuth-${requestId}] Token exchange successful, tokens: ${Object.keys(exchanged.tokens).join(', ')}`)

  await upsertProjectEnvVars(session.user.id, state.projectId, exchanged.tokens, provider.id)

  // The agent runtime reads MCP credentials from the workspace environment,
  // so sync OAuth tokens before enabling the addon. Storing them only in the
  // Pages project document makes OAuth look complete while the agent still
  // cannot authenticate its MCP tools.
  let connectError: string | undefined
  console.log(`[MCP-OAuth-${requestId}] Starting Sycord sync... useSyteWorkspace=${useSyteWorkspace()}`)
  
  // Map OAuth token field names to MCP provider env var names
  const envVarsToSync: Record<string, string> = {}
  const expectedEnvKeys = provider.envKeys || []
  console.log(`[MCP-OAuth-${requestId}] Expected env keys for ${provider.id}: ${expectedEnvKeys.join(', ')}`)
  
  // For GitHub and similar providers, map 'access_token' or 'token' to the expected env var
  for (const expectedKey of expectedEnvKeys) {
    // Try to find matching token from exchanged.tokens
    const tokenValue = exchanged.tokens[expectedKey] || exchanged.tokens.access_token || exchanged.tokens.token
    if (tokenValue) {
      envVarsToSync[expectedKey] = tokenValue
      console.log(`[MCP-OAuth-${requestId}] Mapped token to: ${expectedKey}`)
    } else {
      console.warn(`[MCP-OAuth-${requestId}] No token found for expected env key: ${expectedKey}`)
    }
  }
  
  // Also include any additional tokens that might be needed
  for (const [key, value] of Object.entries(exchanged.tokens)) {
    if (!envVarsToSync[key]) {
      envVarsToSync[key] = value
    }
  }
  
  console.log(`[MCP-OAuth-${requestId}] Final env vars to sync: ${Object.keys(envVarsToSync).join(', ')}`)
  
  if (!useSyteWorkspace()) {
    connectError = 'Syte workspace is not configured. Check SYTE_WORKSPACE_ID or DEPLOYER_API_KEY.'
    console.error(`[MCP-OAuth-${requestId}] ${connectError}`)
  } else {
    console.log(`[MCP-OAuth-${requestId}] Getting workspace UUID for project: ${state.projectId}`)
    const workspace = await requireSyteWorkspaceUuid(project, state.projectId)
    if (!('error' in workspace)) {
      console.log(`[MCP-OAuth-${requestId}] Got workspace UUID: ${workspace.uuid}`)
      console.log(`[MCP-OAuth-${requestId}] Syncing environment variables to Sycord...`)
      
      // Retry logic for transient Sycord API errors (502, 503, etc.)
      let synced = await syteSetEnv(workspace.uuid, envVarsToSync, true)
      
      if (!synced.ok && (synced.status === 502 || synced.status === 503 || synced.status === 504)) {
        console.warn(`[MCP-OAuth-${requestId}] Sycord API returned ${synced.status}, retrying in 1 second...`)
        // Wait 1 second and retry
        await new Promise(r => setTimeout(r, 1000))
        synced = await syteSetEnv(workspace.uuid, envVarsToSync, true)
        console.log(`[MCP-OAuth-${requestId}] Retry result: ok=${synced.ok}, status=${synced.status}`)
      }
      
      if (!synced.ok) {
        connectError = `Failed to sync to Sycord: ${synced.error || `status ${synced.status}`}`
        console.error(`[MCP-OAuth-${requestId}] ${connectError} (endpoint: ${synced.endpoint})`)
      } else {
        console.log(`[MCP-OAuth-${requestId}] Env synced successfully. Enabling MCP addon: ${provider.id}`)
        const connected = await syteAgentMcpConnect(workspace.uuid, provider.id)
        if (!connected.ok) {
          connectError = `Failed to enable addon on Sycord: ${connected.error || `status ${connected.status}`}`
          console.error(`[MCP-OAuth-${requestId}] ${connectError} (endpoint: ${connected.endpoint})`)
        } else {
          console.log(`[MCP-OAuth-${requestId}] MCP addon connected successfully!`)
        }
      }
    } else {
      connectError = `Failed to get workspace: ${workspace.error || 'unknown error'}`
      console.error(`[MCP-OAuth-${requestId}] ${connectError}`)
    }
  }
  
  console.log(`[MCP-OAuth-${requestId}] Final result - ok=${!connectError}, error=${connectError || 'none'}`)

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
