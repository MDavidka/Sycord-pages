// LocalStorage-only AI for OpenSource version

export const CANOPYWAVE_API_URL = '/api/ai/chat';

export type ModelType = 'mimo-v2-flash';

export const MODEL_NAMES: Record<ModelType, string> = {
    'mimo-v2-flash': 'MiMo V2 Flash',
};

export const MODEL_IDS: Record<ModelType, string> = {
    'mimo-v2-flash': 'xiaomi/mimo-v2-flash:free',
};

export interface Message {
    role: 'user' | 'assistant' | 'system' | 'tool';
    content: string | null | Array<{ type: 'text'; text: string } | { type: 'image_url'; image_url: { url: string } }>;
    tool_calls?: ToolCall[];
    tool_call_id?: string;
    name?: string;
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

const STREAM_TIMEOUT_MS = 60000;       // 60s max silence before considering stream dead
const MAX_RETRIES = 2;                 // Retry failed API calls up to 2 times
const RETRY_DELAY_MS = 2000;           // Wait 2s between retries

// ============================================================
// HELPERS
// ============================================================

function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
                await sleep(RETRY_DELAY_MS * attempt);
            }

            return await _sendMessageInternal(messages, onChunk, signal, onToolCallStream);
        } catch (error: any) {
            lastError = error;
            console.error(`[AI] Error on attempt ${attempt}:`, error.message);

            // Don't retry on abort or auth errors
            if (signal?.aborted) throw error;
            if (error.message?.includes('401') || error.message?.includes('403')) throw error;
            if (error.message?.includes('Missing API Key')) throw error;
            if (error.message?.includes('Aborted')) throw error;

            // Retry on network/timeout/5xx errors
            const isRetryable = (
                error.message?.includes('timeout') ||
                error.message?.includes('network') ||
                error.message?.includes('fetch') ||
                error.message?.includes('500') ||
                error.message?.includes('502') ||
                error.message?.includes('503') ||
                error.message?.includes('529') ||
                error.message?.includes('Stream stalled')
            );

            if (!isRetryable || attempt >= MAX_RETRIES) {
                throw error;
            }

            console.warn(`[AI] Retryable error: ${error.message}`);
        }
    }

    throw lastError || new Error('Unknown error in sendMessage');
}

async function _sendMessageInternal(
    messages: Message[],
    onChunk: (content: string | null, toolCalls: ToolCall[] | null, thinking?: string | null) => void,
    signal?: AbortSignal,
    onToolCallStream?: (toolName: string, partialArgs: string, toolCallId: string) => void
): Promise<TokenUsage> {
    const { aiApiKey, aiModel } = useStore.getState();

    const apiUrl = '/api/ai/chat';
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
    };

    // Get API key from env or settings
    const envKey = process.env.NEXT_PUBLIC_AI_API_KEY;
    const apiKeyToUse = (envKey && envKey !== 'your_api_key_here') ? envKey : aiApiKey;

    // Auth is handled server-side by the Gemini Vertex bridge (/api/ai/chat).
    // Only forward an Authorization header if the user explicitly configured a
    // provider key in Settings / env; it is otherwise optional.
    if (apiKeyToUse) {
        headers['Authorization'] = `Bearer ${apiKeyToUse}`;
    }

    // Use env model or fallback
    const actualModelId = process.env.NEXT_PUBLIC_AI_MODEL || aiModel || 'gpt-4';

    // Model context limits (approximate)
    const MODEL_CONTEXT_LIMITS: Record<string, number> = {
        'mimo-v2-flash': 128000,
        'gpt-4o': 128000,
        'gpt-4-turbo': 128000,
        'gpt-4o-mini': 128000,
        'claude-3-opus': 200000,
        'claude-3-sonnet': 200000,
        'claude-3.5-sonnet': 200000,
        'claude-4-sonnet': 200000,
        'deepseek-chat': 128000,
        'deepseek-reasoner': 128000,
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

    // Calculate max_tokens dynamically
    const contextLimit = MODEL_CONTEXT_LIMITS[actualModelId] || useStore.getState().modelContextLimit || 128000;
    const safetyBuffer = 1000;
    const maxTokens = Math.min(
        Math.max(contextLimit - inputTokens - safetyBuffer, 4000),
        16384
    );

    console.log(`[AI] Model: ${actualModelId}, Input: ~${inputTokens} tokens, Max output: ${maxTokens}`);

    // Build request body
    const requestBody: any = {
        model: actualModelId,
        messages: cleanMessages,
        tools: TOOL_DEFINITIONS,
        tool_choice: 'auto',
        stream: true,
        max_tokens: maxTokens,
    };

    // Create abort controller that combines user signal + our timeout
    const controller = new AbortController();
    if (signal) {
        signal.addEventListener('abort', () => controller.abort());
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
        console.error('[AI] Fetch failed:', fetchError.message);
        throw new Error(`Network error: ${fetchError.message}. Check your internet connection and API endpoint.`);
    }

    if (!response.ok) {
        if (response.status === 404 && apiUrl.includes('/api/ai/chat')) {
            throw new Error("Backend Not Found (404). Configure a Custom AI Provider in Settings → AI.");
        }
        const error = await response.text().catch(() => 'Unknown error');
        console.error(`[AI] API Error ${response.status}:`, error.substring(0, 300));
        throw new Error(`API Error: ${response.status} - ${error.substring(0, 500)}`);
    }

    if (!response.body) {
        throw new Error('No response body');
    }

    // ============================================================
    // STREAM PROCESSING — inline for simplicity and reliability
    // ============================================================

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    let currentToolCalls: Record<number, ToolCall> = {};
    let buffer = '';
    let thinkingContent = '';
    let totalOutputChars = 0;
    let usage: TokenUsage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    let lastDataTime = Date.now();
    let toolCallsSent = false;

    // Stall detection timer
    const stallChecker = setInterval(() => {
        if (Date.now() - lastDataTime > STREAM_TIMEOUT_MS) {
            console.warn(`[AI] Stream stalled for ${STREAM_TIMEOUT_MS / 1000}s, aborting...`);
            clearInterval(stallChecker);
            controller.abort();
        }
    }, 5000);

    try {
        while (true) {
            const { done, value } = await reader.read();

            if (done) break;

            lastDataTime = Date.now();
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                try {
                    const parsed = JSON.parse(data);
                    if (!parsed.choices || parsed.choices.length === 0) continue;

                    const choice = parsed.choices[0];
                    const delta = choice.delta;
                    const finishReason = choice.finish_reason;

                    // Handle thinking/reasoning
                    const thinkingDelta = delta?.thinking || delta?.reasoning_content || delta?.reasoning;
                    if (thinkingDelta) {
                        thinkingContent += thinkingDelta;
                        onChunk(null, null, thinkingContent);
                    }

                    // Handle content
                    if (delta?.content) {
                        totalOutputChars += delta.content.length;
                        onChunk(delta.content, null, null);
                    }

                    // Capture usage
                    if (parsed.usage) {
                        usage = {
                            prompt_tokens: parsed.usage.prompt_tokens || 0,
                            completion_tokens: parsed.usage.completion_tokens || 0,
                            total_tokens: parsed.usage.total_tokens || 0
                        };
                    }

                    // Handle tool calls streaming
                    if (delta?.tool_calls) {
                        for (const tc of delta.tool_calls) {
                            const index = tc.index ?? 0;
                            if (!currentToolCalls[index]) {
                                currentToolCalls[index] = {
                                    id: tc.id || `tool_${index}_${Date.now()}`,
                                    type: 'function',
                                    function: { name: tc.function?.name || '', arguments: '' },
                                };
                            }

                            if (tc.function?.name && !currentToolCalls[index].function.name) {
                                currentToolCalls[index].function.name = tc.function.name;
                            }

                            if (tc.function?.arguments) {
                                currentToolCalls[index].function.arguments += tc.function.arguments;
                            }

                            // Stream tool call progress to UI
                            if (onToolCallStream) {
                                onToolCallStream(
                                    currentToolCalls[index].function.name || '',
                                    currentToolCalls[index].function.arguments || '',
                                    currentToolCalls[index].id
                                );
                            }
                        }
                    }

                    // When stream finishes with tool_calls, send them
                    if (finishReason === 'tool_calls') {
                        const finalToolCalls = Object.values(currentToolCalls);
                        if (finalToolCalls.length > 0) {
                            console.log(`[AI] Sending ${finalToolCalls.length} tool calls`);
                            onChunk(null, finalToolCalls);
                            toolCallsSent = true;
                            // Clear after sending
                            currentToolCalls = {};
                        }
                    }

                    if (finishReason) {
                        console.log(`[AI] Stream finished: ${finishReason}`);
                    }
                } catch (e) {
                    // JSON parse error on a chunk — skip it
                    if (data.trim()) {
                        console.warn('[AI] Parse error on chunk:', data.substring(0, 100));
                    }
                }
            }
        }

        // After stream ends, send any remaining tool calls that weren't sent yet
        if (!toolCallsSent) {
            const remainingToolCalls = Object.values(currentToolCalls);
            if (remainingToolCalls.length > 0) {
                console.log(`[AI] Sending ${remainingToolCalls.length} remaining tool calls (post-stream)`);
                onChunk(null, remainingToolCalls);
            }
        }

        // Estimate usage if API didn't provide it
        if (usage.total_tokens === 0) {
            const estimatedOutput = Math.ceil(totalOutputChars / 4);
            usage = {
                prompt_tokens: inputTokens,
                completion_tokens: estimatedOutput,
                total_tokens: inputTokens + estimatedOutput
            };
        }

        console.log(`[AI] Done. Usage: ${usage.prompt_tokens} in + ${usage.completion_tokens} out = ${usage.total_tokens} total`);
        return usage;

    } finally {
        clearInterval(stallChecker);
        try { reader.releaseLock(); } catch { /* ignore */ }
    }
}
