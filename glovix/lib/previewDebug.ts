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

export type ProxyProbeResult = {
    ok: boolean;
    status: number;
    contentType: string;
    bodyPreview?: string;
    htmlBytes?: number;
    proxyErrorText?: string | null;
};

export type IframeInspectOptions = {
    credentiallessApplied?: boolean;
    proxyProbe?: ProxyProbeResult | null;
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
    documentAccessible: boolean;
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

export function detectProxyErrorText(bodyText: string): string | null {
    const trimmed = bodyText.trim();
    if (!trimmed) return null;
    for (const pattern of PROXY_ERROR_PATTERNS) {
        if (trimmed.startsWith(pattern) || trimmed.includes(pattern)) {
            return trimmed.slice(0, 300);
        }
    }
    return null;
}

export function analyzeProxyProbeResponse(
    status: number,
    contentType: string,
    bodyText: string,
): ProxyProbeResult {
    const proxyErrorText = detectProxyErrorText(bodyText);
    const isHtml = contentType.includes('text/html');
    const htmlBytes = isHtml ? bodyText.length : undefined;
    const ok = status >= 200 && status < 300 && !proxyErrorText && (!isHtml || bodyText.length >= 200);

    return {
        ok,
        status,
        contentType,
        bodyPreview: bodyText.slice(0, 200) || undefined,
        htmlBytes,
        proxyErrorText,
    };
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

function diagnoseWithoutDocument(
    embedContext?: PreviewEmbedContext,
    options?: IframeInspectOptions,
): IframeDocumentDiagnosis {
    const credentiallessApplied = options?.credentiallessApplied ?? false;
    const proxyProbe = options?.proxyProbe;
    const usesSameOriginProxy = embedContext?.frameUrl.startsWith('/api/workspace/preview-frame') ?? false;

    if (proxyProbe?.proxyErrorText) {
        return {
            bodyTextLength: 0,
            bodyHtmlLength: 0,
            title: '',
            hasRoot: false,
            rootChildCount: 0,
            looksBlank: true,
            proxyErrorText: proxyProbe.proxyErrorText,
            reason: 'proxy_error',
            documentAccessible: false,
        };
    }

    if (proxyProbe && !proxyProbe.ok && proxyProbe.status >= 400) {
        return {
            bodyTextLength: 0,
            bodyHtmlLength: 0,
            title: '',
            hasRoot: false,
            rootChildCount: 0,
            looksBlank: true,
            proxyErrorText: proxyProbe.bodyPreview || `Preview proxy HTTP ${proxyProbe.status}`,
            reason: 'proxy_error',
            documentAccessible: false,
        };
    }

    // credentialless iframes intentionally hide contentDocument from the parent,
    // even when src is same-origin (/api/workspace/preview-frame).
    if (credentiallessApplied && usesSameOriginProxy) {
        if (proxyProbe?.ok && embedContext?.crossOriginIsolated) {
            return {
                bodyTextLength: 0,
                bodyHtmlLength: proxyProbe.htmlBytes ?? 0,
                title: '',
                hasRoot: false,
                rootChildCount: 0,
                looksBlank: false,
                proxyErrorText: null,
                reason: 'credentialless_opaque_coep',
                documentAccessible: false,
            };
        }
        return {
            bodyTextLength: 0,
            bodyHtmlLength: proxyProbe?.htmlBytes ?? 0,
            title: '',
            hasRoot: false,
            rootChildCount: 0,
            looksBlank: false,
            proxyErrorText: null,
            reason: 'credentialless_opaque',
            documentAccessible: false,
        };
    }

    if (embedContext && !usesSameOriginProxy && embedContext.frameUrl !== embedContext.previewUrl) {
        return {
            bodyTextLength: 0,
            bodyHtmlLength: 0,
            title: '',
            hasRoot: false,
            rootChildCount: 0,
            looksBlank: true,
            proxyErrorText: null,
            reason: 'cross_origin_embed',
            documentAccessible: false,
        };
    }

    return {
        bodyTextLength: 0,
        bodyHtmlLength: 0,
        title: '',
        hasRoot: false,
        rootChildCount: 0,
        looksBlank: true,
        proxyErrorText: null,
        reason: 'no_document_access',
        documentAccessible: false,
    };
}

export function diagnoseIframeDocument(
    doc: Document | null,
    embedContext?: PreviewEmbedContext,
    options?: IframeInspectOptions,
): IframeDocumentDiagnosis {
    if (!doc) {
        return diagnoseWithoutDocument(embedContext, options);
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
        documentAccessible: true,
    };

    diagnosis.reason = inferBlankReason(diagnosis, embedContext);
    return diagnosis;
}

export function describeBlankIframe(
    diagnosis: IframeDocumentDiagnosis,
    embedContext?: PreviewEmbedContext,
): string | null {
    switch (diagnosis.reason) {
        case 'proxy_error':
            return diagnosis.proxyErrorText || 'Preview proxy returned an error.';
        case 'coep_asset_block_suspected':
            return 'Preview loaded but assets may be blocked by COEP (cross-origin isolation). Try Open in new tab.';
        case 'vite_shell_empty_root':
            return 'Preview HTML loaded but the app root is empty — dev server may still be compiling.';
        case 'credentialless_opaque':
            return null;
        case 'credentialless_opaque_coep':
            return 'Preview proxy returned HTML. If the frame is still white, scripts may be blocked by COEP — try Open in new tab.';
        case 'cross_origin_embed':
            return 'Preview is embedded cross-origin; in-app inspection is unavailable.';
        case 'no_document_access':
            return 'Cannot inspect iframe contents yet — waiting for preview HTML.';
        case 'html_without_visible_text':
            return 'Preview HTML loaded with no visible content.';
        case 'blank_document':
            return 'Preview iframe is blank — dev server may not be ready yet.';
        default:
            return diagnosis.looksBlank ? 'Preview iframe appears blank.' : null;
    }
}

export function shouldShowBlankHint(
    diagnosis: IframeDocumentDiagnosis,
): boolean {
    if (!diagnosis.looksBlank && !diagnosis.proxyErrorText) return false;
    const hint = describeBlankIframe(diagnosis);
    return Boolean(hint);
}
