'use client'
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink } from 'lucide-react';

interface ImageViewerProps {
    src: string;
    alt?: string;
    isDark?: boolean;
}

export function ImageViewer({ src, alt, isDark = true }: ImageViewerProps) {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    // Handle Esc key to close fullscreen
    useEffect(() => {
        if (!isFullscreen) return;
        
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setIsFullscreen(false);
            }
        };
        
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [isFullscreen]);

    if (hasError) {
        return null; // Don't show broken images
    }

    return (
        <>
            {/* Thumbnail */}
            <div
                className="relative inline-block group cursor-pointer"
                onClick={() => setIsFullscreen(true)}
            >
                <img
                    src={src}
                    alt={alt || 'Image'}
                    referrerPolicy="no-referrer"
                    className={`
                        max-h-64 max-w-full rounded-lg object-contain
                        transition-all duration-200
                        ${isLoaded ? 'opacity-100' : 'opacity-0'}
                        group-hover:brightness-90
                    `}
                    onLoad={() => setIsLoaded(true)}
                    onError={() => setHasError(true)}
                    loading="lazy"
                />
                {!isLoaded && !hasError && (
                    <div className={`w-48 h-32 rounded-lg animate-pulse ${isDark ? 'bg-[#2a2a2a]' : 'bg-gray-200'}`} />
                )}
            </div>

            {/* Fullscreen Modal */}
            {isFullscreen && createPortal(
                <div
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-12 animate-fade-in"
                    onClick={() => setIsFullscreen(false)}
                    style={{
                        background: 'rgba(0, 0, 0, 0.97)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)'
                    }}
                >
                    {/* Close button */}
                    <button
                        onClick={() => setIsFullscreen(false)}
                        className="absolute top-6 right-6 p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all z-10"
                        title="Close (Esc)"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>

                    {/* Open in new tab */}
                    <a
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-6 right-20 p-2.5 rounded-lg bg-white/10 hover:bg-white/20 transition-all z-10"
                        title="Open in new tab"
                    >
                        <ExternalLink className="w-5 h-5 text-white" />
                    </a>

                    {/* Image - limited size with visible borders */}
                    <div className="relative w-full h-full flex items-center justify-center">
                        <img
                            src={src}
                            alt={alt || 'Image'}
                            referrerPolicy="no-referrer"
                            className="max-w-[80vw] max-h-[80vh] w-auto h-auto object-contain rounded-lg"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                            }}
                        />
                    </div>

                    {/* Caption */}
                    {alt && (
                        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-black/70 backdrop-blur-sm text-white text-sm max-w-[70vw] text-center">
                            {alt}
                        </div>
                    )}
                </div>,
                document.body
            )}
        </>
    );
}

// Gallery component for multiple images
interface ImageGalleryProps {
    images: Array<{ src: string; alt?: string }>;
    isDark?: boolean;
}

export function ImageGallery({ images, isDark = true }: ImageGalleryProps) {
    if (images.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2 my-3">
            {images.map((img, i) => (
                <ImageViewer key={i} src={img.src} alt={img.alt} isDark={isDark} />
            ))}
        </div>
    );
}