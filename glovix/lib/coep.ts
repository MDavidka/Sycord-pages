/** Safari (incl. iOS) does not enable cross-origin isolation with COEP credentialless. */
export function isSafariBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    const ua = navigator.userAgent;
    return /Safari/i.test(ua) && !/Chrome|Chromium|CriOS|FxiOS|EdgiOS/i.test(ua);
}

/** COEP mode for the current page — must match middleware / next.config headers. */
export function getPageCoepMode(): 'credentialless' | 'require-corp' {
    if (typeof window === 'undefined') return 'credentialless';
    if (window.location.pathname.includes('/syra')) return 'require-corp';
    if (isSafariBrowser()) return 'require-corp';
    return 'credentialless';
}

export function canBootWebContainer(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.crossOriginIsolated) return true;
    // Safari uses require-corp on /syra — still attempt boot; isolation may lag one tick.
    return window.location.pathname.includes('/syra');
}
