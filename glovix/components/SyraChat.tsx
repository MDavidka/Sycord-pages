'use client'
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Folder, ChevronDown, ArrowRight, Undo2 } from 'lucide-react';
import { useStore } from '../store';
import { createChat } from '../lib/api';
import { cn } from '@/lib/utils';

type SyraModel = 'nano' | 'mini' | 'pro';

const MODEL_LABELS: Record<SyraModel, string> = {
    nano: 'nano',
    mini: 'mini',
    pro: 'pro',
};

interface SyraChatProps {
    /** Called when the user taps the back (undo) button */
    onBack?: () => void;
    /** User avatar initial or image URL */
    userInitial?: string;
    userImage?: string | null;
}

export function SyraChat({ onBack, userInitial = 'M', userImage }: SyraChatProps) {
    const navigate = useNavigate();
    const { user, addMessage, setCurrentChatId } = useStore();

    const [input, setInput] = useState('');
    const [model, setModel] = useState<SyraModel>('nano');
    const [modelOpen, setModelOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setModelOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isSubmitting || !user) return;

        setIsSubmitting(true);
        try {
            const chat = await createChat(user.uid, input.slice(0, 50));

            const currentChats = useStore.getState().chats;
            useStore.getState().setChats([chat, ...currentChats]);

            setCurrentChatId(chat.id);
            addMessage({ role: 'user', content: input });
            navigate(`/c/${chat.id}`);
        } catch (err) {
            console.error('[SyraChat] Failed to create chat:', err);
            setIsSubmitting(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className="relative flex flex-col h-full w-full bg-[#121214] overflow-hidden">

            {/* ── Top bar ── */}
            <div className="flex items-center justify-between px-4 pt-safe pt-3 pb-3 flex-shrink-0">
                {/* Back button — wide pill */}
                <button
                    type="button"
                    onClick={onBack}
                    aria-label="Go back"
                    className="flex items-center justify-center h-11 w-24 rounded-full bg-[#232325] active:bg-[#2e2e30] transition-colors"
                >
                    <Undo2 className="w-[18px] h-[18px] text-[#7a7a80]" />
                </button>

                {/* Avatar / initial */}
                <button
                    type="button"
                    aria-label="User profile"
                    className="flex items-center justify-center h-11 w-11 rounded-[14px] bg-[#232325] active:bg-[#2e2e30] transition-colors overflow-hidden"
                >
                    {userImage ? (
                        <img src={userImage} alt={userInitial} className="h-full w-full object-cover" />
                    ) : (
                        <span className="text-[15px] font-semibold text-foreground leading-none">
                            {userInitial}
                        </span>
                    )}
                </button>
            </div>

            {/* ── Chat area (empty state — messages render here) ── */}
            <div className="flex-1 overflow-y-auto custom-scrollbar" />

            {/* ── Bottom toolbar + input ── */}
            <div className="flex-shrink-0 pb-safe pb-3 px-3 space-y-2">

                {/* Row: attachment + model selector */}
                <div className="flex items-center gap-2">
                    {/* Folder / attachment button */}
                    <button
                        type="button"
                        aria-label="Attach file"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center justify-center h-11 w-11 rounded-[14px] bg-[#232325] active:bg-[#2e2e30] transition-colors flex-shrink-0"
                    >
                        <Folder className="w-[18px] h-[18px] text-[#9a9aa0]" />
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py"
                    />

                    {/* Model selector pill */}
                    <div ref={dropdownRef} className="relative">
                        <button
                            type="button"
                            onClick={() => setModelOpen(v => !v)}
                            aria-expanded={modelOpen}
                            aria-label="Select model"
                            className="flex items-center gap-1.5 h-11 px-4 rounded-full bg-[#232325] active:bg-[#2e2e30] transition-colors"
                        >
                            <span className="text-[15px] font-semibold text-[#3ecfb2]">Syra</span>
                            <span className="text-[15px] font-normal text-foreground">{MODEL_LABELS[model]}</span>
                            <ChevronDown className={cn(
                                "w-[14px] h-[14px] text-[#7a7a80] transition-transform duration-200",
                                modelOpen && "rotate-180"
                            )} />
                        </button>

                        {/* Dropdown */}
                        {modelOpen && (
                            <div className="absolute bottom-full mb-2 left-0 z-50 min-w-[140px] rounded-2xl bg-[#232325] border border-white/[0.06] shadow-2xl overflow-hidden">
                                {(Object.keys(MODEL_LABELS) as SyraModel[]).map(m => (
                                    <button
                                        key={m}
                                        type="button"
                                        onClick={() => { setModel(m); setModelOpen(false); }}
                                        className={cn(
                                            "flex items-center gap-2 w-full px-4 py-3 text-[14px] transition-colors",
                                            m === model
                                                ? "text-[#3ecfb2] bg-white/[0.05]"
                                                : "text-foreground hover:bg-white/[0.04]"
                                        )}
                                    >
                                        <span className="font-semibold text-[#3ecfb2]">Syra</span>
                                        <span>{MODEL_LABELS[m]}</span>
                                        {m === model && (
                                            <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#3ecfb2]" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Input bar */}
                <form
                    onSubmit={handleSubmit}
                    className="flex items-center gap-3 h-[54px] px-4 rounded-2xl bg-[#232325] border border-white/[0.04]"
                >
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="help to write code..."
                        className="flex-1 bg-transparent text-[15px] text-foreground placeholder:text-[#5a5a60] outline-none border-none min-w-0"
                        style={{ fontSize: '16px' }}
                    />

                    {/* Send button */}
                    <button
                        type="submit"
                        disabled={!input.trim() || isSubmitting}
                        aria-label="Send message"
                        className={cn(
                            "flex items-center justify-center h-9 w-9 rounded-full flex-shrink-0 transition-all",
                            input.trim() && !isSubmitting
                                ? "bg-[#3ecfb2]/20 text-[#3ecfb2] active:scale-90"
                                : "text-[#5a5a60]"
                        )}
                    >
                        {isSubmitting ? (
                            <div className="w-4 h-4 border-2 border-[#3ecfb2]/30 border-t-[#3ecfb2] rounded-full animate-spin" />
                        ) : (
                            <ArrowRight className="w-5 h-5" />
                        )}
                    </button>
                </form>

            </div>
        </div>
    );
}
