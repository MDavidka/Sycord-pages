// Isolated title generator — uses a separate lightweight AI call
// Completely independent from the main AI chat flow

import { useStore } from '../store';
import { updateChatTitle } from './api';
import { getModelChoice } from './ai';

// Very explicit prompt that works well with Gemini and other models
const TITLE_PROMPT = `Generate a short project title (2-5 words) based on the user's request.

Rules:
- Output ONLY the title, nothing else
- No quotes, no punctuation at the end
- No explanations, no thinking
- 2-5 words maximum
- Use the same language as the user's message
- If the user writes in Russian, respond in Russian
- If the user writes in English, respond in English

Examples:
User: "Создай интернет-магазин с корзиной и оплатой"
Title: Интернет-магазин

User: "Make a todo app with React"
Title: React Todo App

User: "Build a portfolio website with animations"
Title: Portfolio Website

User: "Сделай игру змейку на JavaScript"
Title: Игра Змейка

User: "Create a weather dashboard"
Title: Weather Dashboard

User: "Напиши чат-бот для телеграма"
Title: Телеграм Чат-бот

Now generate a title for the following request:`;

// Fallback: extract title from user text without AI
function extractFallbackTitle(text: string): string {
    const clean = text
        .replace(/```[\s\S]*?```/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/[#*_~`]/g, '')
        .trim();

    if (!clean) return 'New Project';

    // Take first meaningful sentence/phrase
    const firstLine = clean.split(/[.\n!?]/)[0].trim();

    // If short enough, use as-is
    if (firstLine.length <= 40) {
        return firstLine;
    }

    // Otherwise take first few words
    const words = firstLine.split(/\s+/).slice(0, 5).join(' ');
    return words.length > 40 ? words.substring(0, 37) + '...' : words;
}

// Main function: generate title and save it
export async function generateAndSaveTitle(userText: string, chatId: string): Promise<void> {
    try {
        const aiTitle = await generateTitleWithAI(userText);

        if (aiTitle && aiTitle.length >= 2) {
            await saveTitleToStore(chatId, aiTitle);
            return;
        }

        console.warn('[TitleGen] AI returned no valid title, using fallback');
        const fallback = extractFallbackTitle(userText);
        await saveTitleToStore(chatId, fallback);
    } catch (err) {
        console.error('[TitleGen] Failed, using fallback:', err);
        const fallback = extractFallbackTitle(userText);
        await saveTitleToStore(chatId, fallback).catch(() => {});
    }
}

// Generate title using AI API (streaming mode for compatibility)
async function generateTitleWithAI(userText: string): Promise<string | null> {
    try {
        const { aiModel } = useStore.getState();
        const mappedChoice = getModelChoice(aiModel);
        const actualModelId = (mappedChoice.modelType === aiModel ? mappedChoice.apiModel : aiModel) || 'gpt-4';

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);

        // Session cookie auth only — never embed API keys in the client bundle.
        const titleHeaders: Record<string, string> = { 'Content-Type': 'application/json' };

        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: titleHeaders,
            body: JSON.stringify({
                model: actualModelId,
                messages: [
                    { role: 'system', content: TITLE_PROMPT },
                    { role: 'user', content: userText.slice(0, 300) }
                ],
                max_tokens: 50,
                temperature: 0.1,
                stream: true,
            }),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!response.ok) {
            console.warn(`[TitleGen] API returned ${response.status}`);
            return null;
        }

        // Parse streaming response
        let title = '';

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
                            const delta = parsed.choices?.[0]?.delta;
                            if (!delta) continue;

                            // Only collect actual content, skip thinking/reasoning
                            if (delta.content) {
                                title += delta.content;
                            }
                        } catch {
                            // Skip unparseable chunks
                        }
                    }
                }
            } finally {
                try { reader.releaseLock(); } catch { /* ignore */ }
            }
        } else {
            // No body — try parsing as JSON (non-streaming response)
            try {
                const data = await response.json();
                title = data.choices?.[0]?.message?.content || '';
            } catch {
                return null;
            }
        }

        // Aggressive cleanup
        title = cleanTitle(title);

        if (!title || title.length < 2 || title.length > 60) {
            console.warn(`[TitleGen] Invalid title: "${title}" (len=${title.length})`);
            return null;
        }

        console.log(`[TitleGen] Generated: "${title}"`);
        return title;
    } catch (err: any) {
        if (err.name === 'AbortError') {
            console.warn('[TitleGen] Timed out');
        } else {
            console.warn('[TitleGen] Error:', err.message);
        }
        return null;
    }
}

// Clean up AI-generated title
function cleanTitle(raw: string): string {
    let title = raw
        // Remove thinking blocks
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        // Remove any XML/HTML tags
        .replace(/<[^>]+>/g, '')
        .trim();

    // Take only first line
    title = title.split('\n')[0].trim();

    // Remove common prefixes the model might add
    title = title
        .replace(/^(Title|Название|Output|Result|Answer|Ответ)\s*[:：]\s*/i, '')
        .replace(/^["'`«»""'']+|["'`«»""'']+$/g, '') // Remove quotes
        .replace(/\.$/, '') // Remove trailing period
        .trim();

    // If title still contains the full user message (model just echoed it), reject
    if (title.length > 50) {
        // Try to extract just the first few meaningful words
        const words = title.split(/\s+/).slice(0, 4).join(' ');
        if (words.length >= 2 && words.length <= 50) {
            return words;
        }
        return '';
    }

    return title;
}

// Save title to store and API
async function saveTitleToStore(chatId: string, title: string): Promise<void> {
    await updateChatTitle(chatId, title);

    const currentChats = useStore.getState().chats;
    if (currentChats.length > 0) {
        const updatedChats = currentChats.map(c =>
            c.id === chatId ? { ...c, title } : c
        );
        useStore.getState().setChats(updatedChats);
    }

    console.log(`[TitleGen] Saved: "${title}" for chat ${chatId}`);
}
