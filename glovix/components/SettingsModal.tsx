'use client'
import { useState, useEffect } from 'react';
import { X, Settings, Cpu, Box } from 'lucide-react';
import { useStore } from '../store';

interface SettingsModalProps {
    onClose: () => void;
}

type Tab = 'general' | 'providers';

export function SettingsModal({ onClose }: SettingsModalProps) {
    const {
        user, theme, setTheme,
        modelContextLimit, setModelContextLimit
    } = useStore();
    const [activeTab, setActiveTab] = useState<Tab>('general');
    const [contextLimitInput, setContextLimitInput] = useState(String(modelContextLimit));

    const isDark = theme === 'dark';

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    if (!user) return null;

    const tabs = [
        { id: 'general' as Tab, label: 'General', icon: Settings },
        { id: 'providers' as Tab, label: 'AI Model', icon: Cpu },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
            <div
                onClick={e => e.stopPropagation()}
                className={`w-full max-w-5xl h-[85vh] overflow-hidden rounded-xl flex ${isDark ? 'bg-[#1a1a1a]' : 'bg-white'
                    }`}
            >
                <div className={`w-56 shrink-0 p-4 ${isDark ? 'bg-[#141414]' : 'bg-gray-50'}`}>
                    <p className={`text-xs font-medium px-3 mb-3 ${isDark ? 'text-[#666]' : 'text-gray-400'}`}>
                        Settings
                    </p>
                    <nav className="space-y-1">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${activeTab === tab.id
                                    ? isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                                    : isDark ? 'text-[#999] hover:text-white hover:bg-[#252525]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                    }`}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </nav>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className={`flex items-center justify-between px-8 py-5 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                        <h2 className={`text-lg font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>
                            {tabs.find(t => t.id === activeTab)?.label}
                        </h2>
                        <button
                            onClick={onClose}
                            className={`p-1.5 rounded-lg transition-colors ${isDark ? 'text-[#666] hover:text-white' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto px-8 py-6">
                        {activeTab === 'general' && (
                            <div className="space-y-8">
                                <div>
                                    <h2 className={`text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Appearance</h2>
                                    <p className={`text-sm mb-6 ${isDark ? 'text-[#666]' : 'text-gray-500'}`}>Customize the interface</p>

                                    <div className="space-y-6">
                                        <div>
                                            <label className={`block text-sm font-medium mb-3 ${isDark ? 'text-[#999]' : 'text-gray-700'}`}>
                                                Theme
                                            </label>
                                            <div className="flex gap-3">
                                                <button
                                                    onClick={() => setTheme('dark')}
                                                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${theme === 'dark'
                                                        ? 'bg-blue-500 text-white'
                                                        : isDark ? 'bg-[#252525] text-[#999] hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    Dark
                                                </button>
                                                <button
                                                    onClick={() => setTheme('light')}
                                                    className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-colors ${theme === 'light'
                                                        ? 'bg-blue-500 text-white'
                                                        : isDark ? 'bg-[#252525] text-[#999] hover:text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                                        }`}
                                                >
                                                    Light
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'providers' && (
                            <div className="space-y-8">
                                <div>
                                    <h2 className={`text-xl font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>AI Configuration</h2>
                                    <p className={`text-sm ${isDark ? 'text-[#666]' : 'text-gray-500'}`}>Configure AI model settings</p>
                                </div>

                                <div className="space-y-6">
                                    <div>
                                        <label className={`block text-sm font-medium mb-2 ${isDark ? 'text-[#999]' : 'text-gray-700'}`}>
                                            Model Context Limit (tokens)
                                        </label>
                                        <div className="relative">
                                            <Box className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${isDark ? 'text-[#555]' : 'text-gray-400'}`} />
                                            <input
                                                type="text"
                                                value={contextLimitInput}
                                                onChange={(e) => setContextLimitInput(e.target.value)}
                                                onBlur={() => {
                                                    const num = parseInt(contextLimitInput);
                                                    if (!isNaN(num) && num >= 1000 && num <= 2000000) {
                                                        setModelContextLimit(num);
                                                    } else {
                                                        setContextLimitInput(String(modelContextLimit));
                                                    }
                                                }}
                                                placeholder="200000"
                                                className={`w-full pl-10 pr-4 py-2.5 rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${isDark
                                                    ? 'bg-[#141414] border border-[#333] text-white placeholder-[#444] focus:border-blue-500'
                                                    : 'bg-white border border-gray-200 text-gray-900 placeholder-gray-400 focus:border-blue-500'
                                                    }`}
                                            />
                                        </div>
                                        <p className={`text-xs mt-1.5 ${isDark ? 'text-[#555]' : 'text-gray-500'}`}>
                                            Maximum context window for the AI model. Common values: GPT-4 (128k), Claude (200k), Gemini (1M+)
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}