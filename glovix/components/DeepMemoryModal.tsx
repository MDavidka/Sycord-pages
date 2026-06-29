'use client'
import { useState, useEffect } from 'react';
import { Brain, X, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface DeepMemoryModalProps {
    onClose: () => void;
}

export function DeepMemoryModal({ onClose }: DeepMemoryModalProps) {
    const { theme, files } = useStore();
    const isDark = theme === 'dark';
    const [content, setContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadMemory = async () => {
            try {
                // Check if in files
                let fileContent = files['.glovix/deep-memory.md']?.file?.contents;

                if (!fileContent) {
                    fileContent = files['.glovix/codebase.md']?.file?.contents;
                }
                if (!fileContent) {
                    fileContent = files['.glovix/context.md']?.file?.contents;
                }

                if (fileContent) {
                    setContent(fileContent);
                } else {
                    setContent("Deep memory has not been generated yet. Instruct Syra to create or update the deep memory.");
                }
            } catch (err) {
                setContent("Failed to load deep memory.");
            } finally {
                setLoading(false);
            }
        };
        loadMemory();
    }, [files]);

    return (
        <Dialog open onOpenChange={() => onClose()}>
            <DialogContent className={cn("max-w-2xl h-[70vh] flex flex-col", isDark ? 'bg-[#1c1c1e] text-white border-white/10' : 'bg-white')}>
                <DialogHeader className="flex-row items-center justify-between border-b pb-4 shrink-0">
                    <DialogTitle className="flex items-center gap-2">
                        <Brain className="w-5 h-5 text-blue-500" />
                        Deep Memory
                    </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto p-4 prose dark:prose-invert max-w-none">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {content || ''}
                        </ReactMarkdown>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
