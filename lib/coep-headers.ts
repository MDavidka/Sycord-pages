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

/** iOS / iPadOS */
export function isIOSUserAgent(userAgent: string): boolean {
  return /iPad|iPhone|iPod/i.test(userAgent)
}

/** Syra embeds the Vite dev server in a cross-origin iframe — COEP breaks module loading. */
export function shouldSkipSyraCoep(_userAgent?: string): boolean {
  return true
}

/** No COEP on /syra — Syte Vite preview is a cross-origin iframe (like dashboard previews). */
export function syraIsolationHeaders(_userAgent: string): Record<string, string> | null {
  return null
}
