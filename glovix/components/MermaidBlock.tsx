'use client'
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2 } from 'lucide-react';

import { getMermaid } from '../lib/mermaid';

interface MermaidBlockProps {
    code: string;
    isDark?: boolean;
}

export function MermaidBlock({ code, isDark = true }: MermaidBlockProps) {
    const [svg, setSvg] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Pan/Zoom state
    const [scale, setScale] = useState(1);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Refs for accessing latest state in standard event listeners
    const stateRef = useRef({ scale, position });
    useEffect(() => { stateRef.current = { scale, position }; }, [scale, position]);

    // Reset view when code changes or fullscreen toggles
    useEffect(() => {
        setScale(1);
        setPosition({ x: 0, y: 0 });
    }, [code, isFullscreen]);

    // Render mermaid
    useEffect(() => {
        let mounted = true;

        const renderDiagram = async () => {
            try {
                if (!svg) setIsLoading(true);
                setError(null);

                const mermaid = await getMermaid(isDark);

                const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
                const { svg: renderedSvg } = await mermaid.render(id, code);

                if (mounted) {
                    setSvg(renderedSvg);
                    setIsLoading(false);
                }
            } catch (err: any) {
                // Silently fail - don't log or show errors
                if (mounted) {
                    setError(err.message || 'Failed to render diagram');
                    setIsLoading(false);
                }
            }
        };

        renderDiagram();
        return () => { mounted = false; };
    }, [code, isDark]);

    // Native wheel listener to prevent scrolling
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const onWheel = (e: WheelEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const { scale: currentScale, position: currentPos } = stateRef.current;
            const rect = container.getBoundingClientRect();

            const mouseX = e.clientX - rect.left - rect.width / 2;
            const mouseY = e.clientY - rect.top - rect.height / 2;

            const delta = -e.deltaY;
            const factor = delta > 0 ? 1.1 : 0.9;

            const newScale = Math.min(Math.max(0.1, currentScale * factor), 10);

            // Zoom to cursor logic
            const newX = currentPos.x + (mouseX - currentPos.x) * (1 - factor);
            const newY = currentPos.y + (mouseY - currentPos.y) * (1 - factor);

            setScale(newScale);
            setPosition({ x: newX, y: newY });
        };

        container.addEventListener('wheel', onWheel, { passive: false });
        return () => container.removeEventListener('wheel', onWheel);
    }, [isFullscreen]); // Re-attach when fullscreen changes (ref changes)

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => setIsDragging(false);

    // Common content for both modes
    const renderContent = () => (
        <>
            {/* Toolbar */}
            <div className={`absolute bottom-4 right-4 flex gap-1 bg-black/50 backdrop-blur-sm rounded-lg p-1 z-10 transition-opacity ${(!svg && isLoading) ? 'opacity-0' : 'opacity-100'}`}>
                <button
                    onClick={(e) => { e.stopPropagation(); setScale(s => Math.min(s + 0.2, 5)); }}
                    className="p-1.5 text-white hover:bg-white/20 rounded transition-colors"
                    title="Zoom In"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setScale(1); setPosition({ x: 0, y: 0 }); }}
                    className="p-1.5 text-white hover:bg-white/20 rounded transition-colors"
                    title="Reset View"
                >
                    <RotateCcw className="w-4 h-4" />
                </button>
                <button
                    onClick={(e) => { e.stopPropagation(); setScale(s => Math.max(s - 0.2, 0.5)); }}
                    className="p-1.5 text-white hover:bg-white/20 rounded transition-colors"
                    title="Zoom Out"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <div className="w-px bg-white/20 mx-1" />
                <button
                    onClick={(e) => { e.stopPropagation(); setIsFullscreen(!isFullscreen); }}
                    className="p-1.5 text-white hover:bg-white/20 rounded transition-colors"
                    title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                >
                    {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                </button>
            </div>

            {isLoading && !svg && (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-gray-400">
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    Rendering diagram...
                </div>
            )}

            <div
                ref={containerRef}
                className={`w-full h-full flex items-center justify-center overflow-hidden ${isDragging ? 'cursor-grabbing' : 'cursor-grab'} ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <div
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`,
                        transformOrigin: 'center',
                        transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                    }}
                    dangerouslySetInnerHTML={{ __html: svg }}
                    className="pointer-events-none origin-center"
                />
            </div>
        </>
    );

    if (error) {
        // Silently fail - don't show error to user
        return null;
    }

    const baseClasses = `relative overflow-hidden border group ${isDark ? 'border-[#27272a] bg-[#1a1a1a]' : 'border-gray-200 bg-white'
        }`;

    if (isFullscreen) {
        return createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-8 animate-fade-in">
                {/* Click outside usually closes modals, but let's require explicit minimize to avoid accidental closes during dragging */}
                <div className={`${baseClasses} w-full h-full max-w-[90vw] max-h-[90vh] rounded-xl shadow-2xl`}>
                    {renderContent()}
                </div>
            </div>,
            document.body
        );
    }

    return (
        <div className={`${baseClasses} rounded-lg`} style={{ height: '400px', userSelect: 'none' }}>
            {renderContent()}
        </div>
    );
}