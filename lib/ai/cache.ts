import type { CacheStats } from "./types"
export type { CacheStats }
import { createHash } from "crypto"
import { existsSync, readFileSync, statSync } from "fs"
import { join } from "path"

interface CacheEntry<T> {
  data: T
  createdAt: number
  ttlMs: number
}

const store: Map<string, CacheEntry<unknown>> = new Map()

function now(): number {
  return Date.now()
}

function isValid<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  if (!entry) return false
  return now() - entry.createdAt < entry.ttlMs
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (isValid(entry)) return entry.data
  store.delete(key)
  return null
}

export function cacheSet<T>(key: string, data: T, ttlMs: number): void {
  store.set(key, { data, createdAt: now(), ttlMs })
}

export function cacheDelete(key: string): void {
  store.delete(key)
}

export function cacheClear(): void {
  store.clear()
}

export function cacheSize(): number {
  return store.size
}

function hashString(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16)
}

export function fileMtimeHash(filePath: string): string {
  try {
    const p = join(process.cwd(), filePath)
    if (!existsSync(p)) return "no-file"
    const s = statSync(p)
    return hashString(s.mtimeMs.toString())
  } catch {
    return "error"
  }
}

function makeKey(...parts: string[]): string {
  return parts.join(":")
}

const TTL_1MIN = 60_000
const TTL_5MIN = 300_000
const TTL_10MIN = 600_000
const TTL_15MIN = 900_000
const TTL_1HR = 3_600_000

export const CacheManager = {
  getSystemPrompts(): unknown | null {
    return cacheGet(makeKey("system-prompts", "v1"))
  },

  setSystemPrompts(data: unknown): void {
    cacheSet(makeKey("system-prompts", "v1"), data, TTL_5MIN)
  },

  getCheatsheet(mtimeHash: string): unknown | null {
    return cacheGet(makeKey("components-json", mtimeHash))
  },

  setCheatsheet(mtimeHash: string, data: unknown): void {
    cacheSet(makeKey("components-json", mtimeHash), data, TTL_10MIN)
  },

  getDependencyReport(): unknown | null {
    return cacheGet(makeKey("dependency-report", "v1"))
  },

  setDependencyReport(data: unknown): void {
    cacheSet(makeKey("dependency-report", "v1"), data, TTL_10MIN)
  },

  getProjectMemory(userId: string, projectId: string, revision: string): unknown | null {
    return cacheGet(makeKey("project-memory", userId, projectId, revision))
  },

  setProjectMemory(userId: string, projectId: string, revision: string, data: unknown): void {
    cacheSet(makeKey("project-memory", userId, projectId, revision), data, TTL_15MIN)
  },

  getFileSummary(contentHash: string): unknown | null {
    return cacheGet(makeKey("file-summary", contentHash))
  },

  setFileSummary(contentHash: string, data: unknown): void {
    cacheSet(makeKey("file-summary", contentHash), data, TTL_1HR)
  },

  getPlanCache(mode: string, promptHash: string, revision: string, modelId: string): unknown | null {
    return cacheGet(makeKey("plan", mode, promptHash, revision, modelId))
  },

  setPlanCache(mode: string, promptHash: string, revision: string, modelId: string, data: unknown): void {
    cacheSet(makeKey("plan", mode, promptHash, revision, modelId), data, TTL_5MIN)
  },

  getProviderResponse(hash: string): unknown | null {
    return cacheGet(makeKey("provider-response", hash))
  },

  setProviderResponse(hash: string, data: unknown): void {
    cacheSet(makeKey("provider-response", hash), data, TTL_5MIN)
  },
}

export function computeContentHash(content: string): string {
  return hashString(content)
}

export function computeProjectRevision(files: Array<{ name: string; content: string; updatedAt?: string }>): string {
  const parts = files
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((f) => `${f.name}:${computeContentHash(f.content)}:${f.updatedAt ?? "0"}`)
  return hashString(parts.join("|"))
}

export function computePromptHash(prompt: string): string {
  return hashString(prompt)
}

export function emptyCacheStats(): CacheStats {
  return {
    systemPromptHit: false,
    cheatsheetHit: false,
    memoryHit: false,
    fileSummaryHits: 0,
    fileSummaryMisses: 0,
    planHit: false,
  }
}
