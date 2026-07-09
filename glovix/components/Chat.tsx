'use client'
import React, { useState, useRef, useEffect, RefObject, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileCode, Image as ImageIcon, X, ChevronRight, ChevronDown, MousePointer2, Undo2, Slash, Mic, AudioLines, ArrowUp, Eye, MessageSquare, Check } from 'lucide-react';
import { useStore } from '../store';
import { Message, MODEL_CHOICES, getModelChoice, type ModelChoice, type ModelType, type ToolCall } from '../lib/ai';
import { mountFiles } from '../lib/webcontainer';
import { getBaseProjectFiles } from '../lib/projectTemplate';
import { createChat, getHostProjectId, getEmbeddedChatId } from '../lib/api';
import { triggerAgentResponse } from '../lib/triggerAgentResponse';
import { MermaidBlock } from './MermaidBlock';
import { ImageViewer } from './ImageViewer';
import { DeepMemoryModal } from './DeepMemoryModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getSystemPrompt } from '../lib/systemPrompts';
import { SYRA_SKILLS, loadActiveSkillIds, saveActiveSkillIds } from '../lib/syraSkills';

// Keep for future use
// const MODELS: ModelType[] = ['glm-4.7'];
// const MODEL_NAMES = { 'glm-4.7': 'GLM 4.7' };

// Attachment interface
interface FileAttachment {
    name: string;
    type: string;
    size: number;
    content?: string; // Store content for transfer to workbench
}

// Helper to group messages for UI
type ContentType = string | null | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;

interface AssistantSegment {
    type: 'text' | 'tools';
    content?: ContentType;
    toolCalls?: { call: ToolCall; result?: string }[];
}

interface MessageGroup {
    role: 'user' | 'assistant';
    content: ContentType; // For user messages and backward compat
    thinking?: string;
    thinkingDuration?: number;
    attachments?: FileAttachment[];
    toolCalls?: {
        call: ToolCall;
        result?: string;
    }[];
    // Ordered segments for assistant messages (text and tool blocks in sequence)
    segments?: AssistantSegment[];
}

interface ChatProps {
    scrollRef?: RefObject<HTMLDivElement | null>;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    /** Embedded: switch to preview pane */
    onOpenPreview?: () => void;
    /** Embedded: switch to chat pane */
    onOpenChat?: () => void;
    /** Embedded: 0 = chat, 1 = preview */
    activePane?: number;
    /** @deprecated use activePane */
    showPreviewButton?: boolean;
    /** Called when the AI finishes streaming a complete response. */
    onAiComplete?: () => void;
}

// Claude-Code-style short path: filename only, but keep the parent folder for
// Next.js route files (page.tsx/layout.tsx/…) so many "page.tsx" rows stay
// distinguishable. e.g. "app/pricing/page.tsx" → "pricing/page.tsx", but
// "components/ui/button.tsx" → "button.tsx".
const NEXT_ROUTE_FILES = new Set([
    'page.tsx', 'page.ts', 'layout.tsx', 'layout.ts', 'route.ts', 'route.tsx',
    'loading.tsx', 'error.tsx', 'not-found.tsx', 'template.tsx', 'default.tsx',
    'globals.css', 'index.tsx', 'index.ts',
]);
const shortFilePath = (path: string): string => {
    if (!path) return '';
    const parts = path.replace(/\\/g, '/').replace(/\/+$/, '').split('/');
    const base = parts[parts.length - 1] || path;
    if (NEXT_ROUTE_FILES.has(base) && parts.length > 1) {
        return `${parts[parts.length - 2]}/${base}`;
    }
    return base;
};

const getActionDisplayName = (toolName: string, args: string): string => {
    if (!toolName) return 'Preparing...';

    const decodeHtml = (text: string): string => {
        return text
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'");
    };

    const extract = (key: string) => {
        const match = args.match(new RegExp(`"${key}"\\s*:\\s*"([^"]*)`));
        return match ? decodeHtml(match[1]) : '';
    };

    try {
        const parsed = JSON.parse(args);
        switch (toolName) {
            case 'createFile': return shortFilePath(parsed.path || '');
            case 'write_file': return shortFilePath(parsed.path || '');
            case 'editFile': return shortFilePath(parsed.path || '');
            case 'readFile': return shortFilePath(parsed.path || '');
            case 'readMultipleFiles': return `${(parsed.paths || []).length} files`;
            case 'deleteFile': return shortFilePath(parsed.path || '');
            case 'renameFile': return parsed.oldPath ? `${shortFilePath(parsed.oldPath)} → ${shortFilePath(parsed.newPath)}` : '';
            case 'grep':
            case 'searchInFiles': return decodeHtml(parsed.pattern || parsed.query || '');
            case 'createWorkspace': return 'Syte API';
            case 'setDomain': return decodeHtml(parsed.domain || '');
            case 'startPreview': return 'sycord.site preview';
            case 'typeCheck': return 'Workspace';
            case 'executeCommand': return decodeHtml(parsed.command || 'shell');
            case 'lintCheck': return parsed.path || 'src/';
            case 'listFiles': return 'Workspace';
            case 'getErrors': return 'Workspace';
            case 'batchCreateFiles': return `${(parsed.files || []).length} files`;
            case 'planning':
                if (parsed.action === 'updateStep' && parsed.stepId) return String(parsed.stepId).replace(/-/g, ' ');
                if (parsed.action === 'create') return parsed.title || parsed.appType || 'new plan';
                return parsed.action || 'pipeline';
            case 'deploy': return 'sycord.site';
            default: return '';
        }
    } catch {
        switch (toolName) {
            case 'createFile':
            case 'write_file':
            case 'editFile':
            case 'readFile':
            case 'deleteFile':
                return shortFilePath(extract('path'));
            case 'lintCheck':
                return extract('path');
            case 'readMultipleFiles':
                return 'Multiple files';
            case 'renameFile':
                const oldP = extract('oldPath');
                const newP = extract('newPath');
                return oldP ? `${oldP} → ${newP}` : oldP;
            case 'grep':
            case 'searchInFiles':
                return extract('pattern') || extract('query');
            case 'batchCreateFiles': return 'Multiple files';
            case 'planning': return extract('title') || extract('stepId') || extract('action') || 'pipeline';
            case 'getErrors': return 'Workspace';
            case 'setDomain': return extract('domain') || 'domain';
            case 'startPreview': return 'preview';
            case 'deploy': return 'sycord.site';
            default: return '';
        }
    }
};

function ModelSelector({ selectedModel, onSelect, showMenu, onToggleMenu, onCloseMenu, isDark }: {
    selectedModel: ModelType
    onSelect: (choice: ModelChoice) => void
    showMenu: boolean
    onToggleMenu: () => void
    onCloseMenu: () => void
    isDark: boolean
}) {
    const current = getModelChoice(selectedModel)

    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggleMenu}
                aria-label="Select model"
                className={`flex h-8 items-center gap-1 rounded-lg px-2 transition-colors active:scale-95 ${isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50'}`}
            >
                <span className={`text-[13px] font-medium tracking-tight ${isDark ? 'text-[#c5c6c9]' : 'text-gray-700'}`}>{current.label}</span>
                <ChevronDown className={`h-3.5 w-3.5 ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`} />
            </button>

            {showMenu && (
                <>
                    <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
                    <div className={`absolute bottom-full left-0 mb-2 rounded-xl overflow-hidden z-20 min-w-[210px] ${isDark ? 'bg-[#1c1d1f] border border-[#2a2b2e] shadow-xl' : 'bg-white border border-gray-200 shadow-lg'}`}>
                        <div className="p-1.5">
                            {MODEL_CHOICES.map((choice) => {
                                const isActive = choice.modelType === selectedModel
                                return (
                                    <button
                                        key={choice.id}
                                        type="button"
                                        onClick={() => onSelect(choice)}
                                        className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between transition-colors ${
                                            isActive
                                                ? isDark ? 'bg-[#26272a]' : 'bg-gray-50'
                                                : isDark ? 'hover:bg-[#26272a]' : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <span className={`text-[13px] font-medium ${isDark ? 'text-[#e5e5e5]' : 'text-gray-800'}`}>{choice.label}</span>
                                        <span className={`text-[11px] ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}>{choice.subtitle}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    )
}

export function Chat({ scrollRef, onScroll, onOpenPreview, onOpenChat, activePane = 0, showPreviewButton = false, onAiComplete }: ChatProps) {
    const navigate = useNavigate();
    const messages = useStore(s => s.messages);
    const addMessage = useStore(s => s.addMessage);
    const setMessages = useStore(s => s.setMessages);
    const selectedModel = useStore(s => s.selectedModel);
    const setSelectedModel = useStore(s => s.setSelectedModel);
    const setAiModel = useStore(s => s.setAiModel);
    const addTerminalOutput = useStore(s => s.addTerminalOutput);
    const updateLastMessage = useStore(s => s.updateLastMessage);
    const user = useStore(s => s.user);
    const currentChatId = useStore(s => s.currentChatId);
    const setCurrentChatId = useStore(s => s.setCurrentChatId);
    const theme = useStore(s => s.theme);
    const setSelectedFile = useStore(s => s.setSelectedFile);
    const setTokenCount = useStore(s => s.setTokenCount);
    const tokenCount = useStore(s => s.tokenCount);
    const modelContextLimit = useStore(s => s.modelContextLimit);
    const setSystemPrompt = useStore(s => s.setSystemPrompt);
    const selectedElement = useStore(s => s.selectedElement);
    const setSelectedElement = useStore(s => s.setSelectedElement);
    const [profileImgError, setProfileImgError] = useState(false);
    const [activeSkillIds, setActiveSkillIds] = useState<string[]>(() => loadActiveSkillIds());
    const [showSlashMenu, setShowSlashMenu] = useState(false);

    const toggleSkill = (skillId: string) => {
        const skill = SYRA_SKILLS.find((s) => s.id === skillId);
        if (!skill?.comingSoon) {
            setActiveSkillIds((prev) => {
                const next = prev.includes(skillId)
                    ? prev.filter((id) => id !== skillId)
                    : [...prev, skillId];
                saveActiveSkillIds(next);
                return next;
            });
        }
    };

    const isDark = theme === 'dark';
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [currentThinking, setCurrentThinking] = useState<string>('');
    const [thinkingDuration, setThinkingDuration] = useState<number>(0);
    const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Set system prompt in store for reference
    useEffect(() => {
        if (user) {
            const prompt = getSystemPrompt(selectedModel, getHostProjectId() || undefined);
            setSystemPrompt(prompt);
        }
    }, [user, selectedModel]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Initialize base project when chat starts
    const projectInitializedRef = useRef<string | null>(null);

    // Resolve preset ID: window.__glovixPreset > sessionStorage > default 'b27GcrRo'
    const presetId = useMemo(() => {
      if (typeof window !== 'undefined') {
        const winPreset = (window as any).__glovixPreset
        if (winPreset) return winPreset
      }
      try {
        const stored = sessionStorage.getItem('glovix_preset')
        if (stored) return stored
      } catch { /* ignore */ }
      return 'b27GcrRo'
    }, [])

    const initializeBaseProject = async () => {
        if (!currentChatId || projectInitializedRef.current === currentChatId) return;

        const state = useStore.getState();
        // Only initialize if no files exist yet
        if (Object.keys(state.files).length === 0) {
            projectInitializedRef.current = currentChatId;

            try {
                // Include preset section components in the base project files
                const projectFiles = getBaseProjectFiles(presetId);

                // Mount base project files to WebContainer
                await mountFiles(projectFiles);

                // Update store with base files
                state.setFiles(projectFiles);

                console.log('Base React project initialized with preset:', presetId);
            } catch (err) {
                console.error('Failed to initialize base project:', err);
            }
        }
    };

    // Load saved messages when opening an existing chat (standalone mode only).
    // Embedded dashboard chats are loaded by EmbeddedChat per project.
    useEffect(() => {
        if (getHostProjectId()) return;

        const loadChatMessages = async () => {
            if (currentChatId && user) {
                try {
                    const { getChatMessages } = await import('../lib/api');
                    const data = await getChatMessages(currentChatId);
                    if (data.messages && data.messages.length > 0) {
                        if (messages.length === 0) {
                            setMessages(data.messages);
                        }
                    }
                } catch (err) {
                    console.error('Failed to load chat messages:', err);
                }
            }
        };
        loadChatMessages();
    }, [currentChatId, user]);

    // Auto-process first message from HomePage
    const autoProcessedRef = useRef<string | null>(null);
    useEffect(() => {
        // If we have exactly 1 user message and haven't processed it for this chat, trigger submit
        if (
            messages.length === 1 &&
            messages[0].role === 'user' &&
            !isLoading &&
            currentChatId &&
            autoProcessedRef.current !== currentChatId
        ) {
            autoProcessedRef.current = currentChatId;

            // Initialize base project first
            initializeBaseProject().then(() => {
                // Check for documents from HomePage
                const storedDocs = sessionStorage.getItem(`chat_docs_${currentChatId}`);
                let aiMessage = messages[0];

                if (storedDocs) {
                    try {
                        const docs = JSON.parse(storedDocs) as { name: string; content: string; type: string }[];
                        sessionStorage.removeItem(`chat_docs_${currentChatId}`);

                        // Build AI message with full file contents
                        const displayContent = typeof messages[0].content === 'string'
                            ? messages[0].content
                            : (messages[0].content as any[]).find(p => p.type === 'text')?.text || '';

                        // Remove file names from display text to get original input
                        const originalInput = displayContent.split('\n📎')[0].trim();

                        const docsContext = docs.map(doc =>
                            `\n\n[User attached file: ${doc.name}]\n\`\`\`${doc.type.split('/')[1] || 'text'}\n${doc.content}\n\`\`\``
                        ).join('');
                        const aiText = originalInput + docsContext;

                        aiMessage = { role: 'user', content: aiText };
                    } catch (e) {
                        console.error('Error parsing stored docs:', e);
                    }
                }

                // Trigger the AI response with the message (with full docs if any)
                triggerAIResponse(aiMessage, currentChatId);
            });
        }
    }, [messages, currentChatId, isLoading]);

    // Auto-setup template project
    const templateSetupRef = useRef<string | null>(null);
    useEffect(() => {
        if (!currentChatId || isLoading || templateSetupRef.current === currentChatId) return;

        const templateFlag = sessionStorage.getItem(`template_setup_${currentChatId}`);
        if (templateFlag) {
            templateSetupRef.current = currentChatId;
            sessionStorage.removeItem(`template_setup_${currentChatId}`);

            // Add user message for setup
            const setupMessage: Message = {
                role: 'user',
                content: 'Install dependencies and run the project. Show me the preview.'
            };
            addMessage(setupMessage);

            // Trigger AI response
            setTimeout(() => {
                triggerAIResponse(setupMessage, currentChatId);
            }, 100);
        }
    }, [currentChatId, isLoading]);

    // Auto-trigger AI in forked chats — detect fork_context flag from sessionStorage
    const forkSetupRef = useRef<string | null>(null);
    useEffect(() => {
        if (!currentChatId || isLoading || forkSetupRef.current === currentChatId) return;

        const forkFlag = sessionStorage.getItem(`fork_context_${currentChatId}`);
        if (forkFlag) {
            forkSetupRef.current = currentChatId;
            // Prevent auto-process hook from also triggering on this chat
            autoProcessedRef.current = currentChatId;
            sessionStorage.removeItem(`fork_context_${currentChatId}`);

            // Initialize base project, then send context recovery message
            initializeBaseProject().then(() => {
                const forkMessage: Message = {
                    role: 'user',
                    content: 'Continue working on the project. Read .glovix/context.md for context from the previous chat.'
                };
                addMessage(forkMessage);

                setTimeout(() => {
                    triggerAIResponse(forkMessage, currentChatId);
                }, 100);
            });
        }
    }, [currentChatId, isLoading]);

    // Group messages: user messages are standalone, consecutive assistant+tool messages form one group with segments
    const groupedMessages = useMemo(() => {
        const groups: MessageGroup[] = [];
        let currentGroup: MessageGroup | null = null;

        for (const msg of messages) {
            if (msg.role === 'user') {
                if (currentGroup) groups.push(currentGroup);
                currentGroup = {
                    role: 'user',
                    content: msg.content,
                    attachments: (msg as any).attachments,
                    pickedElement: (msg as any).pickedElement
                } as any;
            } else if (msg.role === 'assistant') {
                if (currentGroup && currentGroup.role === 'assistant') {
                    if (!currentGroup.segments) currentGroup.segments = [];

                    if (msg.content) {
                        const textContent = typeof msg.content === 'string' ? msg.content : '';
                        if (textContent) {
                            const lastSeg = currentGroup.segments[currentGroup.segments.length - 1];
                            if (lastSeg && lastSeg.type === 'text' && typeof lastSeg.content === 'string') {
                                lastSeg.content += '\n\n' + textContent;
                            } else {
                                currentGroup.segments.push({ type: 'text', content: textContent });
                            }
                        }
                    }

                    if (!currentGroup.thinking && (msg as any).thinking) {
                        currentGroup.thinking = (msg as any).thinking;
                    }
                    if (!currentGroup.thinkingDuration && (msg as any).thinkingDuration) {
                        currentGroup.thinkingDuration = (msg as any).thinkingDuration;
                    }
                } else {
                    if (currentGroup) groups.push(currentGroup);

                    const segments: AssistantSegment[] = [];
                    if (msg.content) {
                        segments.push({ type: 'text', content: msg.content });
                    }

                    currentGroup = {
                        role: 'assistant',
                        content: msg.content,
                        thinking: (msg as any).thinking,
                        thinkingDuration: (msg as any).thinkingDuration,
                        segments
                    };
                }
            }
        }
        if (currentGroup) groups.push(currentGroup);
        return groups;
    }, [messages]);

    const handleStop = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
            setIsLoading(false);
            setCurrentThinking('');
        }
    };

    const [selectedImages, setSelectedImages] = useState<string[]>([]);
    const [selectedDocuments, setSelectedDocuments] = useState<{ name: string; content: string; type: string }[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const documentInputRef = useRef<HTMLInputElement>(null);

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

    const handleDocumentSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files);
            for (const file of files) {
                try {
                    const content = await readDocumentContent(file);
                    setSelectedDocuments(prev => [...prev, {
                        name: file.name,
                        content,
                        type: file.type || getFileType(file.name)
                    }]);
                } catch (err) {
                    console.error('Error reading file:', err);
                }
            }
        }
    };

    const getFileType = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const typeMap: Record<string, string> = {
            'txt': 'text/plain',
            'md': 'text/markdown',
            'json': 'application/json',
            'js': 'text/javascript',
            'ts': 'text/typescript',
            'tsx': 'text/typescript',
            'jsx': 'text/javascript',
            'css': 'text/css',
            'html': 'text/html',
            'py': 'text/python',
            'java': 'text/java',
            'c': 'text/c',
            'cpp': 'text/cpp',
            'rs': 'text/rust',
            'go': 'text/go',
            'sql': 'text/sql',
            'yaml': 'text/yaml',
            'yml': 'text/yaml',
            'xml': 'text/xml',
            'csv': 'text/csv',
        };
        return typeMap[ext] || 'text/plain';
    };

    const readDocumentContent = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const content = reader.result as string;
                resolve(content);
            };
            reader.onerror = () => reject(reader.error);
            reader.readAsText(file);
        });
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

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onloadend = () => {
                    setSelectedImages(prev => [...prev, reader.result as string]);
                };
                reader.readAsDataURL(file);
            }
        });
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Continue cloud agent (replaces legacy Glovix tool loop)
    const triggerAIResponse = async (userMessage: Message, chatIdOverride?: string) => {
        if (isLoading) return;

        setIsLoading(true);
        abortControllerRef.current = new AbortController();
        const chatId = chatIdOverride || currentChatId;

        try {
            await triggerAgentResponse({
                userMessage,
                chatId: chatId || undefined,
                user,
                model: selectedModel,
                activeSkillIds,
                abortSignal: abortControllerRef.current.signal,
                onAiComplete,
            });
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
            setCurrentThinking('');
        }
    };

    // Form submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && selectedImages.length === 0 && selectedDocuments.length === 0) || isLoading) return;

        // Handle /debug command - fetch VM connection debug info
        if (input.trim().startsWith("/debug")) {
            setDebugLoading(true);
            setDebugInfo(null);
            setInput("");
            try {
                const res = await fetch("/api/debug", { headers: { Accept: "application/json" } });
                const data = await res.json();
                setDebugInfo(data);
            } catch (err: any) {
                setDebugInfo({ error: err?.message || "Debug request failed" });
            } finally {
                setDebugLoading(false);
            }
            return;
        }

        // Create chat if not exists
        let chatId = currentChatId || getEmbeddedChatId();
        if (chatId && chatId !== currentChatId) {
            setCurrentChatId(chatId);
        }

        if (!chatId && user) {
            try {
                const title = input.slice(0, 50) + (input.length > 50 ? '...' : '');
                const chat = await createChat(user.uid, title);
                chatId = chat.id;
                setCurrentChatId(chat.id);
                navigate(`/c/${chat.id}`, { replace: true });

                // Update chats in store so titleGenerator can find this chat
                const currentChats = useStore.getState().chats;
                useStore.getState().setChats([chat, ...currentChats]);
            } catch (err) {
                console.error('Failed to create chat:', err);
                return;
            }
        }

        // We are submitting this message ourselves — mark it as processed so the
        // auto-process effect (which fires when messages.length === 1) does not
        // also trigger a second AI response. This matters in chat-only/embedded
        // mode where the chat is pre-selected before the first message.
        if (chatId) {
            autoProcessedRef.current = chatId;
        }

        // Build AI message (what AI receives) - full file contents
        let aiText = input;

        // Capture selected element before clearing
        const pickedElementForSend = selectedElement ? { ...selectedElement } : null;

        // Prepend selected element context if user picked an element from preview
        if (pickedElementForSend) {
            aiText = `[User selected this element from the preview]\nElement: ${pickedElementForSend.tag}\nSelector: ${pickedElementForSend.selector}\nText content: "${pickedElementForSend.text}"\n\nUser request: ${aiText}`;
            setSelectedElement(null); // Clear after sending
        }

        if (selectedDocuments.length > 0) {
            const docsContext = selectedDocuments.map(doc =>
                `\n\n[User attached file: ${doc.name}]\n\`\`\`${doc.type.split('/')[1] || 'text'}\n${doc.content}\n\`\`\``
            ).join('');
            aiText = input + docsContext;
        }

        // Message for display (stored in state) - just user text, attachments stored separately
        let displayMessage: any;
        if (selectedImages.length > 0) {
            displayMessage = {
                role: 'user',
                content: [
                    { type: 'text', text: input },
                    ...selectedImages.map(img => ({ type: 'image_url' as const, image_url: { url: img } }))
                ]
            };
        } else {
            displayMessage = { role: 'user', content: input };
        }

        // Save picked element info for display in chat
        if (pickedElementForSend) {
            displayMessage.pickedElement = pickedElementForSend;
        }

        // Add attachments with content to display message (for transfer to workbench)
        if (selectedDocuments.length > 0) {
            displayMessage.attachments = selectedDocuments.map(doc => ({
                name: doc.name,
                type: doc.type,
                size: doc.content.length,
                content: doc.content
            }));
        }

        // Message for AI (with full file contents)
        let aiMessage: Message;
        if (selectedImages.length > 0) {
            aiMessage = {
                role: 'user',
                content: [
                    { type: 'text', text: aiText },
                    ...selectedImages.map(img => ({ type: 'image_url' as const, image_url: { url: img } }))
                ]
            };
        } else {
            aiMessage = { role: 'user', content: aiText };
        }

        addMessage(displayMessage);
        setInput('');
        setSelectedImages([]);
        setSelectedDocuments([]);
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
        }

        // Send AI message (with full file contents) to AI
        await triggerAIResponse(aiMessage, chatId || undefined);
    };

    const [showModelMenu, setShowModelMenu] = useState(false);
    const [showDeepMemory, setShowDeepMemory] = useState(false);
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [debugLoading, setDebugLoading] = useState(false);

    const markdownComponents = React.useMemo(() => ({
        code({ node, inline, className, children, ...props }: any) {
            const match = /language-([\w-]+)/.exec(className || '');
            if (!inline && match && match[1] === 'mermaid') {
                return <MermaidBlock code={String(children).replace(/\n$/, '')} isDark={isDark} />;
            }
            // Search results block removed - don't render it
            if (!inline && match && match[1] === 'search-results') {
                return null;
            }
            return <code className={className} {...props}>{children}</code>;
        },
        img({ src, alt, ...props }: any) {
            // Use ImageViewer for fullscreen capability
            if (src) {
                return <ImageViewer src={src} alt={alt} isDark={isDark} />;
            }
            return <img src={src} alt={alt} {...props} />;
        }
    }), [isDark]);

    // Embedded inside a Sycord project → show the mobile chrome (back button,
    // centered "Syra" title, profile avatar) with a progressive blur on top and
    // safe-area aware spacing. The host injects the real Google avatar + a back
    // handler via window globals (see GlovixBuilder).
    const embedded = typeof window !== 'undefined' && !!getHostProjectId();
    const onSyraIsolatedShell = typeof window !== 'undefined' && window.location.pathname.includes('/syra');
    const hostUserImage = typeof window !== 'undefined' ? ((window as any).__glovixUserImage as string | undefined) : undefined;
    // External avatar URLs break require-corp isolation on Safari — use initials on /syra.
    const profileImage = onSyraIsolatedShell ? undefined : (hostUserImage || user?.photoURL);
    const handleBack = () => {
        const fn = typeof window !== 'undefined' ? (window as any).__glovixOnBack : undefined;
        if (typeof fn === 'function') fn();
    };

    const headerCircleBtn = (active = false) =>
        `flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border transition-all active:scale-95 ${
            active
                ? isDark
                    ? 'border-white bg-white text-[#18191B]'
                    : 'border-gray-900 bg-gray-900 text-white'
                : isDark
                    ? 'border-[#2a2b2e] bg-[#1c1d1f] text-[#9a9b9e] hover:text-white'
                    : 'border-gray-200 bg-white text-gray-500 hover:text-gray-900'
        }`;

    const paneToggle = embedded && onOpenPreview && onOpenChat;

    return (
        <div className={`relative flex flex-col h-full ${isDark ? 'bg-[#18191B]' : 'bg-white'}`}>
            {showDeepMemory && <DeepMemoryModal onClose={() => setShowDeepMemory(false)} />}
            {/* Mobile header (embedded mode): progressive blur + back + title + avatar */}
            {embedded && (
                <header className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
                    {/* Progressive blur — strongest at the very top, fading to clear so
                        content scrolls smoothly underneath. Layered for a true gradient blur. */}
                    <div className="absolute inset-0 -z-10" aria-hidden="true">
                        <div
                            className="absolute inset-0 backdrop-blur-[3px]"
                            style={{ WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)', maskImage: 'linear-gradient(to bottom, #000 0%, #000 55%, transparent 100%)' }}
                        />
                        <div
                            className="absolute inset-0 backdrop-blur-[10px]"
                            style={{ WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 35%, transparent 75%)', maskImage: 'linear-gradient(to bottom, #000 0%, #000 35%, transparent 75%)' }}
                        />
                        <div
                            className={`absolute inset-0 ${isDark ? 'bg-gradient-to-b from-[#18191B] via-[#18191B]/80 to-transparent' : 'bg-gradient-to-b from-white via-white/80 to-transparent'}`}
                        />
                    </div>

                    <div
                        className="pointer-events-auto relative grid grid-cols-[2.75rem_1fr_2.75rem] items-center gap-3 px-4 pb-3"
                        style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.625rem)' }}
                    >
                        {/* Back — left slot */}
                        <button
                            type="button"
                            onClick={handleBack}
                            aria-label="Back"
                            className={`${headerCircleBtn()} justify-self-start`}
                        >
                            <Undo2 className="h-5 w-5" />
                        </button>

                        {/* Center: chat / preview toggle (symmetrical pill) */}
                        {paneToggle ? (
                            <div
                                className={`justify-self-center flex h-11 w-[5.5rem] items-center justify-center rounded-full border p-1 ${
                                    isDark ? 'border-[#2a2b2e] bg-[#1c1d1f]/95' : 'border-gray-200 bg-white/95 shadow-sm'
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={onOpenChat}
                                    aria-label="Chat"
                                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${activePane === 0 ? (isDark ? 'bg-white text-[#18191B]' : 'bg-gray-900 text-white') : (isDark ? 'text-[#9a9b9e]' : 'text-gray-500')}`}
                                >
                                    <MessageSquare className="h-4 w-4" />
                                </button>
                                <button
                                    type="button"
                                    onClick={onOpenPreview}
                                    aria-label="Preview"
                                    className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${activePane === 1 ? (isDark ? 'bg-white text-[#18191B]' : 'bg-gray-900 text-white') : (isDark ? 'text-[#9a9b9e]' : 'text-gray-500')}`}
                                >
                                    <Eye className="h-4 w-4" />
                                </button>
                            </div>
                        ) : (
                            <div />
                        )}

                        {/* Profile — right slot (mirrors back button) */}
                        <button
                            type="button"
                            onClick={() => setShowDeepMemory(true)}
                            aria-label="Profile"
                            className={`${headerCircleBtn()} justify-self-end overflow-hidden`}
                        >
                            {profileImage && !profileImgError ? (
                                <img
                                    src={profileImage}
                                    alt="Profile"
                                    referrerPolicy="no-referrer"
                                    onError={() => setProfileImgError(true)}
                                    className="h-full w-full object-cover"
                                />
                            ) : (
                                <span className="text-[18px] font-extrabold leading-none tracking-tighter">M</span>
                            )}
                        </button>
                    </div>
                </header>
            )}

            {/* Messages Area */}
            <div
                ref={scrollRef}
                onScroll={onScroll}
                className="flex-1 overflow-y-auto scrollbar-hide"
            >
                <div
                    className={`max-w-2xl mx-auto ${embedded ? 'px-4' : 'px-6'} py-6 space-y-5`}
                    style={embedded ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4.75rem)' } : undefined}
                >
                    {groupedMessages.map((group, idx) => (
                        <div key={idx} className="space-y-3 animate-fade-in-up">
                            {group.role === 'assistant' && group.thinking && (
                                <ThinkingBlock
                                    thinking={group.thinking}
                                    isDark={isDark}
                                    thinkingTime={group.thinkingDuration || undefined}
                                    startTime={idx === groupedMessages.length - 1 && isLoading ? thinkingStartTime : undefined}
                                />
                            )}

                            {group.role === 'user' && group.attachments && group.attachments.length > 0 && (
                                <div className="flex justify-end mb-1">
                                    <div className="flex flex-col gap-1.5">
                                        {group.attachments.map((file, i) => (
                                            <FileAttachmentBlock key={i} file={file} isDark={isDark} />
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Assistant / user message body */}
                            <div className={`flex ${group.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div
                                    className={`text-[14px] leading-relaxed ${group.role === 'user'
                                        ? isDark ? 'bg-[#1f1f1f] text-[#e5e5e5] rounded-2xl px-4 py-2.5 max-w-[85%]' : 'bg-gray-100 text-gray-900 rounded-2xl px-4 py-2.5 max-w-[85%]'
                                        : isDark ? 'text-[#e5e5e5] max-w-full' : 'text-gray-800 max-w-full'
                                        }`}
                                >
                                    {group.role === 'user' && (group as any).pickedElement && (
                                        <div className={`flex items-center gap-1.5 mb-2 text-xs ${isDark ? 'text-blue-400/70' : 'text-blue-500/70'}`}>
                                            <MousePointer2 className="w-3 h-3 flex-shrink-0" />
                                            <span className="font-medium">
                                                {(group as any).pickedElement.selector.split('.')[0].split('#')[0].toUpperCase()}
                                            </span>
                                            {(group as any).pickedElement.text && (
                                                <span className="truncate opacity-70">
                                                    {(group as any).pickedElement.text.length > 30
                                                        ? (group as any).pickedElement.text.slice(0, 30) + '…'
                                                        : (group as any).pickedElement.text}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                    {(() => {
                                        const textFromSegments = group.segments
                                            ?.filter((s) => s.type === 'text' && s.content)
                                            .map((s) => (typeof s.content === 'string' ? s.content : ''))
                                            .join('\n\n');
                                        const content = textFromSegments || group.content;
                                        if (!content) return null;
                                        return (
                                            <div className={`prose prose-sm max-w-none w-full break-words overflow-hidden ${isDark ? 'prose-invert prose-pre:bg-[#1a1a1a] prose-pre:border prose-pre:border-[#2a2a2a] prose-pre:rounded-lg prose-code:text-[#e5e5e5]' : 'prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-lg'}`}>
                                                {Array.isArray(content) ? (
                                                    <div className="space-y-2">
                                                        {content.map((part, i) => {
                                                            if (part.type === 'image_url') {
                                                                return <img key={i} src={part.image_url.url} alt="" className="max-w-full rounded-lg max-h-[250px] object-contain" />;
                                                            }
                                                            return <ReactMarkdown key={i} remarkPlugins={[remarkGfm]} components={markdownComponents}>{part.text.replace(/^\[SYSTEM\] .*/gm, '')}</ReactMarkdown>;
                                                        })}
                                                    </div>
                                                ) : (
                                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                                        {content.replace(/^\[SYSTEM\] .*/gm, '')}
                                                    </ReactMarkdown>
                                                )}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Live Thinking - only when there's no assistant message yet or its thinking isn't set */}
                    {isLoading && currentThinking && (!groupedMessages.length || groupedMessages[groupedMessages.length - 1].role !== 'assistant' || !groupedMessages[groupedMessages.length - 1].thinking) && (
                        <ThinkingBlock thinking={currentThinking} isDark={isDark} thinkingTime={thinkingDuration || undefined} startTime={thinkingStartTime} />
                    )}

                    {/* Typing indicator — shows when AI is loading but hasn't produced any visible content yet */}
                    {isLoading && !currentThinking && (
                        !groupedMessages.length ||
                        groupedMessages[groupedMessages.length - 1].role === 'user' ||
                        (groupedMessages[groupedMessages.length - 1].role === 'assistant' && !groupedMessages[groupedMessages.length - 1].content)
                    ) && (
                        <div className="flex justify-start animate-fade-in-up">
                            <div className={`flex items-center gap-1.5 px-4 py-3 rounded-2xl ${isDark ? 'text-[#888]' : 'text-gray-400'}`}>
                                <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                                <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                                <span className="w-2 h-2 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>
            </div>

            {/* Debug Panel */}
            {debugLoading && (
                <div className={`px-4 pb-2 ${isDark ? 'text-[#888]' : 'text-gray-500'} text-xs flex items-center gap-2`}>
                    <span className="animate-spin">⟳</span>
                    Checking Dokploy API...
                </div>
            )}
            {debugInfo && !debugLoading && (
                <div className="px-4 pb-3">
                    <div className={`max-w-[720px] mx-auto rounded-xl overflow-hidden ${isDark ? 'bg-[#1c1c1c] border border-[#2a2a2a]' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className={`flex items-center justify-between px-4 py-2.5 border-b ${isDark ? 'border-[#2a2a2a]' : 'border-gray-200'}`}>
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${debugInfo.dokploy?.reachable ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className={`text-xs font-medium ${isDark ? 'text-white' : 'text-gray-900'}`}>Dokploy API Status</span>
                            </div>
                            <button type="button" onClick={() => setDebugInfo(null)}
                                className={`p-1 rounded ${isDark ? 'hover:bg-[#2a2a2a] text-[#666]' : 'hover:bg-gray-200 text-gray-400'}`}>
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                        <div className="p-4 font-mono text-[11px] leading-relaxed max-h-80 overflow-y-auto">
                            {debugInfo.error ? (
                                <div className="text-red-400">{debugInfo.error}</div>
                            ) : (
                                <div className="space-y-2">
                                    <div className={`${isDark ? 'text-[#aaa]' : 'text-gray-700'}`}>
                                        <div className={`text-xs font-semibold mb-1 ${isDark ? 'text-white' : 'text-gray-900'}`}>Dokploy API</div>
                                        <div>Configured: <span className={debugInfo.dokploy?.configured ? 'text-green-400' : 'text-red-400'}>{debugInfo.dokploy?.configured ? 'Yes' : 'No'}</span></div>
                                        <div>Reachable: <span className={debugInfo.dokploy?.reachable ? 'text-green-400' : 'text-red-400'}>{debugInfo.dokploy?.reachable ? 'Yes' : 'No'}</span></div>
                                        <div>API URL: <span className={isDark ? 'text-[#7c3aed]' : 'text-purple-700'}>{debugInfo.dokploy?.apiUrl || 'N/A'}</span></div>
                                        {debugInfo.dokploy?.projectsCount !== undefined && <div>Projects: {debugInfo.dokploy.projectsCount}</div>}
                                        {debugInfo.dokploy?.latencyMs && <div>Latency: {debugInfo.dokploy.latencyMs}ms</div>}
                                        {debugInfo.dokploy?.error && <div className="text-red-400">Error: {debugInfo.dokploy.error}</div>}
                                    </div>
                                    <div className={`text-xs ${isDark ? 'text-[#555]' : 'text-gray-400'}`}>Timestamp: {debugInfo.timestamp}</div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Input Area - centered with margins */}
            <div className="px-4 pb-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                <div className="max-w-[720px] mx-auto">
                    <form
                        onSubmit={handleSubmit}
                        onPaste={handlePaste}
                        onDrop={handleDrop}
                        onDragOver={(e) => e.preventDefault()}
                        className="flex flex-col gap-2.5"
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            multiple
                            onChange={handleImageSelect}
                        />
                        <input
                            type="file"
                            ref={documentInputRef}
                            className="hidden"
                            accept=".txt,.md,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,.java,.c,.cpp,.rs,.go,.sql,.yaml,.yml,.xml,.csv,.log,.sh,.bat,.env,.gitignore"
                            multiple
                            onChange={handleDocumentSelect}
                        />

                        {(selectedImages.length > 0 || selectedDocuments.length > 0) && (
                            <div className={`flex gap-2 px-3 py-2 overflow-x-auto rounded-2xl border ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e]' : 'bg-white border-gray-200'}`}>
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

                        {/* Selected element from preview picker */}
                        {selectedElement && (
                            <div className={`flex items-center gap-2 px-3 py-2 rounded-2xl border ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e]' : 'bg-white border-gray-200'}`}>
                                <div className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs max-w-full overflow-hidden ${isDark ? 'bg-blue-500/10 border border-blue-500/20' : 'bg-blue-50 border border-blue-200'}`}>
                                    <MousePointer2 className={`w-3 h-3 flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                                    <span className={`font-medium flex-shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                        {selectedElement.selector.split('.')[0].split('#')[0].toUpperCase()}
                                    </span>
                                    {selectedElement.text && (
                                        <span className={`truncate ${isDark ? 'text-zinc-400' : 'text-gray-500'}`}>
                                            {selectedElement.text.length > 40 ? selectedElement.text.slice(0, 40) + '…' : selectedElement.text}
                                        </span>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => setSelectedElement(null)}
                                        className={`ml-auto flex-shrink-0 p-0.5 rounded hover:bg-red-500/20 ${isDark ? 'text-zinc-500 hover:text-red-400' : 'text-gray-400 hover:text-red-500'}`}
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Unified composer card — plan checklist embedded at top on small screens */}
                        <div className={`rounded-[28px] border px-2 pt-1.5 pb-2 transition-colors ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e] focus-within:border-[#3a3b3e]' : 'bg-white border-gray-200 shadow-sm focus-within:border-gray-300'}`}>
                            <textarea
                                ref={textareaRef}
                                value={input}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    // Auto-resize
                                    const target = e.target as HTMLTextAreaElement;
                                    target.style.height = 'auto';
                                    const maxH = typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 200;
                                    target.style.height = `${Math.min(target.scrollHeight, maxH)}px`;
                                }}
                                placeholder="Help you write code, debug and ship production-ready work."
                                className={`w-full bg-transparent text-[16px] leading-relaxed px-3 pt-2.5 pb-2 focus:outline-none resize-none overflow-y-auto max-h-[120px] md:max-h-[200px] ${isDark ? 'text-[#e5e5e5] placeholder:text-[#6b6c6f]' : 'text-gray-900 placeholder:text-gray-400'}`}
                                style={{ height: 'auto', minHeight: '76px' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSubmit(e);
                                    }
                                }}
                            />

                            {/* Toolbar */}
                            <div className="flex items-center gap-2 px-1">
                                {/* Slash menu — skills + attach */}
                                <div className="relative">
                                    <button
                                        type="button"
                                        onClick={() => { setShowSlashMenu(!showSlashMenu); setShowModelMenu(false); }}
                                        aria-label="Slash commands"
                                        className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors active:scale-95 ${isDark ? 'border-[#3a3b3e] text-[#9a9b9e] hover:text-white hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                                    >
                                        <Slash className="h-3.5 w-3.5" />
                                    </button>

                                    {showSlashMenu && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setShowSlashMenu(false)} />
                                            <div className={`absolute bottom-full left-0 mb-2 z-20 w-[min(92vw,18rem)] max-h-[min(70vh,22rem)] overflow-y-auto rounded-xl ${isDark ? 'bg-[#1c1d1f] border border-[#2a2b2e] shadow-xl' : 'bg-white border border-gray-200 shadow-lg'}`}>
                                                <div className={`px-3 pt-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}>
                                                    Skills
                                                </div>
                                                <div className="px-1.5 pb-1">
                                                    {SYRA_SKILLS.map((skill) => {
                                                        const enabled = activeSkillIds.includes(skill.id);
                                                        return (
                                                            <button
                                                                key={skill.id}
                                                                type="button"
                                                                disabled={skill.comingSoon}
                                                                onClick={() => toggleSkill(skill.id)}
                                                                className={`w-full text-left px-2.5 py-2 rounded-lg flex items-start gap-2.5 transition-colors ${
                                                                    skill.comingSoon
                                                                        ? isDark ? 'opacity-50 cursor-not-allowed' : 'opacity-60 cursor-not-allowed'
                                                                        : isDark ? 'hover:bg-[#26272a]' : 'hover:bg-gray-50'
                                                                }`}
                                                            >
                                                                <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${
                                                                    skill.comingSoon
                                                                        ? isDark ? 'border-[#3a3b3e]' : 'border-gray-300'
                                                                        : enabled
                                                                            ? isDark ? 'border-white bg-white text-[#18191B]' : 'border-gray-900 bg-gray-900 text-white'
                                                                            : isDark ? 'border-[#3a3b3e]' : 'border-gray-300'
                                                                }`}>
                                                                    {enabled && !skill.comingSoon && <Check className="h-2.5 w-2.5" />}
                                                                </span>
                                                                <span className="min-w-0 flex-1">
                                                                    <span className={`flex items-center gap-1.5 text-[13px] font-medium ${isDark ? 'text-[#e5e5e5]' : 'text-gray-800'}`}>
                                                                        {skill.label}
                                                                        {skill.comingSoon && (
                                                                            <span className={`rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${isDark ? 'bg-[#2a2b2e] text-[#9a9b9e]' : 'bg-gray-100 text-gray-500'}`}>
                                                                                Coming soon
                                                                            </span>
                                                                        )}
                                                                    </span>
                                                                    <span className={`block text-[11px] leading-snug mt-0.5 ${isDark ? 'text-[#6b6c6f]' : 'text-gray-500'}`}>
                                                                        {skill.description}
                                                                    </span>
                                                                </span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                                <div className={`mx-3 my-1 border-t ${isDark ? 'border-[#2a2b2e]' : 'border-gray-200'}`} />
                                                <div className={`px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wide ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}>
                                                    Attach
                                                </div>
                                                <div className="p-1.5 pt-0">
                                                    <button type="button" onClick={() => { fileInputRef.current?.click(); setShowSlashMenu(false); }}
                                                        className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2.5 rounded-lg ${isDark ? 'hover:bg-[#26272a] text-[#e5e5e5]' : 'hover:bg-gray-50 text-gray-700'}`}>
                                                        <ImageIcon className="w-4 h-4" /> Image
                                                    </button>
                                                    <button type="button" onClick={() => { documentInputRef.current?.click(); setShowSlashMenu(false); }}
                                                        className={`w-full text-left px-3 py-2 text-[13px] flex items-center gap-2.5 rounded-lg ${isDark ? 'hover:bg-[#26272a] text-[#e5e5e5]' : 'hover:bg-gray-50 text-gray-700'}`}>
                                                        <FileCode className="w-4 h-4" /> Document
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>

                                {/* Model selector */}
                                <ModelSelector
                                    selectedModel={selectedModel}
                                    onSelect={(choice) => {
                                        setSelectedModel(choice.modelType)
                                        setAiModel(choice.apiModel)
                                        setShowModelMenu(false)
                                    }}
                                    showMenu={showModelMenu}
                                    onToggleMenu={() => { setShowModelMenu(!showModelMenu); setShowSlashMenu(false); }}
                                    onCloseMenu={() => setShowModelMenu(false)}
                                    isDark={isDark}
                                />

                                {/* Right cluster */}
                                <div className="ml-auto flex items-center gap-1">
                                    <button
                                        type="button"
                                        aria-label="Voice input"
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors active:scale-95 ${isDark ? 'text-[#9a9b9e] hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                    >
                                        <Mic className="h-5 w-5" />
                                    </button>
                                    <button
                                        type="button"
                                        aria-label="Voice mode"
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors active:scale-95 ${isDark ? 'text-[#9a9b9e] hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                    >
                                        <AudioLines className="h-5 w-5" />
                                    </button>

                                    {isLoading ? (
                                        <button
                                            type="button"
                                            onClick={handleStop}
                                            aria-label="Stop"
                                            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white text-black transition-all active:scale-95 hover:bg-gray-200"
                                        >
                                            <div className="h-3 w-3 rounded-sm bg-black" />
                                        </button>
                                    ) : (
                                        <button
                                            type="submit"
                                            disabled={!input.trim() && selectedImages.length === 0}
                                            aria-label="Send"
                                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed ${input.trim() || selectedImages.length > 0
                                                ? 'bg-white text-black hover:bg-gray-200'
                                                : isDark ? 'bg-white/15 text-white/40' : 'bg-gray-200 text-gray-400'}`}
                                        >
                                            <ArrowUp className="h-5 w-5" strokeWidth={2.5} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

function ThinkingBlock({ thinking, isDark, thinkingTime, startTime }: { thinking: string; isDark: boolean; thinkingTime?: number, startTime?: number | null }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (startTime && !thinkingTime) {
            // Initial calc
            setElapsed(Math.max(1, Math.round((Date.now() - startTime) / 1000)));

            const interval = setInterval(() => {
                setElapsed(Math.max(1, Math.round((Date.now() - startTime) / 1000)));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [startTime, thinkingTime]);

    if (!thinking) return null;

    // Use finalized time if available, otherwise live elapsed time
    const displayTime = thinkingTime !== undefined ? thinkingTime : (startTime ? elapsed : 0);

    return (
        <div className="mb-2 animate-fade-in">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className={`flex items-center gap-1.5 text-sm transition-colors ${isDark ? 'text-[#666] hover:text-[#888]' : 'text-gray-400 hover:text-gray-600'}`}
            >
                <span>Thought for {displayTime}s</span>
                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
            </button>

            {isExpanded && (
                <div className={`mt-2 text-sm leading-relaxed whitespace-pre-wrap animate-fade-in ${isDark ? 'text-[#555]' : 'text-gray-400'}`}>
                    {thinking}
                </div>
            )}
        </div>
    );
}

function FileAttachmentBlock({ file, isDark }: { file: FileAttachment; isDark: boolean }) {
    const [showMenu, setShowMenu] = useState(false);
    const { setFiles, files, setSelectedFile } = useStore();

    const handleAddToWorkbench = () => {
        if (file.content) {
            setFiles({ ...files, [file.name]: { file: { contents: file.content } } });
            setSelectedFile(file.name);
            setShowMenu(false);
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowMenu(!showMenu)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${isDark ? 'bg-[#1a1a1a] hover:bg-[#1f1f1f]' : 'bg-gray-100 hover:bg-gray-200'}`}
            >
                <FileCode className={`w-4 h-4 ${isDark ? 'text-[#666]' : 'text-gray-400'}`} />
                <span className={`text-sm ${isDark ? 'text-[#ccc]' : 'text-gray-700'}`}>{file.name}</span>
            </button>

            {showMenu && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                    <div className={`absolute top-full left-0 mt-1 rounded-lg overflow-hidden z-20 min-w-[160px] ${isDark ? 'bg-[#1a1a1a] border border-[#2a2a2a]' : 'bg-white border border-gray-200 shadow-lg'}`}>
                        <button
                            onClick={handleAddToWorkbench}
                            disabled={!file.content}
                            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${isDark ? 'hover:bg-[#1f1f1f] text-[#ccc]' : 'hover:bg-gray-50 text-gray-700'} disabled:opacity-50`}
                        >
                            <FileCode className="w-4 h-4" />
                            Add to Workbench
                        </button>
                    </div>
                </>
            )}
        </div>
    );
}
