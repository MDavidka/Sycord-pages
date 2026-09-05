'use client'
import React, { useState, useRef, useEffect, RefObject, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Brain, Copy, CreditCard, FileCode, FileUp, HelpCircle, Image as ImageIcon, Puzzle, Sparkles, X, ChevronRight, ChevronDown, MousePointer2, Slash, Mic, ArrowUp, Eye, Check as CheckIcon, Check, Loader2 } from 'lucide-react';
import { useStore } from '../store';
import { sendMessage, Message, ToolCall, getProviderIconUrl, fetchAvailableModelChoices, type ModelChoice, type ModelType } from '../lib/ai';
import {
    fetchPendingAgentQuestions,
    getLatestAgentSession,
    getLatestTursoSessionId,
    resumeProjectAgent,
    streamProjectAgent,
    type AgentQuestion,
    type ProjectAgentEvent,
} from '../lib/project-agent';
import { mountFiles } from '../lib/webcontainer';
import { canBootWebContainer } from '../lib/coep';
import { executeTool, isParallelSafeTool, ToolContext } from '../lib/tools';
import { BASE_PROJECT_FILES, getBaseProjectFiles, getPresetDescription } from '../lib/projectTemplate';
import { saveChatMessages, saveProject, createChat, getHostProjectId, getEmbeddedChatId } from '../lib/api';
import { generateAndSaveTitle } from '../lib/titleGenerator';
import { ActionsList, StreamingAction } from './ActionsList';
import { ModelLearnPanel } from './ModelLearnPanel';
import {
    AgentQuestionCard,
    answerProjectAgentQuestion,
    type AgentQuestionAnswerValue,
} from './AgentQuestionCard';
import {
    CreditsPanel,
    HelpSupportPanel,
    McpLibrary,
    SkillsLibrary,
} from './SlashLibraries';
import { McpBrandIcon } from './McpBrandIcons';
import { buildModelLearnContext, recordToolLearnEntry } from '../lib/model-learn';
import { MermaidBlock } from './MermaidBlock';
import { ImageViewer } from './ImageViewer';
import { DeepMemoryModal } from './DeepMemoryModal';
import { Marker, MarkerContent } from '@/components/ui/marker';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Markdown } from '@/components/agent-elements/markdown';
import { SpiralLoader } from '@/components/agent-elements/spiral-loader';
import { getSystemPrompt } from '../lib/systemPrompts';
import { buildInjectedProjectContext } from '../lib/project-context';
import { planFromAgentUpdate } from '../lib/agent-plan';
import {
    BUILTIN_MCP_FALLBACK,
    BUILTIN_SKILL_FALLBACK,
    fetchProjectMcp,
    fetchProjectSkills,
    type SyraSlashMcpAddon,
    type SyraSlashSkill,
} from '../lib/syraSlashExtras';

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
    agentActions?: StreamingAction[];
    attachments?: FileAttachment[];
    createdAt?: number;
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
    /** Embedded mobile: opens the live preview pane (swipe left). */
    onOpenPreview?: () => void;
    showPreviewButton?: boolean;
    /** Called when an AI response finishes, including which agent handled it. */
    onAiComplete?: (source?: 'local' | 'remote') => void;
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
            case 'edit_file': return shortFilePath(parsed.path || '');
            case 'apply_patch': return shortFilePath(parsed.path || parsed.file || '');
            case 'readFile': return shortFilePath(parsed.path || '');
            case 'read_file': return shortFilePath(parsed.path || '');
            case 'readMultipleFiles': return `${(parsed.paths || []).length} files`;
            case 'read_multiple_files': return `${(parsed.paths || []).length} files`;
            case 'file_created':
            case 'file_modified':
            case 'file_deleted': return shortFilePath(parsed.path || parsed.file || parsed.file_path || '');
            case 'deleteFile': return shortFilePath(parsed.path || '');
            case 'renameFile': return parsed.oldPath ? `${shortFilePath(parsed.oldPath)} → ${shortFilePath(parsed.newPath)}` : '';
            case 'grep':
            case 'searchInFiles': return decodeHtml(parsed.pattern || parsed.query || '');
            case 'createWorkspace': return 'Syte API';
            case 'setDomain': return decodeHtml(parsed.domain || '');
            case 'startPreview': return 'sycord.site preview';
            case 'typeCheck': return 'Workspace';
            case 'executeCommand': return decodeHtml(parsed.command || 'shell');
            case 'execute_command': return decodeHtml(parsed.command || 'shell');
            case 'command_run': return decodeHtml(parsed.command || parsed.cmd || 'shell');
            case 'lintCheck': return parsed.path || 'src/';
            case 'listFiles': return 'Workspace';
            case 'getErrors': return 'Workspace';
            case 'batchCreateFiles': return `${(parsed.files || []).length} files`;
            case 'planning':
                if (parsed.action === 'updateStep' && parsed.stepId) return String(parsed.stepId).replace(/-/g, ' ');
                if (parsed.action === 'create') return parsed.title || parsed.appType || 'new plan';
                return parsed.action || 'pipeline';
            case 'update_plan':
                return Array.isArray(parsed.steps) ? `${parsed.steps.length} steps` : (parsed.title || 'plan');
            case 'screenshot_preview':
            case 'screenshot':
                return parsed.route || parsed.viewport || 'preview';
            case 'service':
                return parsed.action || parsed.name || 'service';
            case 'deploy': return 'sycord.site';
            default: return '';
        }
    } catch {
        switch (toolName) {
            case 'createFile':
            case 'write_file':
            case 'editFile':
            case 'edit_file':
            case 'apply_patch':
            case 'readFile':
            case 'read_file':
            case 'file_created':
            case 'file_modified':
            case 'file_deleted':
            case 'deleteFile':
                return shortFilePath(extract('path') || extract('file') || extract('file_path'));
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
            case 'update_plan': return 'plan';
            case 'screenshot_preview':
            case 'screenshot': return extract('route') || 'preview';
            case 'getErrors': return 'Workspace';
            case 'setDomain': return extract('domain') || 'domain';
            case 'startPreview': return 'preview';
            case 'deploy': return 'sycord.site';
            default: return '';
        }
    }
};

function syncPlanFromTool(toolName: string, args: unknown, setGenerationPlan: (plan: any) => void) {
    const name = toolName.toLowerCase();
    if (name !== 'update_plan' && name !== 'planning' && name !== 'plan') return;
    const next = planFromAgentUpdate(args, useStore.getState().generationPlan);
    if (next) setGenerationPlan(next);
}

function ModelSelector({ selectedModel, choices, loading, error, onSelect, showMenu, onToggleMenu, onCloseMenu, onRetry, isDark }: {
    selectedModel: ModelType
    choices: ModelChoice[]
    loading: boolean
    error: string | null
    onSelect: (choice: ModelChoice) => void
    showMenu: boolean
    onToggleMenu: () => void
    onCloseMenu: () => void
    onRetry: () => void
    isDark: boolean
}) {
    const current = choices.find(choice => choice.modelType === selectedModel) || choices[0]
    const displayModel = loading ? 'Loading models…' : error ? 'Models unavailable' : current?.apiModel || 'No models available'
    const displayIcon = current && (getProviderIconUrl(current.apiModel, isDark) || current.icon)
    const shortModel = displayModel.split('-').slice(0, 2).join('-')
    const canOpen = !loading && (choices.length > 0 || Boolean(error))

    return (
        <div className="relative">
            <button
                type="button"
                onClick={error ? onRetry : onToggleMenu}
                disabled={!canOpen}
                aria-label={loading ? 'Loading models' : error ? 'Retry loading models' : `Select model (${displayModel})`}
                title={error || displayModel}
                className={`flex h-9 sm:h-8 items-center gap-1.5 rounded-xl px-2 sm:px-2.5 transition-colors active:scale-95 disabled:cursor-wait disabled:opacity-60 ${isDark ? 'hover:bg-white/[0.06] border border-white/[0.06]' : 'hover:bg-gray-50 border border-gray-200/50'}`}
            >
                {loading ? (
                    <Loader2 className={`h-4 w-4 animate-spin ${isDark ? 'text-white/50' : 'text-gray-400'}`} />
                ) : displayIcon ? (
                    <img
                        src={displayIcon}
                        alt={displayModel}
                        className={`h-5 w-5 sm:h-4.5 sm:w-4.5 object-contain shrink-0 ${isDark ? 'brightness-150' : ''}`}
                        draggable={false}
                    />
                ) : (
                    <span className={`text-[12px] font-semibold ${isDark ? 'text-[#9a9b9e]' : 'text-gray-500'}`}>
                        {displayModel.split('-')[0]?.toUpperCase().slice(0, 2) || 'AI'}
                    </span>
                )}
                <span className={`text-[12px] sm:text-[13px] font-medium hidden sm:inline max-w-[120px] truncate ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                    {displayModel}
                </span>
                <span className={`text-[12px] font-medium sm:hidden ${isDark ? 'text-white/80' : 'text-gray-700'}`}>
                    {shortModel}
                </span>
                {!loading && !error && <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-white/30' : 'text-gray-400'}`} />}
            </button>

            {showMenu && (
                <>
                    <div className="fixed inset-0 z-10" onClick={onCloseMenu} />
                    <div className={`absolute bottom-full left-0 mb-2 rounded-2xl overflow-hidden z-20 w-[250px] ${isDark ? 'bg-[#1a1a1b] border border-white/[0.08] shadow-2xl shadow-black/40' : 'bg-white border border-gray-200 shadow-xl shadow-black/5'}`}>
                        <div className="px-2 pt-1.5 pb-0.5">
                            <p className={`text-[10px] font-medium uppercase tracking-wider px-2 py-1 ${isDark ? 'text-white/20' : 'text-gray-400'}`}>Available models</p>
                        </div>
                        {choices.length > 0 ? (
                            <div className="p-1.5 space-y-0.5">
                                {choices.map((choice) => {
                                    const isActive = choice.modelType === selectedModel
                                    const choiceIcon = getProviderIconUrl(choice.apiModel, isDark) || choice.icon
                                    return (
                                        <button
                                            key={choice.id}
                                            type="button"
                                            onClick={() => onSelect(choice)}
                                            title={choice.apiModel}
                                            aria-label={choice.apiModel}
                                            className={`w-full text-left px-2.5 py-2.5 sm:py-2 rounded-xl flex items-center gap-3 transition-colors active:scale-[0.98] ${
                                                isActive
                                                    ? isDark ? 'bg-white/[0.08]' : 'bg-gray-100'
                                                    : isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-gray-50'
                                            }`}
                                        >
                                            {choiceIcon ? (
                                                <img
                                                    src={choiceIcon}
                                                    alt={choice.apiModel}
                                                    className={`h-8 w-8 sm:h-7 sm:w-7 shrink-0 object-contain rounded-lg transition-all ${isDark ? 'brightness-150' : ''} ${showMenu && isActive ? 'opacity-70 grayscale' : ''}`}
                                                    draggable={false}
                                                />
                                            ) : (
                                                <span className={`h-8 w-8 sm:h-7 sm:w-7 shrink-0 flex items-center justify-center rounded-lg text-[11px] font-bold transition-all ${isDark ? 'bg-white/[0.06] text-white/40' : 'bg-gray-100 text-gray-400'} ${showMenu && isActive ? 'opacity-70 grayscale' : ''}`}>
                                                    {choice.apiModel.split('-')[0]?.toUpperCase().slice(0, 2) || 'AI'}
                                                </span>
                                            )}
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-[13px] sm:text-[13px] font-medium truncate ${isDark ? 'text-white/80' : 'text-gray-700'}`}>{choice.apiModel}</div>
                                                <div className={`text-[11px] truncate ${isDark ? 'text-white/30' : 'text-gray-400'}`}>{choice.subtitle}</div>
                                            </div>
                                            {isActive && (
                                                <Check className={`h-4 w-4 shrink-0 ${isDark ? 'text-blue-400' : 'text-blue-500'}`} />
                                            )}
                                        </button>
                                    )
                                })}
                            </div>
                        ) : (
                            <div className={`px-3 pb-3 text-xs ${isDark ? 'text-white/45' : 'text-gray-500'}`}>
                                {error || 'No models are currently available.'}
                                {error && (
                                    <button type="button" onClick={onRetry} className="mt-2 block font-medium text-blue-500 hover:underline">
                                        Retry
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    )
}

export function Chat({ scrollRef, onScroll, onOpenPreview, showPreviewButton = false, onAiComplete }: ChatProps) {
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
    const generationPlan = useStore(s => s.generationPlan);
    const setGenerationPlan = useStore(s => s.setGenerationPlan);
    const modelLearnLog = useStore(s => s.modelLearnLog);
    const addModelLearnEntry = useStore(s => s.addModelLearnEntry);
    const showModelLearn = useStore(s => s.showModelLearn);
    const setShowModelLearn = useStore(s => s.setShowModelLearn);
    const [profileImgError, setProfileImgError] = useState(false);
    const [availableModelChoices, setAvailableModelChoices] = useState<ModelChoice[] | null>(null);
    const [modelsLoading, setModelsLoading] = useState(true);
    const [modelsError, setModelsError] = useState<string | null>(null);
    const modelsRequestRef = useRef<AbortController | null>(null);

    const loadAvailableModels = React.useCallback(async () => {
        modelsRequestRef.current?.abort();
        const controller = new AbortController();
        modelsRequestRef.current = controller;
        setModelsLoading(true);
        setModelsError(null);
        setAvailableModelChoices(null);

        try {
            console.log('[v0] models: chat loader start', {
                currentChatId,
                selectedModel,
                aborted: controller.signal.aborted,
            })
            if (!currentChatId) throw new Error('A project must be selected before loading models.')
            const choices = await fetchAvailableModelChoices(currentChatId, controller.signal);
            if (controller.signal.aborted) return;
            console.log('[v0] models: chat loader success', {
                currentChatId,
                count: choices.length,
                choices,
            })
            setAvailableModelChoices(choices);
        } catch (error: any) {
            if (controller.signal.aborted) return;
            console.error('[v0] models: chat loader failed', {
                currentChatId,
                name: error?.name,
                message: error?.message,
                error,
            });
            setModelsError(error?.message || 'Unable to load models from Sycord.');
        } finally {
            if (!controller.signal.aborted) setModelsLoading(false);
        }
    }, [currentChatId]);

    useEffect(() => {
        void loadAvailableModels();
        return () => modelsRequestRef.current?.abort();
    }, [loadAvailableModels]);

    useEffect(() => {
        if (!availableModelChoices?.length) return;
        const selected = availableModelChoices.find(choice => choice.modelType === selectedModel) || availableModelChoices[0];
        if (selected.modelType !== selectedModel) setSelectedModel(selected.modelType);
        setAiModel(selected.apiModel);
    }, [availableModelChoices, selectedModel, setAiModel, setSelectedModel]);

    // Live execution actions. Remote project-agent actions are also copied onto
    // the current assistant message so completed and background runs survive a
    // reload; local tool calls already persist through tool_calls/tool messages.
    const [actions, setActions] = useState<StreamingAction[]>([]);
    const actionsRef = useRef<StreamingAction[]>([]);
    const persistAgentActionsRef = useRef(false);

    const persistActionsOnAssistant = (nextActions: StreamingAction[]) => {
        if (!persistAgentActionsRef.current) return;
        const state = useStore.getState();
        const messageIndex = [...state.messages].map((message, index) => ({ message, index })).reverse()
            .find(entry => entry.message.role === 'assistant')?.index;
        if (messageIndex === undefined) return;
        const nextMessages = [...state.messages];
        nextMessages[messageIndex] = {
            ...nextMessages[messageIndex],
            agentActions: nextActions.map(action => ({ ...action })),
        };
        setMessages(nextMessages);
    };

    const markAgentTimelineLoaded = () => {
        const state = useStore.getState();
        const messageIndex = [...state.messages].map((message, index) => ({ message, index })).reverse()
            .find(entry => entry.message.role === 'assistant')?.index;
        if (messageIndex === undefined) return;
        const nextMessages = [...state.messages];
        nextMessages[messageIndex] = {
            ...nextMessages[messageIndex],
            agentTimelineLoaded: true,
            agentActions: actionsRef.current.map(action => ({ ...action })),
        };
        setMessages(nextMessages);
    };

    const replaceActions = (nextActions: StreamingAction[], persist = true) => {
        actionsRef.current = nextActions;
        setActions(nextActions);
        if (persist) persistActionsOnAssistant(nextActions);
    };

    const addAction = (
        toolName: string,
        displayName: string,
        metadata?: Partial<StreamingAction>,
    ) => {
        const id = metadata?.id || Math.random().toString(36).substring(7);
        if (actionsRef.current.some(action => action.id === id)) return id;
        replaceActions([...actionsRef.current, {
            id,
            toolName,
            displayName,
            status: 'pending',
            startedAt: Date.now(),
            ...metadata,
        }]);
        return id;
    };

    const updateAction = (id: string, updates: Partial<StreamingAction>) => {
        replaceActions(actionsRef.current.map(action =>
            action.id === id ? { ...action, ...updates } : action
        ));
    };

    const isDark = theme === 'dark';
    const [input, setInput] = useState('');
    // Run state lives in the Zustand store so the stop button cannot get stuck
    // after remounts, aborted tool loops, or effect cleanups that skip local finally.
    const isRunning = useStore(s => s.isRunning);
    const setIsRunning = useStore(s => s.setIsRunning);
    const abortCurrentRun = useStore(s => s.abortCurrentRun);
    const setAbortCurrentRun = useStore(s => s.setAbortCurrentRun);
    const [currentThinking, setCurrentThinking] = useState<string>('');
    const [thinkingDuration, setThinkingDuration] = useState<number>(0);
    const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
    const [pendingQuestion, setPendingQuestion] = useState<AgentQuestion | null>(null);
    const [questionSubmitting, setQuestionSubmitting] = useState(false);
    const [questionError, setQuestionError] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const abortControllerRef = useRef<AbortController | null>(null);
    const [isListening, setIsListening] = useState(false);
    const speechRecognitionRef = useRef<SpeechRecognition | null>(null);

    const beginRun = (controller: AbortController) => {
        abortControllerRef.current = controller;
        setIsRunning(true);
        setAbortCurrentRun(() => {
            controller.abort();
        });
    };

    const endRun = (controller?: AbortController) => {
        // If a newer run already replaced the controller, do not clear its state.
        if (controller && abortControllerRef.current && abortControllerRef.current !== controller) {
            return;
        }
        setIsRunning(false);
        setAbortCurrentRun(null);
        if (!controller || abortControllerRef.current === controller) {
            abortControllerRef.current = null;
        }
    };

    // Abort in-flight work on unmount so isRunning never sticks after navigation.
    useEffect(() => {
        return () => {
            const controller = abortControllerRef.current;
            if (controller) {
                controller.abort();
            }
            const state = useStore.getState();
            if (state.isRunning) {
                state.setIsRunning(false);
                state.setAbortCurrentRun(null);
            }
            abortControllerRef.current = null;
            speechRecognitionRef.current?.stop();
            speechRecognitionRef.current = null;
        };
    }, []);

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

                // Mount base project files to WebContainer when isolation allows it.
                // Safari / non-isolated shells skip this — Syte preview is used instead.
                if (canBootWebContainer()) {
                    await mountFiles(projectFiles);
                }

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
            !isRunning &&
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
    }, [messages, currentChatId, isRunning]);

    // Auto-setup template project
    const templateSetupRef = useRef<string | null>(null);
    useEffect(() => {
        if (!currentChatId || isRunning || templateSetupRef.current === currentChatId) return;

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
    }, [currentChatId, isRunning]);

    // Auto-trigger AI in forked chats — detect fork_context flag from sessionStorage
    const forkSetupRef = useRef<string | null>(null);
    useEffect(() => {
        if (!currentChatId || isRunning || forkSetupRef.current === currentChatId) return;

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
    }, [currentChatId, isRunning]);

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

                    if (msg.tool_calls && msg.tool_calls.length > 0) {
                        const newCalls = msg.tool_calls.map(tc => ({ call: tc }));
                        const lastSeg = currentGroup.segments[currentGroup.segments.length - 1];
                        if (lastSeg && lastSeg.type === 'tools') {
                            lastSeg.toolCalls!.push(...newCalls);
                        } else {
                            currentGroup.segments.push({ type: 'tools', toolCalls: newCalls });
                        }
                        if (!currentGroup.toolCalls) currentGroup.toolCalls = [];
                        currentGroup.toolCalls.push(...newCalls);
                    }

                    if (!currentGroup.thinking && (msg as any).thinking) {
                        currentGroup.thinking = (msg as any).thinking;
                    }
                    if (!currentGroup.thinkingDuration && (msg as any).thinkingDuration) {
                        currentGroup.thinkingDuration = (msg as any).thinkingDuration;
                    }
                    if (Array.isArray((msg as any).agentActions) && (msg as any).agentActions.length > 0) {
                        const byId = new Map((currentGroup.agentActions || []).map(action => [action.id, action]));
                        for (const action of (msg as any).agentActions as StreamingAction[]) byId.set(action.id, action);
                        currentGroup.agentActions = Array.from(byId.values());
                    }
                    if (!currentGroup.createdAt && (msg as any).createdAt) {
                        currentGroup.createdAt = (msg as any).createdAt;
                    }
                } else {
                    if (currentGroup) groups.push(currentGroup);

                    const segments: AssistantSegment[] = [];
                    if (msg.content) {
                        segments.push({ type: 'text', content: msg.content });
                    }
                    if (msg.tool_calls && msg.tool_calls.length > 0) {
                        segments.push({ type: 'tools', toolCalls: msg.tool_calls.map(tc => ({ call: tc })) });
                    }

                    currentGroup = {
                        role: 'assistant',
                        content: msg.content,
                        thinking: (msg as any).thinking,
                        thinkingDuration: (msg as any).thinkingDuration,
                        agentActions: Array.isArray((msg as any).agentActions) ? (msg as any).agentActions : undefined,
                        createdAt: (msg as any).createdAt,
                        toolCalls: msg.tool_calls?.map(tc => ({ call: tc })),
                        segments
                    };
                }
            } else if (msg.role === 'tool') {
                if (currentGroup) {
                    const output = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content) || '';

                    if (currentGroup.toolCalls) {
                        const toolCallIndex = currentGroup.toolCalls.findIndex(tc => tc.call.id === msg.tool_call_id);
                        if (toolCallIndex !== -1) {
                            currentGroup.toolCalls[toolCallIndex].result = output;
                        }
                    }

                    if (currentGroup.segments) {
                        for (const seg of currentGroup.segments) {
                            if (seg.type === 'tools' && seg.toolCalls) {
                                const tc = seg.toolCalls.find(tc => tc.call.id === msg.tool_call_id);
                                if (tc) {
                                    tc.result = output;
                                    break;
                                }
                            }
                        }
                    }

                    if (output.includes('```mermaid')) {
                        if (currentGroup.segments) {
                            const lastTextSeg = [...currentGroup.segments].reverse().find(s => s.type === 'text');
                            if (lastTextSeg && typeof lastTextSeg.content === 'string') {
                                lastTextSeg.content += '\n\n' + output;
                            } else {
                                currentGroup.segments.push({ type: 'text', content: output });
                            }
                        }
                    }
                }
            }
        }
        if (currentGroup) groups.push(currentGroup);
        return groups;
    }, [messages]);

    const handleStop = () => {
        const projectId = getHostProjectId();
        if (projectId) {
            // Cancel the durable Syte turn (interrupt), not only the local poller.
            // Docs: https://sycord.site/api/#agent
            void fetch(`/api/projects/${encodeURIComponent(projectId)}/agent/interrupt`, {
                method: 'POST',
                headers: { Accept: 'application/json' },
            }).catch(() => { /* local abort still runs */ });
        }
        // Abort via store so stop works even if the local ref was lost on remount.
        // ai.ts also clears isRunning on abort as a safety net; Chat's ownership-aware
        // endRun prevents a finishing run from clobbering a newer one.
        const abort = abortCurrentRun || (abortControllerRef.current
            ? () => abortControllerRef.current?.abort()
            : null);
        if (abort) {
            abort();
            setCurrentThinking('');
            setThinkingStartTime(null);
            setPendingQuestion(null);
            setQuestionError(null);
            setQuestionSubmitting(false);
        }
    };

    const clearPendingQuestion = () => {
        setPendingQuestion(null);
        setQuestionError(null);
        setQuestionSubmitting(false);
    };

    const syncPendingQuestions = async (projectId: string, signal?: AbortSignal) => {
        try {
            const pending = await fetchPendingAgentQuestions(projectId, signal);
            if (signal?.aborted) return;
            if (pending.length > 0) {
                setPendingQuestion(pending[0]);
                setQuestionError(null);
            }
        } catch {
            /* ignore — event stream remains source of truth */
        }
    };

    const handleAgentQuestionSubmit = async (answer: AgentQuestionAnswerValue) => {
        const projectId = getHostProjectId();
        const question = pendingQuestion;
        if (!projectId || !question || questionSubmitting) return;

        setQuestionSubmitting(true);
        setQuestionError(null);
        const result = await answerProjectAgentQuestion(projectId, question.id, answer);
        if (!result.ok) {
            setQuestionError(result.message || 'Failed to submit answer.');
            setQuestionSubmitting(false);
            return;
        }
        // Keep the card until question_answered / turn continues, but mark as submitted.
        setPendingQuestion((prev) =>
            prev && prev.id === question.id
                ? { ...prev, status: 'answered', answer }
                : prev,
        );
        setQuestionSubmitting(false);
        // Prefer clearing immediately for snappy UI; a later question event can reopen.
        setPendingQuestion(null);
    };

    // Tool execution context
    const toolContext: ToolContext = {
        addTerminalOutput,
        setSelectedFile,
    };

    const handleToolCall = async (
        toolCall: ToolCall,
        meta?: { reason?: string; turnIndex?: number },
    ): Promise<string> => {
        const { name, arguments: argsString } = toolCall.function;
        const result = await executeTool(name, argsString, toolContext);

        addModelLearnEntry(
            recordToolLearnEntry({
                toolName: name,
                argsString: argsString || '{}',
                output: result,
                reason: meta?.reason || '',
                toolCallId: toolCall.id,
                turnIndex: meta?.turnIndex,
            }),
        );

        // Auto-retry logic for editFile failures: read the file and provide content in error
        if (name === 'editFile' && result.includes('Error editing') && result.includes('Could not find')) {
            try {
                const args = JSON.parse(argsString);
                if (args.path) {
                    const fileContent = await executeTool('readFile', JSON.stringify({ path: args.path }), toolContext);
                    return `${result}\n\n📄 Current file content for reference:\n${fileContent}`;
                }
            } catch {
                // If we can't parse args, just return original error
            }
        }

        return result;
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

    const handleVoiceInput = () => {
        if (isListening) {
            speechRecognitionRef.current?.stop();
            setIsListening(false);
            return;
        }

        const SpeechRecognitionCtor =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

        if (!SpeechRecognitionCtor) {
            console.warn('[Voice] Web Speech API is not supported in this browser.');
            return;
        }

        const recognition = new SpeechRecognitionCtor() as SpeechRecognition;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = 'en-US';

        recognition.onresult = (event: SpeechRecognitionEvent) => {
            let interim = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    setInput(prev => (prev ? prev + ' ' : '') + transcript);
                } else {
                    interim += transcript;
                }
            }
            // Show interim results live while listening
            if (interim) {
                const el = textareaRef.current;
                if (el) {
                    el.value = interim;
                    const rect = el.getBoundingClientRect();
                    const maxH = typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 200;
                    el.style.height = `${Math.min(el.scrollHeight, maxH)}px`;
                }
            }
        };

        recognition.onend = () => {
            setIsListening(false);
            speechRecognitionRef.current = null;
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        speechRecognitionRef.current = recognition;
        setIsListening(true);
        recognition.start();
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // When returning to a host project chat, resume any open Turso agent turn
    // so previous activity is reloaded from the durable database.
    const agentResumeKeyRef = useRef<string | null>(null);
    const agentResumeDoneRef = useRef(false);
    useEffect(() => {
        const projectId = getHostProjectId();
        if (!projectId || !currentChatId) return;

        const resumeKey = `${projectId}:${currentChatId}`;
        if (agentResumeKeyRef.current !== resumeKey) {
            agentResumeKeyRef.current = resumeKey;
            agentResumeDoneRef.current = false;
        }
        if (agentResumeDoneRef.current) return;

        let cancelled = false;
        const controller = new AbortController();

        const timer = window.setTimeout(() => {
            void (async () => {
                if (cancelled || agentResumeDoneRef.current) return;
                // Another in-flight agent turn owns the controller — try again later.
                if (abortControllerRef.current) return;

                const msgs = useStore.getState().messages;
                const knownTursoId = getLatestTursoSessionId(msgs);
                const last = msgs[msgs.length - 1];
                const lastLooksIncomplete =
                    last?.role === 'assistant' &&
                    (!last.content ||
                        (typeof last.content === 'string' &&
                            (!last.content.trim() ||
                                last.content.startsWith('Error: Load failed') ||
                                last.content.startsWith('Error: Failed to fetch') ||
                                last.content.includes('Stopped listening') ||
                                last.content.includes('Connection interrupted') ||
                                last.content.includes('continue working in the background') ||
                                last.content.includes('reload the agent activity') ||
                                last.content.includes('reload previous agent activity'))));

                const savedActions = last?.role === 'assistant' && Array.isArray(last.agentActions)
                    ? last.agentActions as StreamingAction[]
                    : [];
                const hasPersistedTimeline =
                    last?.role === 'assistant' &&
                    (last.agentTimelineLoaded === true || Array.isArray(last.agentActions));
                const replayHistoryOnly = Boolean(knownTursoId && !lastLooksIncomplete && !hasPersistedTimeline);

                // A completed turn with a saved timeline needs no replay. The
                // saved message is now the source of truth for older activity.
                if (knownTursoId && hasPersistedTimeline && !lastLooksIncomplete) {
                    agentResumeDoneRef.current = true;
                    return;
                }

                agentResumeDoneRef.current = true;
                const actionByCall = new Map<string, string[]>();

                try {
                    persistAgentActionsRef.current = true;
                    // Continue from the persisted prefix when reconnecting after
                    // a mid-turn exit. Polling starts after its saved cursor, so
                    // clearing here would permanently discard earlier actions.
                    replaceActions(lastLooksIncomplete ? savedActions : [], false);
                    if (lastLooksIncomplete) {
                        for (const action of savedActions) {
                            if (action.status !== 'running' && action.status !== 'pending') continue;
                            const key = action.toolCallId || action.toolName;
                            const pending = actionByCall.get(key) || [];
                            pending.push(action.id);
                            actionByCall.set(key, pending);
                        }
                    }
                    beginRun(controller);

                    let assistantContent = '';
                    let activeSession = getLatestAgentSession(msgs);
                    let highestEventId = Number(last?.agentEventId) || 0;
                    let errorText = '';
                    let completed = false;
                    let thinkingStartedAt: number | null = null;
                    let tursoSessionId = knownTursoId || '';
                    let addedBubble = false;

                    const ensureAssistantBubble = () => {
                        if (addedBubble) return;
                        if ((lastLooksIncomplete || replayHistoryOnly) && last?.role === 'assistant') {
                            addedBubble = true;
                            return;
                        }
                        addMessage({ role: 'assistant', content: '' });
                        addedBubble = true;
                    };

                    const applyEvent = (event: ProjectAgentEvent) => {
                        if (controller.signal.aborted || cancelled) return;
                        ensureAssistantBubble();
                        if (event.tursoSessionId) tursoSessionId = event.tursoSessionId;
                        if (event.session) {
                            activeSession = event.sessionAuthoritative
                                ? event.session
                                : Math.max(activeSession, event.session);
                        }
                        if (event.eventId) highestEventId = Math.max(highestEventId, event.eventId);

                        const state = useStore.getState();
                        const lastMessage = state.messages[state.messages.length - 1];
                        if (lastMessage?.role === 'assistant') {
                            if (activeSession) lastMessage.agentSession = activeSession;
                            if (highestEventId) lastMessage.agentEventId = highestEventId;
                            if (tursoSessionId) lastMessage.tursoSessionId = tursoSessionId;
                            setMessages([...state.messages]);
                        }

                        switch (event.type) {
                            case 'processing':
                                // Syte emits "Cloud agent accepted the durable request" —
                                // keep an inline shimmer marker instead of a big thinking badge.
                                break;
                            case 'thinking': {
                                if (!thinkingStartedAt) {
                                    thinkingStartedAt = Date.now();
                                    if (!replayHistoryOnly) setThinkingStartTime(thinkingStartedAt);
                                }
                                if (!replayHistoryOnly) {
                                    const chunk = event.text || '';
                                    setCurrentThinking(prev =>
                                        event.fromStream && prev && chunk && !chunk.startsWith(prev)
                                            ? prev + chunk
                                            : chunk || prev,
                                    );
                                    if (event.fromStream && chunk) {
                                        const state = useStore.getState();
                                        const last = state.messages[state.messages.length - 1] as any;
                                        updateLastMessage(
                                            assistantContent,
                                            undefined,
                                            `${last?.thinking || ''}${chunk}`,
                                        );
                                    } else {
                                        updateLastMessage(assistantContent, undefined, chunk);
                                    }
                                }
                                break;
                            }
                            case 'plan': {
                                syncPlanFromTool('plan', event.plan ?? event.arguments ?? {}, setGenerationPlan);
                                const args = typeof event.arguments === 'string'
                                    ? event.arguments
                                    : JSON.stringify((event.plan ?? event.arguments) || {});
                                addAction('update_plan', event.title || 'plan', {
                                    id: `agent_${tursoSessionId}_plan_${event.eventId || Date.now()}`,
                                    eventId: event.eventId,
                                    toolCallId: event.toolCallId,
                                    args,
                                    status: 'done',
                                    completedAt: Date.now(),
                                    result: event.text,
                                });
                                break;
                            }
                            case 'subagent_started': {
                                const args = typeof event.arguments === 'string'
                                    ? event.arguments
                                    : JSON.stringify(event.arguments || {});
                                const actionId = addAction('subagent', event.text || event.title || 'Subagent', {
                                    id: event.subagentTaskId
                                        ? `agent_${tursoSessionId}_sub_${event.subagentTaskId}`
                                        : `agent_${tursoSessionId}_sub_${event.eventId || Date.now()}`,
                                    eventId: event.eventId,
                                    toolCallId: event.subagentTaskId || event.toolCallId,
                                    args,
                                    subagentTaskId: event.subagentTaskId,
                                });
                                updateAction(actionId, { status: 'running', args });
                                break;
                            }
                            case 'subagent_scope': {
                                const args = typeof event.arguments === 'string'
                                    ? event.arguments
                                    : JSON.stringify(event.arguments || {});
                                const key = event.subagentTaskId
                                    ? `agent_${tursoSessionId}_sub_${event.subagentTaskId}`
                                    : null;
                                if (key) {
                                    updateAction(key, { args, status: 'running' });
                                }
                                break;
                            }
                            case 'subagent_completed':
                            case 'subagent_failed': {
                                const key = event.subagentTaskId
                                    ? `agent_${tursoSessionId}_sub_${event.subagentTaskId}`
                                    : null;
                                if (key) {
                                    updateAction(key, {
                                        status: event.type === 'subagent_failed' ? 'error' : 'done',
                                        result: event.text,
                                        completedAt: Date.now(),
                                    });
                                } else {
                                    addAction('subagent', event.text || 'Subagent', {
                                        id: `agent_${tursoSessionId}_sub_${event.eventId || Date.now()}`,
                                        eventId: event.eventId,
                                        status: event.type === 'subagent_failed' ? 'error' : 'done',
                                        completedAt: Date.now(),
                                        result: event.text,
                                        args: event.arguments,
                                        subagentTaskId: event.subagentTaskId,
                                    });
                                }
                                break;
                            }
                            case 'tool_started': {
                                const tool = event.tool || event.title || 'Agent tool';
                                const args = typeof event.arguments === 'string'
                                    ? event.arguments
                                    : JSON.stringify(event.arguments || {});
                                syncPlanFromTool(tool, event.arguments ?? args, setGenerationPlan);
                                const key = event.toolCallId || tool;
                                const actionId = addAction(tool, getActionDisplayName(tool, args), {
                                    id: event.toolCallId
                                        ? `agent_${tursoSessionId}_${event.toolCallId}`
                                        : `agent_${tursoSessionId}_${event.eventId || Date.now()}`,
                                    eventId: event.eventId,
                                    toolCallId: event.toolCallId,
                                    args,
                                });
                                const pendingActions = actionByCall.get(key) || [];
                                if (!pendingActions.includes(actionId)) pendingActions.push(actionId);
                                actionByCall.set(key, pendingActions);
                                updateAction(actionId, { status: 'running', args });
                                break;
                            }
                            case 'tool_finished': {
                                const tool = event.tool || event.title || 'Agent tool';
                                const key = event.toolCallId || tool;
                                const pendingActions = actionByCall.get(key) || [];
                                let actionId = pendingActions.shift();
                                if (pendingActions.length > 0) actionByCall.set(key, pendingActions);
                                else actionByCall.delete(key);
                                const args = typeof event.arguments === 'string'
                                    ? event.arguments
                                    : JSON.stringify(event.arguments || {});
                                syncPlanFromTool(tool, event.arguments ?? args, setGenerationPlan);
                                if (!actionId) {
                                    actionId = addAction(tool, getActionDisplayName(tool, args) || event.title || '', {
                                        id: event.toolCallId
                                            ? `agent_${tursoSessionId}_${event.toolCallId}`
                                            : `agent_${tursoSessionId}_${event.eventId || Date.now()}`,
                                        eventId: event.eventId,
                                        toolCallId: event.toolCallId,
                                        args,
                                    });
                                }
                                updateAction(actionId, {
                                    status: event.ok === false ? 'error' : 'done',
                                    result: event.text,
                                    args: args === '{}' ? actionsRef.current.find(action => action.id === actionId)?.args : args,
                                    eventId: event.eventId,
                                    completedAt: Date.now(),
                                });
                                break;
                            }
                            case 'screenshot': {
                                const shots = event.screenshots || [];
                                addAction('screenshot_preview', event.title || event.text || 'made a screenshot', {
                                    id: `agent_${tursoSessionId}_shot_${event.eventId || Date.now()}`,
                                    eventId: event.eventId,
                                    status: 'done',
                                    completedAt: Date.now(),
                                    screenshots: shots,
                                    result: event.text,
                                });
                                break;
                            }
                            case 'question': {
                                if (!replayHistoryOnly && event.question && event.question.status !== 'answered') {
                                    setPendingQuestion(event.question);
                                    setQuestionError(null);
                                    setQuestionSubmitting(false);
                                }
                                break;
                            }
                            case 'question_answered': {
                                if (replayHistoryOnly) break;
                                const answeredId = event.question?.id;
                                setPendingQuestion((prev) =>
                                    !prev || !answeredId || prev.id === answeredId ? null : prev,
                                );
                                setQuestionSubmitting(false);
                                setQuestionError(null);
                                break;
                            }
                            case 'delta':
                                assistantContent += event.text || '';
                                if (!replayHistoryOnly) updateLastMessage(assistantContent);
                                break;
                            case 'message':
                                assistantContent = event.text || assistantContent;
                                if (!replayHistoryOnly) updateLastMessage(assistantContent);
                                break;
                            case 'done':
                                assistantContent = event.text || assistantContent || 'Done.';
                                if (!replayHistoryOnly) updateLastMessage(assistantContent);
                                completed = true;
                                clearPendingQuestion();
                                markAgentTimelineLoaded();
                                break;
                            case 'stopped':
                                if (!replayHistoryOnly && !assistantContent) {
                                    updateLastMessage(event.text || 'Stopped.');
                                }
                                completed = true;
                                clearPendingQuestion();
                                replaceActions(actionsRef.current.map(action =>
                                    action.status === 'running' || action.status === 'pending'
                                        ? { ...action, status: 'done' as const, completedAt: Date.now() }
                                        : action
                                ));
                                markAgentTimelineLoaded();
                                break;
                            case 'error':
                                errorText = event.text || 'The project agent request failed.';
                                clearPendingQuestion();
                                replaceActions(actionsRef.current.map(action =>
                                    action.status === 'running' || action.status === 'pending'
                                        ? { ...action, status: 'error' as const, result: errorText, completedAt: Date.now() }
                                        : action
                                ));
                                markAgentTimelineLoaded();
                                break;
                        }
                    };

                    void syncPendingQuestions(projectId, controller.signal);

                    const resumed = await resumeProjectAgent({
                        projectId,
                        tursoSessionId: knownTursoId || undefined,
                        afterEventId: lastLooksIncomplete ? highestEventId : 0,
                        allowCompleted: Boolean(knownTursoId),
                        signal: controller.signal,
                        onEvent: applyEvent,
                    });

                    if (!resumed) return;

                    // Turn left "open" only if still waiting — normally resume returns when status != open.
                    if (resumed.status !== 'open') {
                        clearPendingQuestion();
                    }
                    // SSE can disconnect after a durable session changes state.
                    // Treat the authoritative session status as the terminal
                    // fallback so a missed final event does not leave the UI
                    // streaming forever or render a false interruption error.
                    if (!completed && resumed.status === 'completed') {
                        completed = true;
                        assistantContent ||= 'Done.';
                        if (!replayHistoryOnly) updateLastMessage(assistantContent);
                        markAgentTimelineLoaded();
                    } else if (!completed && resumed.status === 'stopped') {
                        completed = true;
                        if (!replayHistoryOnly && !assistantContent) updateLastMessage('Stopped.');
                        markAgentTimelineLoaded();
                    }

                    if (errorText && !completed) {
                        if (!replayHistoryOnly) updateLastMessage(`Error: ${errorText}`);
                    } else if (completed) {
                        if (thinkingStartedAt && !replayHistoryOnly) {
                            const duration = Math.max(1, Math.round((Date.now() - thinkingStartedAt) / 1000));
                            setThinkingDuration(duration);
                            setThinkingStartTime(null);
                        }
                        if (!replayHistoryOnly && onAiComplete) onAiComplete('remote');
                    }

                    if (currentChatId && user) {
                        try {
                            await saveChatMessages(currentChatId, useStore.getState().messages, {
                                keepalive: true,
                                projectId,
                            });
                        } catch {
                            /* durable Turso session remains */
                        }
                    }
                } catch (error: any) {
                    if (controller.signal.aborted || cancelled) return;
                    console.warn('[ProjectAgent] Resume probe skipped:', error?.message || error);
                } finally {
                    // Always clear store run state — even when the effect cleanup
                    // set cancelled=true (e.g. messages.length changed mid-resume).
                    // Skipping this left the stop button stuck forever.
                    endRun(controller);
                    setCurrentThinking('');
                    setThinkingStartTime(null);
                    if (!cancelled) {
                        setTimeout(() => replaceActions([], false), 500);
                    }
                }
            })();
        }, 700);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
            controller.abort();
        };
        // Resume after messages hydrate for this chat. Do not depend on isRunning —
        // toggling it would cancel an in-flight resume.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentChatId, messages.length]);

    const triggerProjectAgentResponse = async (
        userMessage: Message,
        projectId: string,
        chatIdOverride?: string,
    ) => {
        if (isRunning) return;

        persistAgentActionsRef.current = true;
        replaceActions([], false);
        setCurrentThinking('');
        setThinkingDuration(0);
        const controller = new AbortController();
        beginRun(controller);

        const chatId = chatIdOverride || currentChatId;
        const currentMessages = useStore.getState().messages;
        const afterSession = getLatestAgentSession(currentMessages);
        const actionByCall = new Map<string, string[]>();
        let assistantContent = '';
        let activeSession = afterSession;
        let highestEventId = 0;
        let errorText = '';
        let completed = false;
        let thinkingStartedAt: number | null = null;
        let tursoSessionId = '';

        addMessage({ role: 'assistant', content: '' });

        const persistCursor = () => {
            const state = useStore.getState();
            const lastMessage = state.messages[state.messages.length - 1];
            if (lastMessage?.role === 'assistant') {
                if (activeSession) lastMessage.agentSession = activeSession;
                if (highestEventId) lastMessage.agentEventId = highestEventId;
                if (tursoSessionId) lastMessage.tursoSessionId = tursoSessionId;
                setMessages([...state.messages]);
            }
        };

        const applyEvent = (event: ProjectAgentEvent) => {
            if (controller.signal.aborted) return;
            if (event.tursoSessionId) tursoSessionId = event.tursoSessionId;
            if (event.session) {
                activeSession = event.sessionAuthoritative
                    ? event.session
                    : Math.max(activeSession, event.session);
            }
            if (event.eventId) highestEventId = Math.max(highestEventId, event.eventId);

            switch (event.type) {
                case 'processing':
                    // Accepted/queued system noise — Marker shimmer covers this state.
                    break;
                case 'thinking': {
                    if (!thinkingStartedAt) {
                        thinkingStartedAt = Date.now();
                        setThinkingStartTime(thinkingStartedAt);
                    }
                    const chunk = event.text || '';
                    setCurrentThinking(prev =>
                        event.fromStream && prev && chunk && !chunk.startsWith(prev)
                            ? prev + chunk
                            : chunk || prev,
                    );
                    if (event.fromStream && chunk) {
                        const state = useStore.getState();
                        const last = state.messages[state.messages.length - 1] as any;
                        const nextThinking = `${last?.thinking || ''}${chunk}`;
                        updateLastMessage(assistantContent, undefined, nextThinking);
                    } else {
                        updateLastMessage(assistantContent, undefined, chunk);
                    }
                    break;
                }
                case 'plan': {
                    syncPlanFromTool('plan', event.plan ?? event.arguments ?? {}, setGenerationPlan);
                    const args = typeof event.arguments === 'string'
                        ? event.arguments
                        : JSON.stringify((event.plan ?? event.arguments) || {});
                    addAction('update_plan', event.title || 'plan', {
                        id: `agent_${tursoSessionId}_plan_${event.eventId || Date.now()}`,
                        eventId: event.eventId,
                        toolCallId: event.toolCallId,
                        args,
                        status: 'done',
                        completedAt: Date.now(),
                        result: event.text,
                    });
                    break;
                }
                case 'subagent_started': {
                    const args = typeof event.arguments === 'string'
                        ? event.arguments
                        : JSON.stringify(event.arguments || {});
                    const actionId = addAction('subagent', event.text || event.title || 'Subagent', {
                        id: event.subagentTaskId
                            ? `agent_${tursoSessionId}_sub_${event.subagentTaskId}`
                            : `agent_${tursoSessionId}_sub_${event.eventId || Date.now()}`,
                        eventId: event.eventId,
                        toolCallId: event.subagentTaskId || event.toolCallId,
                        args,
                        subagentTaskId: event.subagentTaskId,
                    });
                    updateAction(actionId, { status: 'running', args });
                    break;
                }
                case 'subagent_scope': {
                    const args = typeof event.arguments === 'string'
                        ? event.arguments
                        : JSON.stringify(event.arguments || {});
                    const key = event.subagentTaskId
                        ? `agent_${tursoSessionId}_sub_${event.subagentTaskId}`
                        : null;
                    if (key) {
                        updateAction(key, { args, status: 'running' });
                    }
                    break;
                }
                case 'subagent_completed':
                case 'subagent_failed': {
                    const key = event.subagentTaskId
                        ? `agent_${tursoSessionId}_sub_${event.subagentTaskId}`
                        : null;
                    if (key) {
                        updateAction(key, {
                            status: event.type === 'subagent_failed' ? 'error' : 'done',
                            result: event.text,
                            completedAt: Date.now(),
                        });
                    } else {
                        addAction('subagent', event.text || 'Subagent', {
                            id: `agent_${tursoSessionId}_sub_${event.eventId || Date.now()}`,
                            eventId: event.eventId,
                            status: event.type === 'subagent_failed' ? 'error' : 'done',
                            completedAt: Date.now(),
                            result: event.text,
                            args: event.arguments,
                            subagentTaskId: event.subagentTaskId,
                        });
                    }
                    break;
                }
                case 'tool_started': {
                    const tool = event.tool || event.title || 'Agent tool';
                    const key = event.toolCallId || tool;
                    const args = typeof event.arguments === 'string'
                        ? event.arguments
                        : JSON.stringify(event.arguments || {});
                    syncPlanFromTool(tool, event.arguments ?? args, setGenerationPlan);
                    const actionId = addAction(tool, getActionDisplayName(tool, args), {
                        id: event.toolCallId
                            ? `agent_${tursoSessionId}_${event.toolCallId}`
                            : `agent_${tursoSessionId}_${event.eventId || Date.now()}`,
                        eventId: event.eventId,
                        toolCallId: event.toolCallId,
                        args,
                    });
                    const pendingActions = actionByCall.get(key) || [];
                    if (!pendingActions.includes(actionId)) pendingActions.push(actionId);
                    actionByCall.set(key, pendingActions);
                    updateAction(actionId, { status: 'running', args });
                    break;
                }
                case 'tool_finished': {
                    const tool = event.tool || event.title || 'Agent tool';
                    const key = event.toolCallId || tool;
                    const pendingActions = actionByCall.get(key) || [];
                    let actionId = pendingActions.shift();
                    if (pendingActions.length > 0) actionByCall.set(key, pendingActions);
                    else actionByCall.delete(key);
                    const args = typeof event.arguments === 'string'
                        ? event.arguments
                        : JSON.stringify(event.arguments || {});
                    syncPlanFromTool(tool, event.arguments ?? args, setGenerationPlan);
                    if (!actionId) {
                        actionId = addAction(tool, getActionDisplayName(tool, args) || event.title || '', {
                            id: event.toolCallId
                                ? `agent_${tursoSessionId}_${event.toolCallId}`
                                : `agent_${tursoSessionId}_${event.eventId || Date.now()}`,
                            eventId: event.eventId,
                            toolCallId: event.toolCallId,
                            args,
                        });
                    }
                    updateAction(actionId, {
                        status: event.ok === false ? 'error' : 'done',
                        result: event.text,
                        args: args === '{}' ? actionsRef.current.find(action => action.id === actionId)?.args : args,
                        eventId: event.eventId,
                        completedAt: Date.now(),
                    });
                    break;
                }
                case 'screenshot': {
                    const shots = event.screenshots || [];
                    addAction('screenshot_preview', event.title || event.text || 'made a screenshot', {
                        id: `agent_${tursoSessionId}_shot_${event.eventId || Date.now()}`,
                        eventId: event.eventId,
                        status: 'done',
                        completedAt: Date.now(),
                        screenshots: shots,
                        result: event.text,
                    });
                    break;
                }
                case 'question': {
                    if (event.question) {
                        setPendingQuestion(event.question);
                        setQuestionError(null);
                        setQuestionSubmitting(false);
                    }
                    break;
                }
                case 'question_answered': {
                    const answeredId = event.question?.id;
                    setPendingQuestion((prev) =>
                        !prev || !answeredId || prev.id === answeredId ? null : prev,
                    );
                    setQuestionSubmitting(false);
                    setQuestionError(null);
                    break;
                }
                case 'delta':
                    assistantContent += event.text || '';
                    updateLastMessage(assistantContent);
                    break;
                case 'message':
                    assistantContent = event.text || assistantContent;
                    updateLastMessage(assistantContent);
                    break;
                case 'done':
                    assistantContent = event.text || assistantContent || 'Done.';
                    updateLastMessage(assistantContent);
                    completed = true;
                    clearPendingQuestion();
                    markAgentTimelineLoaded();
                    break;
                case 'stopped':
                    if (!assistantContent) updateLastMessage(event.text || 'Stopped.');
                    completed = true;
                    clearPendingQuestion();
                    replaceActions(actionsRef.current.map(action =>
                        action.status === 'running' || action.status === 'pending'
                            ? { ...action, status: 'done' as const, completedAt: Date.now() }
                            : action
                    ));
                    markAgentTimelineLoaded();
                    break;
                case 'error':
                    errorText = event.text || 'The project agent request failed.';
                    clearPendingQuestion();
                    replaceActions(actionsRef.current.map(action =>
                        action.status === 'running' || action.status === 'pending'
                            ? { ...action, status: 'error' as const, result: errorText, completedAt: Date.now() }
                            : action
                    ));
                    markAgentTimelineLoaded();
                    break;
            }

            // Save the normalized event and its cursor together. Persisting the
            // cursor first could make a reload skip an action that was not yet
            // included in agentActions.
            if (tursoSessionId || activeSession > afterSession || highestEventId > 0) {
                persistCursor();
                if (tursoSessionId && chatId && user) {
                    void saveChatMessages(chatId, useStore.getState().messages, {
                        keepalive: true,
                        projectId,
                    }).catch(() => {});
                }
            }
        };

        try {
            void syncPendingQuestions(projectId, controller.signal);
            const result = await streamProjectAgent({
                projectId,
                message: userMessage,
                modelProfile: availableModelChoices?.find(choice => choice.modelType === selectedModel)?.label || 'syra-base',
                afterSession,
                signal: controller.signal,
                onEvent: applyEvent,
            });

            activeSession = Math.max(activeSession, result.session);
            highestEventId = Math.max(highestEventId, result.eventId);
            if (result.tursoSessionId) tursoSessionId = result.tursoSessionId;
            persistCursor();

            // A proxy/mobile transport may drop immediately after Syte has
            // committed the terminal session state. Reconcile that durable
            // status before declaring the response incomplete.
            if (!completed && result.status === 'completed') {
                completed = true;
                assistantContent ||= 'Done.';
                updateLastMessage(assistantContent);
                clearPendingQuestion();
                markAgentTimelineLoaded();
            } else if (!completed && result.status === 'stopped') {
                completed = true;
                if (!assistantContent) updateLastMessage('Stopped.');
                clearPendingQuestion();
                markAgentTimelineLoaded();
            }

            if (controller.signal.aborted) {
                updateLastMessage(assistantContent || 'Stopped.');
                clearPendingQuestion();
                markAgentTimelineLoaded();
                return;
            }
            if (errorText) throw new Error(errorText);
            if (!completed) throw new Error('The project agent stopped before completing its response.');

            if (thinkingStartedAt) {
                const duration = Math.max(1, Math.round((Date.now() - thinkingStartedAt) / 1000));
                setThinkingDuration(duration);
                setThinkingStartTime(null);
            }
        } catch (error: any) {
            if (controller.signal.aborted) {
                updateLastMessage(assistantContent || 'Stopped.');
                clearPendingQuestion();
                markAgentTimelineLoaded();
            } else {
                const msg = String(error?.message || '');
                const looksTransient =
                    /load failed|failed to fetch|network|fetch failed/i.test(msg);

                if (looksTransient) {
                    // Do not leave a dead "Error: Load failed" — keep turso cursor and explain resume.
                    persistCursor();
                    updateLastMessage(
                        assistantContent ||
                            'Connection interrupted. Reopen this chat to reload previous agent activity from the database.',
                    );
                } else {
                    console.error('[ProjectAgent] Error:', error);
                    updateLastMessage(`Error: ${msg || 'Failed to run the project agent.'}`);
                    clearPendingQuestion();
                }
            }
        } finally {
            const wasAborted = controller.signal.aborted;
            endRun(controller);
            setCurrentThinking('');
            setThinkingStartTime(null);
            setTimeout(() => replaceActions([], false), 500);

            if (!wasAborted && completed && onAiComplete) {
                onAiComplete('remote');
            }

            if (chatId && user) {
                try {
                    await saveChatMessages(chatId, useStore.getState().messages, {
                        keepalive: true,
                        projectId,
                    });
                } catch {
                    // Ignore save errors; the durable agent session remains on Turso.
                }
            }
        }
    };

    // Core AI processing function
    const triggerAIResponse = async (userMessage: Message, chatIdOverride?: string) => {
        if (isRunning) return;

        // Embedded project chats use Syte's durable per-project agent. Only the
        // new user turn is submitted; previously saved chat is not resent.
        const hostProjectId = getHostProjectId();
        if (hostProjectId) {
            await triggerProjectAgentResponse(userMessage, hostProjectId, chatIdOverride);
            return;
        }

        persistAgentActionsRef.current = false;
        replaceActions([], false);
        const controller = new AbortController();
        beginRun(controller);

        const chatId = chatIdOverride || currentChatId;

        // Get current project files for context
        const currentFiles = useStore.getState().files;
        const fileList = Object.keys(currentFiles).filter(f => f !== 'glovix-picker.js').sort().join('\n') ||
            'package.json, next.config.mjs, tsconfig.json, tailwind.config.ts, postcss.config.mjs, app/layout.tsx, app/page.tsx, app/globals.css';

        // Build system prompt — always get fresh from getSystemPrompt
        const currentSystemPrompt = getSystemPrompt(selectedModel, getHostProjectId() || undefined);
        const presetDescription = getPresetDescription(presetId);
        const projectContextBlock = buildInjectedProjectContext(currentFiles);
        const modelLearnBlock = buildModelLearnContext(useStore.getState().modelLearnLog);
        const promptContent = currentSystemPrompt
            ? currentSystemPrompt
                .replace('{{FILE_LIST}}', fileList)
                .replace('{{PRESET}}', presetDescription)
                .replace('{{PROJECT_CONTEXT}}', projectContextBlock + (modelLearnBlock ? `\n\n${modelLearnBlock}` : ''))
            : `You are Syra, an AI web developer built by Sycord Technology. Project files: ${fileList}. Use tools to create/modify files saved to the project's Pages. You cannot run tests.\n${presetDescription}\n\n${projectContextBlock}`;

        const SYSTEM_PROMPT: Message = {
            role: 'system',
            content: promptContent
        };

        // Use model context limit from settings (or default to 200k)
        const modelContextLimit = useStore.getState().modelContextLimit || 200000;
        const MAX_CONTEXT_TOKENS = Math.floor(modelContextLimit * 0.8); // Use 80% to leave room for response

        const estimateTokens = (text: string) => Math.ceil(text.length / 4);

        const getMessageTokens = (msg: any) => {
            let tokens = 0;
            if (typeof msg.content === 'string') {
                tokens += estimateTokens(msg.content);
            } else if (Array.isArray(msg.content)) {
                tokens += msg.content.reduce((sum: number, part: any) => {
                    if (part.type === 'text') return sum + estimateTokens(part.text);
                    return sum + 1000; // Rough estimate for images
                }, 0);
            }
            if (msg.tool_calls) {
                tokens += msg.tool_calls.reduce((sum: number, tc: any) =>
                    sum + estimateTokens(tc.function?.name || '') + estimateTokens(tc.function?.arguments || ''), 0);
            }
            return tokens;
        };

        // Get current messages from store (not from hook to ensure freshness)
        const currentStoreMessages = useStore.getState().messages;

        // Filter out truly invalid messages (but keep assistant placeholders and tool messages)
        const validMessages = currentStoreMessages.filter((msg) => {
            if (!msg.role) return false;
            // System messages need content
            if (msg.role === 'system') return !!msg.content;
            // Tool messages need tool_call_id
            if (msg.role === 'tool') return !!msg.tool_call_id;
            // Assistant messages: keep if has content (even empty string) or tool_calls
            if (msg.role === 'assistant') return msg.content !== undefined || (msg.tool_calls && msg.tool_calls.length > 0);
            // User messages need non-empty content
            if (msg.role === 'user') {
                if (typeof msg.content === 'string') return msg.content.length > 0;
                if (Array.isArray(msg.content)) return msg.content.length > 0;
                return false;
            }
            return true;
        });

        let contextMessages = [...validMessages];

        // Count tokens for system prompt
        let totalTokens = estimateTokens(SYSTEM_PROMPT.content as string);

        // Count all existing context messages
        for (let i = 0; i < contextMessages.length; i++) {
            totalTokens += getMessageTokens(contextMessages[i]);
        }

        // Add the new user message tokens
        const userMessageTokens = getMessageTokens(userMessage);
        totalTokens += userMessageTokens;

        // If we're over limit, remove oldest messages until we fit
        while (totalTokens > MAX_CONTEXT_TOKENS && contextMessages.length > 0) {
            const removedMsg = contextMessages.shift();
            if (removedMsg) {
                totalTokens -= getMessageTokens(removedMsg);
                console.log(`[Context] Removed old message, new total: ${totalTokens} tokens`);
            }
        }

        // Update token count display
        setTokenCount(totalTokens);

        // Track total tokens used in this request for billing
        let sessionTokensUsed = 0;

        // Check if userMessage is already the last message in context (to avoid duplication)
        const lastContextMsg = contextMessages[contextMessages.length - 1];
        const isUserMsgAlreadyInContext = lastContextMsg?.role === 'user' &&
            ((typeof lastContextMsg.content === 'string' && typeof userMessage.content === 'string' &&
                lastContextMsg.content === userMessage.content) ||
                (Array.isArray(lastContextMsg.content) && Array.isArray(userMessage.content)));

        let currentMessages = isUserMsgAlreadyInContext
            ? [...contextMessages]
            : [...contextMessages, userMessage];

        // Track files created in this session to detect loops
        const filesCreatedThisSession = new Set<string>();
        let sameFileCreatedCount = 0;
        let consecutiveErrorCount = 0;
        let editFileFailCount = 0;
        const MAX_CONSECUTIVE_ERRORS = 5;
        const MAX_EDIT_FAILS = 4;

        try {
            // Auto-generate title for new chats (first message only)
            // Uses separate titleGenerator module — runs in background, never blocks
            if (currentStoreMessages.length === 1 && user && chatId) {
                const userContentStr = typeof userMessage.content === 'string'
                    ? userMessage.content
                    : (Array.isArray(userMessage.content) ? (userMessage.content.find(c => c.type === 'text') as { type: 'text', text: string } | undefined)?.text || '' : '');

                if (userContentStr) {
                    generateAndSaveTitle(userContentStr, chatId).catch(() => {});
                }
            }

            let turns = 0;
            const MAX_TURNS = 80;

            // Track which tools we've already shown in the UI during this session
            // Maps toolCallId -> actionId (our local UI id)
            // Moved outside while loop so it persists across turns
            const toolIdToActionId = new Map<string, string>();

            while (turns < MAX_TURNS) {
                if (abortControllerRef.current?.signal.aborted) break;

                // Add placeholder for assistant response
                addMessage({ role: 'assistant', content: '' });

                let assistantMessageContent = '';
                let toolCalls: ToolCall[] = [];

                let thinkingContent = '';
                setCurrentThinking('');
                setThinkingDuration(0);

                let thinkingStartTimeLocal: number | null = null;
                let thinkingEndTime: number | null = null;
                let lastThinkingUpdate: number | null = null;

                // Log turn info (simplified)
                console.log(`[Chat] Turn ${turns + 1}/${MAX_TURNS}, sending ${currentMessages.length} messages to AI`);


                const usage = await sendMessage(
                    [SYSTEM_PROMPT, ...currentMessages],
                    selectedModel,
                    '',
                    (content, tools, thinking) => {
                        if (abortControllerRef.current?.signal.aborted) return;

                        // Handle thinking from AI
                        if (thinking) {
                            // Start timing on first thinking chunk
                            if (!thinkingStartTimeLocal) {
                                thinkingStartTimeLocal = Date.now();
                                setThinkingStartTime(thinkingStartTimeLocal);
                            }

                            // Track last update time
                            lastThinkingUpdate = Date.now();

                            // Clean thinking of artifacts
                            let cleanThinking = thinking.replace(/<\|tool_calls_section_begin\|>[\s\S]*/g, '').trim();
                            thinkingContent = cleanThinking;
                            setCurrentThinking(cleanThinking);

                            // Update message immediately with thinking so it renders in-place
                            // This prevents the "jumping" issue by executing standard rendering logic
                            updateLastMessage(assistantMessageContent, toolCalls.length > 0 ? toolCalls : undefined, cleanThinking, undefined);
                        }

                        if (content) {
                            assistantMessageContent += content;

                            // Clean content of artifacts
                            assistantMessageContent = assistantMessageContent.replace(/<\|tool_calls_section_begin\|>[\s\S]*/g, '');

                            // CHECK FOR THINKING TAGS (for models that output <think> inside content)
                            const hasThinkStart = assistantMessageContent.includes('<think>');
                            const hasThinkEnd = assistantMessageContent.includes('</think>');

                            // If we just started a <think> block inside content, START the timer if not running
                            if (hasThinkStart && !hasThinkEnd && !thinkingStartTimeLocal) {
                                thinkingStartTimeLocal = Date.now();
                                setThinkingStartTime(thinkingStartTimeLocal);
                            }

                            // If we hit the end of thinking, STOP the timer
                            if (hasThinkEnd && thinkingStartTimeLocal && !thinkingEndTime) {
                                thinkingEndTime = Date.now();
                                const duration = Math.round((thinkingEndTime - thinkingStartTimeLocal) / 1000);
                                setThinkingDuration(Math.max(1, duration));
                                setThinkingStartTime(null); // Stop live timer logic
                            }

                            // If we have content but NO thinking tags and NO native thinking start, ensure timer is off
                            // (This handles the case where we transition from native thinking to content)
                            if (!hasThinkStart && thinkingStartTimeLocal && !thinkingEndTime && !thinking) {
                                // We were thinking (natively), but now we got content. Stop timer.
                                thinkingEndTime = lastThinkingUpdate || Date.now();
                                const duration = Math.round((thinkingEndTime - thinkingStartTimeLocal) / 1000);
                                setThinkingDuration(Math.max(1, duration));
                                setThinkingStartTime(null);
                            }

                            // Parse thinking - model outputs thinking then </think> then actual response
                            if (hasThinkEnd) {
                                const parts = assistantMessageContent.split('</think>');
                                const thinkingPart = parts[0].replace('<think>', '').trim();
                                let responsePart = parts.slice(1).join('</think>').trim();

                                // Clean tool_call tags from response
                                responsePart = responsePart.replace(/<tool_call>/g, '').trim();

                                if (thinkingPart) {
                                    thinkingContent = thinkingPart;
                                    setCurrentThinking(thinkingPart);
                                    // Final duration available here
                                    const confirmedDuration = thinkingEndTime
                                        ? Math.round((thinkingEndTime - thinkingStartTimeLocal!) / 1000)
                                        : (thinkingDuration || undefined);

                                    updateLastMessage(responsePart, toolCalls.length > 0 ? toolCalls : undefined, thinkingContent, confirmedDuration);
                                } else {
                                    updateLastMessage(responsePart, toolCalls.length > 0 ? toolCalls : undefined, undefined, undefined);
                                }
                            }
                            // Still in think block?
                            else if (hasThinkStart) {
                                const thinking = assistantMessageContent.replace('<think>', '').trim();
                                thinkingContent = thinking;
                                setCurrentThinking(thinking);

                                // Show EMPTY content for message, but update thinking
                                updateLastMessage('', toolCalls.length > 0 ? toolCalls : undefined, thinking, undefined);
                            }
                            // Normal content
                            else {
                                updateLastMessage(assistantMessageContent, toolCalls.length > 0 ? toolCalls : undefined, thinkingContent || undefined, thinkingDuration || undefined);
                            }
                        } else if (tools) {
                            toolCalls = tools;
                            // Ensure all tools are in the UI (some may have been added via streaming already)
                            tools.forEach(tc => {
                                if (!toolIdToActionId.has(tc.id)) {
                                    const displayName = getActionDisplayName(tc.function.name, tc.function.arguments || '');
                                    const id = addAction(tc.function.name, displayName);
                                    toolIdToActionId.set(tc.id, id);
                                    updateAction(id, { status: 'running' });
                                }
                            });

                            updateLastMessage(assistantMessageContent, toolCalls, thinkingContent, thinkingEndTime ? Math.max(1, Math.round((thinkingEndTime - thinkingStartTimeLocal!) / 1000)) : undefined);
                        }
                    },
                    controller.signal,
                    (toolName, args, toolId) => {
                        // STREAMING TOOLS CALLBACK - called for each chunk of a tool call
                        if (!toolId) return;

                        if (!toolIdToActionId.has(toolId)) {
                            // New tool detected - add to UI immediately
                            const displayName = getActionDisplayName(toolName, args);
                            const id = addAction(toolName || 'Processing...', displayName);
                            toolIdToActionId.set(toolId, id);
                            updateAction(id, { status: 'running' });
                        } else {
                            // Update existing tool with new info
                            const actionId = toolIdToActionId.get(toolId)!;
                            const displayName = getActionDisplayName(toolName, args);
                            updateAction(actionId, { displayName, toolName: toolName || undefined });
                        }
                    }
                );

                // Final update after stream finishes
                if (thinkingContent) {
                    // Ensure duration is set
                    const finalDuration = thinkingDuration || (thinkingStartTimeLocal ? Math.max(1, Math.round((Date.now() - thinkingStartTimeLocal) / 1000)) : undefined);
                    updateLastMessage(assistantMessageContent, toolCalls.length > 0 ? toolCalls : undefined, thinkingContent, finalDuration);
                }

                setThinkingStartTime(null);

                if (abortControllerRef.current?.signal.aborted) break;

                // Add tokens from this turn to session total
                sessionTokensUsed += usage.total_tokens;

                // Update UI token count
                setTokenCount(sessionTokensUsed);

                // Save tokens to DB immediately
                // Token usage tracking (local only)
                if (user?.uid && usage.total_tokens > 0) {
                    console.log(`[Chat] Tokens: ${usage.prompt_tokens} in + ${usage.completion_tokens} out = ${usage.total_tokens}`);
                }

                // Clean content from think tags for display, but keep thinking for context
                let cleanContent = assistantMessageContent;
                if (cleanContent.includes('</think>')) {
                    cleanContent = cleanContent.split('</think>').slice(1).join('</think>').trim();
                }
                cleanContent = cleanContent.replace(/<think>[\s\S]*?<\/think>\s*/g, '').trim();

                // Clean tool_call tags that some models output incorrectly
                cleanContent = cleanContent.replace(/<tool_call>/g, '').trim();

                // If AI responded with tool_calls but no text on the first turn,
                // add an auto-generated status message so the user sees something
                if (!cleanContent && toolCalls.length > 0) {
                    const toolNames = toolCalls.map(tc => tc.function.name);
                    if (turns === 0) {
                        // First turn — show a friendly starting message
                        if (toolNames.includes('runCommand')) {
                            cleanContent = '⚙️ Setting up the project...';
                        } else if (toolNames.some(n => n === 'createFile' || n === 'batchCreateFiles')) {
                            cleanContent = '🔨 Building the project...';
                        } else if (toolNames.includes('readFile') || toolNames.includes('readMultipleFiles') || toolNames.includes('listFiles')) {
                            cleanContent = '📖 Analyzing the project...';
                        } else {
                            cleanContent = '🚀 Working on it...';
                        }
                    }
                    // Update the UI with this auto-text (even if empty — to ensure tool_calls render)
                    updateLastMessage(cleanContent, toolCalls, thinkingContent || undefined, undefined);
                }

                const assistantMessage: Message = {
                    role: 'assistant',
                    content: cleanContent || null,
                    tool_calls: toolCalls.length > 0 ? toolCalls : undefined
                } as any;

                // Store thinking - AI should see its own reasoning for continuity
                if (thinkingContent) {
                    (assistantMessage as any).thinking = thinkingContent;
                }

                // Store thinking separately (not sent to API but shown in UI)
                if (thinkingContent) {
                    (assistantMessage as any).thinking = thinkingContent;
                }

                // Message is already in store via updateLastMessage, just add to context
                currentMessages.push(assistantMessage);

                if (toolCalls.length === 0) {
                    // No tool calls - AI is done or just responded with text
                    console.log('[Chat] AI response (no tool calls):', cleanContent?.slice(0, 200));
                    console.log('[Chat] Done - no tool calls received, ending loop');
                    break;
                }

                // If AI responded with only empty content and no tool calls on a non-first turn,
                // it might be confused. Log it.
                if (!cleanContent && toolCalls.length > 0) {
                    console.log(`[Chat] Turn ${turns + 1}: AI sent ${toolCalls.length} tool calls without text`);
                }

                console.log(`[Chat] Running ${toolCalls.length} tool(s)...`);
                let devServerStarted = false;

                // Run consecutive read-only tools in parallel; keep mutating tools
                // sequential so create/edit/command ordering stays correct.
                const toolBatches: ToolCall[][] = [];
                for (const toolCall of toolCalls) {
                    const canParallel = isParallelSafeTool(toolCall.function.name);
                    const last = toolBatches[toolBatches.length - 1];
                    if (
                        canParallel &&
                        last &&
                        last.length > 0 &&
                        isParallelSafeTool(last[0].function.name)
                    ) {
                        last.push(toolCall);
                    } else {
                        toolBatches.push([toolCall]);
                    }
                }

                for (const batch of toolBatches) {
                    if (abortControllerRef.current?.signal.aborted) break;

                    for (const toolCall of batch) {
                        if (!toolIdToActionId.has(toolCall.id)) {
                            const displayName = getActionDisplayName(toolCall.function.name, toolCall.function.arguments || '');
                            const id = addAction(toolCall.function.name, displayName);
                            toolIdToActionId.set(toolCall.id, id);
                        }
                        const actionId = toolIdToActionId.get(toolCall.id);
                        if (actionId) {
                            updateAction(actionId, { status: 'running' });
                        }
                    }
                    await new Promise(r => requestAnimationFrame(r));

                    const runOne = async (toolCall: ToolCall): Promise<{ toolCall: ToolCall; result: string }> => {
                        if (toolCall.function.name === 'createFile') {
                            try {
                                const args = JSON.parse(toolCall.function.arguments || '{}');
                                if (args.path && filesCreatedThisSession.has(args.path)) {
                                    sameFileCreatedCount++;
                                    console.log(`[Chat] Warning: ${args.path} already created this session (count: ${sameFileCreatedCount})`);
                                    if (sameFileCreatedCount >= 5) {
                                        console.log('[Chat] Loop detected - same file created multiple times, breaking');
                                        devServerStarted = true;
                                    }
                                }
                                if (args.path) filesCreatedThisSession.add(args.path);
                            } catch { /* ignore parse errors */ }
                        }

                        let result = '';
                        try {
                            if (toolCall.function.name === 'deploy') {
                                const actionId = toolIdToActionId.get(toolCall.id);
                                toolContext.onDeployProgress = (message: string) => {
                                    if (actionId) {
                                        updateAction(actionId, { result: message, status: 'running' });
                                    }
                                };
                            } else {
                                toolContext.onDeployProgress = undefined;
                            }
                            result = await handleToolCall(toolCall, {
                                reason: assistantMessageContent.trim(),
                                turnIndex: turns,
                            });
                        } catch (err: any) {
                            console.error('Tool execution error:', err);
                            result = `Error executing tool ${toolCall.function.name}: ${err.message}.\n\n⚠️ Suggestion: Try a different approach or use readFile to check the current state.`;
                        }
                        return { toolCall, result };
                    };

                    const settled = batch.length > 1
                        ? await Promise.all(batch.map(runOne))
                        : [await runOne(batch[0])];

                    for (const { toolCall, result } of settled) {
                        const actionId = toolIdToActionId.get(toolCall.id);

                        if (actionId) {
                            const isToolError = (
                                result.startsWith('Error ') ||
                                result.startsWith('[SYSTEM] ❌') ||
                                result.includes('AUTO-FIX REQUIRED') ||
                                (result.includes('crashed') && !result.includes('Deployment build completed')) ||
                                (result.includes('FAILED') && !result.includes('[SYSTEM] ✅'))
                            ) && !result.includes('[SYSTEM] ✅') && !result.includes('TypeScript check found');

                            const newStatus = isToolError ? 'error' : 'done';
                            console.log(`[Actions] ${toolCall.function.name} (${actionId}) → ${newStatus}`);
                            updateAction(actionId, {
                                status: newStatus,
                                result,
                                args: toolCall.function.arguments || ''
                            });

                            if (isToolError) {
                                consecutiveErrorCount++;
                                if (toolCall.function.name === 'editFile') {
                                    editFileFailCount++;
                                }
                            } else {
                                consecutiveErrorCount = 0;
                            }
                        } else {
                            console.warn(`[Actions] No actionId found for toolCall ${toolCall.id}`);
                        }

                        const toolMessage: Message = {
                            role: 'tool',
                            tool_call_id: toolCall.id,
                            name: toolCall.function.name,
                            content: result
                        };

                        addMessage(toolMessage);
                        currentMessages.push(toolMessage);

                        if (result.includes('DEV SERVER IS NOW RUNNING')) {
                            devServerStarted = true;
                        }
                    }

                    if (sameFileCreatedCount >= 5) {
                        break;
                    }
                }

                // If dev server started, let AI know but don't force-break
                // AI should naturally stop after seeing the server is running
                if (devServerStarted) {
                    console.log('[Chat] Dev server started');

                    // Inject a system hint so AI knows to wrap up
                    const devServerHint: Message = {
                        role: 'system',
                        content: '✅ DEV SERVER IS NOW RUNNING. The preview is available. If there are no errors to fix, tell the user the project is ready and STOP calling tools.'
                    };
                    currentMessages.push(devServerHint);
                    // Don't break — let AI do one more turn to provide a summary
                }

                // Loop detection: too many consecutive errors
                if (consecutiveErrorCount >= MAX_CONSECUTIVE_ERRORS) {
                    console.log(`[Chat] Loop detected: ${consecutiveErrorCount} consecutive errors, injecting recovery hint`);
                    const recoveryMessage: Message = {
                        role: 'system',
                        content: `⚠️ LOOP DETECTED: ${consecutiveErrorCount} consecutive tool errors. STOP and change your approach:\n1. Use getErrors() to see all current errors\n2. Use readFile() to check the actual file content\n3. If editFile keeps failing, use createFile to rewrite the entire file\n4. If npm install fails, check the package name with searchWeb\n5. Take a step back and think about what's actually wrong`
                    };
                    currentMessages.push(recoveryMessage);
                    addMessage(recoveryMessage);
                    consecutiveErrorCount = 0; // Reset to give AI another chance
                }

                // Loop detection: editFile keeps failing
                if (editFileFailCount >= MAX_EDIT_FAILS) {
                    console.log(`[Chat] editFile loop detected: ${editFileFailCount} failures, injecting hint`);
                    const editHint: Message = {
                        role: 'system',
                        content: `⚠️ editFile has failed ${editFileFailCount} times. STOP using editFile for this file. Use createFile to rewrite the entire file instead. Call readFile first to see the current content, then createFile with the complete updated content.`
                    };
                    currentMessages.push(editHint);
                    addMessage(editHint);
                    editFileFailCount = 0;
                }

                turns++;
            }

            // Smart AI-powered context compression
            const allMessages = useStore.getState().messages;

            let totalTokens = estimateTokens(SYSTEM_PROMPT.content as string);
            allMessages.forEach(msg => {
                totalTokens += getMessageTokens(msg);
            });

            const modelContextLimit = useStore.getState().modelContextLimit || 200000;
            const MAX_CONTEXT_TOKENS = Math.floor(modelContextLimit * 0.8);
            const COMPRESSION_THRESHOLD = Math.floor(MAX_CONTEXT_TOKENS * 0.8); // 80% of limit

            // Check if we need compression
            if (totalTokens > COMPRESSION_THRESHOLD && allMessages.length > 10) {
                console.log(`[Context] Tokens: ${totalTokens}/${MAX_CONTEXT_TOKENS}, triggering AI compression...`);

                try {
                    // How many messages to keep uncompressed (recent context)
                    const KEEP_RECENT = 8;
                    const messagesToCompress = allMessages.slice(0, -KEEP_RECENT);
                    const recentMessages = allMessages.slice(-KEEP_RECENT);


                    // Create a simple summary (AI summarization would require recursive call)
                    const firstUserMsg = messagesToCompress.find(m => m.role === 'user');
                    const summary = `Previous conversation: ${firstUserMsg ? (typeof firstUserMsg.content === 'string' ? firstUserMsg.content.substring(0, 100) : 'User started conversation') : 'Earlier messages'}... (${messagesToCompress.length} messages compressed to save context)`;

                    // Create summary message
                    const summaryMessage: Message = {
                        role: 'system',
                        content: `📝 ${summary}`
                    };

                    // Replace old messages with summary + keep recent
                    const compressedContext = [summaryMessage, ...recentMessages];
                    setMessages(compressedContext);

                    // Recalculate tokens
                    let newTotal = estimateTokens(SYSTEM_PROMPT.content as string);
                    compressedContext.forEach(msg => {
                        newTotal += getMessageTokens(msg);
                    });

                    setTokenCount(newTotal);

                    // Show notification
                    const compressionNotice: Message = {
                        role: 'assistant',
                        content: `🗜️ Context compressed by AI: ${messagesToCompress.length} old messages summarized. Freed ${totalTokens - newTotal} tokens. Current: ${newTotal.toLocaleString()}/${MAX_CONTEXT_TOKENS.toLocaleString()}`
                    };
                    addMessage(compressionNotice);

                    console.log(`[Context] Compressed ${messagesToCompress.length} messages, saved ${totalTokens - newTotal} tokens`);
                } catch (err) {
                    console.error('[Context] AI compression failed, falling back to simple removal:', err);

                    // Fallback: simple removal of oldest messages
                    let compressedMessages = [...allMessages];
                    let removedCount = 0;

                    while (totalTokens > MAX_CONTEXT_TOKENS && compressedMessages.length > 5) {
                        const removed = compressedMessages.shift();
                        if (removed) {
                            totalTokens -= getMessageTokens(removed);
                            removedCount++;
                        }
                    }

                    if (removedCount > 0) {
                        setMessages(compressedMessages);
                        setTokenCount(totalTokens);

                        const fallbackNotice: Message = {
                            role: 'assistant',
                            content: `🗜️ Context compressed: ${removedCount} old messages removed. Current: ${totalTokens.toLocaleString()}/${MAX_CONTEXT_TOKENS.toLocaleString()}`
                        };
                        addMessage(fallbackNotice);
                    }
                }
            } else {
                // Just update the token count
                setTokenCount(totalTokens);
            }

        } catch (error: any) {
            if (controller.signal.aborted) {
                // When stopped, check if last message has incomplete tool_calls
                const state = useStore.getState();
                const lastMsg = state.messages[state.messages.length - 1] as any;

                if (lastMsg?.role === 'assistant' && lastMsg?.tool_calls?.length > 0) {
                    // Add placeholder tool responses for incomplete tool calls
                    for (const tc of lastMsg.tool_calls) {
                        // Check if tool response already exists
                        const hasResponse = state.messages.some(
                            (m: any) => m.role === 'tool' && m.tool_call_id === tc.id
                        );
                        if (!hasResponse) {
                            addMessage({
                                role: 'tool',
                                tool_call_id: tc.id,
                                name: tc.function.name,
                                content: '[Stopped by user]'
                            });
                        }
                    }
                }

                // Update the empty placeholder instead of adding a new message
                const stateAfter = useStore.getState();
                const last = stateAfter.messages[stateAfter.messages.length - 1];
                if (last?.role === 'assistant' && !last.content && !last.tool_calls?.length) {
                    updateLastMessage('Stopped by user.');
                } else {
                    addMessage({ role: 'assistant', content: 'Stopped by user.' });
                }
            } else {
                console.error('[Chat] Error:', error);
                const rawMessage = error?.message || 'Failed to get response';
                const rateLimitMatch = rawMessage.match(/please wait (\d+) second/i);
                const errorMessage = rateLimitMatch
                    ? `You're sending requests too quickly. Please wait ${rateLimitMatch[1]} second${rateLimitMatch[1] === '1' ? '' : 's'} and try again.`
                    : /429|rate limit|RESOURCE_EXHAUSTED|RATE_LIMITED/i.test(rawMessage)
                        ? 'You\'re sending requests too quickly. Please wait a moment and try again.'
                        : rawMessage;

                // Same check for errors
                const state = useStore.getState();
                const lastMsg = state.messages[state.messages.length - 1] as any;

                if (lastMsg?.role === 'assistant' && lastMsg?.tool_calls?.length > 0) {
                    for (const tc of lastMsg.tool_calls) {
                        const hasResponse = state.messages.some(
                            (m: any) => m.role === 'tool' && m.tool_call_id === tc.id
                        );
                        if (!hasResponse) {
                            addMessage({
                                role: 'tool',
                                tool_call_id: tc.id,
                                name: tc.function.name,
                                content: `[Error: ${errorMessage}]`
                            });
                        }
                    }
                }

                // Update empty placeholder instead of adding new message
                const stateAfter = useStore.getState();
                const last = stateAfter.messages[stateAfter.messages.length - 1];
                if (last?.role === 'assistant' && !last.content && !last.tool_calls?.length) {
                    updateLastMessage(errorMessage);
                } else {
                    addMessage({ role: 'assistant', content: errorMessage });
                }
            }
        } finally {
            const wasAborted = controller.signal.aborted;
            endRun(controller);
            setCurrentThinking('');

            // Notify parent that AI finished a complete response (not aborted)
            if (!wasAborted && onAiComplete) {
                onAiComplete();
            }

            // Clear actions after a delay to allow smooth transition to completed state
            setTimeout(() => replaceActions([], false), 500);

            if (chatId && user) {
                try {
                    const { useStore } = await import('../store');
                    const state = useStore.getState();

                    await saveChatMessages(chatId, state.messages, {
                        keepalive: true,
                        projectId: getHostProjectId(),
                    });

                    if (Object.keys(state.files).length > 0) {
                        await saveProject(chatId, user.uid, state.files);
                    }


                } catch {
                    // Ignore save errors
                }
            }
        }
    };

    // Form submit handler
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if ((!input.trim() && selectedImages.length === 0 && selectedDocuments.length === 0) || isRunning) return;

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

        // Slash commands — attach / libraries / help (do not send as chat)
        const slashCmd = input.trim().toLowerCase();
        if (slashCmd === '/' || slashCmd === '/skills' || slashCmd === '/mcp' || slashCmd === '/integrations' || slashCmd === '/help' || slashCmd === '/credit' || slashCmd === '/credits') {
            setShowSlashMenu(true);
            if (slashCmd === '/skills') setLibraryView('skills');
            else if (slashCmd === '/mcp' || slashCmd === '/integrations') setLibraryView('mcp');
            else if (slashCmd === '/help') setLibraryView('help');
            else if (slashCmd === '/credit' || slashCmd === '/credits') setLibraryView('credits');
            setInput('');
            return;
        }
        if (slashCmd === '/image') {
            setInput('');
            setShowSlashMenu(false);
            fileInputRef.current?.click();
            return;
        }
        if (slashCmd === '/document' || slashCmd === '/doc' || slashCmd === '/file') {
            setInput('');
            setShowSlashMenu(false);
            documentInputRef.current?.click();
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
    const [showSlashMenu, setShowSlashMenu] = useState(false);
    const [libraryView, setLibraryView] = useState<'skills' | 'mcp' | 'help' | 'credits' | null>(null);
    const [slashSkills, setSlashSkills] = useState<SyraSlashSkill[]>(BUILTIN_SKILL_FALLBACK);
    const [slashMcp, setSlashMcp] = useState<SyraSlashMcpAddon[]>(BUILTIN_MCP_FALLBACK);
    const [debugInfo, setDebugInfo] = useState<any>(null);
    const [debugLoading, setDebugLoading] = useState(false);
    const slashLoadedForRef = useRef<string | null>(null);

    const loadSlashExtras = async (projectId: string, force = false) => {
        if (!force && slashLoadedForRef.current === projectId) return;
        const [skillsRes, mcpRes] = await Promise.all([
            fetchProjectSkills(projectId),
            fetchProjectMcp(projectId),
        ]);
        setSlashSkills(skillsRes.skills);
        setSlashMcp(mcpRes.addons);
        slashLoadedForRef.current = projectId;
    };

    useEffect(() => {
        const projectId = getHostProjectId();
        if (projectId) void loadSlashExtras(projectId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const hostProjectIdForSlash = typeof window !== 'undefined' ? getHostProjectId() : null;
    const connectedMcps = useMemo(
        () => slashMcp.filter((a) => a.connected).slice(0, 4),
        [slashMcp],
    );

    const closeLibraryView = () => setLibraryView(null);

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

    const renderAssistantMarkdown = (raw: string) => {
        const content = raw.replace(/^\[SYSTEM\] .*/gm, '');
        if (/```mermaid/.test(content)) {
            return (
                <div className={`prose prose-sm max-w-none w-full break-words overflow-hidden ${isDark ? 'prose-invert' : ''}`}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                        {content}
                    </ReactMarkdown>
                </div>
            );
        }
        return <Markdown content={content} className="an-markdown w-full max-w-none" />;
    };

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

    return (
        <div className={`relative flex flex-col h-full ${isDark ? 'bg-[#18191B]' : 'bg-white'}`}>
            {libraryView === 'skills' && (
                <div className="absolute inset-0 z-40">
                    <SkillsLibrary
                        projectId={hostProjectIdForSlash}
                        isDark={isDark}
                        onBack={closeLibraryView}
                        onSkillsChange={setSlashSkills}
                    />
                </div>
            )}
            {libraryView === 'mcp' && (
                <div className="absolute inset-0 z-40">
                    <McpLibrary
                        projectId={hostProjectIdForSlash}
                        isDark={isDark}
                        onBack={closeLibraryView}
                        onMcpChange={setSlashMcp}
                    />
                </div>
            )}
            {libraryView === 'help' && (
                <div className="absolute inset-0 z-40">
                    <HelpSupportPanel isDark={isDark} onBack={closeLibraryView} />
                </div>
            )}
            {libraryView === 'credits' && (
                <div className="absolute inset-0 z-40">
                    <CreditsPanel isDark={isDark} onBack={closeLibraryView} />
                </div>
            )}
            {showDeepMemory && <DeepMemoryModal onClose={() => setShowDeepMemory(false)} />}
            {showModelLearn && (
                <ModelLearnPanel
                    entries={modelLearnLog}
                    isDark={isDark}
                    onClose={() => setShowModelLearn(false)}
                />
            )}
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
                        className="pointer-events-auto relative mx-auto flex h-14 max-w-[760px] items-center justify-between px-4 sm:px-6"
                        style={{ marginTop: 'env(safe-area-inset-top, 0px)' }}
                    >
                        <button
                            type="button"
                            onClick={handleBack}
                            aria-label="Back"
                            className={`flex size-10 items-center justify-center rounded-xl transition-colors active:scale-95 ${isDark ? 'text-white/60 hover:bg-white/[0.06] hover:text-white' : 'text-gray-500 hover:bg-black/[0.05] hover:text-gray-900'}`}
                        >
                            <ArrowLeft className="size-5" strokeWidth={1.8} />
                        </button>

                        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center gap-2">
                            <span className={`text-[15px] font-semibold tracking-[-0.015em] ${isDark ? 'text-white/90' : 'text-gray-900'}`}>Syra</span>
                            {isRunning && <span className="size-1.5 animate-pulse rounded-full bg-blue-400" aria-label="Building" />}
                        </div>

                        <div className="flex items-center gap-1">
                            {showPreviewButton && onOpenPreview && (
                                <button
                                    type="button"
                                    onClick={onOpenPreview}
                                    aria-label="Open preview"
                                    title="Open preview"
                                    className={`flex size-10 items-center justify-center rounded-xl transition-colors active:scale-95 ${isDark ? 'text-white/60 hover:bg-white/[0.06] hover:text-white' : 'text-gray-500 hover:bg-black/[0.05] hover:text-gray-900'}`}
                                >
                                    <Eye className="size-[18px]" strokeWidth={1.8} />
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={() => setShowDeepMemory(true)}
                                aria-label="Profile"
                                className={`flex size-9 items-center justify-center overflow-hidden rounded-xl transition-transform active:scale-95 ${isDark ? 'bg-white/[0.08] text-white' : 'bg-black/[0.05] text-gray-900'}`}
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
                                    <span className="text-sm font-semibold">M</span>
                                )}
                            </button>
                        </div>
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
                    className={`mx-auto w-full max-w-[760px] ${embedded ? 'px-4 sm:px-6 lg:px-8' : 'px-4 sm:px-6 lg:px-8'} py-6 sm:py-8 lg:py-10 space-y-6 sm:space-y-7 lg:space-y-8`}
                    style={embedded ? { paddingTop: 'calc(env(safe-area-inset-top, 0px) + 4.75rem)' } : undefined}
                >
                    {groupedMessages.map((group, idx) => (
                        <div key={idx} className="space-y-3 animate-fade-in-up">
                            {group.role === 'assistant' && group.thinking && (
                                <ThinkingBlock
                                    thinking={group.thinking}
                                    isDark={isDark}
                                    thinkingTime={group.thinkingDuration || undefined}
                                    startTime={idx === groupedMessages.length - 1 && isRunning ? thinkingStartTime : undefined}
                                />
                            )}

                            {group.role === 'assistant' && group.agentActions && group.agentActions.length > 0 && (
                                <ActionsList
                                    actions={idx === groupedMessages.length - 1 && isRunning && actions.length > 0 ? actions : group.agentActions}
                                    isLive={idx === groupedMessages.length - 1 && isRunning}
                                    isDark={isDark}
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

                            {/* Render segments in order for assistant messages */}
                            {group.role === 'assistant' && group.segments && group.segments.length > 0 ? (
                                <>
                                    {group.segments.map((seg, segIdx) => {
                                        if (seg.type === 'text' && seg.content) {
                                            const textContent = typeof seg.content === 'string' ? seg.content : '';
                                            if (!textContent) return null;
                                            return (
                                                <div key={`seg-${segIdx}`} className="flex justify-start max-w-full">
                                                    <div className={`text-[14px] leading-relaxed w-full max-w-full overflow-hidden break-words ${isDark ? 'text-white/85' : 'text-gray-800'}`}>
                                                        {renderAssistantMarkdown(textContent)}
                                                    </div>
                                                </div>
                                            );
                                        }
                                        if (seg.type === 'tools' && seg.toolCalls && seg.toolCalls.length > 0) {
                                            // If this is the last segment and we're live, show live actions
                                            const isLastSegment = segIdx === group.segments!.length - 1;
                                            const showLive = isRunning && isLastSegment && idx === groupedMessages.length - 1 && actions.length > 0 && !group.agentActions?.length;

                                            if (showLive) {
                                                return (
                                                    <div key={`seg-${segIdx}`}>
                                                        <ActionsList actions={actions.filter(a => a.toolName !== 'drawDiagram')} isLive={true} isDark={isDark} />
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div key={`seg-${segIdx}`}>
                                                <ActionsList
                                                    key={`seg-${segIdx}`}
                                                    actions={seg.toolCalls.filter(tc => tc.call.function.name !== 'drawDiagram').map((tc, i) => ({
                                                        id: `completed_${idx}_${segIdx}_${i}`,
                                                        toolName: tc.call.function.name,
                                                        displayName: getActionDisplayName(tc.call.function.name, tc.call.function.arguments || ''),
                                                        status: tc.result?.startsWith('Error') ? 'error' as const : 'done' as const,
                                                        result: tc.result,
                                                        args: tc.call.function.arguments || ''
                                                    }))}
                                                    isDark={isDark}
                                                />
                                                </div>
                                            );
                                        }
                                        return null;
                                    })}
                                    {/* Live actions if no segments have tools yet */}
                                    {isRunning && idx === groupedMessages.length - 1 && actions.length > 0 && !group.agentActions?.length && !group.segments.some(s => s.type === 'tools') && (
                                        <ActionsList actions={actions.filter(a => a.toolName !== 'drawDiagram')} isLive={true} isDark={isDark} />
                                    )}
                                    <MessageMetaFooter
                                        content={group.content}
                                        createdAt={group.createdAt}
                                        isDark={isDark}
                                        hide={idx === groupedMessages.length - 1 && isRunning}
                                    />
                                </>
                            ) : (
                                <>
                                    {/* Fallback: user messages or assistant without segments */}
                                    <div className={`flex ${group.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div
                                            className={`text-[14px] leading-relaxed ${
                                                group.role === 'user'
                                                    ? isDark
                                                        ? 'bg-gradient-to-br from-white/[0.14] to-white/[0.05] text-white/95 rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] sm:max-w-[75%] border border-white/[0.08] shadow-lg shadow-black/10'
                                                        : 'bg-gradient-to-br from-gray-900 to-gray-800 text-white rounded-2xl rounded-br-md px-4 py-2.5 max-w-[85%] sm:max-w-[75%] shadow-md shadow-black/10'
                                                    : isDark
                                                        ? 'text-white/85 max-w-full'
                                                        : 'text-gray-800 max-w-full'
                                            }`}
                                        >

                                            {/* Picked element indicator */}
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
                                            {group.content && (
                                                <div className={`prose prose-sm max-w-none w-full break-words overflow-hidden ${isDark ? 'prose-invert prose-pre:bg-[#111] prose-pre:border prose-pre:border-white/[0.04] prose-pre:rounded-lg prose-code:text-[#e5e5e5]' : 'prose-pre:bg-gray-50 prose-pre:border prose-pre:border-gray-200 prose-pre:rounded-lg'}`}>                                                    {Array.isArray(group.content) ? (
                                                        <div className="space-y-2">
                                                            {group.content.map((part, i) => {
                                                                if (part.type === 'image_url') {
                                                                    return <img key={i} src={part.image_url.url} alt="" className="max-w-full rounded-lg max-h-[250px] object-contain" />;
                                                                }
                                                                return <React.Fragment key={i}>{renderAssistantMarkdown(part.text)}</React.Fragment>;
                                                            })}
                                                        </div>
                                                    ) : (
                                                        renderAssistantMarkdown(String(group.content || ''))
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {/* Live actions for assistant without segments */}
                                    {group.role === 'assistant' && isRunning && idx === groupedMessages.length - 1 && actions.length > 0 && !group.agentActions?.length && (
                                        <ActionsList actions={actions.filter(a => a.toolName !== 'drawDiagram')} isLive={true} isDark={isDark} />
                                    )}
                                    {group.role === 'assistant' && (
                                        <MessageMetaFooter
                                            content={group.content}
                                            createdAt={group.createdAt}
                                            isDark={isDark}
                                            hide={idx === groupedMessages.length - 1 && isRunning}
                                        />
                                    )}
                                </>
                            )}
                        </div>
                    ))}

                    {/* Live Thinking - only when there's no assistant message yet or its thinking isn't set */}
                    {isRunning && currentThinking && !isSystemProcessingText(currentThinking) && (!groupedMessages.length || groupedMessages[groupedMessages.length - 1].role !== 'assistant' || !groupedMessages[groupedMessages.length - 1].thinking) && (
                        <ThinkingBlock thinking={currentThinking} isDark={isDark} thinkingTime={thinkingDuration || undefined} startTime={thinkingStartTime} />
                    )}

                    {/* Live Actions - only show here if there's no assistant message group yet */}
                    {isRunning && actions.length > 0 && (!groupedMessages.length || groupedMessages[groupedMessages.length - 1].role !== 'assistant') && (
                        <ActionsList actions={actions.filter(a => a.toolName !== 'drawDiagram')} isLive={true} isDark={isDark} />
                    )}

                    {/* Inline shimmer while waiting / after durable accept — replaces big system badge + bounce dots */}
                    {isRunning && (!currentThinking || isSystemProcessingText(currentThinking)) && actions.length === 0 && (
                        !groupedMessages.length ||
                        groupedMessages[groupedMessages.length - 1].role === 'user' ||
                        (groupedMessages[groupedMessages.length - 1].role === 'assistant' && !groupedMessages[groupedMessages.length - 1].content && !groupedMessages[groupedMessages.length - 1].thinking)
                    ) && (
                        <Marker role="status" className="animate-fade-in-up px-1">
                            <MarkerContent className="shimmer">Thinking...</MarkerContent>
                        </Marker>
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
                    {pendingQuestion && (
                        <div className="mb-2.5">
                            <AgentQuestionCard
                                question={pendingQuestion}
                                isDark={isDark}
                                submitting={questionSubmitting}
                                error={questionError}
                                onSubmit={handleAgentQuestionSubmit}
                            />
                        </div>
                    )}
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

                        {/* Connected integrations pill — dashed status chip above composer */}
                        {connectedMcps.length > 0 && (
                            <div className="flex justify-start px-1">
                                <button
                                    type="button"
                                    onClick={() => setLibraryView('mcp')}
                                    className={`inline-flex items-center gap-2 rounded-full border border-dashed px-3 py-1.5 transition-colors ${
                                        isDark
                                            ? 'border-[#4a4b4e] bg-transparent text-[#9a9b9e] hover:border-[#6b6c6f] hover:text-[#c5c6c9]'
                                            : 'border-gray-300 bg-transparent text-gray-500 hover:border-gray-400 hover:text-gray-700'
                                    }`}
                                    aria-label="Connected integrations"
                                >
                                    <span className="flex items-center -space-x-1">
                                        {connectedMcps.map((addon) => (
                                            <span
                                                key={addon.id}
                                                className={`relative inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                                                    isDark ? 'border-[#18191B] bg-[#1c1d1f]' : 'border-white bg-white'
                                                }`}
                                            >
                                                <McpBrandIcon
                                                    id={addon.id}
                                                    name={addon.name}
                                                    className="h-3.5 w-3.5 text-[#e5e5e5]"
                                                />
                                            </span>
                                        ))}
                                    </span>
                                    <span className="text-[12px] leading-none tracking-tight">connected</span>
                                </button>
                            </div>
                        )}

                        {/* Composer — full size by default; minimized when AI asks a question */}
                        <div className={`rounded-[28px] border px-2 transition-colors ${
                            pendingQuestion ? 'py-1.5' : 'pt-1.5 pb-2'
                        } ${isDark ? 'bg-[#1c1d1f] border-[#2a2b2e] focus-within:border-[#3a3b3e]' : 'bg-white border-gray-200 shadow-sm focus-within:border-gray-300'}`}>
                            {!pendingQuestion && (
                                <textarea
                                    ref={textareaRef}
                                    value={input}
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setInput(value);
                                        if (value === '/') {
                                            setShowSlashMenu(true);
                                            setShowModelMenu(false);
                                        }
                                        const target = e.target as HTMLTextAreaElement;
                                        target.style.height = 'auto';
                                        const maxH = typeof window !== 'undefined' && window.innerWidth < 768 ? 120 : 200;
                                        target.style.height = `${Math.min(target.scrollHeight, maxH)}px`;
                                    }}
                                    placeholder="Help you write code, debug and ship production-ready work. Type / for skills & integrations."
                                    className={`w-full bg-transparent text-[16px] leading-relaxed px-3 pt-2.5 pb-2 focus:outline-none resize-none overflow-y-auto max-h-[120px] md:max-h-[200px] ${isDark ? 'text-[#e5e5e5] placeholder:text-[#6b6c6f]' : 'text-gray-900 placeholder:text-gray-400'}`}
                                    style={{ height: 'auto', minHeight: '76px' }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape' && showSlashMenu) {
                                            e.preventDefault();
                                            setShowSlashMenu(false);
                                            return;
                                        }
                                        if (e.key === 'Enter' && !e.shiftKey) {
                                            e.preventDefault();
                                            handleSubmit(e);
                                        }
                                    }}
                                />
                            )}

                            {/* Toolbar */}
                            <div className={`flex items-center gap-2 ${pendingQuestion ? 'px-0.5' : 'px-1'}`}>
                                <DropdownMenu open={showSlashMenu} onOpenChange={(open) => {
                                    setShowSlashMenu(open);
                                    if (open) {
                                        setShowModelMenu(false);
                                        const projectId = getHostProjectId();
                                        if (projectId) void loadSlashExtras(projectId, true);
                                    }
                                }}>
                                    <DropdownMenuTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label="Slash commands"
                                            className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors active:scale-95 ${isDark ? 'border-[#3a3b3e] text-[#9a9b9e] hover:text-white hover:bg-white/5' : 'border-gray-300 text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}
                                        >
                                            <Slash className="h-3.5 w-3.5" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        side="top"
                                        align="start"
                                        className={`w-[min(92vw,17.5rem)] ${isDark ? 'border-[#2a2b2e] bg-[#1c1d1f] text-[#e5e5e5]' : ''}`}
                                    >
                                        <DropdownMenuItem
                                            className="gap-2.5 text-[13px]"
                                            onSelect={() => {
                                                fileInputRef.current?.click();
                                                if (input.startsWith('/')) setInput('');
                                            }}
                                        >
                                            <ImageIcon className="h-4 w-4 opacity-70" />
                                            Image upload
                                            <span className={`ml-auto text-[10px] ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}>/image</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="gap-2.5 text-[13px]"
                                            onSelect={() => {
                                                documentInputRef.current?.click();
                                                if (input.startsWith('/')) setInput('');
                                            }}
                                        >
                                            <FileUp className="h-4 w-4 opacity-70" />
                                            File upload
                                            <span className={`ml-auto text-[10px] ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}>/file</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className={isDark ? 'bg-[#2a2b2e]' : undefined} />
                                        <DropdownMenuItem
                                            className="gap-2.5 text-[13px]"
                                            onSelect={() => {
                                                setLibraryView('skills');
                                                if (input.startsWith('/')) setInput('');
                                            }}
                                        >
                                            <Sparkles className="h-4 w-4 opacity-70" />
                                            Skills
                                            <span className={`ml-auto text-[10px] ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}>/skills</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="gap-2.5 text-[13px]"
                                            onSelect={() => {
                                                setLibraryView('mcp');
                                                if (input.startsWith('/')) setInput('');
                                            }}
                                        >
                                            <Puzzle className="h-4 w-4 opacity-70" />
                                            Integrations
                                            <span className={`ml-auto text-[10px] ${isDark ? 'text-[#6b6c6f]' : 'text-gray-400'}`}>/integrations</span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator className={isDark ? 'bg-[#2a2b2e]' : undefined} />
                                        <DropdownMenuItem
                                            className="gap-2.5 text-[13px]"
                                            onSelect={() => {
                                                setLibraryView('help');
                                                if (input.startsWith('/')) setInput('');
                                            }}
                                        >
                                            <HelpCircle className="h-4 w-4 opacity-70" />
                                            Help and support
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                            className="gap-2.5 text-[13px]"
                                            onSelect={() => {
                                                setLibraryView('credits');
                                                if (input.startsWith('/')) setInput('');
                                            }}
                                        >
                                            <CreditCard className="h-4 w-4 opacity-70" />
                                            Credit
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <ModelSelector
                                    selectedModel={selectedModel}
                                    choices={availableModelChoices || []}
                                    loading={modelsLoading}
                                    error={modelsError}
                                    onRetry={() => { void loadAvailableModels(); }}
                                    onSelect={(choice) => {
                                        setSelectedModel(choice.modelType)
                                        setAiModel(choice.apiModel)
                                        setShowModelMenu(false)
                                    }}
                                    showMenu={showModelMenu && !modelsLoading}
                                    onToggleMenu={() => { setShowModelMenu(!showModelMenu); setShowSlashMenu(false); }}
                                    onCloseMenu={() => setShowModelMenu(false)}
                                    isDark={isDark}
                                />

                                <div className="ml-auto flex items-center gap-1">
                                    <button
                                        type="button"
                                        aria-label="Voice input"
                                        aria-pressed={isListening}
                                        onClick={handleVoiceInput}
                                        className={`flex h-10 w-10 items-center justify-center rounded-xl transition-all active:scale-95 ${isListening ? 'text-red-400 bg-red-500/10' : isDark ? 'text-[#9a9b9e] hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'}`}
                                    >
                                        <Mic className={`h-5 w-5 ${isListening ? 'text-red-500 animate-pulse' : ''}`} />
                                    </button>

                                    {isRunning ? (
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
                                            disabled={Boolean(pendingQuestion) || (!input.trim() && selectedImages.length === 0)}
                                            aria-label="Send"
                                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95 disabled:cursor-not-allowed ${
                                                !pendingQuestion && (input.trim() || selectedImages.length > 0)
                                                    ? 'bg-white text-black hover:bg-gray-200'
                                                    : isDark ? 'bg-white/15 text-white/40' : 'bg-gray-200 text-gray-400'
                                            }`}
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

function MessageMetaFooter({
    content,
    createdAt,
    isDark,
    hide,
}: {
    content: ContentType;
    createdAt?: number;
    isDark: boolean;
    hide?: boolean;
}) {
    const [copied, setCopied] = useState(false);
    const text = typeof content === 'string'
        ? content
        : Array.isArray(content)
            ? content.filter((p): p is { type: 'text'; text: string } => p.type === 'text').map(p => p.text).join('\n')
            : '';

    if (hide || !text.trim()) return null;

    const timeLabel = new Date(createdAt || Date.now()).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text.replace(/^\[SYSTEM\] .*/gm, '').trim());
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            /* ignore */
        }
    };

    return (
        <div className="mt-2 flex items-center justify-end gap-2 px-1">
            <span className={`text-xs tabular-nums ${isDark ? 'text-white/35' : 'text-gray-400'}`}>{timeLabel}</span>
            <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy message"
                className={`flex size-7 items-center justify-center rounded-md transition-colors ${isDark ? 'text-white/40 hover:bg-white/[0.06] hover:text-white/70' : 'text-gray-400 hover:bg-black/[0.04] hover:text-gray-700'}`}
            >
                {copied ? <CheckIcon className="size-3.5" strokeWidth={2} /> : <Copy className="size-3.5" strokeWidth={1.8} />}
            </button>
        </div>
    );
}

function isSystemProcessingText(text: string): boolean {
    const t = text.trim().toLowerCase();
    if (!t) return true;
    return (
        t.includes('accepted the durable request') ||
        t.includes('cloud agent accepted') ||
        t.includes('durable request') ||
        t === 'accepted' ||
        t === 'processing'
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

    if (!thinking || isSystemProcessingText(thinking)) return null;

    // Use finalized time if available, otherwise live elapsed time
    const displayTime = thinkingTime !== undefined ? thinkingTime : (startTime ? elapsed : 0);
    const isLive = Boolean(startTime) && thinkingTime === undefined;
    const thoughtCount = Math.max(1, thinking.split(/\n{2,}/).filter(part => part.trim()).length);
    const title = isLive
        ? 'Thinking'
        : thoughtCount === 1
            ? 'Thought 1 time'
            : `Thought ${thoughtCount} times`;

    if (isLive) {
        return (
            <Marker role="status" className="mb-3 animate-fade-in px-1">
                <span className="inline-flex items-center gap-2">
                    <SpiralLoader size={14} />
                    <MarkerContent className="shimmer">Thinking...</MarkerContent>
                </span>
            </Marker>
        );
    }

    return (
        <div className="mb-3 animate-fade-in px-1">
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                aria-expanded={isExpanded}
                className={`group flex min-h-11 w-full items-start gap-3 rounded-lg py-2 text-left transition-colors ${isDark ? 'hover:bg-white/[0.035]' : 'hover:bg-black/[0.035]'}`}
            >
                <span className="flex size-7 shrink-0 items-center justify-center">
                    <Brain className={`size-4 ${isDark ? 'text-white/65' : 'text-gray-500'}`} strokeWidth={1.8} />
                </span>
                <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-2 text-sm font-semibold ${isDark ? 'text-white/80' : 'text-gray-800'}`}>
                        {title}
                        {displayTime > 0 && <span className={`text-xs font-normal ${isDark ? 'text-white/35' : 'text-gray-400'}`}>{displayTime}s</span>}
                    </span>
                    <span className={`mt-1 block whitespace-pre-wrap text-sm leading-6 ${isExpanded ? '' : 'line-clamp-3'} ${isDark ? 'text-white/60' : 'text-gray-600'}`}>
                        {thinking}
                    </span>
                </span>
                <ChevronRight className={`mt-1 size-4 shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''} ${isDark ? 'text-white/35' : 'text-gray-400'}`} />
            </button>
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
