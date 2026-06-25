'use client'
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Search, Clock, Plus, ImageIcon, X, FileCode } from 'lucide-react';
import { useStore } from '../store';
import { createChat, getChatHistory, ChatHistory } from '../lib/api';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export function HomePage() {
    const navigate = useNavigate();
    const { user, theme, setCurrentChatId, addMessage } = useStore();
    const [input, setInput] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedDocuments, setSelectedDocuments] = useState<{ name: string; content: string; type: string }[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [recentChats, setRecentChats] = useState<ChatHistory[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const isDark = theme === 'dark';

    useEffect(() => {
        if (user) {
            loadRecentProjects();
        }
    }, [user]);

    const loadRecentProjects = async () => {
        if (!user) return;
        try {
            const chats = await getChatHistory(user.uid);
            setRecentChats(chats.slice(0, 6));
        } catch (e) {
            console.error('Failed to load recent chats:', e);
        }
    };

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && sidebarOpen) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [sidebarOpen]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            Array.from(e.target.files).forEach(file => {
                const reader = new FileReader();
                reader.onloadend = () => setSelectedImages(prev => [...prev, reader.result as string]);
                reader.readAsDataURL(file);
            });
        }
    };

    const getFileType = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const typeMap: Record<string, string> = {
            'txt': 'text/plain', 'md': 'text/markdown', 'json': 'application/json',
            'js': 'text/javascript', 'ts': 'text/typescript', 'tsx': 'text/typescript',
            'jsx': 'text/javascript', 'css': 'text/css', 'html': 'text/html',
            'py': 'text/python', 'sql': 'text/sql', 'yaml': 'text/yaml', 'yml': 'text/yaml',
        };
        return typeMap[ext] || 'text/plain';
    };

    const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            for (const file of Array.from(e.target.files)) {
                const reader = new FileReader();
                reader.onload = () => {
                    setSelectedDocuments(prev => [...prev, {
                        name: file.name,
                        content: reader.result as string,
                        type: file.type || getFileType(file.name)
                    }]);
                };
                reader.readAsText(file);
            }
        }
    };

    const handlePaste = (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const blob = items[i].getAsFile();
                if (blob) {
                    const reader = new FileReader();
                    reader.onloadend = () => setSelectedImages(prev => [...prev, reader.result as string]);
                    reader.readAsDataURL(blob);
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && selectedImages.length === 0 && selectedDocuments.length === 0) || isLoading || !user) return;

        setIsLoading(true);

        try {
            const chat = await createChat(user.uid, 'Untitled Project');

            const newChatEntry: ChatHistory = {
                id: chat.id,
                user_id: user.uid,
                title: 'Untitled Project',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            const currentChats = useStore.getState().chats;
            useStore.getState().setChats([newChatEntry, ...currentChats]);

            let displayMessage: any = selectedImages.length > 0
                ? {
                    role: 'user' as const,
                    content: [
                        { type: 'text' as const, text: input },
                        ...selectedImages.map(img => ({ type: 'image_url' as const, image_url: { url: img } }))
                    ]
                }
                : { role: 'user' as const, content: input };

            if (selectedDocuments.length > 0) {
                displayMessage.attachments = selectedDocuments.map(doc => ({
                    name: doc.name,
                    type: doc.type,
                    size: doc.content.length,
                    content: doc.content
                }));
            }

            setCurrentChatId(chat.id);
            addMessage(displayMessage);

            if (selectedDocuments.length > 0) {
                sessionStorage.setItem(`chat_docs_${chat.id}`, JSON.stringify(selectedDocuments));
            }

            navigate(`/c/${chat.id}`);
        } catch (err) {
            console.error('Failed to create chat:', err);
            setIsLoading(false);
        }
    };

    const userInitial = user?.email?.charAt(0).toUpperCase() || '?';

    return (
        <div className={cn("min-h-screen w-screen flex relative", isDark ? 'bg-background' : 'bg-white')}>
            {/* Background Gradient */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0"
                    style={{
                        background: isDark
                            ? 'radial-gradient(ellipse at center, #2563a8 0%, #1a4d6f 25%, #0f2942 60%, #0a1929 100%)'
                            : 'radial-gradient(ellipse at center, #e0f2fe 0%, #bae6fd 25%, #7dd3fc 60%, #38bdf8 100%)'
                    }}
                />
                <div className={cn(
                    "absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')]",
                    isDark ? 'opacity-30' : 'opacity-10'
                )} />
            </div>

            {/* Sidebar Container */}
            {user && (
                <div className={cn(
                    "fixed top-0 left-0 h-screen flex-shrink-0 transition-all duration-300 ease-in-out z-30 backdrop-blur-xl",
                    isDark ? 'bg-card/80 border-r border-border' : 'bg-white/40 border-r border-black/10',
                    sidebarOpen ? 'w-64' : 'w-16'
                )}>
                    {sidebarOpen ? (
                        <Sidebar onClose={() => setSidebarOpen(false)} />
                    ) : (
                        <div className="w-16 h-full flex flex-col items-center py-4">
                            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="mb-6">
                                <img src={isDark ? "/logo.png" : "/logo2.png"} alt="Glovix" className="w-8 h-8 object-contain" />
                            </Button>

                            <div className="flex flex-col items-center gap-1">
                                <Button variant="ghost" size="icon" onClick={() => navigate('/')} title="Home">
                                    <Home className="w-5 h-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} title="Search">
                                    <Search className="w-5 h-5" />
                                </Button>
                                <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} title="Recent projects">
                                    <Clock className="w-5 h-5" />
                                </Button>
                            </div>

                            <div className="flex-1" />

                            <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="rounded-full">
                                <Avatar className="w-8 h-8">
                                    {user.photoURL ? <AvatarImage src={user.photoURL} alt="" /> : null}
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">{userInitial}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </div>
                    )}
                </div>
            )}

            {/* Main content */}
            <div className={cn(
                "flex-1 flex flex-col relative z-10 transition-all duration-300",
                user ? (sidebarOpen ? 'ml-64' : 'ml-16') : '',
                'min-h-screen'
            )}>
                <main className={cn(
                    "flex flex-col items-center px-6",
                    user ? 'pt-[18vh] pb-4' : 'flex-1 justify-center'
                )}>
                    <div className="max-w-xl w-full space-y-8">
                        <div className="text-center">
                            <div className="text-xl tracking-widest font-light text-foreground">
                                Glovix Technologies
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} onPaste={handlePaste}
                            className={cn(
                                "flex flex-col rounded-2xl transition-all duration-300",
                                isDark ? 'bg-card border border-border' : 'bg-gray-50 border border-gray-200'
                            )}>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageSelect} />
                            <input type="file" ref={documentInputRef} className="hidden" accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.sql,.yaml,.yml" multiple onChange={handleDocumentSelect} />

                            {(selectedImages.length > 0 || selectedDocuments.length > 0) && (
                                <div className={cn(
                                    "flex gap-2 px-3 py-2 overflow-x-auto border-b",
                                    isDark ? 'border-border' : 'border-gray-200'
                                )}>
                                    {selectedImages.map((img, i) => (
                                        <div key={`img-${i}`} className="relative flex-shrink-0 group">
                                            <img src={img} alt="" className="h-10 w-10 object-cover rounded-lg" />
                                            <button type="button" onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {selectedDocuments.map((doc, i) => (
                                        <div key={`doc-${i}`} className={cn(
                                            "relative flex-shrink-0 group h-10 px-2 rounded-lg flex items-center gap-1.5",
                                            isDark ? 'bg-accent' : 'bg-gray-100'
                                        )}>
                                            <FileCode className="w-3.5 h-3.5 text-muted-foreground" />
                                            <span className="text-[11px] truncate max-w-[60px] text-muted-foreground">{doc.name}</span>
                                            <button type="button" onClick={() => setSelectedDocuments(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="What do you want to build?"
                                className="w-full bg-transparent text-[13px] border-0 px-4 pt-4 pb-2 focus-visible:ring-0 resize-none"
                                style={{ height: 'auto', minHeight: '44px', maxHeight: '150px' }}
                                onInput={(e) => {
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    target.style.height = `${Math.min(target.scrollHeight, 150)}px`;
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                            />

                            {/* Bottom toolbar */}
                            <div className="flex items-center justify-between px-3 py-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon-sm" type="button">
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" side="top" className="min-w-[160px]">
                                        <DropdownMenuItem onClick={() => fileInputRef.current?.click()} className="text-xs gap-2">
                                            <ImageIcon className="w-3.5 h-3.5" /> Image
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => documentInputRef.current?.click()} className="text-xs gap-2">
                                            <FileCode className="w-3.5 h-3.5" /> Document
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="submit"
                                        variant="default"
                                        size="icon"
                                        disabled={(!input.trim() && selectedImages.length === 0 && selectedDocuments.length === 0) || isLoading}
                                        className="rounded-full"
                                    >
                                        {isLoading ? (
                                            <div className="w-4 h-4 border-2 rounded-full animate-spin border-primary-foreground/20 border-t-primary-foreground" />
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                            </svg>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </main>

                {/* Bottom Projects Section */}
                {user && (
                    <div className={cn(
                        "rounded-2xl backdrop-blur-xl flex-1",
                        isDark ? 'bg-card/80' : 'bg-white/80'
                    )} style={{ marginLeft: '0.5rem', marginRight: '0.5rem', marginTop: '25vh', marginBottom: '0.25rem' }}>
                        <div className="px-5 py-4">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-1">
                                    <Button variant="secondary" size="sm" className="rounded-full text-[11px] h-auto py-1.5">
                                        Recently viewed
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 pb-4">
                                {recentChats.length > 0 ? (
                                    recentChats.map(chat => (
                                        <Card
                                            key={chat.id}
                                            onClick={() => navigate(`/c/${chat.id}`)}
                                            className={cn(
                                                "group cursor-pointer rounded-lg overflow-hidden transition-all hover:ring-2 hover:ring-ring/20 border-0",
                                                isDark ? 'bg-accent/80' : 'bg-white/80'
                                            )}
                                        >
                                            <div className={cn(
                                                "aspect-[16/9] flex items-center justify-center",
                                                isDark ? 'bg-accent' : 'bg-gray-100'
                                            )}>
                                                <FileCode className={cn("w-6 h-6", isDark ? 'text-muted-foreground/50' : 'text-gray-300')} />
                                            </div>
                                            <CardContent className="p-2">
                                                <div className="flex items-center gap-1.5">
                                                    <Avatar className="w-4 h-4">
                                                        <AvatarFallback className="text-[8px] bg-pink-500/30 text-pink-300">
                                                            {userInitial}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-[11px] font-medium truncate flex-1 text-foreground">
                                                        {chat.title}
                                                    </span>
                                                </div>
                                                <p className="text-[9px] mt-0.5 ml-5.5 text-muted-foreground">
                                                    Viewed {new Date(chat.updated_at).toLocaleDateString()}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    ))
                                ) : (
                                    <div className="col-span-2 sm:col-span-3 text-center py-8 text-sm text-muted-foreground">
                                        No projects yet. Start building!
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
