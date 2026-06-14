'use client'
import { useState, useEffect, useRef, useCallback } from 'react';
import { Code2, Play, ChevronDown, ChevronUp, RotateCw, Download, Zap, Loader2, TerminalSquare, Trash2, AlertTriangle, Maximize2, Minimize2, MousePointer2 } from 'lucide-react';
import { useStore } from '../store';
import { CodeEditor } from './CodeEditor';
import { Terminal } from './Terminal';
import { ErrorPanel } from './ErrorPanel';
import { FileExplorer } from './FileExplorer';
import { SkeletonFileTree, SkeletonCodeEditor } from './SkeletonLoader';
import { executeCommand, mountFiles, autoInstallDependencies, smartInstall } from '../lib/webcontainer';
import { createCleanTerminalWriter } from '../lib/tools';
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

    // Element picker: inject script into iframe and listen for selection
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

    // When picker is activated/deactivated, send message to iframe
    useEffect(() => {
        const iframe = iframeRef.current || fullscreenIframeRef.current;
        if (iframe?.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'glovix-picker', active: elementPickerActive }, '*');
        }
    }, [elementPickerActive]);

    // Build full iframe URL from base + path
    const getFullUrl = (path: string) => {
        if (!previewUrl) return '';
        const base = previewUrl.replace(/\/$/, '');
        return base + (path.startsWith('/') ? path : '/' + path);
    };

    // Navigate iframe to a path
    const navigateTo = (path: string) => {
        const url = getFullUrl(path);
        if (iframeRef.current) iframeRef.current.src = url;
        if (fullscreenIframeRef.current) fullscreenIframeRef.current.src = url;
    };

    // Handle URL path input change — ensure it always starts with /
    const handleUrlPathChange = (value: string) => {
        if (!value.startsWith('/')) {
            setUrlPath('/' + value);
        } else {
            setUrlPath(value);
        }
    };

    // Handle Enter key in URL bar
    const handleUrlKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            navigateTo(urlPath);
        }
    };

    // Auto-switch to preview tab when server becomes ready
    useEffect(() => {
        if (previewUrl) {
            setActiveTab('preview');
            setStatus('running');
        }
    }, [previewUrl]);

    useEffect(() => {
        const init = async () => {
            if (Object.keys(files).length > 0) {
                try {
                    await mountFiles(files);
                } catch (error: any) {
                    console.error('[Workbench] Mount error:', error);
                    if (error?.message?.includes('SharedArrayBuffer') || error?.message?.includes('cross-origin')) {
                        setErrorMsg('WebContainer COEP Error: Check server headers. Reload page if issue persists.');
                    } else {
                        setErrorMsg(`Failed to mount files: ${error?.message || 'Unknown error'}`);
                    }
                    setStatus('error');
                }
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
            // Auto-detect and install missing dependencies first
            const currentFiles = useStore.getState().files;
            await autoInstallDependencies(currentFiles, addTerminalOutput);

            // Smart install — skips if deps unchanged & node_modules exists
            await smartInstall(addTerminalOutput);

            setStatus('starting');
            addTerminalOutput('$ pnpm run dev\n');
            // Fire and forget — dev server is long-running, don't await
            executeCommand('pnpm', ['run', 'dev'], (output) => {
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

    // Drag resize for terminal
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
        <div ref={containerRef} className={`flex-1 h-full flex flex-col overflow-hidden pt-2 pr-2 pb-2 gap-1.5 ${isDark ? 'bg-[#141414]' : 'bg-gray-100'}`}>
            {/* Top bar */}
            <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1">
                    <div className={`flex items-center rounded-lg p-0.5 ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`}>
                        <button
                            onClick={() => setActiveTab('code')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'code' ? (isDark ? 'bg-[#2a2a2a] text-white' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-[#666] hover:text-[#999]' : 'text-gray-400 hover:text-gray-600')}`}
                        >
                            <Code2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                            onClick={() => setActiveTab('preview')}
                            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'preview' ? (isDark ? 'bg-[#2a2a2a] text-white' : 'bg-white text-gray-900 shadow-sm') : (isDark ? 'text-[#666] hover:text-[#999]' : 'text-gray-400 hover:text-gray-600')}`}
                        >
                            <Play className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                <div className="flex items-center gap-1">
                    <button
                        onClick={handleDownload}
                        className={`p-2 rounded-lg transition-colors ${isDark ? 'text-[#666] hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-200'}`}
                        title="Download"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main content block - Files + Editor */}
            <div className={`flex-1 flex overflow-hidden rounded-xl border ${isDark ? 'bg-[#141414] border-[#1f1f1f]' : 'bg-white border-gray-200'}`}>
                {activeTab === 'code' ? (
                    <>
                        {/* Files sidebar */}
                        <div className={`w-56 flex flex-col overflow-hidden border-r ${isDark ? 'border-[#1f1f1f]' : 'border-gray-200'}`}>
                            <div className={`h-9 flex items-center gap-3 px-3 border-b text-xs ${isDark ? 'border-[#1f1f1f] text-[#888]' : 'border-gray-200 text-gray-500'}`}>
                                <span className={`font-medium ${isDark ? 'text-[#ccc]' : 'text-gray-700'}`}>Files</span>
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

                        {/* Editor */}
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
                                <div className={`h-9 border-b flex items-center px-3 gap-2 ${isDark ? 'border-[#1f1f1f]' : 'border-gray-200'}`}>
                                    <button onClick={() => navigateTo(urlPath)} className={`p-1.5 rounded-md ${isDark ? 'text-[#666] hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`} title="Reload">
                                        <RotateCw className="w-3.5 h-3.5" />
                                    </button>
                                    <input
                                        type="text"
                                        value={urlPath}
                                        onChange={(e) => handleUrlPathChange(e.target.value)}
                                        onKeyDown={handleUrlKeyDown}
                                        className={`flex-1 px-2 py-1 rounded-md text-xs outline-none ${isDark ? 'bg-[#1a1a1a] text-[#999] focus:text-white border border-transparent focus:border-[#333]' : 'bg-gray-100 text-gray-500 focus:text-gray-900 border border-transparent focus:border-gray-300'}`}
                                        spellCheck={false}
                                    />
                                    <button
                                        onClick={() => setElementPickerActive(!elementPickerActive)}
                                        className={`p-1.5 rounded-md transition-colors ${elementPickerActive ? 'text-blue-400 bg-blue-500/10' : isDark ? 'text-[#666] hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                                        title="Select element"
                                    >
                                        <MousePointer2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button onClick={() => setIsFullscreen(true)} className={`p-1.5 rounded-md ${isDark ? 'text-[#666] hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`} title="Fullscreen">
                                        <Maximize2 className="w-3.5 h-3.5" />
                                    </button>
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
                            <div className={`flex flex-col items-center justify-center h-full gap-2 ${isDark ? 'text-[#444]' : 'text-gray-300'}`}>
                                {status === 'installing' && (
                                    <>
                                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                                        <p className="text-sm text-gray-400">Installing dependencies...</p>
                                        <p className="text-xs text-gray-500">This may take a moment</p>
                                    </>
                                )}
                                {status === 'starting' && (
                                    <>
                                        <Loader2 className="w-8 h-8 animate-spin text-green-500" />
                                        <p className="text-sm text-gray-400">Starting development server...</p>
                                    </>
                                )}
                                {status === 'error' && (
                                    <>
                                        <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mb-2">
                                            <Zap className="w-6 h-6 text-red-500" />
                                        </div>
                                        <p className="text-sm text-red-400 font-medium">Failed to start server</p>
                                        <p className="text-xs text-gray-500 mb-4">{errorMsg}</p>
                                        <button
                                            onClick={() => setStatus('idle')}
                                            className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </>
                                )}
                                {status === 'idle' && (
                                    <button
                                        onClick={startServer}
                                        className="group flex flex-col items-center justify-center gap-2 hover:scale-105 transition-all duration-300"
                                    >
                                        <div className={`w-16 h-16 rounded-full flex items-center justify-center border-2 border-dashed ${isDark ? 'border-[#333] group-hover:border-blue-500' : 'border-gray-300 group-hover:border-blue-500'} animate-[spin_10s_linear_infinite]`}>
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isDark ? 'bg-[#222] group-hover:bg-blue-500/20' : 'bg-gray-100 group-hover:bg-blue-50'} transition-colors`}>
                                                <Play className={`w-6 h-6 ml-1 ${isDark ? 'text-gray-400 group-hover:text-blue-400' : 'text-gray-400 group-hover:text-blue-500'} transition-colors`} />
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
                className={`flex flex-col rounded-xl border overflow-hidden transition-[height] duration-150 ${isDark ? 'bg-[#0a0a0a] border-[#1f1f1f]' : 'bg-white border-gray-200'}`}
                style={{ height: showTerminal ? `${terminalHeight}px` : '36px', minHeight: '36px' }}
            >
                {/* Drag handle */}
                {showTerminal && (
                    <div
                        onMouseDown={handleDragStart}
                        className={`h-[3px] cursor-row-resize flex-shrink-0 group relative ${isDark ? 'hover:bg-blue-500/30' : 'hover:bg-blue-500/20'} transition-colors`}
                    >
                        <div className={`absolute inset-x-0 top-0 h-[1px] ${isDark ? 'bg-[#1f1f1f]' : 'bg-gray-200'}`} />
                    </div>
                )}

                {/* Terminal header */}
                <div className={`h-[33px] flex items-center justify-between px-2 flex-shrink-0 ${isDark ? '' : 'border-b border-gray-200'}`}>
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => { setTerminalTab('terminal'); setShowTerminal(true); }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                terminalTab === 'terminal'
                                    ? (isDark ? 'bg-[#1a1a1a] text-[#ccc]' : 'bg-gray-100 text-gray-700')
                                    : (isDark ? 'text-[#555] hover:text-[#888]' : 'text-gray-400 hover:text-gray-600')
                            }`}
                        >
                            <TerminalSquare className="w-3 h-3" />
                            Terminal
                        </button>
                        <button
                            onClick={() => { setTerminalTab('errors'); setShowTerminal(true); }}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                                terminalTab === 'errors'
                                    ? (isDark ? 'bg-[#1a1a1a] text-[#ccc]' : 'bg-gray-100 text-gray-700')
                                    : (isDark ? 'text-[#555] hover:text-[#888]' : 'text-gray-400 hover:text-gray-600')
                            }`}
                        >
                            <AlertTriangle className={`w-3 h-3 ${parsedErrors.length > 0 ? 'text-red-400' : ''}`} />
                            Errors
                            {parsedErrors.length > 0 && (
                                <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500/20 text-red-400">
                                    {parsedErrors.length}
                                </span>
                            )}
                        </button>
                    </div>
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={() => terminalTab === 'terminal' ? clearTerminalOutput() : clearParsedErrors()}
                            className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-[#444] hover:text-[#888] hover:bg-[#1a1a1a]' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                            title={terminalTab === 'terminal' ? 'Clear terminal' : 'Clear errors'}
                        >
                            <Trash2 className="w-3 h-3" />
                        </button>
                        <button
                            onClick={() => setShowTerminal(!showTerminal)}
                            className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-[#444] hover:text-[#888] hover:bg-[#1a1a1a]' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}
                        >
                            {showTerminal ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                        </button>
                    </div>
                </div>

                {/* Terminal/Errors content — both always mounted, toggle visibility */}
                {showTerminal && (
                    <div className="flex-1 overflow-hidden relative">
                        <div className={`absolute inset-0 ${terminalTab === 'terminal' ? '' : 'invisible h-0 overflow-hidden'}`}>
                            <Terminal />
                        </div>
                        <div className={`h-full ${terminalTab === 'errors' ? '' : 'hidden'}`}>
                            <ErrorPanel />
                        </div>
                    </div>
                )}
            </div>

            {/* Fullscreen preview overlay */}
            {isFullscreen && previewUrl && (
                <div className="fixed inset-0 z-50 flex flex-col bg-black">
                    <div className={`h-10 flex items-center px-4 gap-3 flex-shrink-0 ${isDark ? 'bg-[#0a0a0a] border-b border-[#1f1f1f]' : 'bg-gray-900 border-b border-gray-700'}`}>
                        <button
                            onClick={() => navigateTo(urlPath)}
                            className="p-1.5 rounded-md text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                            title="Reload"
                        >
                            <RotateCw className="w-3.5 h-3.5" />
                        </button>
                        <input
                            type="text"
                            value={urlPath}
                            onChange={(e) => handleUrlPathChange(e.target.value)}
                            onKeyDown={handleUrlKeyDown}
                            className="flex-1 px-3 py-1 rounded-md text-xs outline-none bg-[#1a1a1a] text-[#999] focus:text-white border border-transparent focus:border-[#333]"
                            spellCheck={false}
                        />
                        <button
                            onClick={() => setIsFullscreen(false)}
                            className="p-1.5 rounded-md text-[#666] hover:text-white hover:bg-[#1a1a1a] transition-colors"
                            title="Exit fullscreen"
                        >
                            <Minimize2 className="w-3.5 h-3.5" />
                        </button>
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