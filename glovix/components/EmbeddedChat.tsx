'use client'
import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react';
import { ChevronLeft, RotateCw, ExternalLink, Eye, Loader2, AlertTriangle } from 'lucide-react';
import { Chat } from './Chat';
import { useStore } from '../store';
import { getHostProjectId, getChatMessages, getProject, saveChatMessages } from '../lib/api';
import { getBaseProjectFiles } from '../lib/projectTemplate';
import { mountFiles, autoInstallDependencies, smartInstall, executeCommand, getWebContainer, getCachedPreviewUrl } from '../lib/webcontainer';

type PreviewStatus = 'idle' | 'starting' | 'ready' | 'error' | 'blocked';

/**
 * Chat + live-preview experience used when Syra is embedded inside a Sycord
 * project. There is exactly ONE chat per project (keyed by host project id).
 *
 * Layout: two full-width panes in a horizontal snap-scroller — the chat (kept
 * visually identical) and a live preview of the generated Vite/React app. On
 * mobile you swipe right→left to reveal the preview; a small pill and pager dots
 * make it discoverable. The preview is the in-browser WebContainer dev server.
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
    const [activePane, setActivePane] = useState(0); // 0 = chat, 1 = preview
    const [previewStatus, setPreviewStatus] = useState<PreviewStatus>('idle');
    const [previewError, setPreviewError] = useState('');

    const fileCount = useMemo(() => Object.keys(files).length, [files]);
    const canUseWebContainer = typeof window !== 'undefined' && window.crossOriginIsolated;

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

    useLayoutEffect(() => {
        if (!chatId) return;
        setCurrentChatId(chatId);
    }, [chatId, setCurrentChatId]);

    // Boot WebContainer early so the server-ready listener is registered before
    // we spawn the dev server.
    useEffect(() => {
        if (!canUseWebContainer) return;
        void getWebContainer().catch(() => {});
        const cached = getCachedPreviewUrl();
        if (cached) setPreviewUrl(cached);
    }, [canUseWebContainer, setPreviewUrl]);

    useEffect(() => {
        if (!projectId || !chatId) return;

        let cancelled = false;

        // Clear in-memory state from the previous project before loading this one.
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
                    if (canUseWebContainer) {
                        mountFiles(project.files).catch(() => {});
                    }
                    return;
                }

                // No saved pages yet — seed the Vite baseline so preview can boot.
                if (!baseSeededRef.current) {
                    baseSeededRef.current = true;
                    const baseFiles = getBaseProjectFiles(presetId);
                    setFiles(baseFiles);
                    if (canUseWebContainer) {
                        mountFiles(baseFiles).catch(() => {});
                    }
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
    }, [projectId, chatId, setMessages, setFiles, canUseWebContainer, presetId]);

    // Boot the in-browser dev server once the project has files so the preview
    // pane shows the live site. Runs at most once per mount unless retried.
    const startPreview = useCallback(async (force = false) => {
        if (previewStartedRef.current && !force) return;

        if (typeof window === 'undefined') return;

        if (!window.crossOriginIsolated) {
            setPreviewStatus('blocked');
            setPreviewError('Live preview needs cross-origin isolation headers on this page. Hard-refresh the Syra tab — if this persists, the latest app version may not be deployed yet.');
            return;
        }

        const currentFiles = useStore.getState().files;
        if (Object.keys(currentFiles).length === 0) {
            setPreviewStatus('idle');
            setPreviewError('');
            return;
        }

        const cached = getCachedPreviewUrl();
        if (cached) {
            setPreviewUrl(cached);
            setPreviewStatus('ready');
            previewStartedRef.current = true;
            return;
        }

        previewStartedRef.current = true;
        setPreviewStatus('starting');
        setPreviewError('');

        const addOutput = useStore.getState().addTerminalOutput;
        if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = window.setTimeout(() => {
            if (!getCachedPreviewUrl() && !useStore.getState().previewUrl) {
                previewStartedRef.current = false;
                setPreviewStatus('error');
                setPreviewError('Preview timed out. Check that package.json has a "dev" script and index.html exists, then try again.');
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

            if (!installed) {
                throw new Error('Failed to install dependencies');
            }

            addOutput('$ npm run dev\n');
            executeCommand('npm', ['run', 'dev'], addOutput, -1).catch(() => {});
        } catch (err) {
            console.warn('[EmbeddedChat] preview start failed:', err);
            previewStartedRef.current = false;
            setPreviewStatus('error');
            setPreviewError(err instanceof Error ? err.message : 'Failed to start preview');
            if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
        }
    }, [setPreviewUrl]);

    useEffect(() => {
        if (previewUrl) {
            if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
            setPreviewStatus('ready');
        }
    }, [previewUrl]);

    useEffect(() => () => {
        if (previewTimeoutRef.current) window.clearTimeout(previewTimeoutRef.current);
    }, []);

    // Auto-start preview in the background when project files are available.
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
        if (iframeRef.current && previewUrl) {
            iframeRef.current.src = previewUrl;
        }
    };

    const retryPreview = () => {
        previewStartedRef.current = false;
        setPreviewError('');
        setPreviewStatus('idle');
        void startPreview(true);
    };

    const renderPreviewBody = () => {
        if (previewUrl) {
            return (
                <iframe
                    ref={iframeRef}
                    src={previewUrl}
                    className="absolute inset-0 h-full w-full border-none bg-white"
                    title="Live preview"
                    allow="cross-origin-isolated; clipboard-read; clipboard-write"
                />
            );
        }

        if (previewStatus === 'starting') {
            return (
                <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-400'}`}>
                    <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                    <p className="text-sm">Starting live preview…</p>
                    <p className="text-xs opacity-70">Installing dependencies and booting the dev server.</p>
                </div>
            );
        }

        if (previewStatus === 'blocked' || previewStatus === 'error') {
            return (
                <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-500'}`}>
                    <AlertTriangle className="h-7 w-7 text-amber-500" />
                    <p className="text-sm">{previewStatus === 'blocked' ? 'Preview unavailable' : 'Preview failed to start'}</p>
                    <p className="text-xs opacity-80">{previewError || 'Something went wrong while booting the dev server.'}</p>
                    {previewStatus === 'error' && (
                        <button
                            onClick={retryPreview}
                            className={`mt-1 rounded-lg px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-white/10 text-[#e5e5e5] hover:bg-white/15' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                        >
                            Retry preview
                        </button>
                    )}
                </div>
            );
        }

        return (
            <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-400'}`}>
                <Eye className="h-7 w-7 opacity-50" />
                <p className="text-sm">No preview yet</p>
                <p className="text-xs opacity-70">Ask Syra to build something — the live site appears here.</p>
                <button
                    onClick={() => void startPreview(true)}
                    className={`mt-1 rounded-lg px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-white/10 text-[#e5e5e5] hover:bg-white/15' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                >
                    Start preview
                </button>
            </div>
        );
    };

    return (
        <div className={`relative h-full w-full overflow-hidden ${isDark ? 'bg-[#18191B] text-[#e5e5e5]' : 'bg-white text-gray-900'}`}>
            <div
                ref={scrollerRef}
                onScroll={handleScroll}
                className="flex h-full w-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scrollbar-hide"
                style={{ scrollBehavior: 'smooth' }}
            >
                {/* Pane 1 — chat (unchanged) */}
                <div className="h-full w-full flex-shrink-0 snap-start overflow-hidden">
                    <Chat
                        onOpenPreview={() => goToPane(1)}
                        showPreviewButton={activePane === 0}
                    />
                </div>

                {/* Pane 2 — live preview */}
                <div className="h-full w-full flex-shrink-0 snap-start flex flex-col overflow-hidden">
                    <div className={`flex h-11 flex-shrink-0 items-center gap-2 border-b px-3 ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`}>
                        <button
                            onClick={() => goToPane(0)}
                            className={`flex items-center gap-1 rounded-md px-2 py-1 text-[13px] ${isDark ? 'text-[#c5c6c9] hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}
                        >
                            <ChevronLeft className="h-4 w-4" />
                            Chat
                        </button>
                        <span className={`ml-1 text-[13px] font-medium ${isDark ? 'text-[#e5e5e5]' : 'text-gray-900'}`}>Preview</span>
                        <div className="ml-auto flex items-center gap-1">
                            <button
                                onClick={reloadPreview}
                                disabled={!previewUrl}
                                title="Reload"
                                className={`rounded-md p-1.5 disabled:opacity-40 ${isDark ? 'text-[#c5c6c9] hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}
                            >
                                <RotateCw className="h-3.5 w-3.5" />
                            </button>
                            <a
                                href={previewUrl || undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open in new tab"
                                className={`rounded-md p-1.5 ${!previewUrl ? 'pointer-events-none opacity-40' : ''} ${isDark ? 'text-[#c5c6c9] hover:bg-white/5' : 'text-gray-600 hover:bg-black/5'}`}
                            >
                                <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                        </div>
                    </div>
                    <div className="relative min-h-0 flex-1 bg-white">
                        {renderPreviewBody()}
                    </div>
                </div>
            </div>

            {/* Pager dots */}
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
        </div>
    );
}
