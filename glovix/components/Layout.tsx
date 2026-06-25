'use client'
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Home, Settings, Edit3, Moon, Sun, GitFork, Loader2, MessageSquare, Code2 } from 'lucide-react';
import { Chat } from './Chat';
import { Workbench } from './Workbench';
import { SettingsModal } from './SettingsModal';
import { StreamingText } from './StreamingText';
import { useStore } from '../store';
import { updateChatTitle } from '../lib/api';
import { forkChat } from '../lib/forkChat';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export function Layout() {
    const navigate = useNavigate();
    const theme = useStore(s => s.theme);
    const setTheme = useStore(s => s.setTheme);
    const currentChatId = useStore(s => s.currentChatId);
    const chats = useStore(s => s.chats);
    const user = useStore(s => s.user);
    const chatScrollRef = useRef<HTMLDivElement>(null);
    const scrollbarRef = useRef<HTMLDivElement>(null);
    const thumbRef = useRef<HTMLDivElement>(null);
    const [thumbTop, setThumbTop] = useState(0);
    const [thumbHeight, setThumbHeight] = useState(50);
    const isDragging = useRef(false);
    const dragStartY = useRef(0);
    const dragStartThumbTop = useRef(0);

    const [showProjectMenu, setShowProjectMenu] = useState(false);
    const [mobileTab, setMobileTab] = useState<'chat' | 'workbench'>('chat');
    const [showSettings, setShowSettings] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [isForking, setIsForking] = useState(false);
    const projectMenuRef = useRef<HTMLDivElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const [prevTitle, setPrevTitle] = useState('');
    const [shouldAnimate, setShouldAnimate] = useState(false);

    const isDark = theme === 'dark';

    const currentChat = chats.find(c => c.id === currentChatId);
    const projectTitle = currentChat?.title || 'Untitled Project';

    useEffect(() => {
        if (projectTitle !== prevTitle && projectTitle !== 'Untitled Project' && prevTitle !== '') {
            setShouldAnimate(true);
            const timer = setTimeout(() => setShouldAnimate(false), 2000);
            return () => clearTimeout(timer);
        }
        setPrevTitle(projectTitle);
    }, [projectTitle]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (projectMenuRef.current && !projectMenuRef.current.contains(e.target as Node)) {
                setShowProjectMenu(false);
                setIsRenaming(false);
            }
        };
        if (showProjectMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showProjectMenu]);

    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    const handleRename = async () => {
        if (!currentChatId || !newTitle.trim()) return;
        try {
            await updateChatTitle(currentChatId, newTitle.trim());
            const updatedChats = useStore.getState().chats.map(c =>
                c.id === currentChatId ? { ...c, title: newTitle.trim() } : c
            );
            useStore.getState().setChats(updatedChats);
            setIsRenaming(false);
        } catch (err) {
            console.error('Failed to rename:', err);
        }
    };

    const handleFork = async () => {
        if (isForking || !currentChatId) return;
        setIsForking(true);
        setShowProjectMenu(false);
        try {
            const newChatId = await forkChat();
            const store = useStore.getState();
            store.setMessages([]);
            store.setCurrentChatId(null);
            navigate(`/c/${newChatId}`);
        } catch (err) {
            console.error('Failed to fork:', err);
        } finally {
            setIsForking(false);
        }
    };

    const updateThumb = useCallback(() => {
        if (!chatScrollRef.current || !scrollbarRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
        const trackHeight = scrollbarRef.current.clientHeight - 24;
        const thumbH = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
        const maxTop = trackHeight - thumbH;
        const thumbT = scrollHeight > clientHeight
            ? (scrollTop / (scrollHeight - clientHeight)) * maxTop
            : 0;
        setThumbHeight(thumbH);
        setThumbTop(thumbT);
    }, []);

    const handleChatScroll = useCallback(() => {
        updateThumb();
    }, [updateThumb]);

    const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        dragStartY.current = e.clientY;
        dragStartThumbTop.current = thumbTop;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    }, [thumbTop]);

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !chatScrollRef.current || !scrollbarRef.current) return;
            const deltaY = e.clientY - dragStartY.current;
            const trackHeight = scrollbarRef.current.clientHeight - 24;
            const maxTop = trackHeight - thumbHeight;
            const newThumbTop = Math.max(0, Math.min(maxTop, dragStartThumbTop.current + deltaY));
            const scrollPercent = newThumbTop / maxTop;
            const { scrollHeight, clientHeight } = chatScrollRef.current;
            const scrollTarget = scrollPercent * (scrollHeight - clientHeight);
            chatScrollRef.current.scrollTop = scrollTarget;
        };
        const handleMouseUp = () => {
            isDragging.current = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);
        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [thumbHeight]);

    const handleTrackClick = useCallback((e: React.MouseEvent) => {
        if (!chatScrollRef.current || !scrollbarRef.current || e.target === thumbRef.current) return;
        const rect = scrollbarRef.current.getBoundingClientRect();
        const clickY = e.clientY - rect.top - 12;
        const trackHeight = scrollbarRef.current.clientHeight - 24;
        const scrollPercent = clickY / trackHeight;
        const { scrollHeight, clientHeight } = chatScrollRef.current;
        const scrollTarget = scrollPercent * (scrollHeight - clientHeight);
        chatScrollRef.current.scrollTop = scrollTarget;
    }, []);

    const scrollUp = useCallback(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollBy({ top: -100, behavior: 'smooth' });
        }
    }, []);

    const scrollDown = useCallback(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollBy({ top: 100, behavior: 'smooth' });
        }
    }, []);

    useEffect(() => {
        updateThumb();
    }, [updateThumb]);

    return (
        <div className={cn(
            "h-screen w-screen flex flex-col overflow-hidden",
            isDark ? 'bg-background text-[#e5e5e5]' : 'bg-gray-100 text-gray-900'
        )}>
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

            <div className="flex-1 flex min-h-0 overflow-hidden">

            {/* Chat Panel */}
            <div className={cn(
                "h-full flex-col pl-2 pt-2 pb-2 gap-1.5 w-full md:w-[30%] md:min-w-[280px] md:max-w-[450px]",
                mobileTab === 'chat' ? 'flex' : 'hidden md:flex'
            )}>
                {/* Top bar with project dropdown */}
                <div className="flex items-center gap-1.5 px-1 h-7 relative" ref={projectMenuRef}>
                    <DropdownMenu open={showProjectMenu} onOpenChange={setShowProjectMenu}>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 gap-2 text-xs font-medium"
                                onClick={() => setIsRenaming(false)}
                            >
                                <img
                                    src={isDark ? "/logo.png" : "/logo2.png"}
                                    alt="Glovix"
                                    className="h-3.5 object-contain"
                                />
                                {projectTitle === 'Untitled Project' ? (
                                    <div className="flex items-center gap-1">
                                        <div className={cn(
                                            "h-2.5 rounded animate-pulse",
                                            isDark ? 'bg-sidebar-accent' : 'bg-gray-300'
                                        )} style={{ width: '70px' }} />
                                        <div className={cn(
                                            "h-2.5 rounded animate-pulse",
                                            isDark ? 'bg-sidebar-accent' : 'bg-gray-300'
                                        )} style={{ width: '50px', animationDelay: '0.1s' }} />
                                    </div>
                                ) : shouldAnimate ? (
                                    <StreamingText
                                        text={projectTitle}
                                        className={cn(
                                            "text-xs font-medium truncate max-w-[130px]",
                                            isDark ? 'text-muted-foreground' : 'text-gray-700'
                                        )}
                                        speed={40}
                                    />
                                ) : (
                                    <span className={cn(
                                        "text-xs font-medium truncate max-w-[130px]",
                                        isDark ? 'text-muted-foreground' : 'text-gray-700'
                                    )}>
                                        {projectTitle}
                                    </span>
                                )}
                                <ChevronDown className={cn("w-3 h-3", isDark ? 'text-muted-foreground' : 'text-gray-400')} />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-80 rounded-xl p-0">
                            {/* Header with project name */}
                            <div className={cn("px-4 pt-4 pb-3")}>
                                {isRenaming ? (
                                    <input
                                        ref={renameInputRef}
                                        type="text"
                                        value={newTitle}
                                        onChange={(e) => setNewTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRename();
                                            if (e.key === 'Escape') setIsRenaming(false);
                                        }}
                                        onBlur={handleRename}
                                        className="w-full px-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 bg-secondary text-foreground focus:ring-ring"
                                    />
                                ) : (
                                    <div className="flex items-center justify-between group">
                                        {projectTitle === 'Untitled Project' ? (
                                            <div className="flex flex-col gap-2 flex-1">
                                                <div className={cn(
                                                    "h-4 rounded animate-pulse",
                                                    isDark ? 'bg-sidebar-accent' : 'bg-gray-300'
                                                )} style={{ width: '60%' }} />
                                                <div className={cn(
                                                    "h-3 rounded animate-pulse",
                                                    isDark ? 'bg-sidebar-accent' : 'bg-gray-300'
                                                )} style={{ width: '40%', animationDelay: '0.1s' }} />
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className="text-base font-semibold truncate text-foreground">
                                                    {projectTitle}
                                                </h3>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => { setIsRenaming(true); setNewTitle(projectTitle); }}
                                                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                )}
                                <p className="text-xs mt-1 text-muted-foreground">
                                    {user?.email || 'Guest'}
                                </p>
                            </div>
                            <DropdownMenuSeparator />
                            {/* Quick Actions */}
                            <div className="px-2 pb-2 pt-1">
                                <div className="grid grid-cols-4 gap-1">
                                    <DropdownMenuItem
                                        onClick={() => { navigate('/'); setShowProjectMenu(false); }}
                                        className="flex flex-col items-center gap-1.5 p-3 h-auto rounded-xl cursor-pointer"
                                    >
                                        <Home className="w-5 h-5" />
                                        <span className="text-[10px] font-medium">Home</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => { setShowSettings(true); setShowProjectMenu(false); }}
                                        className="flex flex-col items-center gap-1.5 p-3 h-auto rounded-xl cursor-pointer"
                                    >
                                        <Settings className="w-5 h-5" />
                                        <span className="text-[10px] font-medium">Settings</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => { setTheme(isDark ? 'light' : 'dark'); }}
                                        className="flex flex-col items-center gap-1.5 p-3 h-auto rounded-xl cursor-pointer"
                                    >
                                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                        <span className="text-[10px] font-medium">{isDark ? 'Light' : 'Dark'}</span>
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={handleFork}
                                        disabled={isForking || !currentChatId}
                                        className="flex flex-col items-center gap-1.5 p-3 h-auto rounded-xl cursor-pointer"
                                    >
                                        {isForking ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitFork className="w-5 h-5" />}
                                        <span className="text-[10px] font-medium">Fork</span>
                                    </DropdownMenuItem>
                                </div>
                            </div>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Chat content block */}
                <div className={cn(
                    "flex-1 flex flex-col overflow-hidden rounded-xl border",
                    isDark ? 'bg-background border-border' : 'bg-white border-gray-200'
                )}>
                    <Chat scrollRef={chatScrollRef} onScroll={handleChatScroll} />
                </div>
            </div>

            {/* Custom Scrollbar — desktop only */}
            <div
                ref={scrollbarRef}
                onClick={handleTrackClick}
                className={cn(
                    "hidden md:flex w-3 h-full flex-shrink-0 flex-col items-center select-none",
                    isDark ? 'bg-card' : 'bg-gray-200'
                )}
            >
                <button
                    onClick={scrollUp}
                    className={cn(
                        "w-full h-3 flex items-center justify-center",
                        "hover:bg-accent",
                        isDark ? 'text-muted-foreground/60' : 'text-gray-400'
                    )}
                >
                    <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[4px] border-l-transparent border-r-transparent border-b-current" />
                </button>
                <div className="flex-1 w-full relative">
                    <div
                        ref={thumbRef}
                        onMouseDown={handleThumbMouseDown}
                        className={cn(
                            "absolute left-1/2 -translate-x-1/2 w-1.5 rounded-full cursor-grab active:cursor-grabbing transition-colors",
                            isDark ? 'bg-muted-foreground/30 hover:bg-muted-foreground/40' : 'bg-gray-400 hover:bg-gray-500'
                        )}
                        style={{
                            height: `${thumbHeight}px`,
                            top: `${thumbTop}px`
                        }}
                    />
                </div>
                <button
                    onClick={scrollDown}
                    className={cn(
                        "w-full h-3 flex items-center justify-center",
                        "hover:bg-accent",
                        isDark ? 'text-muted-foreground/60' : 'text-gray-400'
                    )}
                >
                    <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-current" />
                </button>
            </div>

            {/* Workbench */}
            <div className={cn(
                "flex-1 min-w-0 h-full",
                mobileTab === 'workbench' ? 'block' : 'hidden md:block'
            )}>
                <Workbench />
            </div>

            </div>

            {/* Mobile bottom tab switcher */}
            <div className={cn(
                "md:hidden flex-shrink-0 flex items-stretch border-t",
                isDark ? 'bg-background border-border' : 'bg-white border-gray-200'
            )}>
                <Button
                    variant="ghost"
                    onClick={() => setMobileTab('chat')}
                    className={cn(
                        "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 h-auto text-[11px] font-medium rounded-none",
                        mobileTab === 'chat'
                            ? (isDark ? 'text-foreground' : 'text-gray-900')
                            : 'text-muted-foreground'
                    )}
                >
                    <MessageSquare className="w-5 h-5" />
                    Chat
                </Button>
                <Button
                    variant="ghost"
                    onClick={() => setMobileTab('workbench')}
                    className={cn(
                        "flex-1 flex flex-col items-center justify-center gap-0.5 py-2 h-auto text-[11px] font-medium rounded-none",
                        mobileTab === 'workbench'
                            ? (isDark ? 'text-foreground' : 'text-gray-900')
                            : 'text-muted-foreground'
                    )}
                >
                    <Code2 className="w-5 h-5" />
                    Workbench
                </Button>
            </div>
        </div>
    );
}
