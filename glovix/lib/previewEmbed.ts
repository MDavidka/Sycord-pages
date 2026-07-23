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
 * /syra uses page-level COEP credentialless (same as /builder). That already
 * allows cross-origin Vite assets from preview*.sycord.site inside the
 * same-origin /api/workspace/preview-frame iframe.
 *
 * Do NOT put credentialless on the iframe itself: the preview-frame proxy is
 * auth-gated, and a credentialless iframe omits cookies → 401 → blank pane.
 */
export function shouldUseCredentiallessIframe(_url: string): boolean {
    return false;
}
