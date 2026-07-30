'use client'
import { useState, useEffect } from 'react';
import { Brain, X, Loader2, Database, LayoutTemplate, FileCode, Network, BookOpen, ChevronRight } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

interface DeepMemoryModalProps {
    onClose: () => void;
}

export function DeepMemoryModal({ onClose }: DeepMemoryModalProps) {
    const { theme, files } = useStore();
    const isDark = theme === 'dark';

    // Core memory states
    const [deepMemory, setDeepMemory] = useState<string | null>(null);
    const [glovixMd, setGlovixMd] = useState<string | null>(null);
    const [knowledgeBlocks, setKnowledgeBlocks] = useState<{title: string, content: string}[]>([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadMemory = async () => {
            try {
                // 1. Load deep-memory.md (or fallbacks)
                let dmContent = files['.glovix/deep-memory.md']?.file?.contents;
                if (!dmContent) dmContent = files['.glovix/codebase.md']?.file?.contents;
                if (!dmContent) dmContent = files['.glovix/context.md']?.file?.contents;
                setDeepMemory(dmContent || "Deep memory has not been generated yet.");

                // 2. Load glovix.md
                setGlovixMd(files['.glovix/glovix.md']?.file?.contents || null);

                // 3. Load separated knowledge blocks from .glovix/knowledge/
                const blocks: {title: string, content: string}[] = [];
                Object.keys(files).forEach(path => {
                    if (path.startsWith('.glovix/knowledge/') && path.endsWith('.md')) {
                        const title = path.replace('.glovix/knowledge/', '').replace('.md', '');
                        blocks.push({
                            title,
                            content: files[path].file.contents
                        });
                    }
                });
                setKnowledgeBlocks(blocks);

            } catch (err) {
                console.error("Failed to load deep memory", err);
            } finally {
                setLoading(false);
            }
        };
        loadMemory();
    }, [files]);

    return (
        <Dialog open onOpenChange={() => onClose()}>
            <DialogContent
                className={cn(
                    "max-w-3xl w-[95vw] h-[85vh] md:h-[80vh] flex flex-col p-0 overflow-hidden border-0 shadow-2xl",
                    isDark ? 'bg-[#18191b]/95 backdrop-blur-xl text-white ring-1 ring-white/10' : 'bg-white/95 backdrop-blur-xl ring-1 ring-black/5'
                )}
                style={{
                    boxShadow: isDark ? '0 0 0 1px rgba(255,255,255,0.05), 0 30px 60px rgba(0,0,0,0.5)' : '0 30px 60px rgba(0,0,0,0.1)'
                }}
            >
                <DialogHeader className={cn(
                    "flex-row items-center justify-between border-b px-5 py-4 shrink-0 m-0",
                    isDark ? "border-white/10 bg-white/[0.02]" : "border-black/5 bg-black/[0.02]"
                )}>
                    <DialogTitle className="flex items-center gap-3 text-lg font-semibold tracking-tight m-0">
                        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Brain className="w-4 h-4 text-blue-500" />
                        </div>
                        Deep Memory
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-8">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <>
                            {/* Section 1: Deep Memory (Lessons & Mistakes) */}
                            <section>
                                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                    <Database className="w-4 h-4" />
                                    Core Context
                                </h3>
                                <div className={cn(
                                    "p-5 rounded-2xl border prose dark:prose-invert max-w-none text-sm leading-relaxed",
                                    isDark ? "bg-white/[0.03] border-white/[0.05]" : "bg-gray-50 border-gray-100"
                                )}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                        {deepMemory || ''}
                                    </ReactMarkdown>
                                </div>
                            </section>

                            {/* Section 2: Glovix.md (Project Structure) */}
                            {glovixMd && (
                                <section>
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                        <LayoutTemplate className="w-4 h-4" />
                                        Project Architecture
                                    </h3>
                                    <div className={cn(
                                        "p-5 rounded-2xl border prose dark:prose-invert max-w-none text-sm leading-relaxed",
                                        isDark ? "bg-white/[0.03] border-white/[0.05]" : "bg-gray-50 border-gray-100"
                                    )}>
                                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                            {glovixMd}
                                        </ReactMarkdown>
                                    </div>
                                </section>
                            )}

                            {/* Section 3: Separated Knowledge Blocks */}
                            {knowledgeBlocks.length > 0 && (
                                <section>
                                    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 flex items-center gap-2">
                                        <BookOpen className="w-4 h-4" />
                                        Knowledge Blocks ({knowledgeBlocks.length})
                                    </h3>
                                    <Accordion type="single" collapsible className="w-full space-y-2">
                                        {knowledgeBlocks.map((block, idx) => (
                                            <AccordionItem
                                                key={idx}
                                                value={`item-${idx}`}
                                                className={cn(
                                                    "border rounded-xl overflow-hidden",
                                                    isDark ? "border-white/[0.05] bg-white/[0.02]" : "border-gray-100 bg-white"
                                                )}
                                            >
                                                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-white/[0.02] transition-colors">
                                                    <div className="flex items-center gap-2 font-medium text-sm">
                                                        <FileCode className="w-4 h-4 text-blue-400" />
                                                        {block.title}
                                                    </div>
                                                </AccordionTrigger>
                                                <AccordionContent className={cn(
                                                    "px-4 py-4 border-t prose dark:prose-invert max-w-none text-sm",
                                                    isDark ? "border-white/[0.05]" : "border-gray-100"
                                                )}>
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                                        {block.content}
                                                    </ReactMarkdown>
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                </section>
                            )}
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
