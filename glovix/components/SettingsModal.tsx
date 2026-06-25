'use client'
import { useState, useEffect } from 'react';
import { Settings, Cpu, Box, X } from 'lucide-react';
import { useStore } from '../store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

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
        <Dialog open onOpenChange={() => onClose()}>
            <DialogContent className="max-w-4xl h-[85vh] p-0 overflow-hidden rounded-xl">
                <div className="flex h-full">
                    {/* Sidebar */}
                    <div className={cn(
                        "w-56 shrink-0 p-4",
                        isDark ? 'bg-secondary' : 'bg-gray-50'
                    )}>
                        <p className="text-xs font-medium px-3 mb-3 text-muted-foreground">
                            Settings
                        </p>
                        <nav className="space-y-1">
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                return (
                                    <Button
                                        key={tab.id}
                                        variant={activeTab === tab.id ? 'secondary' : 'ghost'}
                                        size="sm"
                                        onClick={() => setActiveTab(tab.id)}
                                        className={cn(
                                            "w-full justify-start gap-3 text-sm font-normal",
                                            activeTab === tab.id && (isDark ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-50 text-blue-600')
                                        )}
                                    >
                                        <Icon className="w-4 h-4" />
                                        {tab.label}
                                    </Button>
                                );
                            })}
                        </nav>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <DialogHeader className={cn(
                            "px-8 py-5 border-b flex-row items-center justify-between space-y-0",
                            isDark ? 'border-border' : 'border-gray-200'
                        )}>
                            <DialogTitle className="text-lg">
                                {tabs.find(t => t.id === activeTab)?.label}
                            </DialogTitle>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={onClose}
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto px-8 py-6">
                            {activeTab === 'general' && (
                                <div className="space-y-8">
                                    <div>
                                        <h2 className="text-xl font-semibold mb-1 text-foreground">Appearance</h2>
                                        <p className="text-sm mb-6 text-muted-foreground">Customize the interface</p>

                                        <div className="space-y-6">
                                            <div>
                                                <label className="block text-sm font-medium mb-3 text-muted-foreground">
                                                    Theme
                                                </label>
                                                <div className="flex gap-3">
                                                    <Button
                                                        variant={theme === 'dark' ? 'default' : 'secondary'}
                                                        size="sm"
                                                        onClick={() => setTheme('dark')}
                                                    >
                                                        Dark
                                                    </Button>
                                                    <Button
                                                        variant={theme === 'light' ? 'default' : 'secondary'}
                                                        size="sm"
                                                        onClick={() => setTheme('light')}
                                                    >
                                                        Light
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'providers' && (
                                <div className="space-y-8">
                                    <div>
                                        <h2 className="text-xl font-semibold mb-1 text-foreground">AI Configuration</h2>
                                        <p className="text-sm text-muted-foreground">Configure AI model settings</p>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-muted-foreground">
                                                Model Context Limit (tokens)
                                            </label>
                                            <div className="relative">
                                                <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                <Input
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
                                                    className="pl-10"
                                                />
                                            </div>
                                            <p className="text-xs mt-1.5 text-muted-foreground">
                                                Maximum context window for the AI model. Common values: GPT-4 (128k), Claude (200k), Gemini (1M+)
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
