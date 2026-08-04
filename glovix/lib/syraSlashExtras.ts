/**
 * Syra slash-menu helpers for agent Skills + Connections.
 * Backed by https://sycord.site/api/#agent (`/api/agent_skills*`, `/api/agent_connection*`).
 */

import { CONNECTION_PROVIDERS } from '@/lib/connection-providers'

export type SyraSlashSkill = {
  id: string
  name: string
  description?: string
  active: boolean
  builtin?: boolean
  custom?: boolean
}

export type SyraSlashConnection = {
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

export const BUILTIN_CONNECTION_FALLBACK: SyraSlashConnection[] = CONNECTION_PROVIDERS.map((p) => ({
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

function connectionCatalogKey(idOrName: string): string {
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

/** Merge API connection addons onto the known connectable catalog (keep catalog order + icons). */
export function mergeConnectionCatalog(remote: SyraSlashConnection[]): SyraSlashConnection[] {
  const remoteByKey = new Map<string, SyraSlashConnection>()
  for (const item of remote) {
    remoteByKey.set(connectionCatalogKey(item.id), item)
    if (item.name) remoteByKey.set(connectionCatalogKey(item.name), item)
  }

  const merged = BUILTIN_CONNECTION_FALLBACK.map((catalogItem) => {
    const remoteItem =
      remoteByKey.get(connectionCatalogKey(catalogItem.id)) ||
      remoteByKey.get(connectionCatalogKey(catalogItem.name))
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
  const known = new Set(merged.map((m) => connectionCatalogKey(m.id)))
  for (const item of remote) {
    const key = connectionCatalogKey(item.id)
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
