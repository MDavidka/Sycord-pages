import type { Message, ToolCall } from './ai';
import { canonicalizeToolName, normalizeAgentTool } from './agent-tools';

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
    /** Durable Turso session UUID from agent_change. */
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

export type ResumeProjectAgentOptions = {
    projectId: string;
    tursoSessionId?: string;
    /** Skip events at or below this id when resuming mid-turn. */
    afterEventId?: number;
    signal?: AbortSignal;
    onEvent: (event: ProjectAgentEvent) => void;
};

type TursoSessionEvent = {
    id: number;
    event_type: string;
    role?: string;
    title?: string;
    detail?: string;
    payload?: Record<string, unknown>;
};

type TursoSessionDoc = {
    ok?: boolean;
    id?: string;
    project_id?: string;
    session_number?: number;
    status?: string;
    events?: TursoSessionEvent[];
    error?: string;
    message?: string;
};

type SubmitAgentResponse = {
    ok?: boolean;
    request_id?: string;
    status?: string;
    turso_session_id?: string;
    session_number?: number;
    session_url?: string;
    message?: string;
    error?: string;
};

type ResumeAgentResponse = {
    ok?: boolean;
    resume_session?: {
        id: string;
        session_number?: number | null;
        status?: string | null;
        session_url?: string;
    } | null;
    open_session?: { id: string; status?: string } | null;
    message?: string;
};

const POLL_INTERVAL_MS = 1500;
const MAX_POLL_MS = 10 * 60 * 1000;
const TRANSIENT_RETRIES = 8;

export function getLatestAgentSession(messages: Message[]): number {
    return messages.reduce((latest, message) => {
        const session = Number(message.agentSession || 0);
        return Number.isSafeInteger(session) && session > latest ? session : latest;
    }, 0);
}

/** Turso session id saved on the newest assistant/user turn, if any. */
export function getLatestTursoSessionId(messages: Message[]): string | null {
    for (let i = messages.length - 1; i >= 0; i--) {
        const id = messages[i]?.tursoSessionId;
        if (typeof id === 'string' && id.trim()) return id.trim();
    }
    return null;
}

/**
 * Collect assistant messages that have a Turso session id but no persisted tool_calls.
 * Used on reopen so older cloud turns still show their stacked file/command feed.
 */
export function getAssistantMessagesNeedingToolHydration(
    messages: Message[],
): Array<{ index: number; tursoSessionId: string }> {
    const out: Array<{ index: number; tursoSessionId: string }> = [];
    const seen = new Set<string>();
    for (let i = 0; i < messages.length; i++) {
        const msg = messages[i];
        if (msg?.role !== 'assistant') continue;
        const id = typeof msg.tursoSessionId === 'string' ? msg.tursoSessionId.trim() : '';
        if (!id || seen.has(id)) continue;
        if (msg.tool_calls && msg.tool_calls.length > 0) continue;
        seen.add(id);
        out.push({ index: i, tursoSessionId: id });
    }
    return out;
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

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve, reject) => {
        if (signal?.aborted) {
            reject(new DOMException('Aborted', 'AbortError'));
            return;
        }
        const timer = setTimeout(resolve, ms);
        const onAbort = () => {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
        };
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function isTransientNetworkError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;
    if ((error as { name?: string }).name === 'AbortError') return false;
    const message = String((error as { message?: string }).message || error).toLowerCase();
    return (
        message.includes('load failed') ||
        message.includes('failed to fetch') ||
        message.includes('network') ||
        message.includes('fetch failed') ||
        message.includes('networkerror') ||
        message.includes('the internet connection appears to be offline') ||
        message.includes('connection')
    );
}

function eventText(event: TursoSessionEvent): string {
    const payload = event.payload || {};
    const preferred =
        payload.reply ?? payload.error ?? payload.delta ?? payload.text ?? event.detail ?? '';
    return typeof preferred === 'string' ? preferred : JSON.stringify(preferred);
}

function normalizeTursoEvent(
    event: TursoSessionEvent,
    session: number,
    tursoSessionId?: string,
    requestId?: string,
): ProjectAgentEvent | null {
    const payload = event.payload || {};
    const rawToolCallId = payload.tool_call_id ?? payload.call_id;
    const common = {
        session,
        eventId: Number(event.id) || undefined,
        text: eventText(event),
        title: event.title,
        toolCallId:
            typeof rawToolCallId === 'string' || typeof rawToolCallId === 'number'
                ? String(rawToolCallId)
                : undefined,
        tursoSessionId,
        requestId,
    };

    switch (event.event_type) {
        case 'request_started':
        case 'processing':
            return { type: 'processing', ...common };
        case 'thinking':
            return { type: 'thinking', ...common };
        case 'tool_call':
            return {
                type: payload.phase === 'finished' ? 'tool_finished' : 'tool_started',
                ...common,
                tool: typeof payload.tool === 'string' ? payload.tool : event.title,
                arguments: payload.arguments,
                ok: payload.ok === true,
            };
        case 'tool_call_started':
            return {
                type: 'tool_started',
                ...common,
                tool: typeof payload.tool === 'string' ? payload.tool : event.title,
                arguments: payload.arguments,
            };
        case 'tool_call_finished':
            return {
                type: 'tool_finished',
                ...common,
                tool: typeof payload.tool === 'string' ? payload.tool : event.title,
                ok: payload.ok === true,
            };
        case 'file_created':
        case 'file_modified':
        case 'file_deleted':
        case 'command_run': {
            // Syte often emits lifecycle snapshots with path/command in payload —
            // treat these as finished tool calls with concrete arguments for the feed.
            const path =
                (typeof payload.path === 'string' && payload.path) ||
                (typeof payload.file === 'string' && payload.file) ||
                undefined;
            const command =
                (typeof payload.command === 'string' && payload.command) ||
                (typeof event.detail === 'string' && event.event_type === 'command_run'
                    ? event.detail
                    : undefined);
            const argumentsPayload =
                payload.arguments && typeof payload.arguments === 'object'
                    ? payload.arguments
                    : path
                      ? { path }
                      : command
                        ? { command }
                        : payload;
            return {
                type: 'tool_finished',
                ...common,
                tool: event.event_type,
                arguments: argumentsPayload,
                ok: payload.ok !== false,
            };
        }
        case 'token_delta':
            return { type: 'delta', ...common };
        case 'message_snapshot':
            return { type: 'message', ...common };
        case 'request_completed':
            return { type: 'done', ...common };
        case 'request_failed':
            return { type: 'error', ...common };
        default:
            return null;
    }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const body = (await response.json().catch(() => null)) as T & {
        message?: string;
        error?: string;
    } | null;
    if (!response.ok) {
        throw new Error(
            body?.message || body?.error || `Request failed (HTTP ${response.status}).`,
        );
    }
    return (body || {}) as T;
}

async function fetchTursoSession(
    projectId: string,
    tursoSessionId: string,
    sinceId: number,
    signal?: AbortSignal,
): Promise<TursoSessionDoc> {
    const url =
        `/api/workspace/sycord/agent-session?sessionId=${encodeURIComponent(tursoSessionId)}` +
        `&projectId=${encodeURIComponent(projectId)}` +
        `&since_id=${sinceId}`;
    return fetchJson<TursoSessionDoc>(url, {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal,
    });
}

/**
 * Poll a durable Turso agent session until it leaves status "open".
 * Retries transient network errors (Safari "Load failed", offline blips)
 * instead of treating disconnect as a fatal agent failure.
 */
export async function pollTursoAgentSession(options: {
    projectId: string;
    tursoSessionId: string;
    requestId?: string;
    sessionNumber?: number;
    afterEventId?: number;
    signal?: AbortSignal;
    onEvent: (event: ProjectAgentEvent) => void;
}): Promise<{ session: number; eventId: number; status: string }> {
    let sinceId = Math.max(0, options.afterEventId || 0);
    let session = Math.max(0, options.sessionNumber || 0);
    let sessionAuthoritative = session > 0;
    let eventId = sinceId;
    let terminal = false;
    let status = 'open';
    let transientFailures = 0;
    const startedAt = Date.now();

    options.onEvent({
        type: 'session',
        session: session || undefined,
        sessionAuthoritative,
        tursoSessionId: options.tursoSessionId,
        requestId: options.requestId,
        eventId: eventId || undefined,
    });

    while (!terminal) {
        if (options.signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }
        if (Date.now() - startedAt > MAX_POLL_MS) {
            throw new Error('Timed out waiting for the Turso agent session to finish.');
        }

        let doc: TursoSessionDoc;
        try {
            doc = await fetchTursoSession(
                options.projectId,
                options.tursoSessionId,
                sinceId,
                options.signal,
            );
            transientFailures = 0;
        } catch (error) {
            if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
                throw error;
            }
            if (isTransientNetworkError(error) && transientFailures < TRANSIENT_RETRIES) {
                transientFailures++;
                await sleep(POLL_INTERVAL_MS * Math.min(transientFailures, 4), options.signal);
                continue;
            }
            throw error;
        }

        const durableSession = Number(doc.session_number) || 0;
        if (durableSession > 0 && (!sessionAuthoritative || session !== durableSession)) {
            session = durableSession;
            sessionAuthoritative = true;
            options.onEvent({
                type: 'session',
                session,
                sessionAuthoritative: true,
                tursoSessionId: options.tursoSessionId,
                requestId: options.requestId,
                eventId: eventId || undefined,
            });
        }

        for (const event of doc.events || []) {
            const id = Number(event.id) || 0;
            if (id && id <= sinceId) continue;
            if (id) {
                sinceId = Math.max(sinceId, id);
                eventId = Math.max(eventId, id);
            }

            const eventRequestId = event.payload?.request_id;
            if (
                options.requestId &&
                typeof eventRequestId === 'string' &&
                eventRequestId &&
                eventRequestId !== options.requestId
            ) {
                continue;
            }

            const normalized = normalizeTursoEvent(
                event,
                session,
                options.tursoSessionId,
                options.requestId,
            );
            if (!normalized) continue;
            options.onEvent(normalized);

            if (normalized.type === 'done' || normalized.type === 'error') {
                terminal = true;
                status = normalized.type === 'error' ? 'failed' : 'completed';
                break;
            }
        }

        if (terminal) break;

        status = doc.status || status;
        if (status && status !== 'open') {
            if (status === 'failed' || status === 'cancelled') {
                options.onEvent({
                    type: 'error',
                    session: session || undefined,
                    eventId: eventId || undefined,
                    text: `Agent session ${status}.`,
                    tursoSessionId: options.tursoSessionId,
                    requestId: options.requestId,
                });
            } else {
                options.onEvent({
                    type: 'done',
                    session: session || undefined,
                    eventId: eventId || undefined,
                    text: '',
                    tursoSessionId: options.tursoSessionId,
                    requestId: options.requestId,
                });
            }
            terminal = true;
            break;
        }

        await sleep(POLL_INTERVAL_MS, options.signal);
    }

    return { session, eventId, status };
}

/** Look up an open (or latest) Turso session for resume after the user left. */
export async function findResumableAgentSession(
    projectId: string,
    options?: { signal?: AbortSignal; allowCompleted?: boolean },
): Promise<{ tursoSessionId: string; sessionNumber?: number; status?: string } | null> {
    const data = await fetchJson<ResumeAgentResponse>(
        `/api/projects/${encodeURIComponent(projectId)}/agent?resume=1`,
        { headers: { Accept: 'application/json' }, cache: 'no-store', signal: options?.signal },
    );
    const open = data.open_session;
    if (open?.id) {
        return {
            tursoSessionId: open.id,
            sessionNumber: (data.resume_session?.id === open.id
                ? data.resume_session?.session_number
                : undefined) ?? undefined,
            status: open.status ?? 'open',
        };
    }
    const target = data.resume_session;
    if (!target?.id) return null;
    if (!options?.allowCompleted && target.status && target.status !== 'open') return null;
    return {
        tursoSessionId: target.id,
        sessionNumber: target.session_number ?? undefined,
        status: target.status ?? undefined,
    };
}

/** Resume observing a known or discovered Turso session (no new agent_change). */
export async function resumeProjectAgent(
    options: ResumeProjectAgentOptions & { allowCompleted?: boolean },
): Promise<{ session: number; eventId: number; tursoSessionId: string; status: string } | null> {
    let tursoSessionId = options.tursoSessionId?.trim() || '';
    let sessionNumber: number | undefined;

    if (!tursoSessionId) {
        const found = await findResumableAgentSession(options.projectId, {
            signal: options.signal,
            allowCompleted: options.allowCompleted,
        });
        if (!found) return null;
        if (!options.allowCompleted && found.status && found.status !== 'open') return null;
        tursoSessionId = found.tursoSessionId;
        sessionNumber = found.sessionNumber;
    }

    const result = await pollTursoAgentSession({
        projectId: options.projectId,
        tursoSessionId,
        sessionNumber,
        afterEventId: options.afterEventId,
        signal: options.signal,
        onEvent: options.onEvent,
    });

    return {
        session: result.session,
        eventId: result.eventId,
        tursoSessionId,
        status: result.status,
    };
}

/**
 * One-shot fetch of a Turso session document (no long poll).
 * Used to rebuild older tool history after reconnect when chat lost ephemeral actions.
 */
export async function fetchAgentSessionSnapshot(options: {
    projectId: string;
    tursoSessionId: string;
    sinceId?: number;
    signal?: AbortSignal;
}): Promise<TursoSessionDoc> {
    return fetchTursoSession(
        options.projectId,
        options.tursoSessionId,
        Math.max(0, options.sinceId || 0),
        options.signal,
    );
}

/** Convert durable Turso events into OpenAI-style tool_calls for chat persistence. */
export function toolCallsFromTursoEvents(events: TursoSessionEvent[]): ToolCall[] {
    const calls: ToolCall[] = [];
    const openByKey = new Map<string, ToolCall>();

    for (const event of events) {
        const payload = event.payload || {};
        const rawTool =
            (typeof payload.tool === 'string' && payload.tool) ||
            event.title ||
            event.event_type;
        const toolCallIdRaw = payload.tool_call_id ?? payload.call_id;
        const toolCallId =
            typeof toolCallIdRaw === 'string' || typeof toolCallIdRaw === 'number'
                ? String(toolCallIdRaw)
                : '';

        if (
            event.event_type === 'tool_call_started' ||
            (event.event_type === 'tool_call' && payload.phase !== 'finished')
        ) {
            const args =
                typeof payload.arguments === 'string'
                    ? payload.arguments
                    : JSON.stringify(payload.arguments || {});
            const normalized = normalizeAgentTool(String(rawTool || 'Agent tool'), args);
            const id = toolCallId || (event.id ? `evt_${event.id}` : `turso_${calls.length}`);
            const tc: ToolCall = {
                id,
                type: 'function',
                function: {
                    name: normalized.toolName || canonicalizeToolName(String(rawTool)),
                    arguments: args,
                },
            };
            calls.push(tc);
            openByKey.set(toolCallId || id, tc);
            continue;
        }

        if (
            event.event_type === 'tool_call_finished' ||
            (event.event_type === 'tool_call' && payload.phase === 'finished') ||
            event.event_type === 'file_created' ||
            event.event_type === 'file_modified' ||
            event.event_type === 'file_deleted' ||
            event.event_type === 'command_run'
        ) {
            const path =
                typeof payload.path === 'string'
                    ? payload.path
                    : typeof payload.file === 'string'
                      ? payload.file
                      : undefined;
            const command =
                typeof payload.command === 'string'
                    ? payload.command
                    : event.event_type === 'command_run'
                      ? event.detail
                      : undefined;
            const argsObj =
                payload.arguments && typeof payload.arguments === 'object'
                    ? payload.arguments
                    : path
                      ? { path }
                      : command
                        ? { command }
                        : {};
            const args = JSON.stringify(argsObj);
            const normalized = normalizeAgentTool(String(rawTool || event.event_type), args, event.detail);
            const key = toolCallId || '';
            if (key && openByKey.has(key)) {
                // started already recorded — keep that call
                continue;
            }
            // Snapshot-only finished event (common for file_* / command_run)
            calls.push({
                id: toolCallId || (event.id ? `evt_${event.id}` : `turso_${calls.length}`),
                type: 'function',
                function: {
                    name: normalized.toolName,
                    arguments: args,
                },
            });
        }
    }

    return calls;
}

/**
 * Submit a durable agent turn, then poll Turso for activity.
 * Leaving the page no longer kills progress — reopen and call resumeProjectAgent.
 */
export async function streamProjectAgent(options: StreamProjectAgentOptions): Promise<{
    session: number;
    eventId: number;
    tursoSessionId: string;
    requestId: string;
}> {
    const text = messageToText(options.message);
    if (!text) throw new Error('The agent message is empty.');

    let submit: SubmitAgentResponse;
    try {
        submit = await fetchJson<SubmitAgentResponse>(
            `/api/projects/${encodeURIComponent(options.projectId)}/agent`,
            {
                method: 'POST',
                headers: {
                    Accept: 'application/json',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: text,
                    modelProfile: options.modelProfile,
                    afterSession: options.afterSession,
                }),
                signal: options.signal,
            },
        );
    } catch (error) {
        if (isTransientNetworkError(error)) {
            // Submit may have succeeded on the server — try to attach to the open Turso session.
            const resumed = await resumeProjectAgent({
                projectId: options.projectId,
                signal: options.signal,
                onEvent: options.onEvent,
            }).catch(() => null);
            if (resumed) {
                return {
                    session: resumed.session,
                    eventId: resumed.eventId,
                    tursoSessionId: resumed.tursoSessionId,
                    requestId: '',
                };
            }
        }
        throw error;
    }

    const tursoSessionId = submit.turso_session_id;
    const requestId = submit.request_id || '';
    if (!tursoSessionId) {
        throw new Error(submit.message || 'Agent did not return a Turso session id.');
    }

    const sessionNumber = Number(submit.session_number) || options.afterSession + 1;
    options.onEvent({
        type: 'session',
        session: sessionNumber,
        sessionAuthoritative: false,
        tursoSessionId,
        requestId,
    });

    const polled = await pollTursoAgentSession({
        projectId: options.projectId,
        tursoSessionId,
        requestId: requestId || undefined,
        sessionNumber,
        signal: options.signal,
        onEvent: options.onEvent,
    });

    return {
        session: polled.session,
        eventId: polled.eventId,
        tursoSessionId,
        requestId,
    };
}
