import { createHmac, timingSafeEqual } from 'crypto'
import type { ConnectionProviderDef } from '@/lib/connection-providers'

const STATE_TTL_MS = 15 * 60 * 1000

function stateSecret(): string {
  return (
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.CONNECTION_OAUTH_STATE_SECRET ||
    'sycord-connection-oauth-dev'
  )
}

export type ConnectionOAuthState = {
  v: 1
  projectId: string
  addon: string
  userId: string
  exp: number
}

export function signConnectionOAuthState(payload: Omit<ConnectionOAuthState, 'v' | 'exp'>): string {
  const body: ConnectionOAuthState = {
    v: 1,
    ...payload,
    exp: Date.now() + STATE_TTL_MS,
  }
  const json = Buffer.from(JSON.stringify(body)).toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(json).digest('base64url')
  return `${json}.${sig}`
}

export function verifyConnectionOAuthState(state: string): ConnectionOAuthState | null {
  const [json, sig] = state.split('.')
  if (!json || !sig) return null
  const expected = createHmac('sha256', stateSecret()).update(json).digest('base64url')
  try {
    const a = Buffer.from(sig)
    const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch {
    return null
  }
  try {
    const parsed = JSON.parse(Buffer.from(json, 'base64url').toString('utf8')) as ConnectionOAuthState
    if (parsed?.v !== 1 || !parsed.projectId || !parsed.addon || !parsed.userId) return null
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null
    return parsed
  } catch {
    return null
  }
}

export function connectionOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, '')}/api/connection/oauth/callback`
}

export function buildAuthorizeUrl(opts: {
  provider: ConnectionProviderDef
  clientId: string
  redirectUri: string
  state: string
}): string | null {
  const { provider, clientId, redirectUri, state } = opts
  if (!provider.authorizeUrl) return null
  const url = new URL(provider.authorizeUrl)

  if (provider.id === 'slack') {
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('scope', (provider.oauthScopes || []).join(','))
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('state', state)
    return url.toString()
  }

  if (provider.id === 'linear') {
    url.searchParams.set('client_id', clientId)
    url.searchParams.set('redirect_uri', redirectUri)
    url.searchParams.set('response_type', 'code')
    url.searchParams.set('scope', (provider.oauthScopes || []).join(','))
    url.searchParams.set('state', state)
    url.searchParams.set('prompt', 'consent')
    return url.toString()
  }

  // GitHub + Google-style
  url.searchParams.set('client_id', clientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('state', state)
  if (provider.oauthScopes?.length) {
    url.searchParams.set('scope', provider.oauthScopes.join(' '))
  }
  if (provider.id === 'google-drive' || provider.id === 'gmail') {
    url.searchParams.set('access_type', 'offline')
    url.searchParams.set('prompt', 'consent')
    url.searchParams.set('include_granted_scopes', 'true')
  }
  return url.toString()
}

export async function exchangeOAuthCode(opts: {
  provider: ConnectionProviderDef
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
}): Promise<{ tokens: Record<string, string>; error?: string }> {
  const { provider, code, redirectUri, clientId, clientSecret } = opts
  if (!provider.tokenUrl) return { tokens: {}, error: 'Token URL missing for provider.' }

  if (provider.id === 'github') {
    const res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      }),
    })
    const data = (await res.json().catch(() => null)) as {
      access_token?: string
      error?: string
      error_description?: string
    } | null
    if (!res.ok || !data?.access_token) {
      return {
        tokens: {},
        error: data?.error_description || data?.error || `GitHub token exchange failed (${res.status})`,
      }
    }
    return { tokens: { GITHUB_TOKEN: data.access_token } }
  }

  if (provider.id === 'slack') {
    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    })
    const res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    const data = (await res.json().catch(() => null)) as {
      ok?: boolean
      access_token?: string
      error?: string
    } | null
    if (!res.ok || !data?.ok || !data.access_token) {
      return { tokens: {}, error: data?.error || `Slack token exchange failed (${res.status})` }
    }
    return { tokens: { SLACK_BOT_TOKEN: data.access_token } }
  }

  // Linear + Google (Drive / Gmail)
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: 'authorization_code',
  })
  const res = await fetch(provider.tokenUrl, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const data = (await res.json().catch(() => null)) as {
    access_token?: string
    refresh_token?: string
    error?: string
    error_description?: string
  } | null
  if (!res.ok || !data?.access_token) {
    return {
      tokens: {},
      error: data?.error_description || data?.error || `Token exchange failed (${res.status})`,
    }
  }

  if (provider.id === 'linear') {
    return { tokens: { LINEAR_API_KEY: data.access_token } }
  }
  if (provider.id === 'google-drive') {
    const tokens: Record<string, string> = {
      GOOGLE_DRIVE_ACCESS_TOKEN: data.access_token,
    }
    if (data.refresh_token) tokens.GOOGLE_DRIVE_REFRESH_TOKEN = data.refresh_token
    return { tokens }
  }
  if (provider.id === 'gmail') {
    const tokens: Record<string, string> = {
      GMAIL_ACCESS_TOKEN: data.access_token,
    }
    if (data.refresh_token) tokens.GMAIL_REFRESH_TOKEN = data.refresh_token
    return { tokens }
  }

  return { tokens: {}, error: `Unsupported OAuth provider: ${provider.id}` }
}
