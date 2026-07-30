'use client'
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Home, Clock, ChevronRight, PanelLeftClose,
    Trash2, Settings, Moon, Sun, Brain
} from 'lucide-react';
import { useStore } from '../store';
import { getChatHistory, deleteChat } from '../lib/api';
import { SettingsModal } from './SettingsModal';
import { DeepMemoryModal } from './DeepMemoryModal';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuSub,
    DropdownMenuSubTrigger,
    DropdownMenuSubContent,
    DropdownMenuPortal,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface SidebarProps {
    onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
    const navigate = useNavigate();
    const { user, currentChatId, setCurrentChatId, setMessages, setFiles, theme, setTheme, chats, setChats } = useStore();
    const [loading, setLoading] = useState(chats.length === 0);
    const [showSettings, setShowSettings] = useState(false);
    const [showDeepMemory, setShowDeepMemory] = useState(false);
    const [recentExpanded, setRecentExpanded] = useState(true);
    const containerRef = useRef<HTMLDivElement>(null);

    const isDark = theme === 'dark';

    useEffect(() => {
        if (user?.uid) {
            loadChats();
        }
    }, [user?.uid]);

    const loadChats = async () => {
        if (!user) return;
        if (chats.length === 0) setLoading(true);
        try {
            const history = await getChatHistory(user.uid);
            setChats(history);
        } catch { }
        finally { setLoading(false); }
    };

    const handleNewChat = () => {
        setCurrentChatId(null);
        setMessages([]);
        setFiles({});
        navigate('/');
        onClose?.();
    };

    const handleSelectChat = (chatId: string) => {
        navigate(`/c/${chatId}`);
        onClose?.();
    };

    const handleDeleteChat = async (e: React.MouseEvent, chatId: string) => {
        e.stopPropagation();
        try {
            await deleteChat(chatId);
            setChats(chats.filter(c => c.id !== chatId));
            if (currentChatId === chatId) {
                setCurrentChatId(null);
                setMessages([]);
                setFiles({});
                navigate('/');
            }
        } catch { }
    };

    if (!user) return null;

    const userInitial = user.email?.charAt(0).toUpperCase() || '?';

    return (
        <>
            <div className={cn(
                "w-64 flex flex-col h-full backdrop-blur-xl",
                isDark ? 'bg-card/80 border-r border-border' : 'bg-white/40 border-r border-black/10'
            )}>
                {/* Header */}
                <div className="px-3 py-2.5 flex items-center justify-between">
                    <img src={isDark ? "/logo.png" : "/logo2.png"} alt="Glovix" className="h-3.5 object-contain" />
                    {onClose && (
                        <Button variant="ghost" size="icon-sm" onClick={onClose}>
                            <PanelLeftClose className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Navigation */}
                <div className="px-2 py-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleNewChat}
                        className="w-full justify-start gap-2.5 text-xs font-normal"
                    >
                        <Home className="w-4 h-4" />
                        Home
                    </Button>
                </div>

                {/* Projects Section */}
                <div className="px-2 py-1.5">
                    <p className={cn(
                        "px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                        "text-muted-foreground"
                    )}>Projects</p>
                </div>

                {/* Recent */}
                <div className="px-2 flex-1 flex flex-col min-h-0">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRecentExpanded(!recentExpanded)}
                        className="w-full justify-start gap-2.5 text-xs font-normal"
                    >
                        <Clock className="w-4 h-4" />
                        <span className="flex-1 text-left">Recent</span>
                        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform", recentExpanded && 'rotate-90')} />
                    </Button>

                    {recentExpanded && (
                        <div className="ml-3 mt-0.5 space-y-0.5 flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground">Loading...</div>
                            ) : chats.length === 0 ? (
                                <div className="px-2.5 py-1.5 text-[10px] text-muted-foreground">No projects yet</div>
                            ) : (
                                chats.map((chat) => (
                                    <div
                                        key={chat.id}
                                        onClick={() => handleSelectChat(chat.id)}
                                        className={cn(
                                            "group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors text-xs",
                                            currentChatId === chat.id
                                                ? 'bg-accent text-accent-foreground'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                                        )}
                                    >
                                        <span className="flex-1 truncate">{chat.title}</span>
                                        <button
                                            onClick={(e) => handleDeleteChat(e, chat.id)}
                                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all"
                                        >
                                            <Trash2 className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* User Avatar with Menu */}
                <div className="px-2 py-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full">
                                <Avatar className="w-8 h-8">
                                    {user.photoURL ? (
                                        <AvatarImage src={user.photoURL} alt="" />
                                    ) : null}
                                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                        {userInitial}
                                    </AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" side="top" className="w-56 rounded-xl" sideOffset={8}>
                            <DropdownMenuLabel className="font-normal">
                                <div className="flex items-center gap-2.5">
                                    <Avatar className="w-8 h-8">
                                        {user.photoURL ? (
                                            <AvatarImage src={user.photoURL} alt="" />
                                        ) : null}
                                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                            {userInitial}
                                        </AvatarFallback>
                                    </Avatar>
                                    <p className="text-xs font-medium truncate">{user.email}</p>
                                </div>
                            </DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setShowSettings(true); }} className="gap-2.5 text-xs">
                                <Settings className="w-3.5 h-3.5" />
                                Settings
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setShowDeepMemory(true); }} className="gap-2.5 text-xs">
                                <Brain className="w-3.5 h-3.5 text-blue-500" />
                                Deep Memory
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-xs gap-2.5">
                                    {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                                    Appearance
                                </DropdownMenuSubTrigger>
                                <DropdownMenuPortal>
                                    <DropdownMenuSubContent className="min-w-[120px]">
                                        <DropdownMenuItem onClick={() => setTheme('light')} className="text-xs gap-2.5">
                                            <Sun className="w-3.5 h-3.5" />
                                            Light
                                            {theme === 'light' && <span className="ml-auto text-primary">✓</span>}
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => setTheme('dark')} className="text-xs gap-2.5">
                                            <Moon className="w-3.5 h-3.5" />
                                            Dark
                                            {theme === 'dark' && <span className="ml-auto text-primary">✓</span>}
                                        </DropdownMenuItem>
                                    </DropdownMenuSubContent>
                                </DropdownMenuPortal>
                            </DropdownMenuSub>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </div>

            {showSettings && createPortal(<SettingsModal onClose={() => setShowSettings(false)} />, document.body)}
            {showDeepMemory && createPortal(<DeepMemoryModal onClose={() => setShowDeepMemory(false)} />, document.body)}
        </>
    );
}
