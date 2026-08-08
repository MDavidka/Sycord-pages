import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"
import type { McpProviderDef } from "@/lib/mcp-providers"

const STATE_TTL_MS = 15 * 60 * 1000

function stateSecret(): string {
  const secret = process.env.MCP_OAUTH_STATE_SECRET || process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
  if (!secret) throw new Error("MCP_OAUTH_STATE_SECRET or AUTH_SECRET must be configured")
  return secret
}

export type McpOAuthState = {
  v: 2
  connectionId: string
  projectId: string
  providerId: string
  /** Kept as an alias for older popup consumers. */
  addon: string
  userId: string
  nonce: string
  exp: number
}

export function createMcpOAuthNonce(): string {
  return randomBytes(32).toString("base64url")
}

export function signMcpOAuthState(
  payload: Omit<McpOAuthState, "v" | "exp">,
  ttlMs = STATE_TTL_MS,
): string {
  const body: McpOAuthState = {
    v: 2,
    ...payload,
    exp: Date.now() + ttlMs,
  }
  const json = Buffer.from(JSON.stringify(body)).toString("base64url")
  const sig = createHmac("sha256", stateSecret()).update(json).digest("base64url")
  return `${json}.${sig}`
}

export function verifyMcpOAuthState(state: string): McpOAuthState | null {
  const [json, sig] = state.split(".")
  if (!json || !sig) return null
  try {
    const expected = createHmac("sha256", stateSecret()).update(json).digest("base64url")
    const actual = Buffer.from(sig)
    const expectedBuffer = Buffer.from(expected)
    if (actual.length !== expectedBuffer.length || !timingSafeEqual(actual, expectedBuffer)) return null

    const parsed = JSON.parse(Buffer.from(json, "base64url").toString("utf8")) as McpOAuthState
    if (
      parsed?.v !== 2 ||
      !parsed.connectionId ||
      !parsed.projectId ||
      !parsed.providerId ||
      !parsed.userId ||
      !parsed.nonce ||
      typeof parsed.exp !== "number" ||
      parsed.exp < Date.now()
    ) {
      return null
    }
    return { ...parsed, addon: parsed.addon || parsed.providerId }
  } catch {
    return null
  }
}

export function mcpOAuthCallbackUrl(origin: string): string {
  return `${origin.replace(/\/$/, "")}/api/mcp/oauth/callback`
}

export function buildAuthorizeUrl(opts: {
  provider: McpProviderDef
  clientId: string
  redirectUri: string
  state: string
}): string | null {
  const { provider, clientId, redirectUri, state } = opts
  if (!provider.authorizeUrl) return null
  const url = new URL(provider.authorizeUrl)

  if (provider.id === "slack") {
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("scope", (provider.oauthScopes || []).join(","))
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("state", state)
    return url.toString()
  }

  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("response_type", "code")
  url.searchParams.set("state", state)
  if (provider.oauthScopes?.length) {
    url.searchParams.set("scope", provider.oauthScopes.join(" "))
  }
  if (provider.id === "google-drive" || provider.id === "gmail") {
    url.searchParams.set("access_type", "offline")
    url.searchParams.set("prompt", "consent")
    url.searchParams.set("include_granted_scopes", "true")
  }
  if (provider.id === "linear") url.searchParams.set("prompt", "consent")
  return url.toString()
}

export type McpOAuthCredentials = {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
  accountId?: string
}

type OAuthResponse = {
  access_token?: string
  refresh_token?: string
  expires_in?: number
  expires_at?: number
  token_type?: string
  scope?: string
  user_id?: string
  team?: { id?: string }
  authed_user?: { id?: string; access_token?: string }
  error?: string
  error_description?: string
  ok?: boolean
}

function tokenExpiry(data: OAuthResponse): number | undefined {
  if (typeof data.expires_at === "number") return data.expires_at * 1000
  if (typeof data.expires_in === "number") return Date.now() + data.expires_in * 1000
  return undefined
}

function tokenCredentials(data: OAuthResponse): McpOAuthCredentials | null {
  if (!data.access_token) return null
  return {
    accessToken: data.access_token,
    ...(data.refresh_token ? { refreshToken: data.refresh_token } : {}),
    ...(tokenExpiry(data) ? { expiresAt: tokenExpiry(data) } : {}),
    ...(data.token_type ? { tokenType: data.token_type } : {}),
    ...(data.scope ? { scope: data.scope } : {}),
    ...(data.user_id || data.team?.id || data.authed_user?.id
      ? { accountId: data.user_id || data.team?.id || data.authed_user?.id }
      : {}),
  }
}

async function parseOAuthResponse(response: Response): Promise<OAuthResponse> {
  const parsed = await response.json().catch(() => null)
  return parsed && typeof parsed === "object" ? (parsed as OAuthResponse) : {}
}

export async function exchangeOAuthCode(opts: {
  provider: McpProviderDef
  code: string
  redirectUri: string
  clientId: string
  clientSecret: string
}): Promise<{ credentials: McpOAuthCredentials | null; error?: string }> {
  const { provider, code, redirectUri, clientId, clientSecret } = opts
  if (!provider.tokenUrl) return { credentials: null, error: "Token URL missing for provider." }

  const request = provider.id === "github"
    ? {
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
      }
    : {
        headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }),
      }

  const response = await fetch(provider.tokenUrl, { method: "POST", ...request })
  const data = await parseOAuthResponse(response)
  if (!response.ok || data.ok === false) {
    return {
      credentials: null,
      error: data.error_description || data.error || `${provider.name} token exchange failed (${response.status})`,
    }
  }

  // Slack returns the bot token in access_token and account identity in team.
  const credentials = tokenCredentials(data)
  if (!credentials) return { credentials: null, error: `${provider.name} did not return an access token` }
  return { credentials }
}

/** Refreshes providers that issue refresh tokens. The caller persists rotation. */
export async function refreshOAuthToken(opts: {
  provider: McpProviderDef
  refreshToken: string
  clientId: string
  clientSecret: string
}): Promise<{ credentials: McpOAuthCredentials | null; error?: string }> {
  if (!opts.provider.tokenUrl) return { credentials: null, error: "Token URL missing for provider." }
  const response = await fetch(opts.provider.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: opts.clientId,
      client_secret: opts.clientSecret,
      refresh_token: opts.refreshToken,
      grant_type: "refresh_token",
    }),
  })
  const data = await parseOAuthResponse(response)
  if (!response.ok || data.ok === false) {
    return { credentials: null, error: data.error_description || data.error || `Token refresh failed (${response.status})` }
  }
  const credentials = tokenCredentials(data)
  if (!credentials) return { credentials: null, error: "Token refresh returned no access token" }
  if (!credentials.refreshToken) credentials.refreshToken = opts.refreshToken
  return { credentials }
}
