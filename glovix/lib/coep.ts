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
    if (window.location.pathname.includes('/syra')) {
        if (shouldSkipSyraCoep(navigator.userAgent)) return 'none';
        return 'credentialless';
    }
    if (isSafariBrowser()) return 'require-corp';
    return 'credentialless';
}

export function canBootWebContainer(): boolean {
    if (typeof window === 'undefined') return false;
    if (window.crossOriginIsolated) return true;
    // iOS/Safari Syra skips COEP — WebContainer is desktop-only fallback anyway.
    if (window.location.pathname.includes('/syra') && shouldSkipSyraCoep(navigator.userAgent)) {
        return false;
    }
    return window.location.pathname.includes('/syra');
}
