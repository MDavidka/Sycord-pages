'use client'
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Image as ImageIcon, X } from 'lucide-react';
import { useStore } from '../store';
import { createChat } from '../lib/api';
import { Message } from '../lib/ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function HomeChat() {
    const navigate = useNavigate();
    const { user, theme, addMessage, setCurrentChatId } = useStore();
    const isDark = theme === 'dark';

    const [input, setInput] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            files.forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setSelectedImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        setSelectedImages(prev => [...prev, reader.result as string]);
                    };
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && selectedImages.length === 0) || isSubmitting || !user) return;

        setIsSubmitting(true);

        try {
            const title = input.slice(0, 50) + (input.length > 50 ? '...' : '');
            const chat = await createChat(user.uid, title);

            const currentChats = useStore.getState().chats;
            useStore.getState().setChats([chat, ...currentChats]);

            let userMessage: Message;
            if (selectedImages.length > 0) {
                userMessage = {
                    role: 'user',
                    content: [
                        { type: 'text', text: input },
                        ...selectedImages.map(img => ({ type: 'image_url' as const, image_url: { url: img } }))
                    ]
                };
            } else {
                userMessage = { role: 'user', content: input };
            }

            setCurrentChatId(chat.id);
            addMessage(userMessage);

            navigate(`/c/${chat.id}`);
        } catch (err) {
            console.error('Failed to create chat:', err);
            setIsSubmitting(false);
        }
    };

    const suggestions = [
        { title: "Create a Todo List", desc: "Simple React app with Tailwind CSS", prompt: "Create a Todo List app with React and Tailwind" },
        { title: "Build a Landing Page", desc: "Modern design with hero section", prompt: "Build a landing page for a SaaS startup" },
        { title: "Explain React Hooks", desc: "Learn about useEffect and useState", prompt: "Explain how useEffect works in React" },
        { title: "Debug Code", desc: "Find and fix errors in your code", prompt: "Debug this code: const x = undefined; console.log(x.y)" },
    ];

    return (
        <div className="h-full flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
            <div className="max-w-2xl w-full space-y-8">
                <div className="text-center space-y-2">
                    <img src={isDark ? "/logo.png" : "/logo2.png"} alt="Glovix" className="h-12 mx-auto mb-4" />
                    <h1 className="text-3xl md:text-4xl font-bold text-foreground">
                        How can Glovix help you today?
                    </h1>
                    <p className="text-muted-foreground">
                        I can help you build web applications, debug code, and more.
                    </p>
                </div>

                <form
                    onSubmit={handleSubmit}
                    onPaste={handlePaste}
                    className={cn(
                        "relative rounded-2xl border transition-colors",
                        isDark ? 'bg-card border-border' : 'bg-white border-gray-300 shadow-sm'
                    )}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                    />

                    {selectedImages.length > 0 && (
                        <div className={cn("flex gap-2 p-3 overflow-x-auto border-b", isDark ? 'border-border' : 'border-gray-200')}>
                            {selectedImages.map((img, i) => (
                                <div key={i} className="relative flex-shrink-0 group">
                                    <img src={img} alt="Preview" className={cn("h-16 w-16 object-cover rounded-lg border", isDark ? 'border-border' : 'border-gray-300')} />
                                    <button
                                        type="button"
                                        onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe what you want to build..."
                        className={cn(
                            "w-full bg-transparent text-sm border-0 rounded-xl pl-4 pr-4 pt-4 pb-14 focus-visible:ring-0 resize-none min-h-[120px] max-h-[200px]",
                            isDark ? 'text-foreground placeholder:text-muted-foreground/60' : 'text-gray-900 placeholder:text-gray-400'
                        )}
                        onInput={(e) => {
                            const target = e.target as HTMLTextAreaElement;
                            target.style.height = 'auto';
                            target.style.height = `${Math.min(target.scrollHeight, 200)}px`;
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e);
                            }
                        }}
                    />

                    <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon-sm" type="button" className="rounded-full">
                                    <Plus className="w-4 h-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" side="top" className="min-w-[200px]">
                                <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="text-xs gap-2">
                                    <ImageIcon className="w-4 h-4" />
                                    Upload Image
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            type="submit"
                            variant="default"
                            size="icon"
                            disabled={(!input.trim() && selectedImages.length === 0) || isSubmitting}
                            className="rounded-full bg-[#3b82f6] hover:bg-blue-600"
                        >
                            <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                            </svg>
                        </Button>
                    </div>
                </form>

                {/* Suggestions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestions.map((s, i) => (
                        <Card
                            key={i}
                            onClick={() => setInput(s.prompt)}
                            className={cn(
                                "p-4 rounded-xl text-left transition-colors cursor-pointer border",
                                isDark ? 'bg-card hover:border-ring/50' : 'bg-white border-gray-200 hover:border-gray-300 shadow-sm'
                            )}
                        >
                            <CardContent className="p-0">
                                <h3 className="font-medium mb-1 text-foreground">{s.title}</h3>
                                <p className="text-xs text-muted-foreground">{s.desc}</p>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <p className="text-center text-[10px] text-muted-foreground">
                    Glovix can make mistakes. Check important info.
                </p>
            </div>
        </div>
    );
}
