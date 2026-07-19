/**
 * Syra slash-menu helpers for agent Skills + MCP.
 * Backed by https://sycord.site/api/#agent (`/api/agent_skills*`, `/api/agent_mcp*`).
 */

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

export const BUILTIN_MCP_FALLBACK: SyraSlashMcpAddon[] = [
  {
    id: 'syte',
    name: 'syte',
    description: 'Built-in Syte workspace MCP tools.',
    connected: false,
    builtin: true,
    status: 'available',
  },
]

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
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      const id = typeof obj.id === 'string' ? obj.id : ''
      if (!id) return null
      const name =
        (typeof obj.name === 'string' && obj.name.trim()) ||
        humanizeId(id)
      const description =
        typeof obj.description === 'string'
          ? obj.description
          : typeof obj.content === 'string'
            ? obj.content.slice(0, 120)
            : undefined
      return {
        id,
        name,
        description,
        active: obj.active === true,
        builtin: obj.builtin === true,
        custom: obj.custom === true,
      } satisfies SyraSlashSkill
    })
    .filter((s): s is SyraSlashSkill => Boolean(s))
}

export function normalizeMcpAddons(raw: unknown): SyraSlashMcpAddon[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const obj = item as Record<string, unknown>
      const id =
        (typeof obj.id === 'string' && obj.id) ||
        (typeof obj.name === 'string' && obj.name) ||
        ''
      if (!id) return null
      const name =
        (typeof obj.name === 'string' && obj.name.trim()) ||
        humanizeId(id)
      const tools = Array.isArray(obj.tools) ? obj.tools : []
      return {
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
      } satisfies SyraSlashMcpAddon
    })
    .filter((a): a is SyraSlashMcpAddon => Boolean(a))
}

/** Prefer addon name for connect/disconnect body when id is namespaced (`uuid:name`). */
export function mcpAddonKey(addon: Pick<SyraSlashMcpAddon, 'id' | 'name'>): string {
  if (addon.name?.trim()) return addon.name.trim()
  if (addon.id.includes(':')) return addon.id.split(':').pop() || addon.id
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
        addons: BUILTIN_MCP_FALLBACK,
        error: data?.message || `Failed to load MCP (${res.status})`,
      }
    }
    const addons = normalizeMcpAddons(data?.addons)
    return { addons: addons.length > 0 ? addons : BUILTIN_MCP_FALLBACK }
  } catch (err: any) {
    return {
      addons: BUILTIN_MCP_FALLBACK,
      error: err?.message || 'Failed to load MCP',
    }
  }
}

export async function toggleProjectMcp(
  projectId: string,
  addon: SyraSlashMcpAddon,
  connect: boolean,
): Promise<{ addons: SyraSlashMcpAddon[]; error?: string }> {
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
        error: data?.message || `Failed to ${connect ? 'connect' : 'disconnect'} MCP`,
      }
    }
    return { addons: normalizeMcpAddons(data?.addons) }
  } catch (err: any) {
    return { addons: [], error: err?.message || 'Failed to update MCP' }
  }
}
