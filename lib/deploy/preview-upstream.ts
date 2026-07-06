/**
 * Fetch Syte preview upstream with retries (dev server / TLS may not be ready yet).
 */

export type PreviewUpstreamFetchResult =
  | { ok: true; response: Response; attempts: number; elapsedMs: number }
  | { ok: false; error: string; attempts: number; elapsedMs: number }

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function formatFetchError(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause
    if (cause instanceof Error) return `${err.message} (${cause.message})`
    return err.message
  }
  return String(err)
}

export async function fetchPreviewUpstream(
  previewUrl: string,
  options?: { retries?: number; retryMs?: number; timeoutMs?: number },
): Promise<PreviewUpstreamFetchResult> {
  const retries = options?.retries ?? 4
  const retryMs = options?.retryMs ?? 2000
  const timeoutMs = options?.timeoutMs ?? 15000
  const started = Date.now()
  let lastError = "fetch failed"

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const response = await fetch(previewUrl, {
        headers: {
          Accept: "text/html,application/xhtml+xml,*/*",
          "User-Agent": "Sycord-Preview-Proxy/1.0",
        },
        signal: AbortSignal.timeout(timeoutMs),
        redirect: "follow",
      })

      if (response.ok || (response.status >= 300 && response.status < 500)) {
        return {
          ok: true,
          response,
          attempts: attempt,
          elapsedMs: Date.now() - started,
        }
      }

      lastError = `upstream HTTP ${response.status}`
    } catch (err) {
      lastError = formatFetchError(err)
    }

    if (attempt <= retries) {
      await sleep(retryMs)
    }
  }

  return {
    ok: false,
    error: lastError,
    attempts: retries + 1,
    elapsedMs: Date.now() - started,
  }
}

/** Poll until preview URL responds or timeout. */
export async function waitForPreviewReachable(
  previewUrl: string,
  options?: { maxWaitMs?: number; pollMs?: number },
): Promise<boolean> {
  const maxWaitMs = options?.maxWaitMs ?? 60_000
  const pollMs = options?.pollMs ?? 2500
  const deadline = Date.now() + maxWaitMs

  while (Date.now() < deadline) {
    const result = await fetchPreviewUpstream(previewUrl, {
      retries: 0,
      timeoutMs: 12_000,
    })
    if (result.ok) return true
    await sleep(pollMs)
  }

  return false
}
