'use client'
import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Home, Settings, Edit3, Moon, Sun, GitFork, Loader2 } from 'lucide-react';
import { Chat } from './Chat';
import { Workbench } from './Workbench';
import { SettingsModal } from './SettingsModal';
import { StreamingText } from './StreamingText';
import { useStore } from '../store';
import { updateChatTitle } from '../lib/api';
import { forkChat } from '../lib/forkChat';

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

    // Project menu state
    const [showProjectMenu, setShowProjectMenu] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [isForking, setIsForking] = useState(false);
    const projectMenuRef = useRef<HTMLDivElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    // Track previous title for animation
    const [prevTitle, setPrevTitle] = useState('');
    const [shouldAnimate, setShouldAnimate] = useState(false);

    const isDark = theme === 'dark';

    // Get current chat title
    const currentChat = chats.find(c => c.id === currentChatId);
    const projectTitle = currentChat?.title || 'Untitled Project';

    // Detect title changes and trigger animation
    useEffect(() => {
        if (projectTitle !== prevTitle && projectTitle !== 'Untitled Project' && prevTitle !== '') {
            setShouldAnimate(true);
            const timer = setTimeout(() => setShouldAnimate(false), 2000);
            return () => clearTimeout(timer);
        }
        setPrevTitle(projectTitle);
    }, [projectTitle]);

    // Close menu on outside click
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

    // Focus rename input when opened
    useEffect(() => {
        if (isRenaming && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [isRenaming]);

    // Handle rename
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

    // Handle fork — create new chat with compressed context
    const handleFork = async () => {
        if (isForking || !currentChatId) return;
        setIsForking(true);
        setShowProjectMenu(false);
        try {
            const newChatId = await forkChat();
            // Clear current state so ChatPage loads the new chat fresh
            const store = useStore.getState();
            store.setMessages([]);
            store.setCurrentChatId(null);
            // Navigate to the new forked chat
            navigate(`/c/${newChatId}`);
        } catch (err) {
            console.error('Failed to fork:', err);
        } finally {
            setIsForking(false);
        }
    };

    // Update thumb position and size based on chat scroll
    const updateThumb = useCallback(() => {
        if (!chatScrollRef.current || !scrollbarRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = chatScrollRef.current;
        const trackHeight = scrollbarRef.current.clientHeight - 24; // minus arrows

        const thumbH = Math.max(30, (clientHeight / scrollHeight) * trackHeight);
        const maxTop = trackHeight - thumbH;
        const thumbT = scrollHeight > clientHeight
            ? (scrollTop / (scrollHeight - clientHeight)) * maxTop
            : 0;

        setThumbHeight(thumbH);
        setThumbTop(thumbT);
    }, []);

    // Handle chat scroll
    const handleChatScroll = useCallback(() => {
        updateThumb();
    }, [updateThumb]);

    // Mouse down on thumb - start dragging
    const handleThumbMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDragging.current = true;
        dragStartY.current = e.clientY;
        dragStartThumbTop.current = thumbTop;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
    }, [thumbTop]);

    // Mouse move - drag thumb
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current || !chatScrollRef.current || !scrollbarRef.current) return;

            const deltaY = e.clientY - dragStartY.current;
            const trackHeight = scrollbarRef.current.clientHeight - 24;
            const maxTop = trackHeight - thumbHeight;
            const newThumbTop = Math.max(0, Math.min(maxTop, dragStartThumbTop.current + deltaY));

            // Calculate scroll position
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

    // Click on track - jump to position
    const handleTrackClick = useCallback((e: React.MouseEvent) => {
        if (!chatScrollRef.current || !scrollbarRef.current || e.target === thumbRef.current) return;

        const rect = scrollbarRef.current.getBoundingClientRect();
        const clickY = e.clientY - rect.top - 12; // minus top arrow
        const trackHeight = scrollbarRef.current.clientHeight - 24;
        const scrollPercent = clickY / trackHeight;

        const { scrollHeight, clientHeight } = chatScrollRef.current;
        const scrollTarget = scrollPercent * (scrollHeight - clientHeight);

        chatScrollRef.current.scrollTop = scrollTarget;
    }, []);

    // Arrow buttons
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

    // Initial thumb update
    useEffect(() => {
        updateThumb();
    }, [updateThumb]);

    return (
        <div className={`h-screen w-screen flex overflow-hidden ${isDark ? 'bg-[#141414] text-[#e5e5e5]' : 'bg-gray-100 text-gray-900'}`}>
            {/* Settings Modal */}
            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}



            {/* Chat Panel */}
            <div className="h-full flex flex-col pl-2 pt-2 pb-2 gap-1.5 w-[30%] min-w-[280px] max-w-[450px]">
                {/* Top bar with project menu */}
                <div className="flex items-center gap-2 px-1 h-8 relative" ref={projectMenuRef}>
                    <button
                        onClick={() => { setShowProjectMenu(!showProjectMenu); setIsRenaming(false); }}
                        className={`flex items-center gap-2 px-2 py-1 rounded-lg transition-colors ${isDark ? 'hover:bg-[#1f1f1f]' : 'hover:bg-gray-200'}`}
                    >
                        <img src={isDark ? "/logo.png" : "/logo2.png"} alt="Glovix" className="h-5 object-contain" />
                        {projectTitle === 'Untitled Project' ? (
                            // Loading skeleton with blur effect
                            <div className="flex items-center gap-1">
                                <div className={`h-3 rounded animate-pulse ${isDark ? 'bg-[#333]' : 'bg-gray-300'}`} style={{ width: '80px' }} />
                                <div className={`h-3 rounded animate-pulse ${isDark ? 'bg-[#333]' : 'bg-gray-300'}`} style={{ width: '60px', animationDelay: '0.1s' }} />
                            </div>
                        ) : shouldAnimate ? (
                            <StreamingText 
                                text={projectTitle}
                                className={`text-sm font-medium truncate max-w-[150px] ${isDark ? 'text-[#ccc]' : 'text-gray-700'}`}
                                speed={40}
                            />
                        ) : (
                            <span className={`text-sm font-medium truncate max-w-[150px] ${isDark ? 'text-[#ccc]' : 'text-gray-700'}`}>
                                {projectTitle}
                            </span>
                        )}
                        <ChevronDown className={`w-4 h-4 ${isDark ? 'text-[#666]' : 'text-gray-400'}`} />
                    </button>

                    {/* Project Dropdown Menu */}
                    {showProjectMenu && (
                        <div className={`absolute top-full left-0 mt-1 w-80 rounded-2xl border shadow-2xl z-50 overflow-hidden backdrop-blur-xl ${isDark ? 'bg-[#1a1a1a]/95 border-[#2a2a2a]' : 'bg-white/95 border-gray-200'}`}>
                            {/* Header with project name */}
                            <div className={`px-4 pt-4 pb-3 ${isDark ? 'border-b border-[#2a2a2a]' : 'border-b border-gray-100'}`}>
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
                                        className={`w-full px-3 py-2 rounded-xl text-sm font-medium focus:outline-none focus:ring-2 ${isDark ? 'bg-[#252525] text-white focus:ring-blue-500/50' : 'bg-gray-100 text-gray-900 focus:ring-blue-500/50'}`}
                                    />
                                ) : (
                                    <div className="flex items-center justify-between group">
                                        {projectTitle === 'Untitled Project' ? (
                                            // Loading skeleton
                                            <div className="flex flex-col gap-2 flex-1">
                                                <div className={`h-4 rounded animate-pulse ${isDark ? 'bg-[#333]' : 'bg-gray-300'}`} style={{ width: '60%' }} />
                                                <div className={`h-3 rounded animate-pulse ${isDark ? 'bg-[#333]' : 'bg-gray-300'}`} style={{ width: '40%', animationDelay: '0.1s' }} />
                                            </div>
                                        ) : (
                                            <>
                                                <h3 className={`text-base font-semibold truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                    {projectTitle}
                                                </h3>
                                                <button
                                                    onClick={() => { setIsRenaming(true); setNewTitle(projectTitle); }}
                                                    className={`p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-all ${isDark ? 'hover:bg-[#333] text-[#888]' : 'hover:bg-gray-100 text-gray-400'}`}
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                </button>
                                            </>
                                        )}
                                    </div>
                                )}
                                <p className={`text-xs mt-1 ${isDark ? 'text-[#666]' : 'text-gray-400'}`}>
                                    {user?.email || 'Guest'}
                                </p>
                            </div>

                            {/* Quick Actions */}
                            <div className={`px-2 pb-2 ${isDark ? 'border-t border-[#2a2a2a]' : 'border-t border-gray-100'}`}>
                                <div className="pt-2 grid grid-cols-4 gap-1">
                                    <button
                                        onClick={() => { navigate('/'); setShowProjectMenu(false); }}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${isDark ? 'hover:bg-[#252525] text-[#888] hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <Home className="w-5 h-5" />
                                        <span className="text-[10px] font-medium">Home</span>
                                    </button>
                                    <button
                                        onClick={() => { setShowSettings(true); setShowProjectMenu(false); }}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${isDark ? 'hover:bg-[#252525] text-[#888] hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                    >
                                        <Settings className="w-5 h-5" />
                                        <span className="text-[10px] font-medium">Settings</span>
                                    </button>
                                    <button
                                        onClick={() => { setTheme(isDark ? 'light' : 'dark'); }}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all ${isDark ? 'hover:bg-[#252525] text-[#888] hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                    >
                                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                                        <span className="text-[10px] font-medium">{isDark ? 'Light' : 'Dark'}</span>
                                    </button>
                                    <button
                                        onClick={handleFork}
                                        disabled={isForking || !currentChatId}
                                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all disabled:opacity-30 ${isDark ? 'hover:bg-[#252525] text-[#888] hover:text-white' : 'hover:bg-gray-100 text-gray-500 hover:text-gray-900'}`}
                                    >
                                        {isForking ? <Loader2 className="w-5 h-5 animate-spin" /> : <GitFork className="w-5 h-5" />}
                                        <span className="text-[10px] font-medium">Fork</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat content block */}
                <div className={`flex-1 flex flex-col overflow-hidden rounded-xl border ${isDark ? 'bg-[#141414] border-[#1f1f1f]' : 'bg-white border-gray-200'}`}>
                    <Chat scrollRef={chatScrollRef} onScroll={handleChatScroll} />
                </div>
            </div>

            {/* Custom Scrollbar */}
            <div
                ref={scrollbarRef}
                onClick={handleTrackClick}
                className={`w-3 h-full flex-shrink-0 flex flex-col items-center select-none ${isDark ? 'bg-[#1a1a1a]' : 'bg-gray-200'}`}
            >
                {/* Top arrow */}
                <button
                    onClick={scrollUp}
                    className={`w-full h-3 flex items-center justify-center hover:bg-[#252525] ${isDark ? 'text-[#444]' : 'text-gray-400'}`}
                >
                    <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-b-[4px] border-l-transparent border-r-transparent border-b-current" />
                </button>

                {/* Track */}
                <div className="flex-1 w-full relative">
                    <div
                        ref={thumbRef}
                        onMouseDown={handleThumbMouseDown}
                        className={`absolute left-1/2 -translate-x-1/2 w-1.5 rounded-full cursor-grab active:cursor-grabbing transition-colors ${isDark ? 'bg-[#444] hover:bg-[#555]' : 'bg-gray-400 hover:bg-gray-500'}`}
                        style={{
                            height: `${thumbHeight}px`,
                            top: `${thumbTop}px`
                        }}
                    />
                </div>

                {/* Bottom arrow */}
                <button
                    onClick={scrollDown}
                    className={`w-full h-3 flex items-center justify-center hover:bg-[#252525] ${isDark ? 'text-[#444]' : 'text-gray-400'}`}
                >
                    <div className="w-0 h-0 border-l-[3px] border-r-[3px] border-t-[4px] border-l-transparent border-r-transparent border-t-current" />
                </button>
            </div>

            {/* Workbench */}
            <div className="flex-1 min-w-0 h-full">
                <Workbench />
            </div>
        </div>
    );
}