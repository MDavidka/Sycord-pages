'use client'
import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, RotateCw, ExternalLink, Eye, Loader2, AlertTriangle, Rocket, Copy, Check, Globe, Zap } from 'lucide-react';
import { Chat } from './Chat';
import { useStore } from '../store';
import { getHostProjectId, getChatMessages, getProject, saveChatMessages, getProjectDeployInfo, startSytePreview } from '../lib/api';
import { getBaseProjectFiles } from '../lib/projectTemplate';
import { canBootWebContainer } from '../lib/coep';
import { mountFiles, autoInstallDependencies, smartInstall, executeCommand, getWebContainer, getCachedPreviewUrl } from '../lib/webcontainer';
import { shouldEmbedPreviewInIframe, shouldUseCredentiallessIframe, isSytePreviewUrl } from '../lib/previewEmbed';
import { warmSyraAgent } from '../lib/syra-agent';

type PreviewStatus = 'idle' | 'starting' | 'ready' | 'error' | 'blocked';
type PreviewSource = 'live' | 'deployed' | 'syte' | null;
type WorkspaceStatus = 'idle' | 'creating' | 'ready' | 'error';
type DeployStatus = 'idle' | 'deploying' | 'success' | 'error';

/**
 * Chat + live-preview experience used when Syra is embedded inside a Sycord
 * project. There is exactly ONE chat per project (keyed by host project id).
 *
 * Key behaviour:
 * - Workspace is auto-created on mount (before AI starts)
 * - Preview starts automatically when AI finishes (via onAiComplete)
 * - Preview pane shows a URL bar + Deploy button
 */
export function EmbeddedChat() {
    const theme = useStore(s => s.theme);
    const setCurrentChatId = useStore(s => s.setCurrentChatId);
    const setMessages = useStore(s => s.setMessages);
    const setFiles = useStore(s => s.setFiles);
    const files = useStore(s => s.files);
    const previewUrl = useStore(s => s.previewUrl);
    const setPreviewUrl = useStore(s => s.setPreviewUrl);
    const isDark = theme === 'dark';

    const projectId = getHostProjectId();
    const chatId = projectId ? `project_${projectId}` : null;

    const scrollerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const previewStartedRef = useRef(false);
    const baseSeededRef = useRef(false);
    const previewTimeoutRef = useRef<number | null>(null);
    const workspaceCreatedRef = useRef(false);

    const [activePane, setActivePane] = useState(0);
    const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
    const [previewError, setPreviewError] = useState('');
    const [previewSource, setPreviewSource] = useState<PreviewSource>(null);
    const [pendingDeploy, setPendingDeploy] = useState(false);

    // Workspace auto-creation state
    const [workspaceStatus, setWorkspaceStatus] = useState<WorkspaceStatus>('idle');

    // Deploy state
    const [deployStatus, setDeployStatus] = useState<DeployStatus>('idle');
    const [deployMessage, setDeployMessage] = useState('');

    // Clipboard copy state for preview URL
    const [urlCopied, setUrlCopied] = useState(false);

    const fileCount = useMemo(() => Object.keys(files).length, [files]);
    const webContainerReady = typeof window !== 'undefined' && canBootWebContainer();

    const presetId = useMemo(() => {
        if (typeof window !== 'undefined') {
            const winPreset = (window as any).__glovixPreset;
            if (winPreset) return winPreset;
        }
        try {
            const stored = sessionStorage.getItem('glovix_preset');
            if (stored) return stored;
        } catch { /* ignore */ }
        return 'b27GcrRo';
    }, []);

    // ─── Auto-create Syte workspace on project open ────────────────────────────
    useEffect(() => {
        if (!projectId || workspaceCreatedRef.current) return;
        workspaceCreatedRef.current = true;
        setWorkspaceStatus('creating');

        fetch('/api/workspace/syte', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, action: 'create_project' }),
        })
            .then(r => r.json())
            .then(data => {
                if (data?.uuid) {
                    setWorkspaceStatus('ready');
                } else {
                    // Workspace may already exist (202) or need a retry — non-fatal
                    setWorkspaceStatus(data?.ok === false ? 'error' : 'ready');
                }
            })
            .catch(() => {
                setWorkspaceStatus('error');
            });
    }, [projectId]);

    // Prewarm Syte VM agent so chat is instant and the runtime stays alive 24/7.
    useEffect(() => {
        if (!projectId || workspaceStatus !== 'ready') return;
        void warmSyraAgent(projectId).then((result) => {
            if (!result.ok) {
                console.warn('[EmbeddedChat] Syra agent warm failed:', result.error);
            }
        });
    }, [projectId, workspaceStatus]);

    // When workspace becomes ready, kick off preview immediately if files exist.
    // This starts the dev server early so HMR is live before AI finishes writing.
    useEffect(() => {
        if (workspaceStatus !== 'ready') return;
        // Reset blocked/error state from a missing UUID so auto-retry fires
        if (previewStatus === 'blocked' || previewStatus === 'error') {
            previewStartedRef.current = false;
            setPreviewStatus('idle');
            setPreviewError('');
        }
        // Start preview now if there are already files (e.g. returning to a project)
        if (fileCount > 0 && !previewStartedRef.current && previewStatus === 'idle') {
            void startPreview();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [workspaceStatus]);

    const showDeployedFallback = useCallback(async (): Promise<boolean> => {
        if (!projectId) return false;
        const deployInfo = await getProjectDeployInfo(projectId);
        setPendingDeploy(deployInfo.pendingDeploy);
        if (!deployInfo.url) return false;
        setPreviewUrl(deployInfo.url);
        setPreviewSource('deployed');
        setPreviewStatus('ready');
        previewStartedRef.current = true;
        return true;
    }, [projectId, setPreviewUrl]);

    useLayoutEffect(() => {
        if (!chatId) return;
        setCurrentChatId(chatId);
    }, [chatId, setCurrentChatId]);

    useEffect(() => {
        if (!webContainerReady) return;
        void getWebContainer().catch(() => {});
        const cached = getCachedPreviewUrl();
        if (cached) {
            setPreviewUrl(cached);
            setPreviewSource('live');
        }
    }, [webContainerReady, setPreviewUrl]);

    useEffect(() => {
        if (!projectId || !chatId) return;

        let cancelled = false;
        setMessages([]);
        setFiles({});

        (async () => {
            try {
                const data = await getChatMessages(chatId, projectId);
                if (cancelled) return;
                setMessages(Array.isArray(data?.messages) ? data.messages : []);
            } catch (err) {
                console.warn('[EmbeddedChat] Failed to restore messages:', err);
                if (!cancelled) setMessages([]);
            }

            try {
                const project = await getProject(chatId);
                if (cancelled) return;

                if (project?.files && Object.keys(project.files).length > 0) {
                    setFiles(project.files);
                    if (webContainerReady) mountFiles(project.files).catch(() => {});
                    return;
                }

                if (!baseSeededRef.current) {
                    baseSeededRef.current = true;
                    const baseFiles = getBaseProjectFiles(presetId);
                    setFiles(baseFiles);
                    if (webContainerReady) mountFiles(baseFiles).catch(() => {});
                }
            } catch (err) {
                console.warn('[EmbeddedChat] Failed to restore project files:', err);
            }
        })();

        return () => {
            cancelled = true;
            const state = useStore.getState();
            if (state.messages.length > 0) {
                void saveChatMessages(chatId, state.messages, {
                    keepalive: true,
                    projectId,
                });
            }
        };
    }, [projectId, chatId, setMessages, setFiles, webContainerReady, presetId]);

    const startSyteServerPreview = useCallback(async (): Promise<{ ok: boolean; error?: string }> => {
        if (!projectId) return { ok: false, error: 'No project id' };
        setPreviewStatus('starting');
        setPreviewError('');
        const currentFiles = useStore.getState().files;
        const result = await startSytePreview(projectId, {
            issueDomain: false,  // Don't call set_domain before preview — that's for production only
            files: Object.keys(currentFiles).length > 0 ? currentFiles : undefined,
        });
        if (result.ok && result.previewUrl) {
            setPreviewUrl(result.previewUrl);
            setPreviewSource('syte');
            setPreviewStatus('ready');
            setPendingDeploy(false);
            previewStartedRef.current = true;
            return { ok: true };
        }
        // Use preview domain URL from partial/error responses when available
        if (result.previewUrl && isSytePreviewUrl(result.previewUrl)) {
            setPreviewUrl(result.previewUrl);
            setPreviewSource('syte');
            setPreviewStatus('ready');
            previewStartedRef.current = true;
            return { ok: true };
        }
        const message = result.needsCreate
            ? 'Workspace is being set up — retrying shortly.'
            : (result.error || 'Syte preview failed to start');
        setPreviewError(message);
        previewStartedRef.current = false;
        return { ok: false, error: message };
    }, [projectId, setPreviewUrl]);

    const startLivePreview = useCallback(async (currentFiles: Record<string, { file: { contents: string } }>) => {
        const cached = getCachedPreviewUrl();
        if (cached) {
            setPreviewUrl(cached);
            setPreviewSource('live');
            setPreviewStatus('ready');
            previewStartedRef.current = true;
            return;
        }

        previewStartedRef.current = true;
        setPreviewStatus('starting');
        setPreviewError('');
        setPreviewSource('live');

        const addOutput = useStore.getState().addTerminalOutput;
        if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = window.setTimeout(() => {
            if (!getCachedPreviewUrl() && !useStore.getState().previewUrl) {
                previewStartedRef.current = false;
                setPreviewStatus('error');
                setPreviewError('Preview timed out. Check package.json has a "dev" script and index.html exists.');
            }
        }, 90_000);

        try {
            await getWebContainer();
            await mountFiles(currentFiles);
            await autoInstallDependencies(currentFiles, addOutput);

            let installed = await smartInstall(addOutput);
            if (!installed) {
                addOutput('$ npm install (fallback)\n');
                const exitCode = await executeCommand('npm', ['install'], addOutput, 180_000);
                installed = exitCode === 0;
            }

            if (!installed) throw new Error('Failed to install dependencies');

            addOutput('$ npm run dev\n');
            executeCommand('npm', ['run', 'dev'], addOutput, -1).catch(() => {});
        } catch (err) {
            console.warn('[EmbeddedChat] live preview failed:', err);
            previewStartedRef.current = false;
            if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
            const usedFallback = await showDeployedFallback();
            if (!usedFallback) {
                setPreviewStatus('error');
                setPreviewError(err instanceof Error ? err.message : 'Failed to start live preview');
            }
        }
    }, [setPreviewUrl, showDeployedFallback]);

    const startPreview = useCallback(async (force = false) => {
        if (previewStartedRef.current && !force) return;
        if (typeof window === 'undefined') return;

        const currentFiles = useStore.getState().files;
        if (Object.keys(currentFiles).length === 0) {
            setPreviewStatus('idle');
            setPreviewError('');
            return;
        }

        // Primary: Syte server preview (https://sycord.site/api/ — works on mobile)
        let syteError = '';
        if (projectId) {
            const syte = await startSyteServerPreview();
            if (syte.ok) return;
            syteError = syte.error || '';
        }

        // Secondary: in-browser WebContainer (desktop / isolated shells only)
        const isMobile = window.matchMedia('(max-width: 768px)').matches;
        const shouldTryWebContainer =
            !isMobile &&
            webContainerReady &&
            (window.crossOriginIsolated || window.location.pathname.includes('/syra'));
        if (shouldTryWebContainer) {
            await startLivePreview(currentFiles);
            return;
        }

        const usedFallback = await showDeployedFallback();
        if (usedFallback) {
            setPreviewStatus('ready');
            return;
        }

        setPreviewStatus('blocked');
        setPreviewError(
            syteError ||
            'Preview could not start. The workspace may still be initialising — tap Retry to try again.'
        );
    }, [projectId, startSyteServerPreview, startLivePreview, showDeployedFallback, webContainerReady]);

    // Called by Chat when AI finishes a complete response.
    // If preview is already running (HMR handles live updates via per-file uploads),
    // we skip the force-restart. Only re-sync + restart when preview isn't live yet.
    const handleAiComplete = useCallback(() => {
        if (typeof window === 'undefined') return;
        const currentFiles = useStore.getState().files;
        if (Object.keys(currentFiles).length === 0) return;
        if (previewStartedRef.current && previewUrl) {
            // Dev server is live. Give Vite ~2.5 s to recompile the new files,
            // then reload the proxy iframe so the updated site appears.
            setTimeout(() => {
                if (iframeRef.current && previewUrl) {
                    const src = (previewSource === 'syte' || isSytePreviewUrl(previewUrl))
                        ? `/api/workspace/preview-frame?url=${encodeURIComponent(previewUrl)}`
                        : previewUrl;
                    iframeRef.current.src = src;
                }
            }, 2500);
            return;
        }
        // Preview not yet live — do a full sync + start
        previewStartedRef.current = false;
        setPreviewStatus('idle');
        setPreviewError('');
        void startPreview(true);
    }, [startPreview, previewUrl]);

    useEffect(() => {
        if (previewUrl) {
            if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
            setPreviewStatus('ready');
        }
    }, [previewUrl]);

    useEffect(() => () => {
        if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
    }, []);

    useEffect(() => {
        if (fileCount === 0 || previewUrl || previewStatus !== 'idle') return;
        void startPreview();
    }, [fileCount, previewUrl, previewStatus, startPreview]);

    const goToPane = useCallback((i: number) => {
        const el = scrollerRef.current;
        if (!el) return;
        el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
        setActivePane(i);
        if (i === 1) void startPreview();
    }, [startPreview]);

    const handleScroll = useCallback(() => {
        const el = scrollerRef.current;
        if (!el) return;
        const pane = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        if (pane !== activePane) {
            setActivePane(pane);
            if (pane === 1) void startPreview();
        }
    }, [activePane, startPreview]);

    const reloadPreview = () => {
        if (!iframeRef.current || !previewUrl) return;
        const src = (previewSource === 'syte' || isSytePreviewUrl(previewUrl))
            ? `/api/workspace/preview-frame?url=${encodeURIComponent(previewUrl)}`
            : previewUrl;
        iframeRef.current.src = src;
    };

    const applyIframeEmbedAttrs = useCallback((el: HTMLIFrameElement | null) => {
        iframeRef.current = el;
        if (!el || !previewUrl) return;
        if (shouldUseCredentiallessIframe(previewUrl)) {
            el.setAttribute('credentialless', '');
        } else {
            el.removeAttribute('credentialless');
        }
    }, [previewUrl]);

    const retryPreview = () => {
        previewStartedRef.current = false;
        setPreviewError('');
        setPreviewStatus('idle');
        setPreviewSource(null);
        setPreviewUrl(null);
        void startPreview(true);
    };

    const copyPreviewUrl = async () => {
        if (!previewUrl) return;
        try {
            await navigator.clipboard.writeText(previewUrl);
            setUrlCopied(true);
            setTimeout(() => setUrlCopied(false), 2000);
        } catch { /* ignore */ }
    };

    const deployToProduction = async () => {
        if (!projectId || deployStatus === 'deploying') return;
        setDeployStatus('deploying');
        setDeployMessage('');
        try {
            const res = await fetch('/api/workspace/sycord', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'issue_deployment', projectId }),
            });
            const data = await res.json().catch(() => ({} as any));
            if (res.ok && data.ok) {
                setDeployStatus('success');
                setDeployMessage(data?.message || 'Deployment started — check Settings for live URL.');
                setPendingDeploy(false);
            } else {
                setDeployStatus('error');
                setDeployMessage(data?.error || data?.message || `Deploy failed (HTTP ${res.status})`);
            }
        } catch (e: any) {
            setDeployStatus('error');
            setDeployMessage(e.message || 'Deploy request failed');
        }
        setTimeout(() => {
            if (deployStatus !== 'idle') setDeployStatus('idle');
        }, 8000);
    };

    const previewLabel =
        previewSource === 'syte' ? 'Syte live preview' :
        previewSource === 'deployed' ? 'Deployed site' : 'Live preview';

    // Compact preview URL display (hostname only)
    const previewHost = (() => {
        if (!previewUrl) return null;
        try { return new URL(previewUrl).hostname; } catch { return previewUrl; }
    })();

    const renderPreviewBody = () => {
        if (previewUrl) {
            // Syte preview subdomains send X-Frame-Options: SAMEORIGIN which the browser
            // enforces for any cross-origin parent (sycord.com ≠ preview*.sycord.com/site).
            // Route through our server-side proxy that strips the header and injects
            // <base href> so assets still load directly from the Syte dev server.
            const isSyte = previewSource === 'syte' || isSytePreviewUrl(previewUrl);
            const frameUrl = isSyte
                ? `/api/workspace/preview-frame?url=${encodeURIComponent(previewUrl)}`
                : previewUrl;

            const embedInline = isSyte ? true : shouldEmbedPreviewInIframe(previewUrl, previewSource);

            if (!embedInline) {
                return (
                    <div className={`flex h-full flex-col items-center justify-center gap-4 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-500'}`}>
                        <ExternalLink className="h-8 w-8 text-blue-500" />
                        <p className="text-sm font-medium">Open your site in the browser</p>
                        <p className="text-xs opacity-80">
                            {previewSource === 'deployed'
                                ? pendingDeploy
                                    ? 'New changes are not deployed yet. Tap Retry to load the Syte live preview.'
                                    : 'Deployed sites block in-app preview for security. Tap Retry for the Syte live preview.'
                                : 'This preview URL cannot be embedded here.'}
                        </p>
                        {previewError && previewSource === 'deployed' && (
                            <p className="text-xs text-amber-500/90">{previewError}</p>
                        )}
                        <a
                            href={previewUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`rounded-lg px-4 py-2 text-sm font-medium ${isDark ? 'bg-white text-[#18191B] hover:bg-white/90' : 'bg-gray-900 text-white hover:bg-gray-800'} transition-colors`}
                        >
                            Open live site
                        </a>
                        <button
                            onClick={retryPreview}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-white/10 text-[#e5e5e5] hover:bg-white/15' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'} transition-colors`}
                        >
                            Retry live preview
                        </button>
                    </div>
                );
            }

            return (
                <>
                    {previewSource === 'deployed' && (
                        <div className={`absolute left-0 right-0 top-0 z-10 border-b px-3 py-1.5 text-center text-[11px] ${isDark ? 'border-[#2a2b2e] bg-[#18191B]/90 text-[#9a9b9e]' : 'border-gray-200 bg-gray-50/95 text-gray-500'}`}>
                            {pendingDeploy
                                ? 'New deployment available — deploy to update the live site.'
                                : 'Showing deployed site — deploy after changes to update.'}
                        </div>
                    )}
                    {previewSource === 'syte' && (
                        <div className={`absolute left-0 right-0 top-0 z-10 border-b px-3 py-1.5 text-center text-[11px] flex items-center justify-center gap-1.5 ${isDark ? 'border-[#2a2b2e] bg-[#18191B]/90 text-[#9a9b9e]' : 'border-gray-200 bg-gray-50/95 text-gray-500'}`}>
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                            Live preview — updates on every file save
                        </div>
                    )}
                    <iframe
                        ref={applyIframeEmbedAttrs}
                        src={frameUrl}
                        className={`absolute inset-0 h-full w-full border-none bg-white ${previewSource === 'deployed' || previewSource === 'syte' ? 'pt-8' : ''}`}
                        title={previewLabel}
                        allow="cross-origin-isolated; clipboard-read; clipboard-write"
                        referrerPolicy="no-referrer-when-downgrade"
                    />
                </>
            );
        }

        if (previewStatus === 'starting') {
            return (
                <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-400'}`}>
                    <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                    <p className="text-sm font-medium">Starting preview…</p>
                    <p className="text-xs opacity-70">Syncing files and booting the dev server.</p>
                </div>
            );
        }

        if (previewStatus === 'blocked' || previewStatus === 'error') {
            return (
                <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-500'}`}>
                    <AlertTriangle className="h-7 w-7 text-amber-500" />
                    <p className="text-sm font-medium">{previewStatus === 'blocked' ? 'Preview unavailable' : 'Preview failed'}</p>
                    <p className="text-xs opacity-80 max-w-xs">{previewError}</p>
                    <button
                        onClick={retryPreview}
                        className={`mt-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isDark ? 'bg-white/10 text-[#e5e5e5] hover:bg-white/15' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                        Retry preview
                    </button>
                </div>
            );
        }

        return (
            <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-400'}`}>
                <Eye className="h-7 w-7 opacity-40" />
                <p className="text-sm font-medium">No preview yet</p>
                <p className="text-xs opacity-70 max-w-xs">
                    {workspaceStatus === 'creating'
                        ? 'Setting up workspace…'
                        : 'Build something with Syra — the live site appears here automatically.'}
                </p>
                {fileCount > 0 && workspaceStatus === 'ready' && (
                    <button
                        onClick={() => void startPreview(true)}
                        className={`mt-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isDark ? 'bg-white/10 text-[#e5e5e5] hover:bg-white/15' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    >
                        Start preview
                    </button>
                )}
            </div>
        );
    };

    // Preview pane header
    const renderPreviewHeader = () => (
        <div className={`flex h-11 flex-shrink-0 items-center gap-1.5 border-b px-2 ${isDark ? 'border-[#2a2b2e] bg-[#1a1b1e]' : 'border-gray-200 bg-white'}`}>
            {/* Back to chat */}
            <button
                onClick={() => goToPane(0)}
                className={`flex items-center gap-0.5 rounded-md px-1.5 py-1 text-[13px] flex-shrink-0 transition-colors ${isDark ? 'text-[#c5c6c9] hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}
            >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Chat</span>
            </button>

            {/* Preview URL bar (when available) */}
            {previewHost ? (
                <button
                    onClick={copyPreviewUrl}
                    title={previewUrl || ''}
                    className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] transition-colors ${isDark ? 'bg-[#2a2b2e] text-[#c5c6c9] hover:bg-[#333436]' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                >
                    <Globe className="h-3 w-3 flex-shrink-0 text-green-500" />
                    <span className="truncate font-mono">{previewHost}</span>
                    {urlCopied
                        ? <Check className="h-3 w-3 flex-shrink-0 text-green-500" />
                        : <Copy className="h-3 w-3 flex-shrink-0 opacity-50" />
                    }
                </button>
            ) : (
                <div className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-2 py-1 text-[11px] ${isDark ? 'bg-[#2a2b2e] text-[#666]' : 'bg-gray-100 text-gray-400'}`}>
                    {workspaceStatus === 'creating' ? (
                        <>
                            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />
                            <span className="truncate">Setting up workspace…</span>
                        </>
                    ) : previewStatus === 'starting' ? (
                        <>
                            <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin text-blue-400" />
                            <span className="truncate">Starting preview…</span>
                        </>
                    ) : (
                        <>
                            <Globe className="h-3 w-3 flex-shrink-0 opacity-40" />
                            <span className="truncate">Preview URL</span>
                        </>
                    )}
                </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-shrink-0 items-center gap-0.5">
                {/* Reload */}
                <button
                    onClick={reloadPreview}
                    disabled={!previewUrl}
                    title="Reload preview"
                    className={`rounded-md p-1.5 disabled:opacity-30 transition-colors ${isDark ? 'text-[#c5c6c9] hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}
                >
                    <RotateCw className="h-3.5 w-3.5" />
                </button>

                {/* Open in new tab */}
                <a
                    href={previewUrl || undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Open in new tab"
                    className={`rounded-md p-1.5 transition-colors ${!previewUrl ? 'pointer-events-none opacity-30' : ''} ${isDark ? 'text-[#c5c6c9] hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}
                >
                    <ExternalLink className="h-3.5 w-3.5" />
                </a>

                {/* Deploy to production */}
                <button
                    onClick={deployToProduction}
                    disabled={deployStatus === 'deploying' || !projectId}
                    title={deployStatus === 'success' ? (deployMessage || 'Deployed!') : deployStatus === 'error' ? deployMessage : 'Deploy to production'}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium disabled:opacity-50 transition-colors ml-0.5 ${
                        deployStatus === 'success'
                            ? isDark ? 'bg-green-600/20 text-green-400' : 'bg-green-100 text-green-700'
                            : deployStatus === 'error'
                            ? isDark ? 'bg-red-600/20 text-red-400' : 'bg-red-100 text-red-700'
                            : isDark ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/30' : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                >
                    {deployStatus === 'deploying' ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                    ) : deployStatus === 'success' ? (
                        <Check className="h-3 w-3" />
                    ) : (
                        <Rocket className="h-3 w-3" />
                    )}
                    <span className="hidden sm:inline">
                        {deployStatus === 'deploying' ? 'Deploying…' : deployStatus === 'success' ? 'Deployed' : deployStatus === 'error' ? 'Failed' : 'Deploy'}
                    </span>
                </button>
            </div>
        </div>
    );

    return (
        <div className={`relative h-full w-full overflow-hidden ${isDark ? 'bg-[#18191B] text-[#e5e5e5]' : 'bg-white text-gray-900'}`}>
            <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="flex h-full w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Chat pane */}
                <div className="h-full w-full flex-shrink-0 snap-start overflow-hidden">
                    <Chat
                        onOpenPreview={() => goToPane(1)}
                        showPreviewButton={activePane === 0}
                        onAiComplete={handleAiComplete}
                    />
                </div>

                {/* Preview pane */}
                <div className="h-full w-full flex-shrink-0 snap-start flex flex-col overflow-hidden">
                    {renderPreviewHeader()}
                    <div className="relative min-h-0 flex-1 bg-white">
                        {renderPreviewBody()}
                    </div>
                </div>
            </div>

            {/* Pane indicators */}
            <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5">
                {[0, 1].map((i) => (
                    <span
                        key={i}
                        className={`h-1.5 rounded-full transition-all ${
                            activePane === i
                                ? isDark ? 'w-4 bg-white/80' : 'w-4 bg-gray-900/80'
                                : isDark ? 'w-1.5 bg-white/30' : 'w-1.5 bg-gray-900/25'
                        }`}
                    />
                ))}
            </div>

            {/* Deploy status toast */}
            {deployStatus === 'error' && deployMessage && (
                <div className="pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-medium bg-red-600 text-white shadow-lg">
                    <Zap className="mr-1 inline h-3 w-3" />
                    {deployMessage.length > 60 ? deployMessage.slice(0, 60) + '…' : deployMessage}
                </div>
            )}
        </div>
    );
}
