type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()
const MAX_BUCKETS = 10_000

export type RateLimitResult = {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

function pruneStale(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}

function evictOldestIfNeeded() {
  if (buckets.size < MAX_BUCKETS) return
  // Drop approximately 10% of entries (oldest insertion order in Map).
  const dropCount = Math.max(1, Math.floor(MAX_BUCKETS * 0.1))
  let dropped = 0
  for (const key of buckets.keys()) {
    buckets.delete(key)
    dropped += 1
    if (dropped >= dropCount) break
  }
}

/**
 * Simple in-memory sliding-window rate limiter (per-process).
 * Suitable for single-instance / edge-adjacent protection; not a distributed limiter.
 */
export function checkRateLimit(
  key: string,
  { limit = 30, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {},
): RateLimitResult {
  const now = Date.now()
  const existing = buckets.get(key)

  if (!existing || now >= existing.resetAt) {
    evictOldestIfNeeded()
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) }
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
  }
}

/** Periodically prune stale buckets to avoid unbounded growth. */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    pruneStale(Date.now())
  }, 5 * 60_000).unref?.()
}
