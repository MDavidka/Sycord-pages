'use client'
import { useState, useMemo, memo } from 'react';
import { useStore, ParsedError } from '../store';
import { AlertTriangle, Trash2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const ERROR_TYPE_LABELS: Record<ParsedError['type'], string> = {
    typescript: 'TypeScript',
    vite: 'Vite',
    runtime: 'Runtime',
    module: 'Module',
    syntax: 'Syntax',
    npm: 'npm',
};

const ERROR_TYPE_COLORS: Record<ParsedError['type'], string> = {
    typescript: 'text-red-400',
    vite: 'text-orange-400',
    runtime: 'text-red-500',
    module: 'text-yellow-400',
    syntax: 'text-pink-400',
    npm: 'text-red-300',
};

const ErrorRow = memo(function ErrorRow({ error, isDark }: { error: ParsedError; isDark: boolean }) {
    const [expanded, setExpanded] = useState(false);
    const setSelectedFile = useStore(s => s.setSelectedFile);

    const typeColor = ERROR_TYPE_COLORS[error.type] || 'text-red-400';
    const typeLabel = ERROR_TYPE_LABELS[error.type] || error.type;
    const time = new Date(error.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const handleFileClick = () => {
        if (error.file) {
            setSelectedFile(error.file);
        }
    };

    return (
        <div className={cn("border-b last:border-b-0", isDark ? 'border-border' : 'border-gray-100')}>
            <div
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "flex items-start gap-2 px-3 py-2 cursor-pointer transition-colors",
                    isDark ? 'hover:bg-accent/50' : 'hover:bg-gray-50'
                )}
            >
                <ChevronRight className={cn(
                    "w-3 h-3 mt-1 flex-shrink-0 transition-transform",
                    expanded && 'rotate-90',
                    isDark ? 'text-muted-foreground' : 'text-gray-400'
                )} />
                <AlertTriangle className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", typeColor)} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0 h-auto">
                            <span className={typeColor}>{typeLabel}</span>
                        </Badge>
                        {error.file && (
                            <button
                                onClick={(e) => { e.stopPropagation(); handleFileClick(); }}
                                className="text-[11px] font-mono truncate max-w-[200px] text-blue-400 hover:text-blue-300"
                            >
                                {error.file}{error.line ? `:${error.line}` : ''}{error.column ? `:${error.column}` : ''}
                            </button>
                        )}
                        <span className={cn("text-[10px] ml-auto flex-shrink-0", isDark ? 'text-muted-foreground/50' : 'text-gray-300')}>
                            {time}
                        </span>
                    </div>
                    <p className={cn("text-[12px] mt-0.5 leading-snug", isDark ? 'text-muted-foreground' : 'text-gray-600')}>
                        {error.message.length > 120 && !expanded
                            ? error.message.slice(0, 120) + '...'
                            : error.message}
                    </p>
                </div>
            </div>
            {expanded && (
                <div className={cn("px-3 pb-2 ml-8", isDark ? 'text-muted-foreground/70' : 'text-gray-400')}>
                    <div className="text-[11px] font-mono space-y-1">
                        <p>{error.message}</p>
                        {error.source && (
                            <p className={isDark ? 'text-muted-foreground/50' : 'text-gray-300'}>
                                Source: {error.source}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
});

export function ErrorPanel() {
    const parsedErrors = useStore(s => s.parsedErrors);
    const clearParsedErrors = useStore(s => s.clearParsedErrors);
    const theme = useStore(s => s.theme);
    const isDark = theme === 'dark';

    const reversedErrors = useMemo(() => [...parsedErrors].reverse(), [parsedErrors]);

    if (parsedErrors.length === 0) {
        return (
            <div className={cn(
                "h-full flex flex-col items-center justify-center gap-2",
                isDark ? 'text-muted-foreground/30' : 'text-gray-300'
            )}>
                <AlertTriangle className="w-6 h-6" />
                <p className="text-xs">No errors</p>
            </div>
        );
    }

    const errorsByType = parsedErrors.reduce((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
    }, {} as Record<string, number>);

    const summary = Object.entries(errorsByType)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');

    return (
        <div className="h-full flex flex-col">
            <div className={cn(
                "flex items-center justify-between px-3 py-1.5 border-b flex-shrink-0",
                isDark ? 'border-border' : 'border-gray-200'
            )}>
                <span className={cn("text-[11px]", isDark ? 'text-muted-foreground/70' : 'text-gray-400')}>
                    {parsedErrors.length} error{parsedErrors.length !== 1 ? 's' : ''} ({summary})
                </span>
                <Button variant="ghost" size="icon-sm" onClick={clearParsedErrors} title="Clear all errors">
                    <Trash2 className="w-3 h-3" />
                </Button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-hide">
                {reversedErrors.map((error) => (
                    <ErrorRow key={error.id} error={error} isDark={isDark} />
                ))}
            </div>
        </div>
    );
}
