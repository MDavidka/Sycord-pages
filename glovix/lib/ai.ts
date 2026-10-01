// LocalStorage-only AI for OpenSource version

export const CANOPYWAVE_API_URL = '/api/ai/chat';

// Model ids are supplied by Sycord at runtime. Keep the known ids in the
// autocomplete union while allowing newer models from /api/models.
export type ModelType =
    | 'mimo-v2-flash'
    | 'deepseek-v4-flash'
    | 'glm-5.2'
    | 'gemini-3.1-pro'
    | (string & {})

export const MODEL_NAMES: Record<ModelType, string> = {
    'mimo-v2-flash': 'MiMo V2 Flash',
    'deepseek-v4-flash': 'DeepSeek V4 Flash',
    'glm-5.2': 'GLM 5.2',
    'gemini-3.1-pro': 'Gemini 3.1 Pro',
};

export const MODEL_IDS: Record<ModelType, string> = {
    'mimo-v2-flash': 'xiaomi/mimo-v2-flash:free',
    'deepseek-v4-flash': 'deepseek/deepseek-v4-flash',
    'glm-5.2': 'glm-5.2',
    'gemini-3.1-pro': 'gemini-3.1-pro',
};

export interface ModelChoice {
    id: string
    label: string
    subtitle: string
    modelType: ModelType
    apiModel: string
    /** Model icon under /public/model-logos, matched by profile name */
    icon: string
    iconAlt: string
    active?: boolean
    isAiTabActive?: boolean
}

export const MODEL_CHOICES: ModelChoice[] = [
    {
        id: 'nano',
        label: 'syra-nano',
        subtitle: 'Fast',
        modelType: 'mimo-v2-flash',
        apiModel: 'gemini-2.5-flash',
        icon: 'https://svgl.app/library/gemini.svg',
        iconAlt: 'syra-nano',
    },
    {
        id: 'base',
        label: 'syra-base',
        subtitle: 'Balanced',
        modelType: 'deepseek-v4-flash',
        apiModel: 'deepseek-v4-flash',
        icon: 'https://svgl.app/library/deepseek.svg',
        iconAlt: 'syra-base',
    },
    {
        id: 'havy',
        label: 'syra-havy',
        subtitle: 'Advanced',
        modelType: 'gemini-3.1-pro',
        apiModel: 'gemini-2.5-pro',
        icon: 'https://svgl.app/library/gemini.svg',
        iconAlt: 'syra-havy',
    },
    {
        id: 'ultra',
        label: 'syra-ultra',
        subtitle: 'Ultra',
        modelType: 'glm-5.2',
        apiModel: 'glm-5.2',
        icon: '/model-logos/zai.svg',
        iconAlt: 'syra-ultra',
    },
];

export function getModelChoice(modelType: ModelType, choices: ModelChoice[] = MODEL_CHOICES): ModelChoice {
    return choices.find(c => c.modelType === modelType) ?? choices[0] ?? MODEL_CHOICES[0]
}

export type AvailableSycordModel = {
    id: string
    profile: string
    name: string
    active?: boolean
    is_active_in_ai_tab?: boolean
}

export async function fetchAvailableModelChoices(signal?: AbortSignal): Promise<ModelChoice[]> {
    const response = await fetch('/api/ai/models', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
    })

    let body: { models?: AvailableSycordModel[]; active_model?: string; message?: string } | null = null
    try {
        body = await response.json()
    } catch {
        // The status below is more useful than a JSON parse error for callers.
    }

    if (!response.ok) {
        throw new Error(body?.message || `Unable to load models (${response.status})`)
    }

    if (!Array.isArray(body?.models)) {
        throw new Error('Sycord returned an invalid model list.')
    }

    const activeModelId = body?.active_model || ""

    return body.models.map((model) => {
        // model.profile carries the actual model identifier (e.g. "glm-5.3-flash")
        // model.name carries the provider/display name (e.g. "B.ai" or "glm-5.3-flash")
        const actualModel = model.profile || model.name
        const displayName = model.name || model.profile
        const isAiTabActive = Boolean(
            model.is_active_in_ai_tab ||
            model.active ||
            (activeModelId && (actualModel === activeModelId || model.id === activeModelId))
        )
        return {
            id: model.id || actualModel,
            label: actualModel,
            subtitle: displayName,
            modelType: actualModel,
            apiModel: actualModel,
            icon: getProviderIconUrl(actualModel) || getProviderIconUrl(displayName) || '/model-logos/gemini.svg',
            iconAlt: displayName,
            active: isAiTabActive,
            isAiTabActive,
        }
    })
}

export function getProviderFromModel(model: string): string {
    const lower = model.toLowerCase().trim()
    if (lower.startsWith("gemini")) return "gemini"
    if (lower.startsWith("deepseek")) return "deepseek"
    if (lower.startsWith("glm") || lower.startsWith("z-ai/glm") || lower.startsWith("zhipu/glm")) return "zai"
    if (lower.startsWith("mimo")) return "mimo"
    if (lower.startsWith("minimax")) return "minimax"
    if (lower.startsWith("gpt") || lower.startsWith("o1") || lower.startsWith("o3") || lower.includes("openai")) return "openai"
    if (lower.startsWith("claude")) return "claude"
    if (lower.startsWith("llama")) return "llama"
    if (lower.startsWith("qwen")) return "qwen"
    if (lower.includes("@") || lower.includes("/")) return lower.split(/[\/@]/)[0]
    return lower.split("-")[0] || lower.split("_")[0] || model
}

export function getProviderIconUrl(model: string, isDark: boolean = true): string | null {
    const lower = model.toLowerCase().trim()

    // Resolve provider logo from svgl.app (https://svgl.app/library/<slug>.svg)
    // by matching the model name against regex patterns for each provider.
    const svglIconMap: Array<{ regex: RegExp; dark: string; light: string }> = [
        { regex: /^gemini|^google/i,            dark: 'https://svgl.app/library/gemini.svg',            light: 'https://svgl.app/library/gemini.svg' },
        { regex: /^deepseek/i,                   dark: 'https://svgl.app/library/deepseek.svg',           light: 'https://svgl.app/library/deepseek.svg' },
        { regex: /^(gpt|o[13])|^openai/i,        dark: 'https://svgl.app/library/openai.svg',             light: 'https://svgl.app/library/openai.svg' },
        { regex: /^claude/i,                    dark: 'https://svgl.app/library/anthropic_white.svg',    light: 'https://svgl.app/library/anthropic_black.svg' },
        { regex: /^qwen/i,                      dark: 'https://svgl.app/library/qwen_dark.svg',          light: 'https://svgl.app/library/qwen_light.svg' },
        { regex: /^grok/i,                      dark: 'https://svgl.app/library/xai_dark.svg',           light: 'https://svgl.app/library/xai_light.svg' },
    ]

    for (const { regex, dark, light } of svglIconMap) {
        if (regex.test(lower)) return isDark ? dark : light
    }

    // Fallback to vendored local icons for providers without svgl.app counterparts.
    const provider = getProviderFromModel(model)
    const localIcons: Record<string, string> = {
        minimax: '/model-logos/minimax.svg',
        zai: '/model-logos/zai.svg',
        glm: '/model-logos/zai.svg',
        mimo: '/model-logos/nano.svg',
    }
    return localIcons[provider] || null
}

export interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
    /** Durable Syte agent session that produced this saved assistant message. */
    agentSession?: number;
    /** Highest durable Syte activity event included in this response. */
    agentEventId?: number;
    /** Turso session UUID — poll /api/agent_session/{id} to reload prior activity. */
    tursoSessionId?: string;
    /** True once the durable session has been fully replayed, even if it used no tools. */
    agentTimelineLoaded?: boolean;
    /** Client timestamp for message footer (HH:MM + copy). */
    createdAt?: number;
    /** Normalized execution feed saved with the assistant turn for durable history. */
    agentActions?: Array<{
        id: string;
        toolName: string;
        displayName: string;
        status: 'pending' | 'running' | 'done' | 'error';
        result?: string;
        args?: unknown;
        eventId?: number;
        toolCallId?: string;
        startedAt?: number;
        completedAt?: number;
        screenshots?: Array<{
            id?: string;
            viewport?: string;
            route?: string;
            imageUrl?: string;
            imageBase64?: string;
        }>;
    }>;
}

export interface ToolCall {
    id: string;
    type: 'function';
    function: {
        name: string;
        arguments: string;
    };
}

// Re-export tool definitions from tools.ts
import { TOOL_DEFINITIONS } from './tools';
export { TOOL_DEFINITIONS as TOOLS } from './tools';

export interface SendMessageOptions {
    userId?: string;
    email?: string;
    enableThinking?: boolean;
}

export interface TokenUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

import { useStore } from '../store';

// ============================================================
// CONFIGURATION
// ============================================================

const STREAM_TIMEOUT_MS = 120000;      // 120s max silence before considering stream dead (handles deep thinking models)
const MAX_RETRIES = 4;                 // Retry failed API calls (429 rate limits need extra attempts)
const RETRY_DELAY_MS = 2000;           // Base wait between retries
const RETRY_429_DELAY_MS = 5000;       // Longer backoff for Vertex rate limits

// ============================================================
// HELPERS
// ============================================================

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimitError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes('429') ||
        lower.includes('resource_exhausted') ||
        lower.includes('resource exhausted') ||
        lower.includes('too many requests') ||
        lower.includes('rate limit') ||
        lower.includes('quota')
    );
}

function isRetryableAiError(message: string): boolean {
    const lower = message.toLowerCase();
    return (
        lower.includes('timeout') ||
        lower.includes('network') ||
        lower.includes('fetch') ||
        lower.includes('500') ||
        lower.includes('502') ||
        lower.includes('503') ||
        lower.includes('529') ||
        lower.includes('stream stalled') ||
        isRateLimitError(message)
    );
}

// Sanitize messages before sending to API — remove invalid/broken messages
function sanitizeMessages(messages: Message[]): Message[] {
    return messages.filter(msg => {
        // Must have a role
        if (!msg.role) return false;

        // System messages just need content
        if (msg.role === 'system') return !!msg.content;

        // Tool messages need tool_call_id
        if (msg.role === 'tool') {
            return !!msg.tool_call_id;
        }

        // Assistant messages: keep if has content OR tool_calls
        // Note: content can be '' (empty string) or null — both are valid for assistants
        if (msg.role === 'assistant') {
            const hasContent = msg.content !== undefined;
            const hasToolCalls = msg.tool_calls && msg.tool_calls.length > 0;
            return hasContent || hasToolCalls;
        }

        // User messages need non-empty content
        if (msg.role === 'user') {
            if (msg.content === undefined || msg.content === null) return false;
            if (typeof msg.content === 'string') return msg.content.length > 0;
            if (Array.isArray(msg.content)) return msg.content.length > 0;
            return false;
        }

        return false;
    }).map(msg => {
        // Clean message — only include fields the API expects
        const clean: any = { role: msg.role };

        if (msg.content !== undefined && msg.content !== null) {
            clean.content = msg.content;
        } else if (msg.role === 'assistant') {
            // Assistants can have null content when they only have tool_calls
            clean.content = null;
        } else if (msg.role === 'tool') {
            // Tool messages should always have content (even empty string)
            clean.content = msg.content ?? '';
        }

        if (msg.tool_calls && msg.tool_calls.length > 0) clean.tool_calls = msg.tool_calls;
        if (msg.tool_call_id) clean.tool_call_id = msg.tool_call_id;
        if (msg.name) clean.name = msg.name;

        return clean as Message;
    });
}

/**
 * Extracts tool calls from model text output when native function calling deltas
 * are omitted or formatted into markdown/XML by external providers.
 */
export function extractTextToolCalls(text: string): ToolCall[] {
    if (!text || typeof text !== 'string') return [];
    const calls: ToolCall[] = [];

    const normalizeName = (rawName: string): string => {
        const n = (rawName || '').trim();
        const clean = n.replace(/^syte_/, '');
        if (clean === 'write_file' || clean === 'writeFile') return 'createFile';
        if (clean === 'create_file') return 'createFile';
        if (clean === 'edit_file') return 'editFile';
        if (clean === 'read_file') return 'readFile';
        if (clean === 'run_command' || clean === 'execute_command' || clean === 'bash') return 'runCommand';
        if (clean === 'create_plan' || clean === 'update_plan_step' || clean === 'plan') return 'planning';
        return clean || n;
    };

    let idx = 1;

    // 1. XML tags: <tool_call> ... </tool_call> or <function_call> ... </function_call>
    const xmlRegex = /<(?:tool_call|function_call)>\s*([\s\S]*?)\s*<\/(?:tool_call|function_call)>/gi;
    let match: RegExpExecArray | null;
    while ((match = xmlRegex.exec(text)) !== null) {
        try {
            const rawBody = match[1].trim();
            const data = JSON.parse(rawBody);
            const name = normalizeName(data.name || data.tool || data.function || '');
            const args = data.arguments ?? data.parameters ?? data.args ?? {};
            if (name) {
                calls.push({
                    id: `call_text_xml_${idx++}`,
                    type: 'function',
                    function: {
                        name,
                        arguments: typeof args === 'string' ? args : JSON.stringify(args),
                    },
                });
            }
        } catch { /* ignore invalid json */ }
    }

    if (calls.length > 0) return calls;

    // 2. Special tokens: <|tool_call_begin|> ... <|tool_call_end|>
    const specialTokenRegex = /<\|tool_call_begin\|>\s*([\s\S]*?)\s*<\|tool_call_end\|>/gi;
    while ((match = specialTokenRegex.exec(text)) !== null) {
        try {
            const data = JSON.parse(match[1].trim());
            const name = normalizeName(data.name || data.tool || '');
            const args = data.arguments ?? data.parameters ?? {};
            if (name) {
                calls.push({
                    id: `call_token_${idx++}`,
                    type: 'function',
                    function: {
                        name,
                        arguments: typeof args === 'string' ? args : JSON.stringify(args),
                    },
                });
            }
        } catch { /* ignore */ }
    }

    if (calls.length > 0) return calls;

    // 3. Claude/Anthropic style: <invoke name="..."> <parameter name="...">...</parameter> </invoke>
    const invokeRegex = /<invoke\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/invoke>/gi;
    while ((match = invokeRegex.exec(text)) !== null) {
        const name = normalizeName(match[1]);
        const body = match[2];
        const paramRegex = /<parameter\s+name=["']([^"']+)["'][^>]*>([\s\S]*?)<\/parameter>/gi;
        let paramMatch: RegExpExecArray | null;
        const argsObj: Record<string, any> = {};
        while ((paramMatch = paramRegex.exec(body)) !== null) {
            argsObj[paramMatch[1]] = paramMatch[2].trim();
        }
        if (name) {
            calls.push({
                id: `call_invoke_${idx++}`,
                type: 'function',
                function: {
                    name,
                    arguments: JSON.stringify(argsObj),
                },
            });
        }
    }

    if (calls.length > 0) return calls;

    // 4. Markdown code blocks: ```json or ```tool_call with {"name": "...", "arguments": ...}
    const blockRegex = /```(?:json|tool_call)?\s*(\{\s*["'](?:name|tool)["'][\s\S]*?\})\s*```/gi;
    while ((match = blockRegex.exec(text)) !== null) {
        try {
            const data = JSON.parse(match[1].trim());
            const name = normalizeName(data.name || data.tool || '');
            const args = data.arguments ?? data.parameters ?? data.args ?? {};
            if (name) {
                calls.push({
                    id: `call_block_${idx++}`,
                    type: 'function',
                    function: {
                        name,
                        arguments: typeof args === 'string' ? args : JSON.stringify(args),
                    },
                });
            }
        } catch { /* ignore */ }
    }

    return calls;
}

/**
 * Strips raw tool call tags from assistant reply text for clean display in chat UI.
 */
export function stripToolCallMarkup(text: string): string {
    if (!text || typeof text !== 'string') return '';
    return text
        .replace(/<\|tool_calls_section_begin\|>[\s\S]*?(?:<\|tool_calls_section_end\|>|$)/gi, '')
        .replace(/<\|tool_call_begin\|>[\s\S]*?(?:<\|tool_call_end\|>|$)/gi, '')
        .replace(/<(?:tool_call|function_call)>[\s\S]*?<\/(?:tool_call|function_call)>/gi, '')
        .replace(/<invoke\s+name=[^>]*>[\s\S]*?<\/invoke>/gi, '')
        .replace(/```(?:json|tool_call)?\s*\{\s*["'](?:name|tool)["'][\s\S]*?\}\s*```/gi, '')
        .trim();
}

// ============================================================
// MAIN SEND MESSAGE FUNCTION
// ============================================================

export async function sendMessage(
    messages: Message[],
    _model: ModelType,
    _apiKey: string,
    onChunk: (content: string | null, toolCalls: ToolCall[] | null, thinking?: string | null) => void,
    signal?: AbortSignal,
    onToolCallStream?: (toolName: string, partialArgs: string, toolCallId: string) => void
): Promise<TokenUsage> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            if (signal?.aborted) throw new Error('Aborted');

            if (attempt > 0) {
                console.log(`[AI] Retry attempt ${attempt}/${MAX_RETRIES}...`);
                const delay = isRateLimitError(lastError?.message || '')
                    ? RETRY_429_DELAY_MS * attempt
                    : RETRY_DELAY_MS * attempt;
                await sleep(delay);
            }

            return await _sendMessageInternal(messages, _model, onChunk, signal, onToolCallStream);
        } catch (error: any) {
            lastError = error;
            console.error(`[AI] Error on attempt ${attempt}:`, error.message);

            // Don't retry on abort or auth errors
            if (signal?.aborted) throw error;
            if (error.message?.includes('401') || error.message?.includes('403')) throw error;
            if (error.message?.includes('Missing API Key')) throw error;
            if (error.message?.includes('Aborted') || error.name === 'AbortError') throw error;

            const isRetryable = isRetryableAiError(error.message || '');

            if (!isRetryable || attempt >= MAX_RETRIES) {
                if (isRateLimitError(error.message || '')) {
                    // Prefer the upstream message when it already includes Retry-After guidance.
                    if (/please wait \d+ second/i.test(error.message || '')) {
                        throw error;
                    }
                    throw new Error(
                        'AI rate limit reached. Please wait a moment and try again, or switch to a different model in Settings.'
                    );
                }
                throw error;
            }

            console.warn(`[AI] Retryable error: ${error.message}`);
        }
    }

    throw lastError || new Error('Unknown error in sendMessage');
}

async function _sendMessageInternal(
    messages: Message[],
    model: ModelType,
    onChunk: (content: string | null, toolCalls: ToolCall[] | null, thinking?: string | null) => void,
    signal?: AbortSignal,
    onToolCallStream?: (toolName: string, partialArgs: string, toolCallId: string) => void
): Promise<TokenUsage> {
    const { aiModel } = useStore.getState();

    const apiUrl = '/api/ai/chat';
    // Auth is session-based on /api/ai/chat. Never read AI secrets from
    // NEXT_PUBLIC_* — those would ship in the client bundle.
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Resolve the actual model to send to the provider. The `model` parameter
    // (selectedModel forwarded through sendMessage from the UI) is authoritative.
    // For built-in model types, map to the provider API model id via MODEL_CHOICES.
    // Dynamic Sycord model types (type === apiModel) are used directly.
    // Fall back to the store's aiModel, then 'gpt-4'. We intentionally do NOT
    // consult NEXT_PUBLIC_AI_MODEL — that env var would always override the
    // user's explicit model selection.
    const mappedChoice = getModelChoice(model);
    const actualModelId = (mappedChoice.modelType === model ? mappedChoice.apiModel : model) || aiModel || 'gpt-4';

    // Model context limits (approximate input token windows)
    const MODEL_CONTEXT_LIMITS: Record<string, number> = {
        // Gemini 2.5 family — 1M context
        'gemini-2.5-flash': 1000000,
        'gemini-2.5-flash-preview': 1000000,
        'gemini-2.5-pro': 1000000,
        'gemini-2.5-pro-preview': 1000000,
        // Gemini 3.x (legacy naming kept for compatibility)
        'gemini-3.5-flash': 1000000,
        'gemini-3.1-pro': 1000000,
        'gemini-3.0-pro': 1000000,
        // Gemini 2.0
        'gemini-2.0-flash': 1000000,
        'gemini-2.0-flash-lite': 1000000,
        // DeepSeek
        'deepseek-chat': 128000,
        'deepseek-reasoner': 128000,
        'deepseek-v4-flash': 128000,
        'deepseek/deepseek-v4-flash': 128000,
        // GLM 5.2 — 1M context
        'glm-5.2': 1000000,
        'glm-5.2[1m]': 1000000,
        'z-ai/glm-5.2': 1000000,
        // MiniMax M3 — 1M context (legacy ids still accepted by the chat bridge)
        'minimax-m3': 1000000,
        'MiniMax-M3': 1000000,
        'minimax/minimax-m3': 1000000,
        // MiMo
        'mimo-v2-flash': 128000,
        'xiaomi/mimo-v2-flash:free': 128000,
        // OpenAI (for custom key users)
        'gpt-4o': 128000,
        'gpt-4-turbo': 128000,
        'gpt-4o-mini': 128000,
        // Anthropic
        'claude-3-opus': 200000,
        'claude-3-sonnet': 200000,
        'claude-3.5-sonnet': 200000,
        'claude-4-sonnet': 200000,
    };

    // Sanitize messages before sending
    const cleanMessages = sanitizeMessages(messages);

    console.log(`[AI] Sending ${cleanMessages.length} messages (from ${messages.length} original)`);

    // Estimate input tokens
    const inputTokens = cleanMessages.reduce((acc, msg) => {
        if (typeof msg.content === 'string') return acc + estimateTokens(msg.content);
        if (Array.isArray(msg.content)) {
            return acc + msg.content.reduce((a, p) => a + (p.type === 'text' ? estimateTokens(p.text) : 1000), 0);
        }
        return acc + 100;
    }, 0);

    // Calculate max_tokens dynamically — allow up to 32 768 output tokens so
    // Syra can produce large, complete files without hitting the output cap.
    const contextLimit = MODEL_CONTEXT_LIMITS[actualModelId] || useStore.getState().modelContextLimit || 128000;
    const safetyBuffer = 2000;
    const maxTokens = Math.min(
        Math.max(contextLimit - inputTokens - safetyBuffer, 4000),
        32768
    );

    console.log(`[AI] Model: ${actualModelId}, Input: ~${inputTokens} tokens, Max output: ${maxTokens}`);

    // Read user effort / thinking level (fast = low / 0 thinking, extra_high = think more)
    const savedEffort = typeof window !== "undefined" ? localStorage.getItem("syra_effort_level") : null;
    const effectiveEffort = savedEffort || "extra_high";

    // Build request body
    const requestBody: any = {
        model: actualModelId,
        messages: cleanMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        stream: true,
        max_tokens: maxTokens,
        thinking_level: effectiveEffort,
        reasoning_effort: effectiveEffort === 'low' ? 'low' : effectiveEffort === 'medium' ? 'medium' : 'high',
    };

    // Create abort controller that combines user signal + our timeout
    const controller = new AbortController();
    const clearRunState = () => {
        // Stall/abort safety net: reset the stop button if Chat's finally is
        // delayed. Ownership-aware endRun in Chat prevents clobbering a newer run.
        useStore.getState().setIsRunning(false);
        useStore.getState().setAbortCurrentRun(null);
    };
    if (signal) {
        signal.addEventListener('abort', () => {
            controller.abort();
            // Clear immediately so the stop button never stays stuck if the
            // outer agentic loop fails to reach its finally block.
            clearRunState();
        }, { once: true });
    }

    let response: Response;
    try {
        response = await fetch(apiUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
    } catch (fetchError: any) {
        if (signal?.aborted || controller.signal.aborted) {
            clearRunState();
            throw new Error('Aborted');
        }
        console.error('[AI] Fetch failed:', fetchError.message);
        throw new Error(`Network error: ${fetchError.message}. Check your internet connection and API endpoint.`);
    }

    if (!response.ok) {
        if (response.status === 404 && apiUrl.includes('/api/ai/chat')) {
            throw new Error("Backend Not Found (404). Configure a Custom AI Provider in Settings → AI.");
        }
        const error = await response.text().catch(() => 'Unknown error');
        console.error(`[AI] API Error ${response.status}:`, error.substring(0, 300));
        if (response.status === 429) {
            const retryAfterRaw = response.headers.get('Retry-After');
            const retryAfterSec = Math.max(1, Number.parseInt(retryAfterRaw || '60', 10) || 60);
            throw new Error(
                `429 RATE_LIMITED: Too many AI requests. Please wait ${retryAfterSec} second${retryAfterSec === 1 ? '' : 's'} and try again.`
            );
        }
        throw new Error(`API Error: ${response.status} - ${error.substring(0, 500)}`);
    }

    if (!response.body) {
        throw new Error('No response body');
    }

    // ============================================================
    // ROBUST SSE STREAM PROCESSOR — remade from scratch
    // ============================================================

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    const currentToolCalls: Record<number, ToolCall> = {};
    let buffer = '';
    let thinkingContent = '';
    let accumulatedContent = '';
    let totalOutputChars = 0;
    let usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let lastDataTime = Date.now();
    let toolCallsSent = false;

    // 180s stall timeout — handles long reasoning / thinking models (deepseek-r1, gemini thinking)
    const EFFECTIVE_STREAM_TIMEOUT_MS = 180000;
    const stallChecker = setInterval(() => {
        if (Date.now() - lastDataTime > EFFECTIVE_STREAM_TIMEOUT_MS) {
            console.warn(`[AI] Stream stalled for ${EFFECTIVE_STREAM_TIMEOUT_MS / 1000}s, aborting...`);
            clearInterval(stallChecker);
            clearRunState();
            controller.abort();
        }
    }, 5000);

    const processSseBlock = (block: string) => {
        const lines = block.split(/\r?\n/);
        let dataPayload = '';
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith(':')) {
                // Heartbeat / comment line — keeps stream alive
                lastDataTime = Date.now();
                continue;
            }
            if (trimmed.startsWith('data:')) {
                // Strip "data:" and any single optional leading space per W3C SSE standard
                const content = trimmed.slice(5).replace(/^\s/, '');
                dataPayload += (dataPayload ? '\n' : '') + content;
            }
        }

        if (!dataPayload || dataPayload === '[DONE]') {
            return;
        }

        try {
            const parsed = JSON.parse(dataPayload);
            if (!parsed.choices || parsed.choices.length === 0) {
                if (parsed.usage) {
                    usage = {
                        prompt_tokens: parsed.usage.prompt_tokens || 0,
                        completion_tokens: parsed.usage.completion_tokens || 0,
                        total_tokens: parsed.usage.total_tokens || 0,
                    };
                }
                return;
            }

            const choice = parsed.choices[0];
            const delta = choice.delta;
            const finishReason = choice.finish_reason;

            // 1. Thinking / reasoning delta
            const thinkingDelta = delta?.thinking || delta?.reasoning_content || delta?.reasoning;
            if (thinkingDelta) {
                thinkingContent += thinkingDelta;
                onChunk(null, null, thinkingContent);
            }

            // 2. Text content delta
            if (delta?.content) {
                accumulatedContent += delta.content;
                totalOutputChars += delta.content.length;
                onChunk(delta.content, null, null);
            }

            // 3. Usage tokens if provided
            if (parsed.usage) {
                usage = {
                    prompt_tokens: parsed.usage.prompt_tokens || 0,
                    completion_tokens: parsed.usage.completion_tokens || 0,
                    total_tokens: parsed.usage.total_tokens || 0,
                };
            }

            // 4. Tool calls streaming
            if (delta?.tool_calls && Array.isArray(delta.tool_calls)) {
                for (const tc of delta.tool_calls) {
                    const index = typeof tc.index === 'number' ? tc.index : Object.keys(currentToolCalls).length;
                    if (!currentToolCalls[index]) {
                        currentToolCalls[index] = {
                            id: tc.id || `tool_${index}_${Date.now()}`,
                            type: 'function',
                            function: { name: tc.function?.name || '', arguments: '' },
                        };
                    }

                    if (tc.id && !currentToolCalls[index].id) {
                        currentToolCalls[index].id = tc.id;
                    }

                    if (tc.function?.name && !currentToolCalls[index].function.name) {
                        currentToolCalls[index].function.name = tc.function.name;
                    }

                    if (tc.function?.arguments) {
                        currentToolCalls[index].function.arguments += tc.function.arguments;
                    }

                    if (onToolCallStream) {
                        onToolCallStream(
                            currentToolCalls[index].function.name || '',
                            currentToolCalls[index].function.arguments || '',
                            currentToolCalls[index].id
                        );
                    }
                }
            }

            // 5. Emit tool calls on finish
            if (finishReason === 'tool_calls') {
                const finalToolCalls = Object.values(currentToolCalls).filter(t => t.function.name);
                if (finalToolCalls.length > 0) {
                    console.log(`[AI] Emitting ${finalToolCalls.length} tool calls on finish_reason: tool_calls`);
                    onChunk(null, finalToolCalls, null);
                    toolCallsSent = true;
                }
            }
        } catch (err) {
            // Malformed chunk warning
            if (dataPayload.length < 200) {
                console.warn('[AI] SSE JSON parse warning:', dataPayload);
            }
        }
    };

    try {
        while (true) {
            let done = false;
            let value: Uint8Array | undefined;
            try {
                ({ done, value } = await reader.read());
            } catch (readError: any) {
                if (signal?.aborted || controller.signal.aborted) {
                    clearRunState();
                    throw new Error('Aborted');
                }
                throw readError;
            }

            if (done) break;
            if (!value) continue;

            lastDataTime = Date.now();
            buffer += decoder.decode(value, { stream: true });

            // Standard SSE event boundary: double newline
            let separator = /\r?\n\r?\n/.exec(buffer);
            while (separator && separator.index >= 0) {
                const block = buffer.slice(0, separator.index);
                buffer = buffer.slice(separator.index + separator[0].length);
                if (block.trim()) {
                    processSseBlock(block);
                }
                separator = /\r?\n\r?\n/.exec(buffer);
            }
        }

        // Process any trailing bytes if provider closed connection without trailing double-newline
        if (buffer.trim()) {
            processSseBlock(buffer);
            buffer = '';
        }

        // Post-stream tool call flush:
        if (!toolCallsSent) {
            const accumulatedCalls = Object.values(currentToolCalls).filter(t => t.function.name);
            if (accumulatedCalls.length > 0) {
                console.log(`[AI] Emitting ${accumulatedCalls.length} tool calls (post-stream)`);
                onChunk(null, accumulatedCalls, null);
                toolCallsSent = true;
            } else {
                // Check if model generated tool calls as raw text
                const textToolCalls = extractTextToolCalls(accumulatedContent);
                if (textToolCalls.length > 0) {
                    console.log(`[AI] Extracted and emitting ${textToolCalls.length} tool calls from text response`);
                    onChunk(null, textToolCalls, null);
                    toolCallsSent = true;
                }
            }
        }

        // Estimate token usage if not provided
        if (usage.total_tokens === 0) {
            const estimatedOutput = Math.ceil(totalOutputChars / 4);
            usage = {
                prompt_tokens: inputTokens,
                completion_tokens: estimatedOutput,
                total_tokens: inputTokens + estimatedOutput,
            };
        }

        console.log(`[AI] Done. Usage: ${usage.prompt_tokens} in + ${usage.completion_tokens} out = ${usage.total_tokens} total`);
        return usage;
    } finally {
        clearInterval(stallChecker);
        try { reader.releaseLock(); } catch { /* ignore */ }
    }
}
