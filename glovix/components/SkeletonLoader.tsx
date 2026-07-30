'use client'
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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
    delay = '0s'
}: SkeletonLoaderProps) {
    return (
        <Skeleton
            className={cn("rounded", className)}
            style={{ 
                width, 
                height,
                animationDelay: delay
            }}
        />
    );
}

export function SkeletonText({ lines = 3 }: { isDark?: boolean; lines?: number }) {
    return (
        <div className="space-y-2">
            {Array.from({ length: lines }).map((_, i) => (
                <SkeletonLoader
                    key={i}
                    width={i === lines - 1 ? '60%' : '100%'}
                    height="12px"
                    delay={`${i * 0.1}s`}
                />
            ))}
        </div>
    );
}

export function SkeletonCard({ isDark = true }: { isDark?: boolean }) {
    return (
        <div className={cn(
            "p-4 rounded-lg border",
            isDark ? 'bg-card border-border' : 'bg-white border-gray-200'
        )}>
            <SkeletonLoader width="40%" height="16px" />
            <div className="mt-3 space-y-2">
                <SkeletonLoader width="100%" height="12px" delay="0.1s" />
                <SkeletonLoader width="80%" height="12px" delay="0.2s" />
            </div>
        </div>
    );
}

export function SkeletonFileTree({ isDark = true }: { isDark?: boolean }) {
    return (
        <div className="space-y-1 p-2">
            {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2" style={{ paddingLeft: `${(i % 3) * 12}px` }}>
                    <SkeletonLoader width="16px" height="16px" delay={`${i * 0.05}s`} />
                    <SkeletonLoader width={`${60 + (i % 3) * 20}px`} height="12px" delay={`${i * 0.05}s`} />
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
                    <SkeletonLoader width="24px" height="12px" delay={`${i * 0.05}s`} />
                    <SkeletonLoader 
                        width={`${40 + Math.random() * 40}%`} 
                        height="12px" 
                        delay={`${i * 0.05}s`}
                    />
                </div>
            ))}
        </div>
    );
}
