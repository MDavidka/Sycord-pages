'use client'
import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { ChevronLeft, RotateCw, ExternalLink, Eye, Loader2 } from 'lucide-react';
import { Chat } from './Chat';
import { useStore } from '../store';
import { getHostProjectId, getChatMessages, getProject, saveChatMessages } from '../lib/api';
import { mountFiles, autoInstallDependencies, smartInstall, executeCommand } from '../lib/webcontainer';

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
    const previewUrl = useStore(s => s.previewUrl);
    const isDark = theme === 'dark';

    const projectId = getHostProjectId();
    const chatId = projectId ? `project_${projectId}` : null;

    const scrollerRef = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const previewStartedRef = useRef(false);
    const [activePane, setActivePane] = useState(0); // 0 = chat, 1 = preview
    const [previewStatus, setPreviewStatus] = useState<'idle' | 'starting' | 'ready'>('idle');

    useLayoutEffect(() => {
        if (!chatId) return;
        setCurrentChatId(chatId);
    }, [chatId, setCurrentChatId]);

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
                if (cancelled || !project?.files) return;

                const files = typeof project.files === 'string'
                    ? JSON.parse(project.files)
                    : project.files;
                if (files && Object.keys(files).length > 0) {
                    setFiles(files);
                    mountFiles(files).catch(() => {});
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
    }, [projectId, chatId, setMessages, setFiles]);

    // Boot the in-browser dev server once the project has files so the preview
    // pane shows the live site. Runs at most once per mount.
    const startPreview = useCallback(async () => {
        if (previewStartedRef.current) return;
        if (typeof window === 'undefined' || !(window as any).crossOriginIsolated) return;
        const files = useStore.getState().files;
        if (Object.keys(files).length === 0) return;

        previewStartedRef.current = true;
        setPreviewStatus('starting');
        const addOutput = useStore.getState().addTerminalOutput;
        try {
            await mountFiles(files);
            await autoInstallDependencies(files, addOutput);
            await smartInstall(addOutput);
            executeCommand('npm', ['run', 'dev'], () => {}, -1).catch(() => {});
        } catch (err) {
            console.warn('[EmbeddedChat] preview start failed:', err);
            previewStartedRef.current = false;
            setPreviewStatus('idle');
        }
    }, []);

    useEffect(() => {
        if (previewUrl) setPreviewStatus('ready');
    }, [previewUrl]);

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
                    <Chat />
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
                    <div className="relative flex-1 bg-white">
                        {previewUrl ? (
                            <iframe
                                ref={iframeRef}
                                src={previewUrl}
                                className="absolute inset-0 h-full w-full border-none bg-white"
                                title="Live preview"
                                allow="cross-origin-isolated; clipboard-read; clipboard-write"
                            />
                        ) : (
                            <div className={`flex h-full flex-col items-center justify-center gap-3 px-6 text-center ${isDark ? 'bg-[#18191B] text-[#9a9b9e]' : 'bg-gray-50 text-gray-400'}`}>
                                {previewStatus === 'starting' ? (
                                    <>
                                        <Loader2 className="h-7 w-7 animate-spin text-blue-500" />
                                        <p className="text-sm">Starting live preview…</p>
                                        <p className="text-xs opacity-70">Installing dependencies and booting the dev server.</p>
                                    </>
                                ) : (
                                    <>
                                        <Eye className="h-7 w-7 opacity-50" />
                                        <p className="text-sm">No preview yet</p>
                                        <p className="text-xs opacity-70">Ask Syra to build something — the live site appears here.</p>
                                        <button
                                            onClick={() => void startPreview()}
                                            className={`mt-1 rounded-lg px-3 py-1.5 text-xs font-medium ${isDark ? 'bg-white/10 text-[#e5e5e5] hover:bg-white/15' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                                        >
                                            Start preview
                                        </button>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Floating "Preview" pill — only on the chat pane */}
            {activePane === 0 && (
                <button
                    onClick={() => goToPane(1)}
                    className={`absolute bottom-24 right-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] font-medium shadow-lg transition-all active:scale-95 ${isDark ? 'bg-white/10 text-[#e5e5e5] backdrop-blur hover:bg-white/15' : 'bg-gray-900 text-white hover:bg-gray-800'}`}
                    title="Swipe left to preview"
                >
                    <Eye className="h-4 w-4" />
                    Preview
                </button>
            )}

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
