import type { Message } from './ai';

export type ProjectAgentEvent = {
    type: 'session' | 'processing' | 'thinking' | 'tool_started' | 'tool_finished' | 'delta' | 'message' | 'done' | 'error';
    session?: number;
    sessionAuthoritative?: boolean;
    eventId?: number;
    text?: string;
    title?: string;
    tool?: string;
    toolCallId?: string;
    arguments?: unknown;
    ok?: boolean;
    /** Durable Turso session UUID from agent_change (poll GET /api/agent_session/{id}). */
    tursoSessionId?: string;
    requestId?: string;
};

export type StreamProjectAgentOptions = {
    projectId: string;
    message: Message;
    modelProfile: string;
    afterSession: number;
    signal?: AbortSignal;
    onEvent: (event: ProjectAgentEvent) => void;
};

export function getLatestAgentSession(messages: Message[]): number {
    return messages.reduce((latest, message) => {
        const session = Number(message.agentSession || 0);
        return Number.isSafeInteger(session) && session > latest ? session : latest;
    }, 0);
}

function messageToText(message: Message): string {
    if (typeof message.content === 'string') return message.content.trim();
    if (!Array.isArray(message.content)) return '';

    return message.content
        .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map(part => part.text)
        .join('\n\n')
        .trim();
}

function parseSseFrame(frame: string): ProjectAgentEvent | null {
    const data = frame
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart())
        .join('\n');

    if (!data) return null;
    try {
        return JSON.parse(data) as ProjectAgentEvent;
    } catch {
        return null;
    }
}

export async function streamProjectAgent(options: StreamProjectAgentOptions): Promise<{
    session: number;
    eventId: number;
}> {
    const text = messageToText(options.message);
    if (!text) throw new Error('The agent message is empty.');

    const response = await fetch(`/api/projects/${encodeURIComponent(options.projectId)}/agent`, {
        method: 'POST',
        headers: {
            Accept: 'text/event-stream',
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: text,
            modelProfile: options.modelProfile,
            afterSession: options.afterSession,
        }),
        signal: options.signal,
    });

    if (!response.ok) {
        const body = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        throw new Error(body?.message || body?.error || `Agent request failed (HTTP ${response.status}).`);
    }
    if (!response.body) throw new Error('Agent activity stream returned no response body.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let session = options.afterSession;
    let eventId = 0;
    let terminal = false;

    try {
        while (!terminal) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const frames = buffer.split(/\r?\n\r?\n/);
            buffer = frames.pop() || '';

            for (const frame of frames) {
                const event = parseSseFrame(frame);
                if (!event) continue;
                if (event.session) {
                    session = event.sessionAuthoritative
                        ? event.session
                        : Math.max(session, event.session);
                }
                if (event.eventId && event.eventId > eventId) eventId = event.eventId;
                options.onEvent(event);
                if (event.type === 'done' || event.type === 'error') {
                    terminal = true;
                    break;
                }
            }
        }
    } finally {
        try { await reader.cancel(); } catch { /* stream may already be closed */ }
        try { reader.releaseLock(); } catch { /* ignore */ }
    }

    if (!terminal && !options.signal?.aborted) {
        throw new Error('Agent activity stream ended before the request completed.');
    }

    return { session, eventId };
}
