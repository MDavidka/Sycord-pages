'use client'
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
    Home, Clock, ChevronRight, PanelLeftClose,
    Trash2, Settings, Moon, Sun
} from 'lucide-react';
import { useStore } from '../store';
import { getChatHistory, deleteChat } from '../lib/api';
import { SettingsModal } from './SettingsModal';

interface SidebarProps {
    onClose?: () => void;
}

export function Sidebar({ onClose }: SidebarProps) {
    const navigate = useNavigate();
    const { user, currentChatId, setCurrentChatId, setMessages, setFiles, theme, setTheme, chats, setChats } = useStore();
    const [loading, setLoading] = useState(chats.length === 0);
    const [showSettings, setShowSettings] = useState(false);
    const [recentExpanded, setRecentExpanded] = useState(true);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [showThemeSubmenu, setShowThemeSubmenu] = useState(false);
    const userMenuRef = useRef<HTMLDivElement>(null);

    const isDark = theme === 'dark';

    useEffect(() => {
        if (user?.uid) {
            loadChats();
        }
    }, [user?.uid]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
                setShowUserMenu(false);
                setShowThemeSubmenu(false);
            }
        };
        if (showUserMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showUserMenu]);

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

    return (
        <>
            <div className={`w-64 flex flex-col h-full backdrop-blur-xl ${isDark ? 'bg-black/40 border-r border-white/10' : 'bg-white/40 border-r border-black/10'}`}>
                {/* Header */}
                <div className="px-3 py-2.5 flex items-center justify-between">
                    <img src={isDark ? "/logo.png" : "/logo2.png"} alt="Glovix" className="h-3.5 object-contain" />
                    {onClose && (
                        <button onClick={onClose} className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-[#666] hover:text-white hover:bg-[#1a1a1a]' : 'text-gray-400 hover:text-gray-900 hover:bg-gray-100'}`}>
                            <PanelLeftClose className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Navigation */}
                <div className="px-2 py-1">
                    <button onClick={handleNewChat} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${isDark ? 'text-[#999] hover:bg-[#1a1a1a] hover:text-white' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}>
                        <Home className="w-4 h-4" />
                        Home
                    </button>
                </div>

                {/* Projects Section */}
                <div className="px-2 py-1.5">
                    <p className={`px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${isDark ? 'text-[#555]' : 'text-gray-400'}`}>Projects</p>
                </div>

                {/* Recent */}
                <div className="px-2 flex-1 flex flex-col min-h-0">
                    <button onClick={() => setRecentExpanded(!recentExpanded)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-xs transition-colors ${isDark ? 'text-[#999] hover:bg-[#1a1a1a]' : 'text-gray-600 hover:bg-gray-100'}`}>
                        <Clock className="w-4 h-4" />
                        <span className="flex-1 text-left">Recent</span>
                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${recentExpanded ? 'rotate-90' : ''}`} />
                    </button>

                    {recentExpanded && (
                        <div className="ml-3 mt-0.5 space-y-0.5 flex-1 overflow-y-auto">
                            {loading ? (
                                <div className={`px-2.5 py-1.5 text-[10px] ${isDark ? 'text-[#444]' : 'text-gray-400'}`}>Loading...</div>
                            ) : chats.length === 0 ? (
                                <div className={`px-2.5 py-1.5 text-[10px] ${isDark ? 'text-[#444]' : 'text-gray-400'}`}>No projects yet</div>
                            ) : (
                                chats.map((chat) => (
                                    <div key={chat.id} onClick={() => handleSelectChat(chat.id)} className={`group flex items-center gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors ${currentChatId === chat.id ? (isDark ? 'bg-[#1a1a1a] text-white' : 'bg-gray-200 text-gray-900') : (isDark ? 'text-[#888] hover:text-[#ccc] hover:bg-[#18191B]' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-100')}`}>
                                        <span className="flex-1 truncate text-xs">{chat.title}</span>
                                        <button onClick={(e) => handleDeleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all">
                                            <Trash2 className={`w-3 h-3 hover:text-red-400 ${isDark ? 'text-[#444]' : 'text-gray-300'}`} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* User Avatar with Menu */}
                <div className="px-2 py-2 relative" ref={userMenuRef}>
                    <button onClick={() => setShowUserMenu(!showUserMenu)} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium backdrop-blur-sm transition-all ${showUserMenu ? 'ring-2 ring-blue-500' : ''} ${isDark ? 'bg-blue-500/20 text-blue-300 hover:ring-2 hover:ring-blue-500/30' : 'bg-blue-500/20 text-blue-700 hover:ring-2 hover:ring-blue-500/30'}`}>
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                        ) : (
                            user.email?.charAt(0).toUpperCase()
                        )}
                    </button>

                    {showUserMenu && (
                        <div className={`absolute bottom-full left-2.5 mb-2 w-56 rounded-xl border shadow-2xl overflow-hidden backdrop-blur-xl ${isDark ? 'bg-black/60 border-white/10' : 'bg-white/80 border-black/10'}`}>
                            <div className={`p-3 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-100'}`}>
                                <div className="flex items-center gap-2.5">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${isDark ? 'bg-blue-500/20 text-blue-300' : 'bg-blue-500/20 text-blue-700'}`}>
                                        {user.photoURL ? (<img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />) : (user.email?.charAt(0).toUpperCase())}
                                    </div>
                                    <p className={`text-xs font-medium truncate ${isDark ? 'text-white' : 'text-gray-900'}`}>{user.email}</p>
                                </div>
                            </div>

                            <div className="py-1">
                                <button onClick={() => { setShowSettings(true); setShowUserMenu(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${isDark ? 'text-[#ccc] hover:bg-[#252525]' : 'text-gray-700 hover:bg-gray-50'}`}>
                                    <Settings className="w-3.5 h-3.5" />
                                    Settings
                                </button>

                                <div className="relative">
                                    <button onClick={() => setShowThemeSubmenu(!showThemeSubmenu)} className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-colors ${isDark ? 'text-[#ccc] hover:bg-[#252525]' : 'text-gray-700 hover:bg-gray-50'}`}>
                                        <span className="flex items-center gap-2.5">
                                            {isDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
                                            Appearance
                                        </span>
                                        <ChevronRight className={`w-3.5 h-3.5 transition-transform ${showThemeSubmenu ? 'rotate-90' : ''} ${isDark ? 'text-[#555]' : 'text-gray-400'}`} />
                                    </button>

                                    {showThemeSubmenu && (
                                        <div className={`mx-2 mb-1 rounded-lg overflow-hidden ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}>
                                            <button onClick={() => { setTheme('light'); setShowThemeSubmenu(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${theme === 'light' ? 'text-blue-500' : (isDark ? 'text-[#999] hover:text-white' : 'text-gray-600 hover:text-gray-900')}`}>
                                                <Sun className="w-3.5 h-3.5" />
                                                Light
                                                {theme === 'light' && <span className="ml-auto text-blue-500">✓</span>}
                                            </button>
                                            <button onClick={() => { setTheme('dark'); setShowThemeSubmenu(false); }} className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors ${theme === 'dark' ? 'text-blue-500' : (isDark ? 'text-[#999] hover:text-white' : 'text-gray-600 hover:text-gray-900')}`}>
                                                <Moon className="w-3.5 h-3.5" />
                                                Dark
                                                {theme === 'dark' && <span className="ml-auto text-blue-500">✓</span>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showSettings && createPortal(<SettingsModal onClose={() => setShowSettings(false)} />, document.body)}
        </>
    );
}