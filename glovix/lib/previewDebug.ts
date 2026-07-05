import { isSytePreviewUrl, shouldUseCredentiallessIframe } from './previewEmbed';

const DEBUG_PREFIX = '[PreviewDebug]';
const DEBUG_STORAGE_KEY = 'sycord:preview-debug';

export type PreviewSource = 'live' | 'deployed' | 'syte' | null;

export type PreviewEmbedContext = {
    frameUrl: string;
    previewUrl: string;
    previewSource: PreviewSource;
    crossOriginIsolated: boolean;
    pathname: string;
    credentiallessNeeded: boolean;
    isMobile: boolean;
    isSyte: boolean;
};

export type IframeDocumentDiagnosis = {
    bodyTextLength: number;
    bodyHtmlLength: number;
    title: string;
    hasRoot: boolean;
    rootChildCount: number;
    looksBlank: boolean;
    proxyErrorText: string | null;
    reason: string | null;
};

const PROXY_ERROR_PATTERNS = [
    'Unauthorized',
    'Missing url param',
    'Bad url encoding',
    'URL not allowed',
    'Preview server unreachable',
] as const;

/** Client verbose logs: ?previewDebug=1 or localStorage sycord:preview-debug=1 */
export function isPreviewDebugEnabled(): boolean {
    if (typeof window === 'undefined') return true;
    try {
        if (new URLSearchParams(window.location.search).get('previewDebug') === '1') return true;
        return localStorage.getItem(DEBUG_STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

export function logPreviewDebug(phase: string, data?: Record<string, unknown>): void {
    const payload = { phase, ...(data ?? {}) };
    if (typeof window === 'undefined') {
        console.warn(DEBUG_PREFIX, payload);
        return;
    }
    if (!isPreviewDebugEnabled()) return;
    console.warn(DEBUG_PREFIX, payload);
}

/** Always logs warnings (blank iframe, proxy failures) regardless of debug flag. */
export function logPreviewWarn(phase: string, data?: Record<string, unknown>): void {
    console.warn(DEBUG_PREFIX, { phase, ...(data ?? {}) });
}

export function buildPreviewFrameUrl(previewUrl: string, previewSource: PreviewSource): string {
    const isSyte = previewSource === 'syte' || isSytePreviewUrl(previewUrl);
    return isSyte
        ? `/api/workspace/preview-frame?url=${encodeURIComponent(previewUrl)}`
        : previewUrl;
}

export function getPreviewEmbedContext(
    previewUrl: string,
    previewSource: PreviewSource,
): PreviewEmbedContext {
    const isSyte = previewSource === 'syte' || isSytePreviewUrl(previewUrl);
    const frameUrl = buildPreviewFrameUrl(previewUrl, previewSource);
    const isMobile =
        typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;

    return {
        frameUrl,
        previewUrl,
        previewSource,
        crossOriginIsolated: typeof window !== 'undefined' && window.crossOriginIsolated,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '',
        credentiallessNeeded: shouldUseCredentiallessIframe(previewUrl),
        isMobile,
        isSyte,
    };
}

function detectProxyErrorText(bodyText: string): string | null {
    const trimmed = bodyText.trim();
    if (!trimmed) return null;
    for (const pattern of PROXY_ERROR_PATTERNS) {
        if (trimmed.startsWith(pattern) || trimmed.includes(pattern)) {
            return trimmed.slice(0, 300);
        }
    }
    return null;
}

function inferBlankReason(
    diagnosis: Omit<IframeDocumentDiagnosis, 'reason'>,
    embedContext?: PreviewEmbedContext,
): string | null {
    if (diagnosis.proxyErrorText) return 'proxy_error';
    if (!diagnosis.looksBlank) return null;

    if (embedContext?.crossOriginIsolated && embedContext.credentiallessNeeded) {
        return 'coep_asset_block_suspected';
    }
    if (diagnosis.hasRoot && diagnosis.rootChildCount === 0) {
        return 'vite_shell_empty_root';
    }
    if (diagnosis.bodyHtmlLength > 0 && diagnosis.bodyTextLength === 0) {
        return 'html_without_visible_text';
    }
    return 'blank_document';
}

export function diagnoseIframeDocument(
    doc: Document | null,
    embedContext?: PreviewEmbedContext,
): IframeDocumentDiagnosis {
    if (!doc) {
        const base = {
            bodyTextLength: 0,
            bodyHtmlLength: 0,
            title: '',
            hasRoot: false,
            rootChildCount: 0,
            looksBlank: true,
            proxyErrorText: null as string | null,
            reason: 'no_document_access',
        };
        return base;
    }

    const body = doc.body;
    const bodyText = body?.innerText?.trim() ?? '';
    const bodyHtml = body?.innerHTML?.trim() ?? '';
    const root = doc.querySelector('#root');
    const proxyErrorText = detectProxyErrorText(bodyText || bodyHtml);

    const diagnosis: IframeDocumentDiagnosis = {
        bodyTextLength: bodyText.length,
        bodyHtmlLength: bodyHtml.length,
        title: doc.title || '',
        hasRoot: Boolean(root),
        rootChildCount: root?.childElementCount ?? 0,
        looksBlank: proxyErrorText
            ? true
            : bodyText.length < 20 && (root?.childElementCount ?? 0) === 0 && bodyHtml.length < 200,
        proxyErrorText,
        reason: null,
    };

    diagnosis.reason = inferBlankReason(diagnosis, embedContext);
    return diagnosis;
}

export function describeBlankIframe(
    diagnosis: IframeDocumentDiagnosis,
    embedContext?: PreviewEmbedContext,
): string {
    switch (diagnosis.reason) {
        case 'proxy_error':
            return diagnosis.proxyErrorText || 'Preview proxy returned an error.';
        case 'coep_asset_block_suspected':
            return 'Preview loaded but assets may be blocked by COEP (cross-origin isolation).';
        case 'vite_shell_empty_root':
            return 'Preview HTML loaded but the app root is empty — dev server may still be compiling.';
        case 'no_document_access':
            return 'Cannot read iframe document (cross-origin or blocked embed).';
        case 'html_without_visible_text':
            return 'Preview HTML loaded with no visible content.';
        case 'blank_document':
            return 'Preview iframe is blank — dev server may not be ready yet.';
        default:
            return 'Preview iframe appears blank.';
    }
}
