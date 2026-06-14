import { create } from 'zustand';
import { Message, ModelType } from '../lib/ai';
import { User } from '../lib/auth';
import { UserTokens, ChatHistory } from '../lib/api';

export interface ParsedError {
    id: string;
    type: 'typescript' | 'vite' | 'runtime' | 'module' | 'syntax' | 'npm';
    message: string;
    file?: string;
    line?: number;
    column?: number;
    timestamp: number;
    source: string;
}

// ============================================================
// INLINE ERROR PARSER for terminal output
// ============================================================
let _errId = 0;
const _recentErrorKeys = new Set<string>();
let _lastCleanup = Date.now();

function parseTerminalErrors(output: string): ParsedError[] {
    // Cleanup dedup cache every 30s
    if (Date.now() - _lastCleanup > 30000) {
        _recentErrorKeys.clear();
        _lastCleanup = Date.now();
    }

    const errors: ParsedError[] = [];
    const now = Date.now();

    const addErr = (type: ParsedError['type'], message: string, file?: string, line?: number, col?: number) => {
        const key = `${type}:${file || ''}:${line || ''}:${message.slice(0, 60)}`;
        if (_recentErrorKeys.has(key)) return;
        _recentErrorKeys.add(key);
        errors.push({
            id: `e${++_errId}`,
            type,
            message: message.trim(),
            file: file?.replace(/^\.\//, '').replace(/\/home\/[a-z0-9_-]+\//g, ''),
            line,
            column: col,
            timestamp: now,
            source: 'terminal',
        });
    };

    const lines = output.split('\n');
    for (const line of lines) {
        // TypeScript: src/App.tsx(10,5): error TS2345: ...
        let m = line.match(/([^\s(]+)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/);
        if (m) { addErr('typescript', `${m[4]}: ${m[5]}`, m[1], +m[2], +m[3]); continue; }

        // TypeScript alt: src/App.tsx:10:5 - error TS2345: ...
        m = line.match(/([^\s:]+):(\d+):(\d+)\s*-\s*error\s+(TS\d+):\s*(.+)/);
        if (m) { addErr('typescript', `${m[4]}: ${m[5]}`, m[1], +m[2], +m[3]); continue; }

        // Vite: Failed to resolve import "xxx" from "yyy"
        m = line.match(/Failed to resolve import "([^"]+)" from "([^"]+)"/);
        if (m) { addErr('module', `Cannot find module "${m[1]}"`, m[2]); continue; }

        // Vite: "The following dependencies are imported but could not be resolved"
        // Next line has: "package-name (imported by /path/to/file.tsx)"
        m = line.match(/^\s*(\S+)\s+\(imported by\s+(.+)\)/);
        if (m) { addErr('module', `Missing dependency: ${m[1]}`, m[2].replace(/\/home\/[a-z0-9_-]+\//g, '')); continue; }

        // Generic "Error: ..." lines (like Vite dependency resolution errors)
        if (line.trim().startsWith('Error:') && !line.includes('at ')) {
            const msg = line.trim().replace(/^Error:\s*/, '');
            if (msg.length > 5) { addErr('vite', msg); continue; }
        }

        // Cannot find module 'xxx'
        m = line.match(/Cannot find module '([^']+)'/);
        if (m && !line.includes('at ')) { addErr('module', `Missing module: ${m[1]}`); continue; }

        // [vite] Internal server error / Pre-transform error
        m = line.match(/\[vite\]\s*(?:Internal server error|Pre-transform error):\s*(.+)/);
        if (m) {
            const msg = m[1].replace(/\[postcss\]\s*/, '');
            if (!msg.includes('Cannot find module') && !msg.includes('Failed to resolve')) {
                addErr('vite', msg);
            }
            continue;
        }

        // SyntaxError
        m = line.match(/SyntaxError:\s*(.+)/);
        if (m) { addErr('syntax', m[1]); continue; }

        // npm ERR!
        m = line.match(/npm (?:ERR!|error)\s*(.+)/);
        if (m && m[1].trim().length > 3 && !m[1].includes('A complete log')) {
            addErr('npm', m[1].trim());
            continue;
        }

        // Runtime errors
        m = line.match(/^(TypeError|ReferenceError|RangeError):\s*(.+)/);
        if (m) { addErr('runtime', `${m[1]}: ${m[2]}`); continue; }
    }

    return errors;
}

interface FileSystem {
    [key: string]: {
        file: {
            contents: string;
        };
    };
}

interface AppState {
    // Auth
    user: User | null;
    userTokens: UserTokens | null; // User's monthly token limits

    // Chat
    currentChatId: string | null;
    messages: Message[];
    tokenCount: number; // Token count for current chat

    // Files
    files: FileSystem;
    selectedFile: string | null;

    // Terminal & Preview
    terminalOutput: string[];
    previewUrl: string | null;

    // Parsed errors
    parsedErrors: ParsedError[];

    // Settings
    selectedModel: ModelType;
    isDeploying: boolean;
    theme: 'dark' | 'light';
    showTokenCounter: boolean;

    // Auth actions
    setUser: (user: User | null) => void;
    setUserTokens: (tokens: UserTokens | null) => void;

    // Chat actions
    setCurrentChatId: (id: string | null) => void;
    setMessages: (messages: Message[]) => void;
    addMessage: (message: Message) => void;
    updateLastMessage: (content: string, toolCalls?: any[], thinking?: string, thinkingDuration?: number) => void;
    setTokenCount: (count: number) => void;

    // File actions
    setFiles: (files: FileSystem) => void;
    setSelectedFile: (file: string | null) => void;

    // Terminal actions
    addTerminalOutput: (output: string) => void;
    clearTerminalOutput: () => void;

    // Error actions
    addParsedError: (error: ParsedError) => void;
    addParsedErrors: (errors: ParsedError[]) => void;
    clearParsedErrors: () => void;
    removeErrorsForFile: (file: string) => void;
    replaceAllErrors: (errors: ParsedError[]) => void;
    parseOutputForErrors: (output: string) => void;

    // Other actions
    setPreviewUrl: (url: string | null) => void;
    setIsDeploying: (isDeploying: boolean) => void;
    setSelectedModel: (model: ModelType) => void;
    setTheme: (theme: 'dark' | 'light') => void;
    setShowTokenCounter: (show: boolean) => void;
    // Chats
    chats: ChatHistory[];
    setChats: (chats: ChatHistory[]) => void;
    // System Prompt
    systemPrompt: string | null;
    setSystemPrompt: (prompt: string) => void;

    // AI Provider Settings
    aiProvider: string;
    aiApiKey: string;
    aiBaseUrl: string;
    aiModel: string;

    setAiProvider: (provider: string) => void;
    setAiApiKey: (key: string) => void;
    setAiBaseUrl: (url: string) => void;
    setAiModel: (model: string) => void;

    // Model context limit (in tokens)
    modelContextLimit: number;
    setModelContextLimit: (limit: number) => void;

    // Element picker
    elementPickerActive: boolean;
    selectedElement: { tag: string; text: string; selector: string } | null;
    setElementPickerActive: (active: boolean) => void;
    setSelectedElement: (el: { tag: string; text: string; selector: string } | null) => void;
}

export const useStore = create<AppState>((set) => ({
    // Initial state
    user: null,
    userTokens: null,
    currentChatId: null,
    messages: [],
    tokenCount: 0,
    files: {},
    selectedFile: null,
    terminalOutput: [],
    previewUrl: null,
    parsedErrors: [],
    selectedModel: 'mimo-v2-flash',
    isDeploying: false,
    theme: (localStorage.getItem('theme') as 'dark' | 'light') || 'dark',
    showTokenCounter: localStorage.getItem('showTokenCounter') === 'true',

    // Auth actions
    setUser: (user) => set({ user }),
    setUserTokens: (userTokens) => set({ userTokens }),

    // Chat actions
    setCurrentChatId: (currentChatId) => set({ currentChatId }),
    setMessages: (messages) => set({ messages }),
    addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
    updateLastMessage: (content, toolCalls, thinking, thinkingDuration) => set((state) => {
        const messages = state.messages;
        if (messages.length > 0) {
            const lastMsg = messages[messages.length - 1] as any;
            lastMsg.content = content;
            if (toolCalls) lastMsg.tool_calls = toolCalls;
            if (thinking) lastMsg.thinking = thinking;
            if (thinkingDuration !== undefined) lastMsg.thinkingDuration = thinkingDuration;
        }
        // Return new array ref to trigger re-render
        return { messages: [...messages] };
    }),
    setTokenCount: (tokenCount) => set({ tokenCount }),

    // File actions
    setFiles: (files) => set({ files }),
    setSelectedFile: (selectedFile) => set({ selectedFile }),

    // Terminal actions — optimized: mutate array in-place, only create new parsedErrors when needed
    addTerminalOutput: (output) => set((state) => {
        // Push to existing array (mutation) — avoids GC pressure from spreading
        state.terminalOutput.push(output);

        let currentErrors = state.parsedErrors;
        let errorsChanged = false;

        // Detect HMR success — remove errors for updated files
        const hmrMatch = output.match(/\[vite\]\s*hmr\s+update\s+(.+)/i);
        if (hmrMatch) {
            const files = hmrMatch[1].split(',').map(f => f.trim().replace(/^\//, ''));
            const filtered = currentErrors.filter(e => {
                if (!e.file) return true;
                const errFile = e.file.replace(/^\.\//, '').replace(/^\//, '');
                return !files.some(f => errFile === f || errFile.endsWith(f) || f.endsWith(errFile));
            });
            if (filtered.length !== currentErrors.length) {
                currentErrors = filtered;
                errorsChanged = true;
            }
        }

        // Detect successful compilation — clear vite/module/syntax errors
        if (/ready in \d+\s*ms/i.test(output) || /compiled successfully/i.test(output)) {
            const filtered = currentErrors.filter(e =>
                e.type !== 'vite' && e.type !== 'module' && e.type !== 'syntax'
            );
            if (filtered.length !== currentErrors.length) {
                currentErrors = filtered;
                errorsChanged = true;
            }
        }

        // Parse new errors
        const newErrors = parseTerminalErrors(output);
        if (newErrors.length > 0) {
            currentErrors = [...currentErrors, ...newErrors];
            errorsChanged = true;
        }

        // Return new terminalOutput ref to trigger subscribers, but reuse parsedErrors if unchanged
        return {
            terminalOutput: [...state.terminalOutput],
            ...(errorsChanged ? { parsedErrors: currentErrors } : {}),
        };
    }),
    clearTerminalOutput: () => set({ terminalOutput: [] }),

    // Error actions
    addParsedError: (error) => set((state) => ({
        parsedErrors: [...state.parsedErrors, error]
    })),
    addParsedErrors: (errors) => set((state) => ({
        parsedErrors: [...state.parsedErrors, ...errors]
    })),
    clearParsedErrors: () => set({ parsedErrors: [] }),
    removeErrorsForFile: (file) => set((state) => ({
        parsedErrors: state.parsedErrors.filter(e => {
            if (!e.file) return true;
            // Normalize paths for comparison
            const errFile = e.file.replace(/^\.\//, '').replace(/^\//, '');
            const targetFile = file.replace(/^\.\//, '').replace(/^\//, '');
            return errFile !== targetFile;
        })
    })),
    replaceAllErrors: (errors) => set({ parsedErrors: errors }),
    parseOutputForErrors: (output) => set((state) => {
        // Detect HMR success — remove errors for updated files
        // [vite] hmr update /src/App.tsx, /src/components/Sidebar.tsx
        const hmrMatch = output.match(/\[vite\]\s*hmr\s+update\s+(.+)/i);
        if (hmrMatch) {
            const files = hmrMatch[1].split(',').map(f => f.trim().replace(/^\//, ''));
            if (files.length > 0) {
                const remaining = state.parsedErrors.filter(e => {
                    if (!e.file) return true;
                    const errFile = e.file.replace(/^\.\//, '').replace(/^\//, '');
                    return !files.some(f => errFile === f || errFile.endsWith(f) || f.endsWith(errFile));
                });
                // Also parse for new errors in same output
                const newErrors = parseTerminalErrors(output);
                return { parsedErrors: [...remaining, ...newErrors] };
            }
        }

        // Detect "compiled successfully" / "ready in" — clear all vite/module errors
        if (/ready in \d+\s*ms/i.test(output) || /compiled successfully/i.test(output)) {
            const remaining = state.parsedErrors.filter(e =>
                e.type !== 'vite' && e.type !== 'module' && e.type !== 'syntax'
            );
            return { parsedErrors: remaining };
        }

        // Normal error parsing
        const newErrors = parseTerminalErrors(output);
        if (newErrors.length === 0) return state;
        return { parsedErrors: [...state.parsedErrors, ...newErrors] };
    }),

    // Other actions
    setPreviewUrl: (url) => set({ previewUrl: url }),
    setIsDeploying: (isDeploying) => set({ isDeploying }),
    setSelectedModel: (selectedModel) => set({ selectedModel }),
    setTheme: (theme) => {
        localStorage.setItem('theme', theme);
        set({ theme });
    },
    setShowTokenCounter: (showTokenCounter) => {
        localStorage.setItem('showTokenCounter', String(showTokenCounter));
        set({ showTokenCounter });
    },
    // Chats
    chats: [],
    setChats: (chats) => set({ chats }),

    // System Prompt
    systemPrompt: null,
    setSystemPrompt: (systemPrompt) => set({ systemPrompt }),

    // AI Provider Settings
    aiProvider: localStorage.getItem('aiProvider') || 'glovix',
    aiApiKey: localStorage.getItem('aiApiKey') || '',
    aiBaseUrl: localStorage.getItem('aiBaseUrl') || 'https://api.openai.com/v1',
    aiModel: localStorage.getItem('aiModel') || 'gpt-4o',

    // AI Provider Actions
    setAiProvider: (provider) => {
        localStorage.setItem('aiProvider', provider);
        set({ aiProvider: provider });
    },
    setAiApiKey: (key) => {
        localStorage.setItem('aiApiKey', key);
        set({ aiApiKey: key });
    },
    setAiBaseUrl: (url) => {
        localStorage.setItem('aiBaseUrl', url);
        set({ aiBaseUrl: url });
    },
    setAiModel: (model) => {
        localStorage.setItem('aiModel', model);
        set({ aiModel: model });
    },

    // Model Context Limit
    modelContextLimit: parseInt(localStorage.getItem('modelContextLimit') || '200000'),
    setModelContextLimit: (modelContextLimit) => {
        localStorage.setItem('modelContextLimit', String(modelContextLimit));
        set({ modelContextLimit });
    },

    // Element Picker
    elementPickerActive: false,
    selectedElement: null,
    setElementPickerActive: (elementPickerActive) => set({ elementPickerActive }),
    setSelectedElement: (selectedElement) => set({ selectedElement }),
}));
