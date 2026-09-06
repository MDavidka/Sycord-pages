import type { Message } from './ai';

/** Interactive ask_question / request_env widget types from Syte. */
export type AgentQuestionType = 'answer' | 'input' | 'slider' | 'choice' | 'multi_choice';

export type AgentQuestionOption = {
    label: string;
    value: string;
};

export type AgentQuestion = {
    id: string;
    questionType: AgentQuestionType;
    prompt: string;
    options?: AgentQuestionOption[];
    min?: number;
    max?: number;
    step?: number;
    defaultValue?: string | number | string[];
    placeholder?: string;
    status?: 'pending' | 'answered' | string;
    answer?: unknown;
};

export type ProjectAgentEvent = {
    type:
        | 'session'
        | 'processing'
        | 'thinking'
        | 'thinking_delta'
        | 'tool_started'
        | 'tool_finished'
        | 'delta'
        | 'token_delta'
        | 'message'
        | 'message_snapshot'
        | 'done'
        | 'error'
        | 'screenshot'
        | 'stopped'
        | 'question'
        | 'question_answered'
        | 'plan'
        | 'subagent_started'
        | 'subagent_completed'
        | 'subagent_failed'
        | 'subagent_scope'
        | 'status'
        | 'request_started'
        | 'agent_started'
        | 'agent_stopped'
        | 'agent_restarted'
        | 'usage'
        | 'file_created'
        | 'file_modified'
        | 'file_deleted'
        | 'file_read'
        | 'file_search'
        | 'file_changed'
        | 'command_run'
        | 'command_output';
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
    screenshots?: AgentScreenshot[];
    question?: AgentQuestion;
    /** Structured plan payload from SSE `plan` events. */
    plan?: unknown;
    /** Subagent task id / profile when present. */
    subagentTaskId?: string;
    subagentProfile?: string;
    /** True when this event came from the SSE hot path (may never hit Turso). */
    fromStream?: boolean;
    /** For thinking_delta: the incremental delta */
    delta?: string;
    /** For token_delta: the incremental token delta */
    tokenDelta?: string;
    /** For message_snapshot: full message so far */
    content?: string;
    /** For usage events */
    usage?: {
        promptTokens?: number;
        completionTokens?: number;
        totalTokens?: number;
    };
    /** File operation details */
    filePath?: string;
    /** Command details */
    command?: string;
    /** Stream sequence info */
    sequence?: number;
};

export type AgentScreenshot = {
    id?: string;
    viewport?: string;
    route?: string;
    imageUrl?: string;
    imageBase64?: string;
};

export type StreamProjectAgentOptions = {
    projectId: string;
    message: Message;
    modelProfile: string;
    /** Normal coding turns build directly; callers may explicitly request a plan. */
    planMode?: 'auto' | 'always' | 'off';
    agentMode?: 'build' | 'plan';
    thinkingLevel?: 'low' | 'medium' | 'high' | 'extra_high' | string;
    executionSpeed?: string;
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

/** Fast first polls so token/thinking events appear quickly after submit. */
const POLL_INTERVAL_FAST_MS = 350;
/** Back off when the session is quiet to avoid hammering Syte/Turso. */
const POLL_INTERVAL_IDLE_MS = 900;
const POLL_INTERVAL_MAX_MS = 2000;
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
        payload.reply ?? payload.error ?? payload.delta ?? payload.content ?? payload.text ?? payload.message ?? event.detail ?? '';
    return typeof preferred === 'string' ? preferred : JSON.stringify(preferred);
}

const QUESTION_TYPES = new Set<AgentQuestionType>([
    'answer',
    'input',
    'slider',
    'choice',
    'multi_choice',
]);

function asFiniteNumber(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) {
        return Number(value);
    }
    return undefined;
}

function normalizeQuestionOptions(raw: unknown): AgentQuestionOption[] | undefined {
    if (!Array.isArray(raw) || raw.length === 0) return undefined;
    const options: AgentQuestionOption[] = [];
    for (const item of raw) {
        if (typeof item === 'string' || typeof item === 'number') {
            const value = String(item);
            options.push({ label: value, value });
            continue;
        }
        if (!item || typeof item !== 'object') continue;
        const obj = item as Record<string, unknown>;
        const value =
            obj.value != null
                ? String(obj.value)
                : obj.id != null
                    ? String(obj.id)
                    : obj.label != null
                        ? String(obj.label)
                        : obj.name != null
                            ? String(obj.name)
                            : '';
        if (!value) continue;
        const label =
            obj.label != null
                ? String(obj.label)
                : obj.name != null
                    ? String(obj.name)
                    : value;
        options.push({ label, value });
    }
    return options.length > 0 ? options : undefined;
}

export function normalizeAgentQuestion(
    payload: Record<string, unknown> | null | undefined,
    fallback?: { title?: string; detail?: string },
): AgentQuestion | null {
    if (!payload || typeof payload !== 'object') return null;

    const nested =
        payload.question && typeof payload.question === 'object'
            ? (payload.question as Record<string, unknown>)
            : payload.question_data && typeof payload.question_data === 'object'
                ? (payload.question_data as Record<string, unknown>)
                : null;
    const source = nested || payload;

    const idRaw =
        source.question_id ??
        source.id ??
        payload.question_id ??
        payload.id ??
        'question_1';
    const id = typeof idRaw === 'string' || typeof idRaw === 'number' ? String(idRaw).trim() : 'question_1';
    if (!id) return null;

    const typeRaw = String(
        source.question_type ?? source.type ?? payload.question_type ?? payload.type ?? 'input',
    )
        .trim()
        .toLowerCase()
        .replace(/-/g, '_');
    const questionType: AgentQuestionType = QUESTION_TYPES.has(typeRaw as AgentQuestionType)
        ? (typeRaw as AgentQuestionType)
        : typeRaw === 'multichoice' || typeRaw === 'multi'
            ? 'multi_choice'
            : typeRaw === 'text' || typeRaw === 'freeform'
                ? 'input'
                : typeRaw === 'number' || typeRaw === 'range'
                    ? 'slider'
                    : typeRaw === 'confirm' || typeRaw === 'ack'
                        ? 'answer'
                        : 'input';

    const prompt =
        (typeof source.prompt === 'string' && source.prompt.trim()) ||
        (typeof source.question === 'string' && source.question.trim()) ||
        (typeof source.text === 'string' && source.text.trim()) ||
        (typeof source.message === 'string' && source.message.trim()) ||
        (typeof payload.prompt === 'string' && payload.prompt.trim()) ||
        (typeof fallback?.detail === 'string' && fallback.detail.trim()) ||
        (typeof fallback?.title === 'string' && fallback.title.trim()) ||
        'Question';

    const min = asFiniteNumber(source.min ?? source.min_value ?? source.minimum);
    const max = asFiniteNumber(source.max ?? source.max_value ?? source.maximum);
    const step = asFiniteNumber(source.step ?? source.step_value) ?? 1;
    const defaultRaw = source.default ?? source.default_value ?? source.value ?? source.initial;
    let defaultValue: string | number | string[] | undefined;
    if (Array.isArray(defaultRaw)) {
        defaultValue = defaultRaw.map(String);
    } else if (typeof defaultRaw === 'number' && Number.isFinite(defaultRaw)) {
        defaultValue = defaultRaw;
    } else if (typeof defaultRaw === 'string') {
        defaultValue = defaultRaw;
    }

    const placeholder =
        typeof source.placeholder === 'string'
            ? source.placeholder
            : typeof source.hint === 'string'
                ? source.hint
                : undefined;

    const status =
        typeof source.status === 'string'
            ? source.status
            : typeof payload.status === 'string'
                ? payload.status
                : undefined;

    return {
        id,
        questionType,
        prompt,
        options: normalizeQuestionOptions(source.options ?? source.choices ?? payload.options),
        min,
        max,
        step,
        defaultValue,
        placeholder,
        status,
        answer: source.answer ?? payload.answer,
    };
}

function normalizeScreenshots(payload: Record<string, unknown>, projectId?: string): AgentScreenshot[] {
    const raw = payload.screenshots
    const list = Array.isArray(raw) ? raw : raw ? [raw] : []
    return list.map((item, index) => {
        const shot = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        const id = typeof shot.id === 'string' ? shot.id : typeof shot.screenshot_id === 'string' ? shot.screenshot_id : undefined
        const imageBase64 = typeof shot.chat_image_base64 === 'string'
            ? shot.chat_image_base64
            : typeof shot.image_base64 === 'string'
                ? shot.image_base64
                : undefined
        let imageUrl = typeof shot.image_url === 'string' ? shot.image_url : undefined
        if (!imageUrl && id && projectId) {
            imageUrl = `/api/projects/${encodeURIComponent(projectId)}/agent/screenshots/${encodeURIComponent(id)}?variant=full`
        } else if (imageUrl && imageUrl.startsWith('/') && !imageUrl.startsWith('/api/projects/')) {
            // Syte-relative path — prefer our auth proxy when we have an id
            if (id && projectId) {
                imageUrl = `/api/projects/${encodeURIComponent(projectId)}/agent/screenshots/${encodeURIComponent(id)}?variant=full`
            } else {
                imageUrl = `https://sycord.site${imageUrl}`
            }
        }
        return {
            id,
            viewport: typeof shot.viewport === 'string' ? shot.viewport : index === 0 ? 'desktop' : 'phone',
            route: typeof shot.route === 'string' ? shot.route : undefined,
            imageUrl,
            imageBase64: imageBase64
                ? (imageBase64.startsWith('data:') ? imageBase64 : `data:image/png;base64,${imageBase64}`)
                : undefined,
        }
    }).filter(shot => shot.imageUrl || shot.imageBase64)
}

function normalizeTursoEvent(
    event: TursoSessionEvent,
    session: number,
    tursoSessionId?: string,
    requestId?: string,
    projectId?: string,
    fromStream = false,
): ProjectAgentEvent | null {
    const payload = event.payload || {};
    const rawToolCallId = payload.tool_call_id ?? payload.call_id;
    const payloadSession =
        typeof payload.session === 'number'
            ? payload.session
            : Number(payload.session) || undefined;
    const payloadTurso =
        typeof payload.turso_session_id === 'string' ? payload.turso_session_id : undefined;
    const payloadRequestId =
        typeof payload.request_id === 'string' ? payload.request_id : undefined;
    const rawSubagentId = payload.subagent_task_id ?? payload.task_id;
    const common = {
        session: payloadSession || session,
        eventId: Number(event.id) || undefined,
        text: eventText(event),
        title: event.title,
        toolCallId:
            typeof rawToolCallId === 'string' || typeof rawToolCallId === 'number'
                ? String(rawToolCallId)
                : undefined,
        tursoSessionId: payloadTurso || tursoSessionId,
        requestId: payloadRequestId || requestId,
        fromStream,
        subagentTaskId:
            typeof rawSubagentId === 'string' || typeof rawSubagentId === 'number'
                ? String(rawSubagentId)
                : undefined,
        subagentProfile:
            typeof payload.profile === 'string'
                ? payload.profile
                : typeof payload.subagent_type === 'string'
                    ? payload.subagent_type
                    : undefined,
    };

    switch (event.event_type) {
        case 'request_started':
        case 'processing':
            return { type: 'processing', ...common };
        case 'status':
            return {
                type: 'status',
                ...common,
                text: event.detail || (typeof payload.message === 'string' ? payload.message : eventText(event)),
                tool: typeof payload.tool_name === 'string' ? payload.tool_name : undefined,
                arguments: payload,
            };
        case 'thinking':
        case 'thinking_delta':
        case 'thought':
        case 'thought_delta': {
            const rawDelta = payload.delta ?? payload.content ?? payload.text ?? event.detail ?? '';
            const deltaStr = typeof rawDelta === 'string' ? rawDelta : (rawDelta ? JSON.stringify(rawDelta) : '');
            return {
                type: 'thinking',
                ...common,
                delta: deltaStr || common.text,
            };
        }
        case 'token':
        case 'token_delta':
            return {
                type: 'delta',
                ...common,
                text: eventText(event),
            };
        case 'plan':
        case 'plan_approval_required':
        case 'update_plan':
        case 'step_update':
        case 'update_plan_step':
        case 'plan_step':
            return {
                type: 'plan',
                ...common,
                plan: payload.plan ?? payload,
                arguments: payload,
                tool: 'update_plan',
            };
        case 'machine_action':
        case 'machine_action_start':
        case 'machine_action_finish':
            return {
                type: event.event_type === 'machine_action_start' ? 'tool_started' : 'tool_finished',
                ...common,
                tool: typeof payload.tool === 'string' ? payload.tool : 'machine_action',
                arguments: payload,
                text: event.detail || event.title || (typeof payload.command === 'string' ? payload.command : 'Machine action'),
                ok: payload.ok !== false,
            };
        case 'activity':
        case 'activity_step':
            return {
                type: 'status',
                ...common,
                text: event.detail || (typeof payload.message === 'string' ? payload.message : eventText(event)),
                tool: typeof payload.tool_name === 'string' ? payload.tool_name : 'activity',
                arguments: payload,
            };
        case 'screenshot': {
            const screenshots = normalizeScreenshots(payload, projectId);
            return {
                type: 'screenshot',
                ...common,
                screenshots,
                text: event.detail || event.title || 'made a screenshot',
            };
        }
        case 'ask_question':
        case 'question':
        case 'user_input_required': {
            const question = normalizeAgentQuestion(payload, {
                title: event.title,
                detail: event.detail,
            });
            if (!question) return null;
            return {
                type: 'question',
                ...common,
                question,
                text: question.prompt,
            };
        }
        case 'question_answered': {
            const question = normalizeAgentQuestion(payload, {
                title: event.title,
                detail: event.detail,
            });
            return {
                type: 'question_answered',
                ...common,
                question: question || undefined,
                text: event.detail || event.title || 'Question answered',
            };
        }
        case 'tool_call':
            return {
                type: payload.phase === 'finished' ? 'tool_finished' : 'tool_started',
                ...common,
                tool: typeof payload.tool === 'string' ? payload.tool : (typeof payload.tool_name === 'string' ? payload.tool_name : event.title),
                arguments: payload.arguments ?? payload,
                ok: payload.ok === true,
            };
        case 'tool_call_started':
        case 'tool_call_start':
            return {
                type: 'tool_started',
                ...common,
                tool: typeof payload.tool === 'string' ? payload.tool : (typeof payload.tool_name === 'string' ? payload.tool_name : event.title),
                arguments: payload.arguments ?? payload,
            };
        case 'tool_call_finished':
        case 'tool_call_result':
        case 'tool_error':
            return {
                type: 'tool_finished',
                ...common,
                tool: typeof payload.tool === 'string' ? payload.tool : (typeof payload.tool_name === 'string' ? payload.tool_name : event.title),
                arguments: payload.arguments ?? payload,
                ok: event.event_type === 'tool_error' ? false : payload.ok !== false && (!payload.result || (payload.result as Record<string, any>).ok !== false),
            };
        case 'file_created':
        case 'file_modified':
        case 'file_deleted':
        case 'file_read':
        case 'file_search':
        case 'file_changed':
        case 'command_run':
        case 'command_output':
            // Semantic activity events — preserve payload for file/search/command UI.
            return {
                type: 'tool_finished',
                ...common,
                tool: event.event_type,
                arguments: {
                    ...payload,
                    ...(event.event_type.startsWith('command') && !payload.command && event.detail
                        ? { command: event.detail }
                        : {}),
                    ...(!event.event_type.startsWith('command') && !payload.path && event.detail
                        ? { path: event.detail }
                        : {}),
                    ...(event.event_type === 'file_search' && !payload.query && event.detail
                        ? { query: event.detail, pattern: event.detail }
                        : {}),
                },
                ok: payload.ok !== false,
            };
        case 'subagent_started':
            return {
                type: 'subagent_started',
                ...common,
                tool: 'subagent',
                arguments: payload,
                text: event.detail || event.title || 'Subagent started',
            };
        case 'subagent_completed':
            return {
                type: 'subagent_completed',
                ...common,
                tool: 'subagent',
                arguments: payload,
                ok: true,
                text: event.detail || event.title || 'Subagent completed',
            };
        case 'subagent_failed':
            return {
                type: 'subagent_failed',
                ...common,
                tool: 'subagent',
                arguments: payload,
                ok: false,
                text: event.detail || (typeof payload.error === 'string' ? payload.error : 'Subagent failed'),
            };
        case 'subagent_scope':
            return {
                type: 'subagent_scope',
                ...common,
                tool: 'subagent',
                arguments: payload,
                text: event.detail || event.title || 'Subagent scope',
            };
        case 'token_delta':
        case 'delta':
            return { type: 'delta', ...common };
        case 'message_snapshot':
        case 'assistant_message':
            return { type: 'message', ...common };
        case 'user_message':
        case 'user_message_received':
            return null;
        case 'request_completed':
        case 'done':
            return { type: 'done', ...common };
        case 'request_failed':
        case 'error':
            return { type: 'error', ...common };
        case 'session_stopped':
        case 'agent_stopped':
        case 'stopped':
        case 'cancelled':
            return {
                type: 'stopped',
                ...common,
                text: event.detail || (typeof payload.reason === 'string' ? payload.reason : 'Agent stopped.'),
            };
        case 'heartbeat':
        case 'ping':
        case 'usage':
        case 'service_action':
        case 'agent_started':
        case 'agent_restarted':
        case 'session_idle':
            return null;
        default:
            return null;
    }
}

/** Parse one SSE chunk block into an activity event (or null for heartbeats). */
function parseSseBlock(block: string): TursoSessionEvent | null {
    const lines = block.split(/\r?\n/);
    let eventName = '';
    let data = '';
    let id = 0;
    for (const line of lines) {
        if (!line || line.startsWith(':')) continue; // heartbeat / comment
        if (line.startsWith('id:')) {
            id = parseInt(line.slice(3).trim(), 10) || id;
        } else if (line.startsWith('event:')) {
            eventName = line.slice(6).trim();
        } else if (line.startsWith('data:')) {
            data += (data ? '\n' : '') + line.slice(5).trimStart();
        }
    }
    if (!data) return null;
    try {
        const parsed = JSON.parse(data) as Record<string, unknown>;
        const eventType =
            (typeof parsed.event_type === 'string' && parsed.event_type) ||
            (typeof parsed.event === 'string' && parsed.event) ||
            eventName ||
            'status';
        const payload =
            parsed.payload && typeof parsed.payload === 'object'
                ? (parsed.payload as Record<string, unknown>)
                : parsed;
        return {
            id: Number(parsed.id) || id || 0,
            event_type: eventType,
            role: typeof parsed.role === 'string' ? parsed.role : undefined,
            title: typeof parsed.title === 'string' ? parsed.title : (typeof parsed.tool_name === 'string' ? parsed.tool_name : undefined),
            detail: typeof parsed.detail === 'string' ? parsed.detail : (typeof parsed.message === 'string' ? parsed.message : undefined),
            payload,
        };
    } catch {
        return null;
    }
}

/**
 * Consume the Syte SSE hot path (token_delta / thinking_delta skip Turso).
 * Docs: https://sycord.site/api/#stream/
 */
export async function streamAgentActivitySse(options: {
    projectId: string;
    sinceId?: number;
    session?: number | string;
    requestId?: string;
    tursoSessionId?: string;
    signal?: AbortSignal;
    onEvent: (event: ProjectAgentEvent) => void;
    /** Called whenever a higher event id is observed. */
    onEventId?: (eventId: number) => void;
}): Promise<{ lastEventId: number; terminal: boolean }> {
    let sinceId = Math.max(0, options.sinceId || 0);
    let lastEventId = sinceId;
    let terminal = false;
    let session = Math.max(0, Number(options.session) || 0);

    const url =
        `/api/workspace/sycord/agent-activity?projectId=${encodeURIComponent(options.projectId)}` +
        `&live=1&since_id=${sinceId}` +
        (options.session ? `&session=${encodeURIComponent(String(options.session))}` : '');

    const response = await fetch(url, {
        headers: {
            Accept: 'text/event-stream',
            'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
        signal: options.signal,
    });

    if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        throw new Error(
            text.slice(0, 240) || `Agent activity stream failed (HTTP ${response.status}).`,
        );
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    const emit = (raw: TursoSessionEvent) => {
        const id = Number(raw.id) || 0;
        if (id && id <= sinceId) return;
        if (id) {
            sinceId = Math.max(sinceId, id);
            lastEventId = Math.max(lastEventId, id);
            options.onEventId?.(lastEventId);
        }

        const eventRequestId = raw.payload?.request_id;
        if (
            options.requestId &&
            typeof eventRequestId === 'string' &&
            eventRequestId &&
            eventRequestId !== options.requestId
        ) {
            return;
        }

        const payloadSession =
            typeof raw.payload?.session === 'number'
                ? raw.payload.session
                : Number(raw.payload?.session) || 0;
        if (payloadSession > 0) session = payloadSession;

        const normalized = normalizeTursoEvent(
            raw,
            session,
            options.tursoSessionId,
            options.requestId,
            options.projectId,
            true,
        );
        if (!normalized) return;
        options.onEvent(normalized);
        if (
            normalized.type === 'done' ||
            normalized.type === 'error' ||
            normalized.type === 'stopped'
        ) {
            terminal = true;
        }
    };

    try {
        while (!terminal) {
            if (options.signal?.aborted) {
                throw new DOMException('Aborted', 'AbortError');
            }
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            let separator = /\r?\n\r?\n/.exec(buffer);
            while (separator && separator.index >= 0) {
                const block = buffer.slice(0, separator.index);
                buffer = buffer.slice(separator.index + separator[0].length);
                const parsed = parseSseBlock(block);
                if (parsed) emit(parsed);
                if (terminal) break;
                separator = /\r?\n\r?\n/.exec(buffer);
            }
            if (terminal) break;
        }

        // Some proxies close a valid SSE stream immediately after the final
        // data line without its trailing blank separator. Consume that final
        // frame rather than dropping a completed response or terminal event.
        if (!terminal && buffer.trim()) {
            const parsed = parseSseBlock(buffer);
            if (parsed) emit(parsed);
        }
    } finally {
        try {
            reader.releaseLock();
        } catch {
            /* ignore */
        }
    }

    return { lastEventId, terminal };
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
 * Observe a durable Turso agent session until it leaves status "open".
 * Prefers the SSE hot path (token_delta / thinking_delta skip Turso) and
 * keeps Turso polling as a durable fallback / terminal status source.
 * Docs: https://sycord.site/api/#stream/
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
    let idlePolls = 0;
    let pollIntervalMs = POLL_INTERVAL_FAST_MS;
    const startedAt = Date.now();
    const seenEventIds = new Set<number>();

    options.onEvent({
        type: 'session',
        session: session || undefined,
        sessionAuthoritative,
        tursoSessionId: options.tursoSessionId,
        requestId: options.requestId,
        eventId: eventId || undefined,
    });

    const emitNormalized = (normalized: ProjectAgentEvent) => {
        if (normalized.eventId) {
            if (seenEventIds.has(normalized.eventId)) return;
            seenEventIds.add(normalized.eventId);
            sinceId = Math.max(sinceId, normalized.eventId);
            eventId = Math.max(eventId, normalized.eventId);
        }
        if (normalized.session) {
            if (!sessionAuthoritative || normalized.session !== session) {
                session = normalized.session;
                if (normalized.sessionAuthoritative || normalized.fromStream) {
                    sessionAuthoritative = true;
                }
            }
        }
        options.onEvent(normalized);
        if (normalized.type === 'done' || normalized.type === 'error' || normalized.type === 'stopped') {
            terminal = true;
            status = normalized.type === 'error'
                ? 'failed'
                : normalized.type === 'stopped'
                    ? 'stopped'
                    : 'completed';
        }
    };

    // SSE hot path — required for token_delta / thinking_delta.
    const streamAbort = new AbortController();
    const onParentAbort = () => streamAbort.abort();
    options.signal?.addEventListener('abort', onParentAbort, { once: true });

    const streamPromise = streamAgentActivitySse({
        projectId: options.projectId,
        sinceId,
        session: session || undefined,
        requestId: options.requestId,
        tursoSessionId: options.tursoSessionId,
        signal: streamAbort.signal,
        onEvent: emitNormalized,
        onEventId: (id) => {
            sinceId = Math.max(sinceId, id);
            eventId = Math.max(eventId, id);
        },
    }).catch((error) => {
        if (options.signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) {
            return { lastEventId: eventId, terminal };
        }
        // SSE may be unavailable — Turso poll remains the source of truth for cold events.
        console.warn('[project-agent] SSE stream unavailable, falling back to Turso poll:', error);
        return { lastEventId: eventId, terminal: false };
    });

    try {
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
                    await sleep(pollIntervalMs * Math.min(transientFailures, 4), options.signal);
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

            let sawNewEvent = false;
            for (const event of doc.events || []) {
                const id = Number(event.id) || 0;
                if (id && id <= sinceId) continue;
                if (id && seenEventIds.has(id)) {
                    sinceId = Math.max(sinceId, id);
                    continue;
                }

                const eventRequestId = event.payload?.request_id;
                if (
                    options.requestId &&
                    typeof eventRequestId === 'string' &&
                    eventRequestId &&
                    eventRequestId !== options.requestId
                ) {
                    if (id) sinceId = Math.max(sinceId, id);
                    continue;
                }

                const normalized = normalizeTursoEvent(
                    event,
                    session,
                    options.tursoSessionId,
                    options.requestId,
                    options.projectId,
                    false,
                );
                if (!normalized) {
                    if (id) {
                        seenEventIds.add(id);
                        sinceId = Math.max(sinceId, id);
                        eventId = Math.max(eventId, id);
                    }
                    continue;
                }
                sawNewEvent = true;
                emitNormalized(normalized);
                if (terminal) break;
            }

            if (terminal) break;

            status = doc.status || status;
            if (status && status !== 'open') {
                if (status === 'failed' || status === 'cancelled') {
                    emitNormalized({
                        type: 'error',
                        session: session || undefined,
                        eventId: eventId || undefined,
                        text: `Agent session ${status}.`,
                        tursoSessionId: options.tursoSessionId,
                        requestId: options.requestId,
                    });
                } else if (status === 'stopped') {
                    emitNormalized({
                        type: 'stopped',
                        session: session || undefined,
                        eventId: eventId || undefined,
                        text: 'Agent stopped.',
                        tursoSessionId: options.tursoSessionId,
                        requestId: options.requestId,
                    });
                } else {
                    emitNormalized({
                        type: 'done',
                        session: session || undefined,
                        eventId: eventId || undefined,
                        text: '',
                        tursoSessionId: options.tursoSessionId,
                        requestId: options.requestId,
                    });
                }
                break;
            }

            if (sawNewEvent) {
                idlePolls = 0;
                pollIntervalMs = POLL_INTERVAL_FAST_MS;
            } else {
                idlePolls += 1;
                pollIntervalMs = Math.min(
                    POLL_INTERVAL_MAX_MS,
                    idlePolls <= 2 ? POLL_INTERVAL_FAST_MS : POLL_INTERVAL_IDLE_MS + (idlePolls - 3) * 200,
                );
            }

            await sleep(pollIntervalMs, options.signal);
        }
    } finally {
        streamAbort.abort();
        options.signal?.removeEventListener('abort', onParentAbort);
        await streamPromise.catch(() => null);
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
 * Submit a durable agent turn, then poll Turso for activity.
 * Leaving the page no longer kills progress — reopen and call resumeProjectAgent.
 */
export async function streamProjectAgent(options: StreamProjectAgentOptions): Promise<{
    session: number;
    eventId: number;
    tursoSessionId: string;
    requestId: string;
    /** Durable session state after the stream/poll observer reconciles. */
    status: string;
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
                    planMode: options.planMode,
                    agentMode: options.agentMode,
                    afterSession: options.afterSession,
                    thinkingLevel: options.thinkingLevel,
                    executionSpeed: options.executionSpeed,
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
                    status: resumed.status,
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
        status: polled.status,
    };
}

/**
 * Load pending interactive questions for a host project.
 * GET /api/projects/{id}/agent/questions?status=pending
 */
export async function fetchPendingAgentQuestions(
    projectId: string,
    signal?: AbortSignal,
): Promise<AgentQuestion[]> {
    const data = await fetchJson<{
        ok?: boolean;
        questions?: Array<Record<string, unknown>>;
        message?: string;
    }>(
        `/api/projects/${encodeURIComponent(projectId)}/agent/questions?status=pending&limit=20`,
        {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
            credentials: 'same-origin',
            signal,
        },
    );

    const list = Array.isArray(data.questions) ? data.questions : [];
    const normalized: AgentQuestion[] = [];
    for (const raw of list) {
        const q = normalizeAgentQuestion(raw);
        if (q && (!q.status || q.status === 'pending')) normalized.push(q);
    }
    return normalized;
}
