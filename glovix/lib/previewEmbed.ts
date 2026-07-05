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
 * Syte preview URLs (preview*.sycord.site) are on a different origin than the Sycord
 * app (sycord.com), so SAMEORIGIN headers from the Caddy reverse proxy silently blank
 * the iframe. Show an open-in-browser card for both instead of a blank iframe.
 */
export function shouldEmbedPreviewInIframe(url: string, source: 'live' | 'deployed' | 'syte' | null): boolean {
    if (!url) return false;
    // Deployed sites and Syte HMR previews cannot be embedded cross-origin.
    if (source === 'deployed' || source === 'syte') return false;
    if (isSytePreviewUrl(url)) return false;
    if (source === 'live') {
        // WebContainer dev server — same shell origin or blob; embed when possible.
        return !isCrossOriginPreviewUrl(url) || url.startsWith('blob:');
    }
    return !isCrossOriginPreviewUrl(url);
}

/**
 * /syra uses COEP require-corp. Cross-origin iframes need credentialless or CORP
 * headers on the child — otherwise the iframe stays white while top-level navigation works.
 */
export function shouldUseCredentiallessIframe(url: string): boolean {
    if (typeof window === 'undefined' || !url) return false;
    if (!isCrossOriginPreviewUrl(url)) return false;
    if (!window.location.pathname.includes('/syra')) return false;
    return true;
}
