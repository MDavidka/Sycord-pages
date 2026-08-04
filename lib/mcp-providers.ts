/**
 * MCP provider catalog — logos from https://svgl.app (vendored under /public/mcp-logos)
 * plus auth flow metadata for connect/disconnect.
 */

export type McpAuthType = 'oauth' | 'api_key' | 'builtin'

/**
 * Syte MCP stdio registration spec — used when the provider must be registered
 * as a custom addon via POST /api/agent_mcp_register before it can be connected.
 * OAuth providers need this because Syte has no built-in addon for them.
 * The command/args run inside the Syte workspace container (npx is available).
 */
export type McpRegisterSpec = {
  /** MCP server npm package (passed to npx). */
  command: string
  args?: string[]
  /** Subset of `envKeys` that must be injected for the server to authenticate. */
  envKeys: string[]
}

export type McpProviderDef = {
  id: string
  name: string
  description: string
  /** Path under /public — SVGL logos except syte (custom). */
  logo: string
  authType: McpAuthType
  /** OAuth authorize scopes when authType === 'oauth' */
  oauthScopes?: string[]
  /** Env keys required / collected for api_key or after OAuth */
  envKeys?: string[]
  /** Env var names for OAuth app credentials (server-side) */
  oauthClientIdEnv?: string
  oauthClientSecretEnv?: string
  /** Provider authorize / token endpoints */
  authorizeUrl?: string
  tokenUrl?: string
  /** Optional brand color for fallback */
  brandColor?: string
  /**
   * When set, the OAuth callback will call agent_mcp_register with this spec
   * before agent_mcp_connect. Required for providers that are not Syte builtins.
   */
  mcpRegisterSpec?: McpRegisterSpec
}

export const MCP_PROVIDERS: McpProviderDef[] = [
  {
    id: 'syte',
    name: 'Web Search (Syte)',
    description: 'Syte built-in web search for the agent.',
    logo: '/mcp-logos/syte.svg',
    authType: 'builtin',
    brandColor: '#22D3EE',
  },
  {
    id: 'github',
    name: 'GitHub',
    description: 'Repos, issues, PRs, and repository tools.',
    logo: '/mcp-logos/github.svg',
    authType: 'oauth',
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    oauthScopes: ['repo', 'read:user', 'read:org'],
    oauthClientIdEnv: 'MCP_GITHUB_CLIENT_ID',
    oauthClientSecretEnv: 'MCP_GITHUB_CLIENT_SECRET',
    envKeys: ['GITHUB_TOKEN'],
    brandColor: '#E6EDF3',
    mcpRegisterSpec: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-github'],
      envKeys: ['GITHUB_TOKEN'],
    },
  },
  {
    id: 'linear',
    name: 'Linear',
    description: 'Issues, projects, and roadmap tools.',
    logo: '/mcp-logos/linear.svg',
    authType: 'oauth',
    authorizeUrl: 'https://linear.app/oauth/authorize',
    tokenUrl: 'https://api.linear.app/oauth/token',
    oauthScopes: ['read', 'write'],
    oauthClientIdEnv: 'MCP_LINEAR_CLIENT_ID',
    oauthClientSecretEnv: 'MCP_LINEAR_CLIENT_SECRET',
    envKeys: ['LINEAR_API_KEY'],
    brandColor: '#5E6AD2',
    mcpRegisterSpec: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-linear'],
      envKeys: ['LINEAR_API_KEY'],
    },
  },
  {
    id: 'supabase',
    name: 'Supabase',
    description: 'Database, auth, and storage tools.',
    logo: '/mcp-logos/supabase.svg',
    authType: 'api_key',
    envKeys: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
    brandColor: '#3ECF8E',
  },
  {
    id: 'datadog',
    name: 'Datadog',
    description: 'Metrics, logs, and monitoring tools.',
    logo: '/mcp-logos/datadog.svg',
    authType: 'api_key',
    envKeys: ['DATADOG_API_KEY', 'DATADOG_APP_KEY'],
    brandColor: '#632CA6',
  },
  {
    id: 'google-drive',
    name: 'Google Drive',
    description: 'Files, folders, and Drive search tools.',
    logo: '/mcp-logos/google-drive.svg',
    authType: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    oauthScopes: [
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.file',
    ],
    oauthClientIdEnv: 'MCP_GOOGLE_CLIENT_ID',
    oauthClientSecretEnv: 'MCP_GOOGLE_CLIENT_SECRET',
    envKeys: ['GOOGLE_DRIVE_ACCESS_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN'],
    brandColor: '#4285F4',
    mcpRegisterSpec: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-gdrive'],
      envKeys: ['GOOGLE_DRIVE_ACCESS_TOKEN', 'GOOGLE_DRIVE_REFRESH_TOKEN'],
    },
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Channels, messages, and workspace tools.',
    logo: '/mcp-logos/slack.svg',
    authType: 'oauth',
    authorizeUrl: 'https://slack.com/oauth/v2/authorize',
    tokenUrl: 'https://slack.com/api/oauth.v2.access',
    oauthScopes: ['channels:read', 'chat:write', 'users:read'],
    oauthClientIdEnv: 'MCP_SLACK_CLIENT_ID',
    oauthClientSecretEnv: 'MCP_SLACK_CLIENT_SECRET',
    envKeys: ['SLACK_BOT_TOKEN'],
    brandColor: '#E01E5A',
    mcpRegisterSpec: {
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-slack'],
      envKeys: ['SLACK_BOT_TOKEN'],
    },
  },
  {
    id: 'gmail',
    name: 'Gmail',
    description: 'Email search, draft, and send tools.',
    logo: '/mcp-logos/gmail.svg',
    authType: 'oauth',
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    oauthScopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
    ],
    oauthClientIdEnv: 'MCP_GOOGLE_CLIENT_ID',
    oauthClientSecretEnv: 'MCP_GOOGLE_CLIENT_SECRET',
    envKeys: ['GMAIL_ACCESS_TOKEN', 'GMAIL_REFRESH_TOKEN'],
    brandColor: '#EA4335',
    mcpRegisterSpec: {
      command: 'npx',
      args: ['-y', '@gptscript-ai/gmail-mcp-server'],
      envKeys: ['GMAIL_ACCESS_TOKEN', 'GMAIL_REFRESH_TOKEN'],
    },
  },
  {
    id: 'openai',
    name: 'OpenAI / OpenRouter',
    description: 'Model and completion tools via OpenAI or OpenRouter.',
    logo: '/mcp-logos/openai.svg',
    authType: 'api_key',
    envKeys: ['OPENAI_API_KEY', 'OPENROUTER_API_KEY'],
    brandColor: '#10A37F',
  },
]

export function getMcpProvider(id: string): McpProviderDef | undefined {
  const key = id.toLowerCase().replace(/^.*:/, '')
  return MCP_PROVIDERS.find(
    (p) =>
      p.id === key ||
      p.id === key.replace(/_/g, '-') ||
      (key.includes('openrouter') && p.id === 'openai') ||
      (key.includes('syte') && p.id === 'syte') ||
      (key.includes('drive') && p.id === 'google-drive'),
  )
}

/** Resolve OAuth client id, falling back to shared Google / GitHub app envs. */
export function resolveOAuthClientId(provider: McpProviderDef): string | null {
  const primary = provider.oauthClientIdEnv ? process.env[provider.oauthClientIdEnv] : undefined
  if (primary?.trim()) return primary.trim()
  if (provider.id === 'github') {
    return process.env.GITHUB_CLIENT_ID?.trim() || process.env.GITHUB_OAUTH_CLIENT_ID?.trim() || null
  }
  if (provider.id === 'google-drive' || provider.id === 'gmail') {
    return process.env.GOOGLE_CLIENT_ID?.trim() || null
  }
  return null
}

export function resolveOAuthClientSecret(provider: McpProviderDef): string | null {
  const primary = provider.oauthClientSecretEnv
    ? process.env[provider.oauthClientSecretEnv]
    : undefined
  if (primary?.trim()) return primary.trim()
  if (provider.id === 'github') {
    return (
      process.env.GITHUB_CLIENT_SECRET?.trim() ||
      process.env.GITHUB_OAUTH_CLIENT_SECRET?.trim() ||
      null
    )
  }
  if (provider.id === 'google-drive' || provider.id === 'gmail') {
    return process.env.GOOGLE_CLIENT_SECRET?.trim() || null
  }
  return null
}
