/** Whether a preview URL is cross-origin relative to the Syra shell. */
export function isCrossOriginPreviewUrl(url: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
}

/** Syte HMR preview host (preview*.sycord.site). */
export function isSytePreviewUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host.endsWith('.sycord.site') && host.startsWith('preview');
    } catch {
        return false;
    }
}

/**
 * Production / deployed URLs almost always block iframe embedding (X-Frame-Options).
 * Show an open-in-browser card instead of a blank iframe.
 */
export function shouldEmbedPreviewInIframe(url: string, source: 'live' | 'deployed' | 'syte' | null): boolean {
    if (!url) return false;
    if (source === 'deployed') return false;
    if (source === 'syte' || isSytePreviewUrl(url)) return true;
    if (source === 'live') {
        // WebContainer dev server — same shell origin or blob; embed when possible.
        return !isCrossOriginPreviewUrl(url) || url.startsWith('blob:');
    }
    return !isCrossOriginPreviewUrl(url);
}

/**
 * iframe src for a live preview URL.
 *
 * Syte preview*.sycord.site allows framing from sycord.com via CSP
 * `frame-ancestors` (and currently sends no X-Frame-Options). Embed the
 * Syte URL directly so Vite absolute module paths (`/@vite/client`,
 * `/src/main.tsx`) resolve on the preview origin.
 *
 * The same-origin HTML proxy left those absolute paths on sycord.com → 404 →
 * blank white pane. Rewriting them to the Syte host still fails because Syte
 * CORS is fixed to `Access-Control-Allow-Origin: https://sycord.site`, which
 * rejects ES module loads from a sycord.com document.
 *
 * Keep `/api/workspace/preview-frame` as a fallback for hosts that still
 * block framing (legacy XFO / stricter CSP).
 */
export function resolvePreviewFrameSrc(
    url: string,
    source: 'live' | 'deployed' | 'syte' | null = null,
    opts?: { preferProxy?: boolean },
): string {
    if (!url) return url;
    const isSyte = source === 'syte' || isSytePreviewUrl(url);
    if (isSyte && opts?.preferProxy) {
        return `/api/workspace/preview-frame?url=${encodeURIComponent(url)}`;
    }
    // Direct embed for Syte (and non-Syte URLs that are already embeddable).
    return url;
}

/**
 * /syra uses page-level COEP credentialless (same as /builder).
 *
 * Do NOT put credentialless on the iframe itself: if we ever fall back to the
 * auth-gated preview-frame proxy, a credentialless iframe omits cookies → 401.
 */
export function shouldUseCredentiallessIframe(_url: string): boolean {
    return false;
}
