/** Whether a preview URL is cross-origin relative to the Syra shell. */
export function isCrossOriginPreviewUrl(url: string): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return new URL(url, window.location.href).origin !== window.location.origin;
    } catch {
        return false;
    }
}

/** Syte HMR preview host (preview*.sycord.site or preview*.sycord.com). */
export function isSytePreviewUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        if (!host.startsWith('preview')) return false;
        return host.endsWith('.sycord.site') || host.endsWith('.sycord.com');
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
 * /syra uses COEP credentialless on desktop Chromium (same as /builder) so Syte
 * preview assets from preview*.sycord.com can load inside the proxied iframe.
 * iOS/Safari skips COEP entirely.
 */
export function shouldUseCredentiallessIframe(url: string): boolean {
    if (typeof window === 'undefined' || !url) return false;
    if (!isCrossOriginPreviewUrl(url)) return false;
    if (!window.location.pathname.includes('/syra')) return false;
    if (!window.crossOriginIsolated) return false;
    return true;
}
