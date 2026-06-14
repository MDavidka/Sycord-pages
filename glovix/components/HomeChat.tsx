'use client'
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Image as ImageIcon, X } from 'lucide-react';
import { useStore } from '../store';
import { createChat } from '../lib/api';
import { Message } from '../lib/ai';

// Keep for future use
// const MODELS: ModelType[] = ['glm-4.7'];

export function HomeChat() {
    const navigate = useNavigate();
    const { user, theme, addMessage, setCurrentChatId } = useStore();
    const isDark = theme === 'dark';

    const [input, setInput] = useState('');
    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [showModelMenu, setShowModelMenu] = useState(false);
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
            // Create new chat
            const title = input.slice(0, 50) + (input.length > 50 ? '...' : '');
            const chat = await createChat(user.uid, title);

            // Update chats in store so titleGenerator can find this chat
            const currentChats = useStore.getState().chats;
            useStore.getState().setChats([chat, ...currentChats]);

            // Create user message
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

            // Set chat and add message
            setCurrentChatId(chat.id);
            addMessage(userMessage);

            // Navigate to chat
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
                {/* Header */}
                <div className="text-center space-y-2">
                    <img src={isDark ? "/logo.png" : "/logo2.png"} alt="Glovix" className="h-12 mx-auto mb-4" />
                    <h1 className={`text-3xl md:text-4xl font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                        How can Glovix help you today?
                    </h1>
                    <p className={isDark ? 'text-[#a3a3a3]' : 'text-gray-500'}>
                        I can help you build web applications, debug code, and more.
                    </p>
                </div>

                {/* Input */}
                <form
                    onSubmit={handleSubmit}
                    onPaste={handlePaste}
                    className={`relative rounded-2xl border transition-colors ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-white border-gray-300 shadow-sm'}`}
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
                        <div className={`flex gap-2 p-3 overflow-x-auto border-b ${isDark ? 'border-[#262626]' : 'border-gray-200'}`}>
                            {selectedImages.map((img, i) => (
                                <div key={i} className="relative flex-shrink-0 group">
                                    <img src={img} alt="Preview" className={`h-16 w-16 object-cover rounded-lg border ${isDark ? 'border-[#333]' : 'border-gray-300'}`} />
                                    <button
                                        type="button"
                                        onClick={() => setSelectedImages(prev => prev.filter((_, idx) => idx !== i))}
                                        className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <textarea
                        ref={textareaRef}
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Describe what you want to build..."
                        className={`w-full bg-transparent text-sm rounded-xl pl-4 pr-4 pt-4 pb-14 focus:outline-none resize-none min-h-[120px] max-h-[200px] ${isDark ? 'text-[#e5e5e5] placeholder:text-[#525252]' : 'text-gray-900 placeholder:text-gray-400'}`}
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
                        <div className="flex items-center gap-2 relative">
                            {showModelMenu && (
                                <div className={`absolute bottom-full left-0 mb-2 rounded-lg shadow-xl overflow-hidden z-10 min-w-[200px] ${isDark ? 'bg-[#171717] border border-[#262626]' : 'bg-white border border-gray-200'}`}>
                                    <div className="p-1 space-y-0.5">
                                        <button
                                            type="button"
                                            onClick={() => { fileInputRef.current?.click(); setShowModelMenu(false); }}
                                            className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center gap-2 rounded-md ${isDark ? 'hover:bg-[#262626] text-[#e5e5e5]' : 'hover:bg-gray-100 text-gray-700'}`}
                                        >
                                            <ImageIcon className="w-4 h-4" />
                                            Upload Image
                                        </button>
                                    </div>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowModelMenu(!showModelMenu)}
                                className={`p-1.5 rounded-full transition-colors border ${showModelMenu ? 'text-blue-400 border-blue-400/30 bg-blue-400/10' : isDark ? 'text-[#a3a3a3] hover:text-[#e5e5e5] hover:bg-[#262626] border-transparent hover:border-[#333]' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 border-transparent hover:border-gray-300'}`}
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                        <button
                            type="submit"
                            disabled={(!input.trim() && selectedImages.length === 0) || isSubmitting}
                            className="p-2 bg-[#3b82f6] text-white rounded-full hover:bg-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                        >
                            <svg className="w-4 h-4 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                            </svg>
                        </button>
                    </div>
                </form>

                {/* Suggestions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {suggestions.map((s, i) => (
                        <button
                            key={i}
                            onClick={() => setInput(s.prompt)}
                            className={`p-4 rounded-xl text-left transition-colors ${isDark ? 'bg-[#1a1a1a] border border-[#262626] hover:border-[#404040]' : 'bg-white border border-gray-200 hover:border-gray-300 shadow-sm'}`}
                        >
                            <h3 className={`font-medium mb-1 ${isDark ? 'text-[#e5e5e5]' : 'text-gray-900'}`}>{s.title}</h3>
                            <p className={`text-xs ${isDark ? 'text-[#a3a3a3]' : 'text-gray-500'}`}>{s.desc}</p>
                        </button>
                    ))}
                </div>

                <p className={`text-center text-[10px] ${isDark ? 'text-[#525252]' : 'text-gray-400'}`}>
                    Glovix can make mistakes. Check important info.
                </p>
            </div>
        </div>
    );
}