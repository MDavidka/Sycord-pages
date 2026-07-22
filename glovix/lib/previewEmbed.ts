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
 * /syra uses COEP (require-corp / credentialless). Even when HTML is loaded via
 * the same-origin preview-frame proxy, scripts/CSS still come from
 * preview*.sycord.site and need a credentialless iframe (or CORP on every asset)
 * — otherwise the iframe stays white while top-level navigation works.
 */
export function shouldUseCredentiallessIframe(url: string): boolean {
    if (typeof window === 'undefined' || !url) return false;
    if (!window.location.pathname.includes('/syra')) return false;
    // Always credentialless inside Syra: proxied HTML still pulls cross-origin assets.
    return true;
}
