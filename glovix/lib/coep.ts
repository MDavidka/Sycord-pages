/** Safari (incl. iOS) does not enable cross-origin isolation with COEP credentialless. */
export function isSafariBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/i.test(ua);
}

export function isMobileBrowser(): boolean {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
}

/** COEP mode for the current page — must match middleware / next.config headers. */
export function getPageCoepMode(): 'credentialless' | 'require-corp' {
    if (typeof window === 'undefined') return 'credentialless';
    // /syra matches /builder: credentialless so proxied Syte Vite assets can load.
    if (window.location.pathname.includes('/syra')) return 'credentialless';
    if (isSafariBrowser()) return 'require-corp';
    return 'credentialless';
}

export function canBootWebContainer(): boolean {
    if (typeof window === 'undefined') return false;
    // Mobile devices don't support SharedArrayBuffer properly — use Syte server preview.
    if (isMobileBrowser()) return false;
    // Safari (incl. iOS) does not achieve cross-origin isolation with credentialless
    // COEP — SharedArrayBuffer is unavailable, WebContainer boot throws DataCloneError.
    if (isSafariBrowser()) return false;
    return window.crossOriginIsolated;
}
