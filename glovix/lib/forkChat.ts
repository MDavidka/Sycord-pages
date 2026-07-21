// Fork Chat — creates a new chat with compressed context from the current one
// Uses the same AI to summarize conversation history into .glovix/context.md

import { useStore } from '../store';
import { createChat, saveProject } from './api';

const SUMMARIZE_PROMPT = `You are a context compression assistant. Your job is to summarize a conversation between a user and an AI developer into a compact context document.

Rules:
- Write in the SAME LANGUAGE as the conversation (Russian → Russian, English → English)
- Be extremely concise — this will be injected into a new chat as context
- Focus on WHAT was built, WHAT decisions were made, WHAT problems were solved
- Include current project state: tech stack, key files, architecture decisions
- Do NOT include code — just describe what each file/component does
- Do NOT include greetings, pleasantries, or meta-commentary
- Maximum 800 words

Output format:
## Project
[1-2 sentence description]

## Tech Stack
[List of technologies used]

## What Was Built
[List of features/components created]

## Key Decisions
[Important architectural or design decisions]

## Current State
[What works, what's in progress, any known issues]

## User Preferences
[Any specific preferences the user expressed about design, behavior, etc.]

Now summarize this conversation:`;

// Extract text content from messages for summarization
function extractConversationText(messages: any[]): string {
    const parts: string[] = [];
    
    for (const msg of messages) {
        if (msg.role === 'system') continue; // Skip system prompts
        if (msg.role === 'tool') continue; // Skip tool results (too verbose)
        
        const role = msg.role === 'user' ? 'User' : 'AI';
        let text = '';
        
        if (typeof msg.content === 'string') {
            text = msg.content;
        } else if (Array.isArray(msg.content)) {
            text = msg.content
                .filter((p: any) => p.type === 'text')
                .map((p: any) => p.text)
                .join('\n');
        }
        
        if (!text || text.length < 3) continue;
        
        // Truncate very long messages (like full file contents)
        if (text.length > 500) {
            text = text.slice(0, 500) + '... [truncated]';
        }
        
        // For assistant messages with tool_calls, note what tools were used
        if (msg.role === 'assistant' && msg.tool_calls?.length > 0) {
            const tools = msg.tool_calls.map((tc: any) => {
                const name = tc.function?.name || 'unknown';
                try {
                    const args = JSON.parse(tc.function?.arguments || '{}');
                    if (args.path) return `${name}(${args.path})`;
                    if (args.command) return `${name}(${args.command})`;
                    return name;
                } catch {
                    return name;
                }
            }).join(', ');
            text = text ? `${text}\n[Tools: ${tools}]` : `[Tools: ${tools}]`;
        }
        
        parts.push(`${role}: ${text}`);
    }
    
    // Limit total size to ~4000 chars to fit in a single AI call
    let result = parts.join('\n\n');
    if (result.length > 4000) {
        // Keep first 1000 and last 3000 chars (recent context is more important)
        result = result.slice(0, 1000) + '\n\n[... middle of conversation omitted ...]\n\n' + result.slice(-3000);
    }
    
    return result;
}

// Generate context summary using AI
async function generateContextSummary(conversationText: string): Promise<string> {
    const { aiModel } = useStore.getState();
    const actualModelId = process.env.NEXT_PUBLIC_AI_MODEL || aiModel || 'gpt-4';

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    // Session cookie auth only — never embed API keys in the client bundle.
    const fetchHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: fetchHeaders,
            body: JSON.stringify({
                model: actualModelId,
                messages: [
                    { role: 'system', content: SUMMARIZE_PROMPT },
                    { role: 'user', content: conversationText }
                ],
                max_tokens: 2000,
                temperature: 0.3,
                stream: true,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        // Parse streaming response
        let summary = '';
        if (response.body) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed === 'data: [DONE]') continue;
                        if (!trimmed.startsWith('data: ')) continue;

                        try {
                            const parsed = JSON.parse(trimmed.slice(6));
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) summary += content;
                        } catch { /* skip */ }
                    }
                }
            } finally {
                try { reader.releaseLock(); } catch { /* ignore */ }
            }
        }

        // Clean thinking tags
        summary = summary
            .replace(/<think>[\s\S]*?<\/think>/g, '')
            .replace(/<[^>]+>/g, '')
            .trim();

        return summary || 'No context available.';
    } catch (err: any) {
        clearTimeout(timeout);
        console.error('[Fork] Context generation failed:', err.message);
        throw err;
    }
}

// Main fork function
export async function forkChat(): Promise<string> {
    const state = useStore.getState();
    const { user, messages, files, currentChatId, chats } = state;

    if (!user) throw new Error('Not authenticated');
    if (!currentChatId) throw new Error('No active chat');

    // 1. Get current chat title
    const currentChat = chats.find(c => c.id === currentChatId);
    const baseTitle = currentChat?.title || 'Project';

    // 2. Generate context summary from conversation
    console.log('[Fork] Generating context summary...');
    const conversationText = extractConversationText(messages);
    
    let contextMd: string;
    try {
        contextMd = await generateContextSummary(conversationText);
    } catch {
        // Fallback: use codebase.md if it exists, or create minimal context
        const codebaseMd = files['.glovix/codebase.md']?.file?.contents;
        contextMd = codebaseMd || `## Project\nForked from "${baseTitle}". No detailed context available.`;
    }

    // 3. Prepare files for the new chat — copy all current files
    const newFiles = { ...files };
    
    // 4. Write context.md into .glovix
    newFiles['.glovix/context.md'] = { file: { contents: contextMd } };

    // 5. Create new chat
    const newChat = await createChat(user.uid, `${baseTitle} (fork)`);
    console.log('[Fork] Created new chat:', newChat.id);

    // 6. Save files to new chat's project
    await saveProject(newChat.id, user.uid, newFiles);

    // 7. Update store chats list
    const currentChats = useStore.getState().chats;
    useStore.getState().setChats([newChat, ...currentChats]);

    // 8. Mark this chat for auto-context loading
    sessionStorage.setItem(`fork_context_${newChat.id}`, 'true');

    console.log('[Fork] Done. Context saved to .glovix/context.md');
    return newChat.id;
}
