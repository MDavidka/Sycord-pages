'use client'
interface SkeletonLoaderProps {
    width?: string;
    height?: string;
    className?: string;
    isDark?: boolean;
    delay?: string;
}

export function SkeletonLoader({ 
    width = '100%', 
    height = '12px', 
    className = '', 
    isDark = true,
    delay = '0s'
}: SkeletonLoaderProps) {
    return (
        <div
            className={`rounded animate-pulse ${isDark ? 'bg-[#333]' : 'bg-gray-300'} ${className}`}
            style={{ 
                width, 
                height,
                animationDelay: delay
            }}
        />
    );
}

// Preset skeletons for common use cases
export function SkeletonText({ isDark = true, lines = 3 }: { isDark?: boolean; lines?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonLoader
                    key={i}
                    width={i === lines - 1 ? '60%' : '100%'}
                    height="12px"
                    isDark={isDark}
                    delay={`${i * 0.1}s`}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ isDark = true }: { isDark?: boolean }) {
    return (
        <div className={`p-4 rounded-lg border ${isDark ? 'bg-[#1a1a1a] border-[#2a2a2a]' : 'bg-white border-gray-200'}`}>
            <SkeletonLoader width="40%" height="16px" isDark={isDark} />
            <div className="mt-3 space-y-2">
                <SkeletonLoader width="100%" height="12px" isDark={isDark} delay="0.1s" />
                <SkeletonLoader width="80%" height="12px" isDark={isDark} delay="0.2s" />
            </div>
        </div>
    );
}

export function SkeletonFileTree({ isDark = true }: { isDark?: boolean }) {
    return (
        <div className="space-y-1 p-2">
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12}px` }}>
                    <SkeletonLoader width="16px" height="16px" isDark={isDark} delay={`${i * 0.05}s`} />
                    <SkeletonLoader width={`${60 + (i % 3) * 20}px`} height="12px" isDark={isDark} delay={`${i * 0.05}s`} />
                </div>
            ))}
        </div>
    );
}

export function SkeletonCodeEditor({ isDark = true }: { isDark?: boolean }) {
    return (
        <div className="p-4 space-y-2">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="flex items-center gap-2">
                    <SkeletonLoader width="24px" height="12px" isDark={isDark} delay={`${i * 0.05}s`} />
                    <SkeletonLoader 
                        width={`${40 + Math.random() * 40}%`} 
                        height="12px" 
                        isDark={isDark} 
                        delay={`${i * 0.05}s`}
                    />
                </div>
            ))}
        </div>
    );
}