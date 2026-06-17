// Cloudflare API client for managing a remotely-managed (token-based) tunnel.
//
// This replaces the old interactive `cloudflared tunnel login` flow (which
// required a browser auth step and a cert.pem on the VM) with fully automated
// API calls. The flow is:
//   1. Create (or reuse) a named tunnel with config_src="cloudflare"  -> tunnel id + run token
//   2. PUT the ingress configuration so *.<baseDomain> -> http://127.0.0.1:80
//   3. Ensure a proxied wildcard DNS CNAME *.<baseDomain> -> <id>.cfargotunnel.com
//   4. On the VM: `cloudflared service install <token>` (no cert.pem needed)
//
// A single tunnel + wildcard DNS serves every project: nginx on the VM routes
// each <project>.<baseDomain> by Host header to the project's local port, so a
// new deployment becomes reachable immediately without any extra Cloudflare calls.

const CF_API_BASE = "https://api.cloudflare.com/client/v4"
const TUNNEL_NAME = process.env.CLOUDFLARE_TUNNEL_NAME || "sycord-deployer"

export type CloudflareEnv = {
  apiKey: string
  accountId: string
  zoneId: string
  apiEmail?: string
}

export type TunnelInfo = {
  id: string
  token: string
  name: string
}

export function getCloudflareEnv(): CloudflareEnv | null {
  const apiKey = process.env.CLOUDFLARE_API_KEY
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
  const zoneId = process.env.CLOUDFLARE_ZONE_ID
  if (!apiKey || !accountId || !zoneId) return null
  return {
    apiKey,
    accountId,
    zoneId,
    apiEmail: process.env.CLOUDFLARE_API_EMAIL || undefined,
  }
}

export function cloudflareConfigured(): boolean {
  return getCloudflareEnv() !== null
}

function authHeaders(env: CloudflareEnv): Record<string, string> {
  // Support both API Token (Bearer) and legacy Global API Key (email + key).
  if (env.apiEmail) {
    return {
      "X-Auth-Email": env.apiEmail,
      "X-Auth-Key": env.apiKey,
      "Content-Type": "application/json",
    }
  }
  return {
    Authorization: `Bearer ${env.apiKey}`,
    "Content-Type": "application/json",
  }
}

type CfResponse<T> = {
  success: boolean
  errors: Array<{ code?: number; message?: string }>
  messages: unknown[]
  result: T
}

async function cfFetch<T>(
  env: CloudflareEnv,
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; data: CfResponse<T> | null; error?: string }> {
  try {
    const res = await fetch(`${CF_API_BASE}${path}`, {
      ...init,
      headers: { ...authHeaders(env), ...(init?.headers || {}) },
    })
    const text = await res.text()
    let data: CfResponse<T> | null = null
    try {
      data = text ? (JSON.parse(text) as CfResponse<T>) : null
    } catch {
      data = null
    }
    if (!res.ok || (data && data.success === false)) {
      const error =
        data?.errors?.map((e) => e.message).filter(Boolean).join("; ") ||
        `Cloudflare API ${res.status}`
      return { ok: false, status: res.status, data, error }
    }
    return { ok: true, status: res.status, data }
  } catch (err: any) {
    return { ok: false, status: 0, data: null, error: err?.message || "Cloudflare API request failed" }
  }
}

// ---------------------------------------------------------------------------
// Tunnel management
// ---------------------------------------------------------------------------

async function findExistingTunnel(env: CloudflareEnv, name: string): Promise<{ id: string } | null> {
  const res = await cfFetch<Array<{ id: string; name: string; deleted_at: string | null }>>(
    env,
    `/accounts/${env.accountId}/cfd_tunnel?name=${encodeURIComponent(name)}&is_deleted=false`,
  )
  if (!res.ok || !res.data?.result?.length) return null
  const match = res.data.result.find((t) => t.name === name && !t.deleted_at) || res.data.result[0]
  return match ? { id: match.id } : null
}

export async function getTunnelToken(env: CloudflareEnv, tunnelId: string): Promise<string | null> {
  const res = await cfFetch<string>(env, `/accounts/${env.accountId}/cfd_tunnel/${tunnelId}/token`)
  if (!res.ok || !res.data) return null
  // The token endpoint returns the token directly as `result` (a string).
  return typeof res.data.result === "string" ? res.data.result : null
}

export async function getOrCreateTunnel(
  env: CloudflareEnv,
  name: string = TUNNEL_NAME,
): Promise<{ tunnel: TunnelInfo | null; error?: string; created: boolean }> {
  // Reuse an existing tunnel if present (idempotent setup).
  const existing = await findExistingTunnel(env, name)
  if (existing) {
    const token = await getTunnelToken(env, existing.id)
    if (!token) {
      return { tunnel: null, created: false, error: "Found existing tunnel but failed to retrieve its run token" }
    }
    return { tunnel: { id: existing.id, token, name }, created: false }
  }

  const res = await cfFetch<{ id: string; token?: string }>(
    env,
    `/accounts/${env.accountId}/cfd_tunnel`,
    {
      method: "POST",
      body: JSON.stringify({ name, config_src: "cloudflare" }),
    },
  )
  if (!res.ok || !res.data?.result?.id) {
    return { tunnel: null, created: false, error: res.error || "Failed to create tunnel" }
  }

  const id = res.data.result.id
  let token = res.data.result.token || null
  if (!token) token = await getTunnelToken(env, id)
  if (!token) {
    return { tunnel: null, created: true, error: "Tunnel created but run token could not be retrieved" }
  }
  return { tunnel: { id, token, name }, created: true }
}

export async function putWildcardIngress(
  env: CloudflareEnv,
  tunnelId: string,
  baseDomain: string,
  localService = "http://127.0.0.1:80",
): Promise<{ ok: boolean; error?: string }> {
  const res = await cfFetch(env, `/accounts/${env.accountId}/cfd_tunnel/${tunnelId}/configurations`, {
    method: "PUT",
    body: JSON.stringify({
      config: {
        ingress: [
          { hostname: `*.${baseDomain}`, service: localService, originRequest: {} },
          { hostname: baseDomain, service: localService, originRequest: {} },
          { service: "http_status:404" },
        ],
      },
    }),
  })
  return { ok: res.ok, error: res.error }
}

// ---------------------------------------------------------------------------
// DNS management
// ---------------------------------------------------------------------------

async function findDnsRecord(
  env: CloudflareEnv,
  name: string,
): Promise<{ id: string; content: string; type: string } | null> {
  const res = await cfFetch<Array<{ id: string; content: string; type: string }>>(
    env,
    `/zones/${env.zoneId}/dns_records?name=${encodeURIComponent(name)}`,
  )
  if (!res.ok || !res.data?.result?.length) return null
  return res.data.result[0]
}

/**
 * Ensure a proxied CNAME record exists pointing `name` -> `<tunnelId>.cfargotunnel.com`.
 * Used for the wildcard `*.<baseDomain>` record (and optionally per-host records).
 */
export async function ensureTunnelDns(
  env: CloudflareEnv,
  name: string,
  tunnelId: string,
): Promise<{ ok: boolean; created: boolean; error?: string }> {
  const target = `${tunnelId}.cfargotunnel.com`
  const existing = await findDnsRecord(env, name)

  if (existing) {
    if (existing.type === "CNAME" && existing.content === target) {
      return { ok: true, created: false }
    }
    const res = await cfFetch(env, `/zones/${env.zoneId}/dns_records/${existing.id}`, {
      method: "PUT",
      body: JSON.stringify({ type: "CNAME", name, content: target, proxied: true }),
    })
    return { ok: res.ok, created: false, error: res.error }
  }

  const res = await cfFetch(env, `/zones/${env.zoneId}/dns_records`, {
    method: "POST",
    body: JSON.stringify({ type: "CNAME", name, content: target, proxied: true }),
  })
  return { ok: res.ok, created: true, error: res.error }
}

export async function ensureWildcardDns(
  env: CloudflareEnv,
  baseDomain: string,
  tunnelId: string,
): Promise<{ ok: boolean; created: boolean; error?: string }> {
  return ensureTunnelDns(env, `*.${baseDomain}`, tunnelId)
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export type CloudflareCheck = {
  ok: boolean
  detail: string
}

export type CloudflareVerification = {
  configured: boolean
  authMode: "token" | "global-key"
  account: CloudflareCheck
  zone: CloudflareCheck & { zoneName?: string }
  tunnel: CloudflareCheck & { tunnelId?: string; status?: string; connections?: number }
}

/**
 * Independently verify each Cloudflare credential so the admin UI can show a
 * precise reason instead of a generic "authentication error". Uses the account
 * and zone GET endpoints (which work with both API tokens and Global API keys).
 */
export async function verifyCloudflareCredentials(): Promise<CloudflareVerification> {
  const env = getCloudflareEnv()
  if (!env) {
    return {
      configured: false,
      authMode: "token",
      account: { ok: false, detail: "CLOUDFLARE_API_KEY / CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_ZONE_ID not all set" },
      zone: { ok: false, detail: "Not checked — credentials missing" },
      tunnel: { ok: false, detail: "Not checked — credentials missing" },
    }
  }

  const authMode: "token" | "global-key" = env.apiEmail ? "global-key" : "token"

  // 1. Account access
  const accountRes = await cfFetch<{ id: string; name: string }>(env, `/accounts/${env.accountId}`)
  const account: CloudflareCheck = accountRes.ok
    ? { ok: true, detail: `Account "${accountRes.data?.result?.name || env.accountId}" accessible` }
    : { ok: false, detail: accountRes.error || `Account ${env.accountId} not accessible (status ${accountRes.status})` }

  // 2. Zone access
  const zoneRes = await cfFetch<{ id: string; name: string }>(env, `/zones/${env.zoneId}`)
  const zone: CloudflareVerification["zone"] = zoneRes.ok
    ? { ok: true, detail: `Zone "${zoneRes.data?.result?.name}" accessible`, zoneName: zoneRes.data?.result?.name }
    : { ok: false, detail: zoneRes.error || `Zone ${env.zoneId} not accessible (status ${zoneRes.status})` }

  // 3. Existing tunnel (optional — absence is fine, setup will create it)
  let tunnel: CloudflareVerification["tunnel"] = { ok: true, detail: "No tunnel yet — will be created during setup" }
  if (account.ok) {
    const existing = await findExistingTunnel(env, process.env.CLOUDFLARE_TUNNEL_NAME || "sycord-deployer")
    if (existing) {
      const status = await getTunnelApiStatus(env, existing.id)
      tunnel = {
        ok: true,
        tunnelId: existing.id,
        status: status?.status,
        connections: status?.connections,
        detail: status
          ? `Tunnel ${existing.id.slice(0, 8)}… is ${status.status} (${status.connections} edge connections)`
          : `Tunnel ${existing.id.slice(0, 8)}… exists`,
      }
    }
  }

  return { configured: true, authMode, account, zone, tunnel }
}

export async function getTunnelApiStatus(
  env: CloudflareEnv,
  tunnelId: string,
): Promise<{ status: string; connections: number } | null> {
  const res = await cfFetch<{ status: string; connections?: unknown[] }>(
    env,
    `/accounts/${env.accountId}/cfd_tunnel/${tunnelId}`,
  )
  if (!res.ok || !res.data?.result) return null
  return {
    status: res.data.result.status || "unknown",
    connections: Array.isArray(res.data.result.connections) ? res.data.result.connections.length : 0,
  }
}

/**
 * High-level helper that performs the full Cloudflare-side provisioning:
 * create/reuse tunnel, set wildcard ingress, ensure wildcard DNS.
 * Returns the tunnel (with run token) on success.
 */
export async function provisionTunnel(
  baseDomain: string,
  log: (line: string) => void,
): Promise<{ success: boolean; tunnel?: TunnelInfo; error?: string }> {
  const env = getCloudflareEnv()
  if (!env) {
    return {
      success: false,
      error:
        "Cloudflare API is not configured. Set CLOUDFLARE_API_KEY, CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_ZONE_ID.",
    }
  }

  log(`[cloudflare-api] Creating/locating tunnel "${TUNNEL_NAME}"...`)
  const { tunnel, created, error } = await getOrCreateTunnel(env)
  if (!tunnel) {
    return { success: false, error: error || "Failed to provision tunnel" }
  }
  log(`[cloudflare-api] Tunnel ${created ? "created" : "reused"}: ${tunnel.id}`)

  log(`[cloudflare-api] Setting ingress: *.${baseDomain} -> http://127.0.0.1:80`)
  const ingress = await putWildcardIngress(env, tunnel.id, baseDomain)
  if (!ingress.ok) {
    return { success: false, error: `Failed to set tunnel ingress: ${ingress.error}` }
  }

  log(`[cloudflare-api] Ensuring wildcard DNS *.${baseDomain} -> ${tunnel.id}.cfargotunnel.com`)
  const dns = await ensureWildcardDns(env, baseDomain, tunnel.id)
  if (!dns.ok) {
    return { success: false, error: `Failed to set wildcard DNS: ${dns.error}` }
  }
  log(`[cloudflare-api] Wildcard DNS ${dns.created ? "created" : "verified"}`)

  return { success: true, tunnel }
}
