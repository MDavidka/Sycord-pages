/**
 * Eagerly initialise Eruda when it is injected by a mobile browser extension
 * (e.g. Eruda for iOS Safari) before our React tree mounts.
 *
 * Eruda is optional third-party tooling — all errors are swallowed.
 */

declare global {
    interface Window {
        eruda?: { init?: () => void; _devTools?: unknown }
    }
}

export function initErudaIfPresent(): void {
    if (typeof window === 'undefined') return;
    const w = window;
    if (w.eruda?.init && !w.eruda._devTools) {
        try {
            w.eruda.init();
        } catch {
            // Ignore — eruda is optional.
        }
    }
}

/**
 * Watch for Eruda being injected into <head> after page load
 * (browser extensions inject it asynchronously).
 */
function watchForEruda(): void {
    if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;

    const observer = new MutationObserver(() => {
        if (window.eruda) {
            initErudaIfPresent();
            if (window.eruda._devTools) {
                // Already initialised — no need to keep watching.
                observer.disconnect();
            }
        }
    });

    const target = document.head ?? document.documentElement;
    if (target) {
        observer.observe(target, { childList: true, subtree: true });
        // Also schedule a disconnect after 30 s to avoid leaking the observer
        // on pages where eruda never appears.
        setTimeout(() => observer.disconnect(), 30_000);
    }
}

// Run immediately on import (SSR-safe) — before React hydration.
if (typeof window !== 'undefined') {
    initErudaIfPresent();
    watchForEruda();
}
