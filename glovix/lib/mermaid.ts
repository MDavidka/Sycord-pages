
const MERMAID_URL = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.esm.min.mjs';

let mermaidInstance: any = null;
let initPromise: Promise<any> | null = null;

export const getMermaid = async (isDark: boolean) => {
    if (mermaidInstance) {
        // Update theme if needed, though usually easier to just return. 
        // Mermaid config is persistent. We might need to re-init for theme change?
        // Mermaid.initialize matches the last config.
        mermaidInstance.initialize({
            theme: isDark ? 'dark' : 'default',
            startOnLoad: false,
        });
        return mermaidInstance;
    }

    if (!initPromise) {
        initPromise = (async () => {
            try {
                const { default: m } = await import(/* webpackIgnore: true */ /* @vite-ignore */ /* turbopackIgnore: true */ MERMAID_URL);
                m.initialize({
                    startOnLoad: false, // CRITICAL: Prevents auto-scanning DOM
                    theme: isDark ? 'dark' : 'default',
                    securityLevel: 'loose',
                    fontFamily: 'Inter, system-ui, sans-serif',
                });
                // Suppress globally leaked errors
                m.setParseErrorHandler((err: any) => {
                    console.warn('Mermaid Parse Error (Suppressed):', err);
                });
                mermaidInstance = m;
                return m;
            } catch (e) {
                console.error('Failed to load mermaid', e);
                throw e;
            }
        })();
    }
    return initPromise;
};
