/**
 * Syra slash-menu helpers for agent Skills + MCP.
 * Backed by https://sycord.site/api/#agent (`/api/agent_skills*`, `/api/agent_mcp*`).
 */

import { MCP_PROVIDERS } from '@/lib/mcp-providers'

export type SyraSlashSkill = {
  id: string
  name: string
  description?: string
  active: boolean
  builtin?: boolean
  custom?: boolean
}

export type SyraSlashMcpAddon = {
  id: string
  name: string
  description?: string
  connected: boolean
  builtin?: boolean
  status?: string
  toolsCount?: number
  authType?: 'oauth' | 'api_key' | 'builtin'
  logo?: string
  envKeys?: string[]
}

/** Built-in catalog from Syte docs — used when the API is unreachable. */
export const BUILTIN_SKILL_FALLBACK: SyraSlashSkill[] = [
  {
    id: 'website-editing',
    name: 'Website editing',
    description: 'Edit pages, components, and site content in the workspace.',
    active: false,
    builtin: true,
  },
  {
    id: 'workspace-search',
    name: 'Workspace search',
    description: 'Search project files and symbols before editing.',
    active: false,
    builtin: true,
  },
  {
    id: 'preview-access',
    name: 'Preview access',
    description: 'Start, inspect, and screenshot the live preview.',
    active: false,
    builtin: true,
  },
  {
    id: 'service-management',
    name: 'Service management',
    description: 'Manage preview/deploy services for this project.',
    active: false,
    builtin: true,
  },
  {
    id: 'nextjs-app-router',
    name: 'Next.js App Router',
    description: 'App Router conventions, routing, and data patterns.',
    active: false,
    builtin: true,
  },
  {
    id: 'cli-tools',
    name: 'CLI tools',
    description: 'Run allowed workspace shell and package commands.',
    active: false,
    builtin: true,
  },
]

export const BUILTIN_MCP_FALLBACK: SyraSlashMcpAddon[] = MCP_PROVIDERS.map((p) => ({
  id: p.id,
  name: p.name,
  description: p.description,
  connected: false,
  builtin: true,
  status: 'available',
  authType: p.authType,
  logo: p.logo,
  envKeys: p.envKeys,
}))

function mcpCatalogKey(idOrName: string): string {
  let key = idOrName
    .toLowerCase()
    .replace(/^.*:/, '')
    .replace(/[\s_/]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
  if (key.includes('openrouter') || key.includes('openroute') || key === 'openai') key = 'openai'
  if (key.includes('google') && key.includes('drive')) key = 'google-drive'
  if (key === 'drive' || key === 'googledrive') key = 'google-drive'
  if (key.includes('syte') || key.includes('web-search') || key === 'websearch') key = 'syte'
  return key
}

/** Merge API MCP addons onto the known connectable catalog (keep catalog order + icons). */
export function mergeMcpCatalog(remote: SyraSlashMcpAddon[]): SyraSlashMcpAddon[] {
  const remoteByKey = new Map<string, SyraSlashMcpAddon>()
  for (const item of remote) {
    remoteByKey.set(mcpCatalogKey(item.id), item)
    if (item.name) remoteByKey.set(mcpCatalogKey(item.name), item)
  }

  const merged = BUILTIN_MCP_FALLBACK.map((catalogItem) => {
    const remoteItem =
      remoteByKey.get(mcpCatalogKey(catalogItem.id)) ||
      remoteByKey.get(mcpCatalogKey(catalogItem.name))
    if (!remoteItem) return { ...catalogItem }
    return {
      ...catalogItem,
      ...remoteItem,
      id: catalogItem.id,
      name: catalogItem.name,
      description: catalogItem.description || remoteItem.description,
      builtin: true,
      connected: remoteItem.connected,
      status: remoteItem.status || (remoteItem.connected ? 'connected' : 'available'),
      toolsCount: remoteItem.toolsCount,
      authType: catalogItem.authType,
      logo: catalogItem.logo,
      envKeys: catalogItem.envKeys,
    }
  })

  // Append unknown remotes that are not in the catalog
  const known = new Set(merged.map((m) => mcpCatalogKey(m.id)))
  for (const item of remote) {
    const key = mcpCatalogKey(item.id)
    if (!known.has(key)) {
      known.add(key)
      merged.push(item)
    }
  }
  return merged
}

function humanizeId(id: string): string {
  const bare = id.includes(':') ? id.split(':').pop() || id : id
  return bare
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function isMcpConnected(addon: {
  status?: string
  connected?: boolean
  enabled?: boolean
}): boolean {
  if (addon.connected === true || addon.enabled === true) return true
  const status = (addon.status || '').toLowerCase()
  return status === 'connected' || status === 'enabled' || status === 'active' || status === 'running'
}

export function normalizeSkills(raw: unknown): SyraSlashSkill[] {
  if (!Array.isArray(raw)) return []
  const skills: SyraSlashSkill[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const id = typeof obj.id === 'string' ? obj.id : ''
    if (!id) continue
    const name =
      (typeof obj.name === 'string' && obj.name.trim()) ||
      humanizeId(id)
    const description =
      typeof obj.description === 'string'
        ? obj.description
        : typeof obj.content === 'string'
          ? obj.content.slice(0, 120)
          : undefined
    skills.push({
      id,
      name,
      description,
      active: obj.active === true,
      builtin: obj.builtin === true,
      custom: obj.custom === true,
    })
  }
  return skills
}

export function normalizeMcpAddons(raw: unknown): SyraSlashMcpAddon[] {
  if (!Array.isArray(raw)) return []
  const addons: SyraSlashMcpAddon[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const obj = item as Record<string, unknown>
    const id =
      (typeof obj.id === 'string' && obj.id) ||
      (typeof obj.name === 'string' && obj.name) ||
      ''
    if (!id) continue
    const name =
      (typeof obj.name === 'string' && obj.name.trim()) ||
      humanizeId(id)
    const tools = Array.isArray(obj.tools) ? obj.tools : []
    addons.push({
      id,
      name,
      description: typeof obj.description === 'string' ? obj.description : undefined,
      connected: isMcpConnected({
        status: typeof obj.status === 'string' ? obj.status : undefined,
        connected: typeof obj.connected === 'boolean' ? obj.connected : undefined,
        enabled: typeof obj.enabled === 'boolean' ? obj.enabled : undefined,
      }),
      builtin: obj.builtin === true,
      status: typeof obj.status === 'string' ? obj.status : undefined,
      toolsCount: tools.length,
    })
  }
  return addons
}

/** Prefer stable catalog id for connect/disconnect body. */
export function mcpAddonKey(addon: Pick<SyraSlashMcpAddon, 'id' | 'name'>): string {
  const bare = addon.id.includes(':') ? addon.id.split(':').pop() || addon.id : addon.id
  if (bare?.trim()) return bare.trim()
  if (addon.name?.trim()) return addon.name.trim()
  return addon.id
}

export async function fetchProjectSkills(projectId: string): Promise<{
  skills: SyraSlashSkill[]
  error?: string
}> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent/skills`, {
      headers: { Accept: 'application/json' },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        skills: BUILTIN_SKILL_FALLBACK,
        error: data?.message || `Failed to load skills (${res.status})`,
      }
    }
    const skills = normalizeSkills(data?.skills)
    return { skills: skills.length > 0 ? skills : BUILTIN_SKILL_FALLBACK }
  } catch (err: any) {
    return {
      skills: BUILTIN_SKILL_FALLBACK,
      error: err?.message || 'Failed to load skills',
    }
  }
}

export async function toggleProjectSkill(
  projectId: string,
  skillId: string,
  enable: boolean,
): Promise<{ skills: SyraSlashSkill[]; error?: string }> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ action: enable ? 'enable' : 'disable', skillId }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return { skills: [], error: data?.message || `Failed to ${enable ? 'enable' : 'disable'} skill` }
    }
    return { skills: normalizeSkills(data?.skills) }
  } catch (err: any) {
    return { skills: [], error: err?.message || 'Failed to update skill' }
  }
}

export async function fetchProjectMcp(projectId: string): Promise<{
  addons: SyraSlashMcpAddon[]
  error?: string
}> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent/mcp`, {
      headers: { Accept: 'application/json' },
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        addons: mergeMcpCatalog([]),
        error: data?.message || `Failed to load MCP (${res.status})`,
      }
    }
    return { addons: mergeMcpCatalog(normalizeMcpAddons(data?.addons)) }
  } catch (err: any) {
    return {
      addons: mergeMcpCatalog([]),
      error: err?.message || 'Failed to load MCP',
    }
  }
}

export async function toggleProjectMcp(
  projectId: string,
  addon: SyraSlashMcpAddon,
  connect: boolean,
): Promise<{ addons: SyraSlashMcpAddon[]; hasRemoteState: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/agent/mcp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        action: connect ? 'connect' : 'disconnect',
        addon: mcpAddonKey(addon),
      }),
    })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      return {
        addons: [],
        hasRemoteState: false,
        error: data?.message || `Failed to ${connect ? 'connect' : 'disconnect'} MCP`,
      }
    }
    const hasRemoteState = Array.isArray(data?.addons)
    return {
      addons: hasRemoteState ? mergeMcpCatalog(normalizeMcpAddons(data.addons)) : [],
      hasRemoteState,
    }
  } catch (err: any) {
    return { addons: [], hasRemoteState: false, error: err?.message || 'Failed to update MCP' }
  }
}
