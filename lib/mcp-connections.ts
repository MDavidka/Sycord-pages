import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto"
import clientPromise from "@/lib/torso"
import { getMcpProvider, MCP_PROVIDERS, resolveOAuthClientId, resolveOAuthClientSecret, type McpProviderDef } from "@/lib/mcp-providers"
import { refreshOAuthToken } from "@/lib/mcp-oauth"
import { getOwnedProject, getProjectOwnerUserId, ownedProjectMutationFilter } from "@/lib/project-id"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import {
  syteAgentMcpConnect,
  syteAgentMcpDisconnect,
  syteSetEnv,
  useSyteWorkspace,
} from "@/lib/deploy/syte-client"

export const MCP_CONNECTIONS_COLLECTION = "mcp_connections"
const CREDENTIAL_ENVELOPE_VERSION = 1
const REFRESH_WINDOW_MS = 60_000

type Database = { collection: (name: string) => any }

type EncryptedCredentials = {
  version: 1
  iv: string
  tag: string
  ciphertext: string
}

export type McpCredentialSet = {
  accessToken?: string
  refreshToken?: string
  expiresAt?: number
  tokenType?: string
  scope?: string
  accountId?: string
  apiKeys?: Record<string, string>
}

export type McpConnectionStatus = "pending" | "syncing" | "connected" | "error" | "disconnected"

export type McpConnection = {
  connectionId: string
  userId: string
  projectId: string
  providerId: string
  authType: "oauth" | "api_key" | "builtin"
  status: McpConnectionStatus
  accountId?: string
  scope?: string
  expiresAt?: number
  hasCredentials: boolean
  lastError?: string
  createdAt: string
  updatedAt: string
  connectedAt?: string
  disconnectedAt?: string
}

type StoredMcpConnection = McpConnection & {
  _id?: string
  encryptedCredentials?: EncryptedCredentials | null
  oauthStateHash?: string | null
  oauthStateExpiresAt?: number | null
}

function credentialEncryptionKey(): Buffer {
  const configured =
    process.env.MCP_CREDENTIALS_ENCRYPTION_KEY ||
    (process.env.NODE_ENV !== "production" ? process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET : "")
  if (!configured) {
    throw new Error("MCP_CREDENTIALS_ENCRYPTION_KEY must be configured to store MCP credentials")
  }
  return scryptSync(configured, "sycord:mcp-credentials:v1", 32)
}

function encryptCredentials(credentials: McpCredentialSet): EncryptedCredentials {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", credentialEncryptionKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ])
  return {
    version: CREDENTIAL_ENVELOPE_VERSION,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  }
}

function decryptCredentials(envelope: EncryptedCredentials): McpCredentialSet {
  if (!envelope || envelope.version !== CREDENTIAL_ENVELOPE_VERSION) {
    throw new Error("Unsupported MCP credential envelope")
  }
  const decipher = createDecipheriv(
    "aes-256-gcm",
    credentialEncryptionKey(),
    Buffer.from(envelope.iv, "base64url"),
  )
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"))
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8")
  return JSON.parse(plaintext) as McpCredentialSet
}

function now(): string {
  return new Date().toISOString()
}

export function buildMcpConnectionId(userId: string, projectId: string, providerId: string): string {
  return createHash("sha256")
    .update(`${userId}:${projectId}:${providerId}`)
    .digest("hex")
    .slice(0, 32)
}

function publicConnection(connection: StoredMcpConnection): McpConnection {
  const {
    encryptedCredentials: _encryptedCredentials,
    oauthStateHash: _oauthStateHash,
    oauthStateExpiresAt: _oauthStateExpiresAt,
    ...safe
  } = connection
  return {
    ...safe,
    hasCredentials: Boolean(connection.encryptedCredentials),
  }
}

export async function getMcpConnection(
  db: Database,
  userId: string,
  projectId: string,
  providerId: string,
): Promise<StoredMcpConnection | null> {
  return db.collection(MCP_CONNECTIONS_COLLECTION).findOne({
    userId,
    projectId,
    providerId,
  })
}

export async function listMcpConnections(
  db: Database,
  userId: string,
  projectId: string,
): Promise<McpConnection[]> {
  const records = await db
    .collection(MCP_CONNECTIONS_COLLECTION)
    .find({ userId, projectId })
    .sort({ updatedAt: -1 })
    .toArray()
  return (records as StoredMcpConnection[]).map(publicConnection)
}

export async function ensureMcpConnection(
  db: Database,
  userId: string,
  projectId: string,
  provider: McpProviderDef,
): Promise<StoredMcpConnection> {
  const existing = await getMcpConnection(db, userId, projectId, provider.id)
  if (existing) return existing

  const timestamp = now()
  const connection: StoredMcpConnection = {
    _id: buildMcpConnectionId(userId, projectId, provider.id),
    connectionId: buildMcpConnectionId(userId, projectId, provider.id),
    userId,
    projectId,
    providerId: provider.id,
    authType: provider.authType,
    status: "pending",
    hasCredentials: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    encryptedCredentials: null,
  }
  await db.collection(MCP_CONNECTIONS_COLLECTION).insertOne(connection)
  return connection
}

export function hashOAuthNonce(nonce: string): string {
  return createHash("sha256").update(nonce).digest("hex")
}

export async function prepareOAuthConnection(
  db: Database,
  userId: string,
  projectId: string,
  provider: McpProviderDef,
  nonce: string,
  expiresAt: number,
): Promise<StoredMcpConnection> {
  const connection = await ensureMcpConnection(db, userId, projectId, provider)
  await db.collection(MCP_CONNECTIONS_COLLECTION).updateOne(
    { connectionId: connection.connectionId, userId, projectId, providerId: provider.id },
    {
      $set: {
        status: "pending",
        lastError: null,
        oauthStateHash: hashOAuthNonce(nonce),
        oauthStateExpiresAt: expiresAt,
        updatedAt: now(),
      },
    },
  )
  return (await getMcpConnection(db, userId, projectId, provider.id)) as StoredMcpConnection
}

/** Consume a state nonce exactly once before exchanging the OAuth code. */
export async function consumeOAuthConnectionState(
  db: Database,
  state: { connectionId: string; userId: string; projectId: string; providerId: string },
  nonce: string,
): Promise<StoredMcpConnection | null> {
  const connection = await db.collection(MCP_CONNECTIONS_COLLECTION).findOne({
    connectionId: state.connectionId,
    userId: state.userId,
    projectId: state.projectId,
    providerId: state.providerId,
    oauthStateHash: hashOAuthNonce(nonce),
    status: "pending",
  }) as StoredMcpConnection | null
  if (!connection || !connection.oauthStateExpiresAt || connection.oauthStateExpiresAt < Date.now()) {
    return null
  }

  const consumed = await db.collection(MCP_CONNECTIONS_COLLECTION).updateOne(
    {
      connectionId: state.connectionId,
      userId: state.userId,
      projectId: state.projectId,
      providerId: state.providerId,
      oauthStateHash: hashOAuthNonce(nonce),
      status: "pending",
    },
    { $set: { oauthStateHash: null, oauthStateExpiresAt: null, updatedAt: now() } },
  )
  return consumed.matchedCount === 1 ? connection : null
}

function validateCredentialSet(provider: McpProviderDef, credentials: McpCredentialSet): string | null {
  if (provider.authType === "builtin") return null
  if (provider.authType === "oauth" && !credentials.accessToken) return "OAuth did not return an access token"
  if (provider.authType === "api_key") {
    const keys = provider.envKeys || []
    const apiKeys = credentials.apiKeys || {}
    const missing = keys.find((key) => !apiKeys[key]?.trim())
    if (missing) return `Missing credential for ${missing}`
  }
  return null
}

const MCP_MANAGED_CREDENTIAL_KEYS = new Set([
  "GITHUB_TOKEN",
  "LINEAR_API_KEY",
  "SLACK_BOT_TOKEN",
  "GOOGLE_DRIVE_ACCESS_TOKEN",
  "GOOGLE_DRIVE_REFRESH_TOKEN",
  "GMAIL_ACCESS_TOKEN",
  "GMAIL_REFRESH_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "DATADOG_API_KEY",
  "DATADOG_APP_KEY",
  "OPENAI_API_KEY",
  "OPENROUTER_API_KEY",
])

export function isMcpCredentialKey(key: string): boolean {
  return MCP_MANAGED_CREDENTIAL_KEYS.has(key)
}

export function credentialsToEnv(providerId: string, credentials: McpCredentialSet): Record<string, string> {
  const provider = getMcpProvider(providerId)
  if (!provider) return {}
  if (provider.authType === "api_key") {
    return Object.fromEntries(
      Object.entries(credentials.apiKeys || {}).filter(
        ([key, value]) => provider.envKeys?.includes(key) && typeof value === "string" && value.length > 0,
      ),
    )
  }

  const access = credentials.accessToken || ""
  const refresh = credentials.refreshToken || ""
  if (provider.id === "github") return access ? { GITHUB_TOKEN: access } : {}
  if (provider.id === "linear") return access ? { LINEAR_API_KEY: access } : {}
  if (provider.id === "slack") return access ? { SLACK_BOT_TOKEN: access } : {}
  if (provider.id === "google-drive") {
    return {
      ...(access ? { GOOGLE_DRIVE_ACCESS_TOKEN: access } : {}),
      ...(refresh ? { GOOGLE_DRIVE_REFRESH_TOKEN: refresh } : {}),
    }
  }
  if (provider.id === "gmail") {
    return {
      ...(access ? { GMAIL_ACCESS_TOKEN: access } : {}),
      ...(refresh ? { GMAIL_REFRESH_TOKEN: refresh } : {}),
    }
  }
  return {}
}

async function updateConnection(
  db: Database,
  connectionId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await db.collection(MCP_CONNECTIONS_COLLECTION).updateOne(
    { connectionId },
    { $set: { ...patch, updatedAt: now() } },
  )
}

function credentialEnvKeys(providerId: string): string[] {
  const provider = getMcpProvider(providerId)
  if (!provider) return []
  if (provider.authType === "api_key") return provider.envKeys || []
  if (provider.id === "github") return ["GITHUB_TOKEN"]
  if (provider.id === "linear") return ["LINEAR_API_KEY"]
  if (provider.id === "slack") return ["SLACK_BOT_TOKEN"]
  if (provider.id === "google-drive") return ["GOOGLE_DRIVE_ACCESS_TOKEN", "GOOGLE_DRIVE_REFRESH_TOKEN"]
  if (provider.id === "gmail") return ["GMAIL_ACCESS_TOKEN", "GMAIL_REFRESH_TOKEN"]
  return []
}

export async function clearRemoteMcpCredentials(uuid: string, providerId: string): Promise<{ ok: boolean; error?: string }> {
  const keys = credentialEnvKeys(providerId)
  if (keys.length === 0) return { ok: true }
  // Syte's set_env endpoint does not expose a separate delete route. Emptying
  // the provider-owned keys removes their secret values without replacing any
  // unrelated workspace environment variables.
  const cleared = await syteSetEnv(uuid, Object.fromEntries(keys.map((key) => [key, ""])), true)
  return cleared.ok ? { ok: true } : { ok: false, error: cleared.error || "Failed to clear remote MCP credentials" }
}

async function syncRemoteConnection(
  project: any,
  projectId: string,
  providerId: string,
  credentials: McpCredentialSet,
): Promise<{ ok: boolean; error?: string }> {
  if (!useSyteWorkspace()) return { ok: false, error: "Syte workspace is not configured" }
  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) return { ok: false, error: workspace.error }

  const env = credentialsToEnv(providerId, credentials)
  if (Object.keys(env).length > 0) {
    const synced = await syteSetEnv(workspace.uuid, env, true)
    if (!synced.ok) return { ok: false, error: synced.error || "Failed to sync MCP credentials" }
  }
  const connected = await syteAgentMcpConnect(workspace.uuid, providerId)
  return connected.ok
    ? { ok: true }
    : { ok: false, error: connected.error || "Failed to connect MCP provider" }
}

export async function completeMcpConnection(input: {
  db: Database
  connection: StoredMcpConnection
  project: any
  credentials: McpCredentialSet
}): Promise<{ ok: boolean; connection: McpConnection; error?: string }> {
  const { db, connection, project, credentials } = input
  const provider = getMcpProvider(connection.providerId)
  if (!provider) throw new Error("Unknown MCP provider")
  const validationError = validateCredentialSet(provider, credentials)
  if (validationError) throw new Error(validationError)

  const encryptedCredentials = provider.authType === "builtin" ? null : encryptCredentials(credentials)
  await updateConnection(db, connection.connectionId, {
    status: "syncing",
    encryptedCredentials,
    hasCredentials: provider.authType !== "builtin",
    accountId: credentials.accountId || null,
    scope: credentials.scope || null,
    expiresAt: credentials.expiresAt || null,
    lastError: null,
  })

  const synced = await syncRemoteConnection(project, connection.projectId, provider.id, credentials)
  if (!synced.ok) {
    await updateConnection(db, connection.connectionId, {
      status: "error",
      lastError: synced.error || "Failed to synchronize MCP connection",
    })
    const failed = await db.collection(MCP_CONNECTIONS_COLLECTION).findOne({ connectionId: connection.connectionId })
    return { ok: false, connection: publicConnection(failed), error: synced.error }
  }

  const connectedAt = now()
  await updateConnection(db, connection.connectionId, {
    status: "connected",
    connectedAt,
    disconnectedAt: null,
    lastError: null,
  })
  const connected = await db.collection(MCP_CONNECTIONS_COLLECTION).findOne({ connectionId: connection.connectionId })
  return { ok: true, connection: publicConnection(connected) }
}

export async function resolveMcpCredentials(
  db: Database,
  connection: StoredMcpConnection,
): Promise<McpCredentialSet | null> {
  if (!connection.encryptedCredentials) return null
  let credentials = decryptCredentials(connection.encryptedCredentials)
  if (!credentials.expiresAt || credentials.expiresAt > Date.now() + REFRESH_WINDOW_MS) return credentials

  if (!credentials.refreshToken) {
    await updateConnection(db, connection.connectionId, {
      status: "error",
      lastError: "MCP access token expired and cannot be refreshed",
    })
    return null
  }

  const provider = getMcpProvider(connection.providerId)
  const clientId = provider ? resolveOAuthClientId(provider) : null
  const clientSecret = provider ? resolveOAuthClientSecret(provider) : null
  if (!provider || provider.authType !== "oauth" || !clientId || !clientSecret) {
    await updateConnection(db, connection.connectionId, {
      status: "error",
      lastError: "MCP access token expired and refresh is not configured",
    })
    return null
  }

  const refreshed = await refreshOAuthToken({
    provider,
    refreshToken: credentials.refreshToken,
    clientId,
    clientSecret,
  })
  if (!refreshed.credentials) {
    await updateConnection(db, connection.connectionId, {
      status: "error",
      lastError: refreshed.error || "Failed to refresh MCP access token",
    })
    return null
  }

  credentials = refreshed.credentials
  await updateConnection(db, connection.connectionId, {
    encryptedCredentials: encryptCredentials(credentials),
    expiresAt: credentials.expiresAt || null,
    scope: credentials.scope || connection.scope || null,
    status: "connected",
    lastError: null,
  })
  const project = await getOwnedProject(db, connection.userId, connection.projectId)
  if (project) {
    const synced = await syncRemoteConnection(project, connection.projectId, connection.providerId, credentials)
    if (!synced.ok) {
      await updateConnection(db, connection.connectionId, {
        status: "error",
        lastError: synced.error || "Failed to synchronize refreshed MCP credentials",
      })
      return null
    }
  }
  return credentials
}

export async function disconnectMcpConnection(
  db: Database,
  connection: StoredMcpConnection,
  project: any,
): Promise<{ ok: boolean; error?: string }> {
  if (useSyteWorkspace()) {
    const workspace = await requireSyteWorkspaceUuid(project, connection.projectId)
    if ("error" in workspace) return { ok: false, error: workspace.error }
    const cleared = await clearRemoteMcpCredentials(workspace.uuid, connection.providerId)
    if (!cleared.ok) return { ok: false, error: cleared.error }
    const disconnected = await syteAgentMcpDisconnect(workspace.uuid, connection.providerId)
    if (!disconnected.ok) return { ok: false, error: disconnected.error || "Failed to disconnect MCP provider" }
  }

  await updateConnection(db, connection.connectionId, {
    status: "disconnected",
    encryptedCredentials: null,
    hasCredentials: false,
    expiresAt: null,
    accountId: null,
    scope: null,
    disconnectedAt: now(),
    lastError: null,
  })
  return { ok: true }
}

/**
 * One-time compatibility migration for credentials written by the old env API.
 * It removes MCP keys from the project document after encrypting them in the
 * connection store, so future credential reads never depend on plaintext envVars.
 */
export async function migrateLegacyMcpCredentials(
  db: Database,
  requestingUserId: string,
  projectId: string,
): Promise<void> {
  const project = await getOwnedProject(db, requestingUserId, projectId)
  if (!project || !Array.isArray(project.envVars) || project.envVars.length === 0) return
  const ownerId = project.__canonicalOwnerUserId || requestingUserId
  const remaining = [...project.envVars]

  for (const provider of MCP_PROVIDERS) {
    const legacy = project.envVars.filter(
      (item: any) => item?.integration === provider.id || provider.envKeys?.includes(item?.key),
    )
    if (legacy.length === 0) continue

    const existing = await getMcpConnection(db, ownerId, projectId, provider.id)
    if (existing?.encryptedCredentials) {
      // A durable connection always wins over stale legacy values.
      const keys = new Set(legacy.map((item: any) => item.key))
      for (let index = remaining.length - 1; index >= 0; index -= 1) {
        if (keys.has(remaining[index]?.key)) remaining.splice(index, 1)
      }
      continue
    }
    if (existing && (existing.status === "pending" || existing.status === "syncing")) continue

    const values = Object.fromEntries(
      legacy.filter((item: any) => typeof item?.key === "string" && typeof item?.value === "string")
        .map((item: any) => [item.key, item.value]),
    ) as Record<string, string>
    const credentials: McpCredentialSet = provider.authType === "api_key"
      ? { apiKeys: values }
      : {
          accessToken: values[provider.id === "github" ? "GITHUB_TOKEN" : provider.id === "linear" ? "LINEAR_API_KEY" : provider.id === "slack" ? "SLACK_BOT_TOKEN" : provider.id === "google-drive" ? "GOOGLE_DRIVE_ACCESS_TOKEN" : "GMAIL_ACCESS_TOKEN"],
          refreshToken: values[provider.id === "google-drive" ? "GOOGLE_DRIVE_REFRESH_TOKEN" : "GMAIL_REFRESH_TOKEN"],
        }
    const validationError = validateCredentialSet(provider, credentials)
    const connection = existing || await ensureMcpConnection(db, ownerId, projectId, provider)
    await updateConnection(db, connection.connectionId, {
      status: validationError ? "error" : "pending",
      encryptedCredentials: provider.authType === "builtin" ? null : encryptCredentials(credentials),
      hasCredentials: provider.authType !== "builtin",
      lastError: validationError || null,
    })
    // Remove every legacy MCP value, including incomplete records, so it is
    // never left as an unencrypted credential after this migration pass.
    const keys = new Set(legacy.map((item: any) => item.key))
    for (let index = remaining.length - 1; index >= 0; index -= 1) {
      if (keys.has(remaining[index]?.key)) remaining.splice(index, 1)
    }
  }

  if (remaining.length !== project.envVars.length) {
    await db.collection("users").updateOne(
      ownedProjectMutationFilter(requestingUserId, project),
      { $set: { "projects.$.envVars": remaining, "projects.$.updatedAt": new Date() } },
    )
  }
}

export async function getMcpConnectionWithCredentials(
  db: Database,
  userId: string,
  projectId: string,
  providerId: string,
): Promise<McpCredentialSet | null> {
  const connection = await getMcpConnection(db, userId, projectId, providerId)
  return connection ? resolveMcpCredentials(db, connection) : null
}

export async function getMcpDb() {
  const client = await clientPromise
  return client.db()
}
