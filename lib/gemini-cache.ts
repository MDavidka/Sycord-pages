/**
 * Server-side per-project in-memory cache for Gemini code generation context.
 * Stores the last generated files so the AI can reference them across sequential
 * generation calls without relying solely on the frontend re-sending all pages.
 *
 * TTL: 30 minutes (refreshed on each write).
 */

export interface CachedFile {
  name: string
  code: string
  usedFor?: string
  timestamp: number
}

interface ProjectCache {
  files: CachedFile[]
  lastUpdated: number
}

const CACHE_TTL_MS = 30 * 60 * 1000 // 30 minutes

const projectCaches = new Map<string, ProjectCache>()

/** Store or update a generated file in the project's cache. */
export function cacheGeneratedFile(
  projectId: string,
  name: string,
  code: string,
  usedFor?: string
): void {
  const existing = projectCaches.get(projectId)
  const files: CachedFile[] = existing
    ? existing.files.filter((f) => f.name !== name)
    : []

  files.push({ name, code, usedFor, timestamp: Date.now() })

  projectCaches.set(projectId, { files, lastUpdated: Date.now() })
}

/** Retrieve all cached files for a project (returns [] if expired or missing). */
export function getCachedFiles(projectId: string): CachedFile[] {
  const cache = projectCaches.get(projectId)
  if (!cache) return []
  if (Date.now() - cache.lastUpdated > CACHE_TTL_MS) {
    projectCaches.delete(projectId)
    return []
  }
  return [...cache.files].sort((a, b) => b.timestamp - a.timestamp)
}

/**
 * Return the most recently generated file for a project.
 * Used to inject last-file context into the next generation prompt.
 */
export function getLastGeneratedFile(projectId: string): CachedFile | null {
  const files = getCachedFiles(projectId)
  if (files.length === 0) return null
  return files.reduce((latest, f) => (f.timestamp > latest.timestamp ? f : latest), files[0])
}

/** Invalidate the entire cache for a project (e.g. on fresh build). */
export function clearProjectCache(projectId: string): void {
  projectCaches.delete(projectId)
}
