'use client'
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, Search, Clock, Plus, ImageIcon, X, FileCode } from 'lucide-react';
import { useStore } from '../store';
import { createChat, getChatHistory, ChatHistory } from '../lib/api';
import { Sidebar } from './Sidebar';

// Keep for future use
// const MODELS: ModelType[] = ['glm-4.7'];

export function HomePage() {
    const navigate = useNavigate();
    const { user, theme, setCurrentChatId, addMessage } = useStore();
    const [input, setInput] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedDocuments, setSelectedDocuments] = useState<{ name: string; content: string; type: string }[]>([]);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [showModelMenu, setShowModelMenu] = useState(false);
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

    // Закрыть сайдбар при клике вне его (для мобильных)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && sidebarOpen) {
                setSidebarOpen(false);
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [sidebarOpen]);

    useEffect(() => {
        const handleClickOutside = () => {
            if (showModelMenu) {
                setShowModelMenu(false);
            }
        };
        if (showModelMenu) {
            document.addEventListener('click', handleClickOutside);
        }
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showModelMenu]);

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

            // Add new chat to store immediately with placeholder title
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

    return (
        <div className={`min-h-screen w-screen flex relative ${isDark ? 'bg-[#0a0a0a]' : 'bg-white'}`}>
            {/* Background Gradient */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0"
                    style={{
                        background: isDark
                            ? 'radial-gradient(ellipse at center, #2563a8 0%, #1a4d6f 25%, #0f2942 60%, #0a1929 100%)'
                            : 'radial-gradient(ellipse at center, #e0f2fe 0%, #bae6fd 25%, #7dd3fc 60%, #38bdf8 100%)'
                    }}
                />
                <div className={`absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZGVmcz48cGF0dGVybiBpZD0iZ3JpZCIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIj48cGF0aCBkPSJNIDQwIDAgTCAwIDAgMCA0MCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJyZ2JhKDI1NSwyNTUsMjU1LDAuMDMpIiBzdHJva2Utd2lkdGg9IjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] ${isDark ? 'opacity-30' : 'opacity-10'}`} />
            </div>
            {/* Sidebar Container - Fixed */}
            {user && (
                <div className={`fixed top-0 left-0 h-screen flex-shrink-0 transition-all duration-300 ease-in-out z-30 backdrop-blur-xl ${isDark ? 'bg-black/40 border-r border-white/10' : 'bg-white/40 border-r border-black/10'} ${sidebarOpen ? 'w-64' : 'w-16'}`}>
                    {sidebarOpen ? (
                        <Sidebar onClose={() => setSidebarOpen(false)} />
                    ) : (
                        <div className="w-16 h-full flex flex-col items-center py-4">
                            {/* Logo */}
                            <button onClick={() => setSidebarOpen(true)} className="mb-6 hover:opacity-80 transition-opacity">
                                <img src={isDark ? "/logo.png" : "/logo2.png"} alt="Glovix" className="w-8 h-8 object-contain" />
                            </button>

                            {/* Nav Icons */}
                            <div className="flex flex-col items-center gap-1">
                                <button onClick={() => { navigate('/'); }} className={`p-2.5 rounded-xl backdrop-blur-sm transition-colors ${isDark ? 'text-white bg-white/10' : 'text-gray-900 bg-black/10'}`} title="Home">
                                    <Home className="w-5 h-5" />
                                </button>
                                <button onClick={() => setSidebarOpen(true)} className={`p-2.5 rounded-xl backdrop-blur-sm transition-colors ${isDark ? 'text-[#999] hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-black/10'}`} title="Search">
                                    <Search className="w-5 h-5" />
                                </button>
                                <button onClick={() => setSidebarOpen(true)} className={`p-2.5 rounded-xl backdrop-blur-sm transition-colors ${isDark ? 'text-[#999] hover:text-white hover:bg-white/10' : 'text-gray-500 hover:text-gray-900 hover:bg-black/10'}`} title="Recent projects">
                                    <Clock className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1" />

                            {/* Bottom Avatar */}
                            <button onClick={() => setSidebarOpen(true)} className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium backdrop-blur-sm transition-all hover:ring-2 ${isDark ? 'bg-blue-500/20 text-blue-300 hover:ring-blue-500/30' : 'bg-blue-500/20 text-blue-700 hover:ring-blue-500/30'}`}>
                                {user.photoURL ? (
                                    <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" />
                                ) : (
                                    user.email?.charAt(0).toUpperCase()
                                )}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Main content - scrollable container with left margin for sidebar */}
            <div className={`flex-1 flex flex-col relative z-10 transition-all duration-300 ${user ? (sidebarOpen ? 'ml-64' : 'ml-16') : ''} min-h-screen`}>

                {/* Main - positioned in upper area */}
                <main className={`flex flex-col items-center px-6 ${user ? 'pt-[18vh] pb-4' : 'flex-1 justify-center'}`}>
                    <div className="max-w-xl w-full space-y-8">
                        {/* Title */}
                        <div className="text-center">
                            <div className={`text-xl tracking-widest font-light ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                Glovix Technologies
                            </div>
                        </div>

                        {/* Input */}
                        <form onSubmit={handleSubmit} onPaste={handlePaste}
                            className={`flex flex-col rounded-2xl transition-all duration-300 ${isDark ? 'bg-[#1a1a1a] border border-[#2a2a2a]' : 'bg-gray-50 border border-gray-200'}`}>
                            <input type="file" ref={fileInputRef} className="hidden" accept="image/*" multiple onChange={handleImageSelect} />
                            <input type="file" ref={documentInputRef} className="hidden" accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.sql,.yaml,.yml" multiple onChange={handleDocumentSelect} />

                            {(selectedImages.length > 0 || selectedDocuments.length > 0) && (
                                <div className={`flex gap-2 px-3 py-2 overflow-x-auto border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                                    {selectedImages.map((img, i) => (
                                        <div key={`img-${i}`} className="relative flex-shrink-0 group">
                                            <img src={img} alt="" className="h-10 w-10 object-cover rounded-lg" />
                                            <button type="button" onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                    {selectedDocuments.map((doc, i) => (
                                        <div key={`doc-${i}`} className={`relative flex-shrink-0 group h-10 px-2 rounded-lg flex items-center gap-1.5 ${isDark ? 'bg-[#1f1f1f]' : 'bg-gray-100'}`}>
                                            <FileCode className="w-3.5 h-3.5 text-[#555]" />
                                            <span className={`text-[11px] truncate max-w-[60px] ${isDark ? 'text-[#999]' : 'text-gray-600'}`}>{doc.name}</span>
                                            <button type="button" onClick={() => setSelectedDocuments(prev => prev.filter((_, idx) => idx !== i))}
                                                className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-2.5 h-2.5" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="What do you want to build?"
                                className={`w-full bg-transparent text-[13px] px-4 pt-4 pb-2 focus:outline-none resize-none overflow-y-auto ${isDark ? 'text-[#e5e5e5] placeholder:text-[#555]' : 'text-gray-900 placeholder:text-gray-400'}`}
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
                                <div className="flex items-center gap-1.5 relative" onClick={(e) => e.stopPropagation()}>
                                    <button type="button" onClick={() => setShowModelMenu(!showModelMenu)}
                                        className={`p-1.5 rounded-md transition-colors ${isDark ? 'text-[#444] hover:text-[#888] hover:bg-[#1f1f1f]' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'}`}>
                                        <Plus className="w-4 h-4" />
                                    </button>

                                    {showModelMenu && (
                                        <div className={`absolute bottom-full left-0 mb-1 rounded-lg overflow-hidden z-10 min-w-[160px] ${isDark ? 'bg-[#1a1a1a] border border-[#2a2a2a]' : 'bg-white border border-gray-200 shadow-lg'}`}>
                                            <div className="p-1">
                                                <button type="button" onClick={() => { fileInputRef.current?.click(); setShowModelMenu(false); }}
                                                    className={`w-full text-left px-2.5 py-1.5 text-[12px] flex items-center gap-2 rounded ${isDark ? 'hover:bg-[#1f1f1f] text-[#ccc]' : 'hover:bg-gray-50 text-gray-700'}`}>
                                                    <ImageIcon className="w-3.5 h-3.5" /> Image
                                                </button>
                                                <button type="button" onClick={() => { documentInputRef.current?.click(); setShowModelMenu(false); }}
                                                    className={`w-full text-left px-2.5 py-1.5 text-[12px] flex items-center gap-2 rounded ${isDark ? 'hover:bg-[#1f1f1f] text-[#ccc]' : 'hover:bg-gray-50 text-gray-700'}`}>
                                                    <FileCode className="w-3.5 h-3.5" /> Document
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex items-center gap-1">
                                    <button type="submit" disabled={(!input.trim() && selectedImages.length === 0 && selectedDocuments.length === 0) || isLoading}
                                        className={`w-8 h-8 flex items-center justify-center rounded-full disabled:opacity-30 disabled:cursor-not-allowed transition-all ${isDark ? 'bg-white text-black hover:bg-gray-200' : 'bg-black text-white hover:bg-gray-800'}`}>
                                        {isLoading ? (
                                            <div className={`w-4 h-4 border-2 rounded-full animate-spin ${isDark ? 'border-black/20 border-t-black' : 'border-white/20 border-t-white'}`} />
                                        ) : (
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </main>

                {/* Bottom Projects Section - Lower on page, visible preview with scroll */}
                {user && (
                    <div className={`rounded-2xl backdrop-blur-xl flex-1 ${isDark ? 'bg-black/80' : 'bg-white/80'}`} style={{ marginLeft: '0.5rem', marginRight: '0.5rem', marginTop: '25vh', marginBottom: '0.25rem' }}>
                        <div className="px-5 py-4">
                            {/* Tabs Header */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-1">
                                    <button
                                        className={`px-3 py-1.5 text-[11px] rounded-full transition-colors ${isDark ? 'bg-white/15 text-white' : 'bg-black/10 text-gray-900'}`}
                                    >
                                        Recently viewed
                                    </button>
                                </div>
                            </div>

                            {/* Project Cards - Grid with vertical layout */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 pb-4">
                                {recentChats.length > 0 ? (
                                    recentChats.map(chat => (
                                        <div
                                            key={chat.id}
                                            onClick={() => navigate(`/c/${chat.id}`)}
                                            className={`group cursor-pointer rounded-lg overflow-hidden transition-all hover:ring-2 hover:ring-white/20 ${isDark ? 'bg-[#1a1a1a]/80' : 'bg-white/80'}`}
                                        >
                                            <div className={`aspect-[16/9] flex items-center justify-center ${isDark ? 'bg-[#252525]' : 'bg-gray-100'}`}>
                                                <FileCode className={`w-6 h-6 ${isDark ? 'text-[#444]' : 'text-gray-300'}`} />
                                            </div>
                                            <div className="p-2">
                                                <div className="flex items-center gap-1.5">
                                                    <div className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-medium ${isDark ? 'bg-pink-500/30 text-pink-300' : 'bg-pink-500/20 text-pink-600'}`}>
                                                        {user.email?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <span className={`text-[11px] font-medium truncate flex-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>
                                                        {chat.title}
                                                    </span>
                                                </div>
                                                <p className={`text-[9px] mt-0.5 ml-5.5 ${isDark ? 'text-gray-600' : 'text-gray-400'}`}>
                                                    Viewed {new Date(chat.updated_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className={`col-span-2 sm:col-span-3 text-center py-8 text-sm ${isDark ? 'text-gray-500' : 'text-gray-400'}`}>
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