/** Mobile debug consoles sometimes inject eruda without calling init(). */
export function initErudaIfPresent(): void {
    if (typeof window === 'undefined') return;
    const w = window as Window & { eruda?: { init?: () => void; _devTools?: unknown } };
    if (w.eruda?.init && !w.eruda._devTools) {
        try {
            w.eruda.init();
        } catch {
            // Ignore — eruda is optional third-party tooling.
        }
    }
}
