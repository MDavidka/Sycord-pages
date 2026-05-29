import { createHash } from "crypto"

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

export class TTLCache<K, V> {
  private store = new Map<K, CacheEntry<V>>()

  constructor(private defaultTTL: number = 5 * 60 * 1000) {}

  get(key: K): V | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key)
      return undefined
    }
    return entry.value
  }

  set(key: K, value: V, ttl?: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    })
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  delete(key: K): boolean {
    return this.store.delete(key)
  }

  clear(): void {
    this.store.clear()
  }

  get size(): number {
    return this.store.size
  }

  cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key)
    }
  }
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex")
}

export function cacheKey(...parts: string[]): string {
  return sha256(parts.join("::"))
}

export const promptCache = new TTLCache<string, unknown>(30 * 60 * 1000)
export const cheatsheetCache = new TTLCache<string, string>(10 * 60 * 1000)
export const memoryCache = new TTLCache<string, unknown>(5 * 60 * 1000)
export const fileSummaryCache = new TTLCache<string, string>(15 * 60 * 1000)
export const deterministicCache = new TTLCache<string, unknown>(60 * 60 * 1000)

export function redactSensitive(input: string): string {
  return input
    .replace(/(MONGO_URI|DATABASE_URL|API_KEY|SECRET|PASSWORD|TOKEN|AUTH_SECRET)\s*[:=]\s*\S+/gi, "$1=[REDACTED]")
    .replace(/(mongodb\+srv|postgres|mysql|redis):\/\/[^\s"']+/gi, "[REDACTED-URL]")
    .replace(/-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----[\s\S]*?-----END\s+(RSA\s+)?PRIVATE\s+KEY-----/g, "[REDACTED-KEY]")
}
