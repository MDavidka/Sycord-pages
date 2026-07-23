'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { Code2, Play, ChevronDown, ChevronUp, RotateCw, Download, Zap, Loader2, TerminalSquare, Trash2, AlertTriangle, Maximize2, Minimize2, MousePointer2, PanelLeft } from 'lucide-react';
import { useStore } from '../store';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { ErrorPanel } from './ErrorPanel';
import { FileExplorer } from './FileExplorer';
import { SkeletonFileTree, SkeletonCodeEditor } from './SkeletonLoader';
import { executeCommand, mountFiles, autoInstallDependencies, smartInstall } from '../lib/webcontainer';
import { canBootWebContainer } from '../lib/coep';
import { createCleanTerminalWriter } from '../lib/tools';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export function Workbench() {
    const [activeTab, setActiveTab] = useState<'code' | 'preview'>('code');
    const [terminalTab, setTerminalTab] = useState<'terminal' | 'errors'>('terminal');
    const previewUrl = useStore(s => s.previewUrl);
    const addTerminalOutput = useStore(s => s.addTerminalOutput);
    const clearTerminalOutput = useStore(s => s.clearTerminalOutput);
    const parsedErrors = useStore(s => s.parsedErrors);
    const clearParsedErrors = useStore(s => s.clearParsedErrors);
    const files = useStore(s => s.files);
    const theme = useStore(s => s.theme);
    const [status, setStatus] = useState<'idle' | 'installing' | 'starting' | 'running' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [showTerminal, setShowTerminal] = useState(true);
    const [terminalHeight, setTerminalHeight] = useState(220);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showFilesMobile, setShowFilesMobile] = useState(false);
    const [urlPath, setUrlPath] = useState('/');
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const fullscreenIframeRef = useRef<HTMLIFrameElement>(null);
    const isDragging = useRef(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const isDark = theme === 'dark';
    const MIN_TERMINAL_HEIGHT = 80;
    const MAX_TERMINAL_HEIGHT = 500;

    const elementPickerActive = useStore(s => s.elementPickerActive);
    const setElementPickerActive = useStore(s => s.setElementPickerActive);
    const setSelectedElement = useStore(s => s.setSelectedElement);

    useEffect(() => {
        const handleMessage = (e: MessageEvent) => {
            if (e.data?.type === 'glovix-element-selected') {
                setSelectedElement({
                    tag: e.data.tag || '',
                    text: e.data.text || '',
                    selector: e.data.selector || '',
                });
                setElementPickerActive(false);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [setSelectedElement, setElementPickerActive]);

    useEffect(() => {
        const iframe = iframeRef.current || fullscreenIframeRef.current;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'glovix-picker', active: elementPickerActive }, '*');
        }
    }, [elementPickerActive]);

    const getFullUrl = (path: string) => {
        if (!previewUrl) return '';
        const base = previewUrl.replace(/\/$/, '');
        return base + (path.startsWith('/') ? path : '/' + path);
    };

    const navigateTo = (path: string) => {
        const url = getFullUrl(path);
        if (iframeRef.current) iframeRef.current.src = url;
        if (fullscreenIframeRef.current) fullscreenIframeRef.current.src = url;
    };

    const handleUrlPathChange = (value: string) => {
        if (!value.startsWith('/')) {
            setUrlPath('/' + value);
        } else {
            setUrlPath(value);
        }
    };

    const handleUrlKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            navigateTo(urlPath);
        }
    };

    useEffect(() => {
        if (previewUrl) {
            setActiveTab('preview');
            setStatus('running');
        }
    }, [previewUrl]);

    useEffect(() => {
        const init = async () => {
            if (Object.keys(files).length === 0) return;
            if (!canBootWebContainer()) {
                // Safari / non-isolated: skip in-browser mount — Syte preview handles live view.
                return;
            }
            try {
                await mountFiles(files);
            } catch (error: any) {
                console.warn('[Workbench] Mount skipped/failed:', error?.message || error);
                // Don't hard-fail the workbench UI — Preview can still use Syte.
            }
        };
        init();
    }, [files]);

    const startServer = async () => {
        if (status === 'installing' || status === 'starting' || status === 'running') return;

        setStatus('installing');
        setErrorMsg('');

        const writeToTerminal = createCleanTerminalWriter(addTerminalOutput);

        try {
            const currentFiles = useStore.getState().files;
            await autoInstallDependencies(currentFiles, addTerminalOutput);
            await smartInstall(addTerminalOutput);

            setStatus('starting');
            addTerminalOutput('$ npm run dev\n');
            executeCommand('npm', ['run', 'dev'], (output) => {
                writeToTerminal(output);
            }, -1);
        } catch (e: any) {
            console.error(e);
            setErrorMsg(e.message || 'Failed to start server');
            setStatus('error');
        }
    };

    const handleDownload = async () => {
        if (Object.keys(files).length === 0) {
            addTerminalOutput('No files to download.\n');
            return;
        }
        const zip = new JSZip();
        for (const [path, file] of Object.entries(files)) {
            zip.file(path, file.file.contents);
        }
        const blob = await zip.generateAsync({ type: 'blob' });
        saveAs(blob, 'project.zip');
    };

    const handleDragStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        const startY = e.clientY;
        const startHeight = terminalHeight;

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return;
            const delta = startY - e.clientY;
            const newHeight = Math.min(MAX_TERMINAL_HEIGHT, Math.max(MIN_TERMINAL_HEIGHT, startHeight + delta));
            setTerminalHeight(newHeight);
        };

        const handleMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
    }, [terminalHeight]);

    return (
        <div ref={containerRef} className={cn(
            "flex-1 h-full flex flex-col overflow-hidden p-1.5 md:pt-2 md:pr-2 md:pb-2 md:pl-0 gap-1.5",
            isDark ? 'bg-background' : 'bg-gray-100'
        )}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                    {activeTab === 'code' && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowFilesMobile(v => !v)}
                            className="md:hidden"
                            title="Files"
                        >
                            <PanelLeft className="w-4 h-4" />
                        </Button>
                    )}
                    <div className={cn(
                        "flex items-center rounded-lg p-0.5",
                        isDark ? 'bg-accent' : 'bg-gray-200'
                    )}>
                        <Button
                            variant={activeTab === 'code' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('code')}
                            className="rounded-md text-xs gap-1.5"
                        >
                            <Code2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                            variant={activeTab === 'preview' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => setActiveTab('preview')}
                            className="rounded-md text-xs gap-1.5"
                        >
                            <Play className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon-sm" onClick={handleDownload} title="Download">
                        <Download className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            {/* Main content block - Files + Editor */}
            <div className={cn(
                "flex-1 flex overflow-hidden rounded-xl border relative",
                isDark ? 'bg-background border-border' : 'bg-white border-gray-200'
            )}>
                {activeTab === 'code' ? (
                    <>
                        {showFilesMobile && (
                            <div
                                onClick={() => setShowFilesMobile(false)}
                                className="md:hidden absolute inset-0 z-20 bg-black/40"
                            />
                        )}
                        <div className={cn(
                            "flex-col overflow-hidden border-r",
                            showFilesMobile ? 'flex absolute z-30 inset-y-0 left-0 w-3/4 max-w-[260px] shadow-2xl' : 'hidden',
                            'md:relative md:flex md:w-56 md:max-w-none md:shadow-none',
                            isDark ? 'bg-background border-border' : 'bg-white border-gray-200'
                        )}>
                            <div className={cn(
                                "h-9 flex items-center gap-3 px-3 border-b text-xs",
                                isDark ? 'border-border text-muted-foreground' : 'border-gray-200 text-gray-500'
                            )}>
                                <span className="font-medium text-foreground/70">Files</span>
                                <span className="opacity-50">Search</span>
                            </div>
                            <div className="flex-1 overflow-y-auto custom-scrollbar">
                                {Object.keys(files).length === 0 ? (
                                    <SkeletonFileTree isDark={isDark} />
                                ) : (
                                    <FileExplorer />
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col min-w-0">
                            <div className="flex-1 overflow-hidden">
                                {Object.keys(files).length === 0 ? (
                                    <SkeletonCodeEditor isDark={isDark} />
                                ) : (
                                    <CodeEditor />
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col">
                        {previewUrl ? (
                            <>
                                <div className={cn(
                                    "h-9 border-b flex items-center px-3 gap-2",
                                    isDark ? 'border-border' : 'border-gray-200'
                                )}>
                                    <Button variant="ghost" size="icon-sm" onClick={() => navigateTo(urlPath)} title="Reload">
                                        <RotateCw className="w-3.5 h-3.5" />
                                    </Button>
                                    <Input
                                        type="text"
                                        value={urlPath}
                                        onChange={(e) => handleUrlPathChange(e.target.value)}
                                        onKeyDown={handleUrlKeyDown}
                                        className="flex-1 h-7 text-xs bg-accent border-transparent focus:border-ring/50"
                                        spellCheck={false}
                                    />
                                    <Button
                                        variant={elementPickerActive ? 'secondary' : 'ghost'}
                                        size="icon-sm"
                                        onClick={() => setElementPickerActive(!elementPickerActive)}
                                        className={elementPickerActive ? 'text-blue-400 bg-blue-500/10' : ''}
                                        title="Select element"
                                    >
                                        <MousePointer2 className="w-3.5 h-3.5" />
                                    </Button>
                                    <Button variant="ghost" size="icon-sm" onClick={() => setIsFullscreen(true)} title="Fullscreen">
                                        <Maximize2 className="w-3.5 h-3.5" />
                                    </Button>
                                </div>
                                <div className="flex-1 relative">
                                    <iframe
                                        ref={iframeRef}
                                        src={getFullUrl(urlPath)}
                                        className="absolute inset-0 w-full h-full border-none bg-white"
                                        title="Preview"
                                        allow="cross-origin-isolated; clipboard-read; clipboard-write"
                                    />
                                </div>
                            </>
                        ) : (
                            <div className={cn(
                                "flex flex-col items-center justify-center h-full gap-2",
                                isDark ? 'text-muted-foreground' : 'text-gray-300'
                            )}>
                                {status === 'installing' && (
                                    <>
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                        <p className="text-sm text-muted-foreground">Installing dependencies...</p>
                                        <p className="text-xs text-muted-foreground/60">This may take a moment</p>
                                    </>
                                )}
                                {status === 'starting' && (
                                    <>
                                        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                                        <p className="text-sm text-muted-foreground">Starting development server...</p>
                                    </>
                                )}
                                {status === 'error' && (
                                    <>
                                        <div className="w-12 h-12 rounded-full bg-destructive/20 flex items-center justify-center mb-2">
                                            <Zap className="w-6 h-6 text-destructive" />
                                        </div>
                                        <p className="text-sm text-destructive font-medium">Failed to start server</p>
                                        <p className="text-xs text-muted-foreground mb-4">{errorMsg}</p>
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={() => setStatus('idle')}
                                        >
                                            Try Again
                                        </Button>
                                    </>
                                )}
                                {status === 'idle' && (
                                    <button
                                        onClick={startServer}
                                        className="group flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all duration-300"
                                    >
                                        <div className={cn(
                                            "w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed animate-[spin_10s_linear_infinite]",
                                            isDark ? 'border-border group-hover:border-ring' : 'border-gray-300 group-hover:border-blue-500'
                                        )}>
                                            <div className={cn(
                                                "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                                                isDark ? 'bg-accent group-hover:bg-blue-500/20' : 'bg-gray-100 group-hover:bg-blue-50'
                                            )}>
                                                <Play className={cn(
                                                    "w-6 h-6 ml-1 transition-colors",
                                                    isDark ? 'text-muted-foreground group-hover:text-blue-400' : 'text-gray-400 group-hover:text-blue-500'
                                                )} />
                                            </div>
                                        </div>
                                        <p className="text-sm opacity-50 group-hover:opacity-100 transition-opacity">Run Project</p>
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Terminal panel */}
            <div
                className={cn(
                    "flex flex-col rounded-xl border overflow-hidden transition-[height] duration-150",
                    isDark ? 'bg-background border-border' : 'bg-white border-gray-200'
                )}
                style={{ height: showTerminal ? `${terminalHeight}px` : '36px', minHeight: '36px' }}
            >
                {showTerminal && (
                    <div
                        onMouseDown={handleDragStart}
                        className={cn(
                            "h-[3px] cursor-row-resize flex-shrink-0 group relative transition-colors",
                            isDark ? 'hover:bg-blue-500/30' : 'hover:bg-blue-500/20'
                        )}
                    >
                        <div className={cn(
                            "absolute inset-x-0 top-0 h-[1px]",
                            isDark ? 'bg-border' : 'bg-gray-200'
                        )} />
                    </div>
                )}

                {/* Terminal header */}
                <div className={cn(
                    "h-[33px] flex items-center justify-between px-2 flex-shrink-0",
                    !isDark && 'border-b border-gray-200'
                )}>
                    <div className="flex items-center gap-0.5">
                        <Button
                            variant={terminalTab === 'terminal' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => { setTerminalTab('terminal'); setShowTerminal(true); }}
                            className="text-[11px] gap-1.5 h-auto py-1"
                        >
                            <TerminalSquare className="w-3 h-3" />
                            Terminal
                        </Button>
                        <Button
                            variant={terminalTab === 'errors' ? 'secondary' : 'ghost'}
                            size="sm"
                            onClick={() => { setTerminalTab('errors'); setShowTerminal(true); }}
                            className="text-[11px] gap-1.5 h-auto py-1"
                        >
                            <AlertTriangle className={cn("w-3 h-3", parsedErrors.length > 0 && 'text-red-400')} />
                            Errors
                            {parsedErrors.length > 0 && (
                                <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-auto ml-0.5">
                                    {parsedErrors.length}
                                </Badge>
                            )}
                        </Button>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => terminalTab === 'terminal' ? clearTerminalOutput() : clearParsedErrors()}
                            title={terminalTab === 'terminal' ? 'Clear terminal' : 'Clear errors'}
                        >
                            <Trash2 className="w-3 h-3" />
                        </Button>
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setShowTerminal(!showTerminal)}
                        >
                            {showTerminal ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </Button>
                    </div>
                </div>

                {showTerminal && (
                    <div className="flex-1 overflow-hidden relative">
                        <div className={cn("absolute inset-0", terminalTab !== 'terminal' && 'invisible h-0 overflow-hidden')}>
                            <Terminal />
                        </div>
                        <div className={cn("h-full", terminalTab !== 'errors' && 'hidden')}>
                            <ErrorPanel />
                        </div>
                    </div>
                )}
            </div>

            {/* Fullscreen preview overlay */}
            {isFullscreen && previewUrl && (
                <div className="fixed inset-0 z-50 flex flex-col bg-black">
                    <div className={cn(
                        "h-10 flex items-center px-4 gap-3 flex-shrink-0",
                        isDark ? 'bg-background border-b border-border' : 'bg-gray-900 border-b border-gray-700'
                    )}>
                        <Button variant="ghost" size="icon-sm" onClick={() => navigateTo(urlPath)} title="Reload">
                            <RotateCw className="w-3.5 h-3.5" />
                        </Button>
                        <Input
                            type="text"
                            value={urlPath}
                            onChange={(e) => handleUrlPathChange(e.target.value)}
                            onKeyDown={handleUrlKeyDown}
                            className="flex-1 h-7 text-xs bg-accent border-transparent focus:border-ring/50"
                            spellCheck={false}
                        />
                        <Button variant="ghost" size="icon-sm" onClick={() => setIsFullscreen(false)} title="Exit fullscreen">
                            <Minimize2 className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                    <div className="flex-1 relative">
                        <iframe
                            ref={fullscreenIframeRef}
                            src={getFullUrl(urlPath)}
                            className="absolute inset-0 w-full h-full border-none bg-white"
                            title="Preview Fullscreen"
                            allow="cross-origin-isolated; clipboard-read; clipboard-write"
                        />
                    </div>
                </div>
            )}
        </div>
    );
}
