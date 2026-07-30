/** Safari (incl. iOS) does not enable cross-origin isolation with COEP credentialless. */
export function isSafariBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/i.test(ua);
}

/** COEP mode for the current page — must match middleware / next.config headers. */
export function getPageCoepMode(): 'credentialless' | 'require-corp' {
    if (typeof window === 'undefined') return 'credentialless';
    // /syra matches /builder: credentialless so proxied Syte Vite assets can load.
    // Safari ignores credentialless (crossOriginIsolated stays false) — preview uses Syte.
    if (window.location.pathname.includes('/syra')) return 'credentialless';
    if (isSafariBrowser()) return 'require-corp';
    return 'credentialless';
}

/**
 * True only when WebContainers can actually boot.
 * Safari never qualifies (no COEP credentialless → no SharedArrayBuffer → DataCloneError).
 * Syte server preview is the universal path for Safari + any non-isolated shell.
 */
export function canBootWebContainer(): boolean {
    if (typeof window === 'undefined') return false;
    if (isSafariBrowser()) return false;
    if (!window.crossOriginIsolated) return false;
    return typeof SharedArrayBuffer !== 'undefined';
}
