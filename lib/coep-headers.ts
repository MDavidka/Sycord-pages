/**
 * Shared COOP/COEP header policy for builder and Syra routes.
 * Used by middleware (UA-aware) and documented for next.config.
 */

export const COEP_CREDENTIALLESS: Record<string, string> = {
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
}

export const COEP_REQUIRE_CORP: Record<string, string> = {
  "Cross-Origin-Embedder-Policy": "require-corp",
  "Cross-Origin-Opener-Policy": "same-origin",
}

/** Safari (incl. iOS WebKit) — used for server-side UA checks. */
export function isSafariUserAgent(userAgent: string): boolean {
  return /Safari/i.test(userAgent) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/i.test(userAgent)
}

/** iOS / iPadOS — WebKit preview embeds break under COEP require-corp. */
export function isIOSUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent)
}

/**
 * Mobile Syra uses Syte server preview (not WebContainer). COEP require-corp blocks
 * cross-origin Vite assets inside the proxied iframe on iOS Safari.
 */
export function shouldSkipSyraCoep(userAgent: string): boolean {
  return isIOSUserAgent(userAgent) || isSafariUserAgent(userAgent)
}

export function syraIsolationHeaders(userAgent: string): Record<string, string> | null {
  if (shouldSkipSyraCoep(userAgent)) return null
  return COEP_REQUIRE_CORP
}
