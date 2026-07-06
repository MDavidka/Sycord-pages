import { isIOSUserAgent, isSafariUserAgent, shouldSkipSyraCoep } from '@/lib/coep-headers';

/** Safari (incl. iOS) does not enable cross-origin isolation with COEP credentialless. */
export function isSafariBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    return isSafariUserAgent(navigator.userAgent);
}

export function isIOSBrowser(): boolean {
    if (typeof navigator === 'undefined') return false;
    return isIOSUserAgent(navigator.userAgent);
}

/** COEP mode for the current page — must match middleware headers. */
export function getPageCoepMode(): 'credentialless' | 'require-corp' | 'none' {
    if (typeof window === 'undefined') return 'credentialless';
    if (window.location.pathname.includes('/syra')) return 'none';
    if (isSafariBrowser()) return 'require-corp';
    return 'credentialless';
}

export function canBootWebContainer(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.crossOriginIsolated) return true;
    // /syra has no COEP — WebContainer needs isolation; Syte server preview is primary.
    if (window.location.pathname.includes('/syra')) return false;
    return false;
}
