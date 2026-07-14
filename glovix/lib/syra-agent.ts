/**
 * Syra cloud agent client — talks to Syte VM agent via /api/workspace/agent.
 * Docs: https://sycord.site/api/#agent
 *
 * The Next.js backend does not run the coding loop; the durable VM agent does.
 */

import type { ModelType } from './ai';
import { getModelChoice } from './ai';

export type SyraModelProfile = 'syra-nano' | 'syra-base' | 'syra-havy';

export type SyraAgentEvent = {
  id?: number;
  event_type: string;
  role?: string;
  title?: string;
  detail?: string;
  source?: string;
  request_id?: string;
  payload?: Record<string, unknown>;
  text?: string;
  tool?: string;
  ok?: boolean;
  is_error?: boolean;
};

export function modelTypeToSyraProfile(modelType: ModelType): SyraModelProfile {
  const choice = getModelChoice(modelType);
  const id = choice.id;
  if (id === 'nano') return 'syra-nano';
  if (id === 'havy') return 'syra-havy';
  return 'syra-base';
}

export async function warmSyraAgent(projectId: string): Promise<{
  ok: boolean;
  uuid?: string;
  status?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/workspace/agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'warm', projectId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data?.ok === false) {
      return { ok: false, error: data?.error || `Warm failed (${res.status})` };
    }
    return {
      ok: true,
      uuid: data.uuid,
      status: data.status,
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Warm request failed' };
  }
}

export async function getSyraAgentStatus(projectId: string) {
  const res = await fetch(
    `/api/workspace/agent?action=status&projectId=${encodeURIComponent(projectId)}`,
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `Agent status failed (${res.status})`);
  }
  return data;
}

export async function submitSyraAgentChange(input: {
  projectId: string;
  message: string;
  modelProfile?: SyraModelProfile;
  signal?: AbortSignal;
}): Promise<{
  request_id: string | null;
  status: string;
  stream_path: string;
  uuid: string;
  reply?: string | null;
}> {
  const res = await fetch('/api/workspace/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'change',
      projectId: input.projectId,
      message: input.message,
      model_profile: input.modelProfile,
    }),
    signal: input.signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.ok === false) {
    throw new Error(data?.error || `Agent change failed (${res.status})`);
  }
  return {
    request_id: data.request_id ?? null,
    status: data.status ?? 'accepted',
    stream_path:
      data.stream_path ||
      `/api/workspace/agent/stream?projectId=${encodeURIComponent(input.projectId)}`,
    uuid: data.uuid,
    reply: data.reply ?? null,
  };
}

function parseSseBlocks(buffer: string): { events: Array<{ id?: string; data: string }>; rest: string } {
  const parts = buffer.split(/\n\n/);
  const rest = parts.pop() ?? '';
  const events: Array<{ id?: string; data: string }> = [];

  for (const part of parts) {
    if (!part.trim()) continue;
    let id: string | undefined;
    const dataLines: string[] = [];
    for (const line of part.split(/\n/)) {
      if (line.startsWith('id:')) id = line.slice(3).trim();
      else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
    }
    if (dataLines.length) events.push({ id, data: dataLines.join('\n') });
  }

  return { events, rest };
}

function normalizeActivityPayload(raw: unknown, sseId?: string): SyraAgentEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, any>;

  // Default SSE format: { type: 'activity', event: {...} }
  if (obj.type === 'activity' && obj.event && typeof obj.event === 'object') {
    const ev = obj.event as Record<string, any>;
    const payload = (ev.payload && typeof ev.payload === 'object' ? ev.payload : {}) as Record<string, unknown>;
    return {
      id: typeof ev.id === 'number' ? ev.id : Number(sseId) || undefined,
      event_type: String(ev.event_type || ev.type || 'activity'),
      role: ev.role,
      title: ev.title,
      detail: typeof ev.detail === 'string' ? ev.detail : undefined,
      source: ev.source,
      request_id: typeof payload.request_id === 'string' ? payload.request_id : undefined,
      payload,
      text: typeof ev.detail === 'string' ? ev.detail : undefined,
      tool: typeof payload.tool === 'string' ? payload.tool : undefined,
      ok: typeof payload.ok === 'boolean' ? payload.ok : undefined,
    };
  }

  if (obj.type === 'ping' || obj.type === 'session' || obj.type === 'reconnect') {
    return {
      event_type: String(obj.type),
      id: typeof obj.since_id === 'number' ? obj.since_id : undefined,
      payload: obj as Record<string, unknown>,
    };
  }

  // Tagged-style JSON already flattened
  if (typeof obj.type === 'string' || typeof obj.event_type === 'string') {
    const eventType = String(obj.event_type || obj.type);
    const payload = (obj.payload && typeof obj.payload === 'object' ? obj.payload : obj) as Record<string, unknown>;
    return {
      id: typeof obj.id === 'number' ? obj.id : Number(sseId) || undefined,
      event_type: eventType,
      role: obj.role,
      title: obj.title,
      detail: typeof obj.detail === 'string' ? obj.detail : typeof obj.text === 'string' ? obj.text : undefined,
      text: typeof obj.text === 'string' ? obj.text : typeof obj.detail === 'string' ? obj.detail : undefined,
      request_id:
        typeof obj.request_id === 'string'
          ? obj.request_id
          : typeof payload.request_id === 'string'
            ? (payload.request_id as string)
            : undefined,
      payload,
      tool: typeof obj.tool === 'string' ? obj.tool : typeof payload.tool === 'string' ? (payload.tool as string) : undefined,
      ok: typeof obj.ok === 'boolean' ? obj.ok : typeof payload.ok === 'boolean' ? (payload.ok as boolean) : undefined,
      is_error: typeof obj.is_error === 'boolean' ? obj.is_error : undefined,
    };
  }

  return null;
}

/**
 * Stream one durable agent turn. Correlates frames by request_id when provided.
 * Resolves when request_completed / request_failed arrives (or abort / timeout).
 */
export async function runSyraAgentTurn(input: {
  projectId: string;
  message: string;
  modelProfile?: SyraModelProfile;
  sinceId?: number;
  signal?: AbortSignal;
  onEvent?: (event: SyraAgentEvent) => void;
  timeoutMs?: number;
}): Promise<{
  requestId: string | null;
  reply: string;
  failed: boolean;
  error?: string;
  lastEventId: number;
}> {
  const change = await submitSyraAgentChange({
    projectId: input.projectId,
    message: input.message,
    modelProfile: input.modelProfile,
    signal: input.signal,
  });

  // Legacy blocking reply (rare)
  if (change.reply && !change.request_id) {
    return {
      requestId: null,
      reply: change.reply,
      failed: false,
      lastEventId: input.sinceId ?? 0,
    };
  }

  const requestId = change.request_id;
  let lastEventId = input.sinceId ?? 0;
  let reply = '';
  let failed = false;
  let error: string | undefined;
  let terminal = false;

  const streamUrl = new URL(change.stream_path, window.location.origin);
  streamUrl.searchParams.set('since_id', String(lastEventId));
  streamUrl.searchParams.set('live', '1');
  streamUrl.searchParams.set('format', 'sse');

  const timeoutMs = input.timeoutMs ?? 30 * 60 * 1000;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);

  const onAbort = () => timeoutController.abort();
  input.signal?.addEventListener('abort', onAbort);

  const mergedSignal = timeoutController.signal;

  try {
    const res = await fetch(streamUrl.toString(), {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: mergedSignal,
    });

    if (!res.ok || !res.body) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error || `Agent stream failed (${res.status})`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (!terminal) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSseBlocks(buffer);
      buffer = parsed.rest;

      for (const block of parsed.events) {
        let json: unknown = null;
        try {
          json = JSON.parse(block.data);
        } catch {
          continue;
        }

        const event = normalizeActivityPayload(json, block.id);
        if (!event) continue;

        if (typeof event.id === 'number' && event.id > lastEventId) {
          lastEventId = event.id;
        }

        // Ignore control frames for UI / completion
        if (event.event_type === 'ping' || event.event_type === 'session') {
          input.onEvent?.(event);
          continue;
        }

        if (event.event_type === 'reconnect') {
          input.onEvent?.(event);
          continue;
        }

        // Correlate to this request when ids are present
        if (
          requestId &&
          event.request_id &&
          event.request_id !== requestId &&
          event.event_type !== 'agent_started' &&
          event.event_type !== 'agent_stopped'
        ) {
          continue;
        }

        input.onEvent?.(event);

        if (event.event_type === 'token_delta') {
          const delta =
            (typeof event.payload?.delta === 'string' && event.payload.delta) ||
            event.text ||
            event.detail ||
            '';
          if (delta) reply += delta;
        }

        if (event.event_type === 'message_snapshot' || event.event_type === 'assistant_message') {
          const snap =
            (typeof event.payload?.reply === 'string' && event.payload.reply) ||
            event.text ||
            event.detail ||
            '';
          if (snap) reply = snap;
        }

        if (event.event_type === 'request_completed') {
          const finalReply =
            (typeof event.payload?.reply === 'string' && event.payload.reply) ||
            event.text ||
            event.detail ||
            reply;
          reply = finalReply || reply || 'Done.';
          terminal = true;
          break;
        }

        if (event.event_type === 'request_failed') {
          failed = true;
          error =
            (typeof event.payload?.error === 'string' && event.payload.error) ||
            (typeof event.payload?.retry_message === 'string' && event.payload.retry_message) ||
            event.detail ||
            event.text ||
            'Agent request failed';
          reply = error;
          terminal = true;
          break;
        }
      }
    }

    if (!terminal && !reply) {
      // Stream closed without a terminal event — poll snapshot once as fallback
      const snap = await fetch(
        `/api/workspace/agent?action=activity&projectId=${encodeURIComponent(input.projectId)}&since_id=${Math.max(0, lastEventId - 1)}`,
      );
      const snapData = await snap.json().catch(() => ({}));
      const events = Array.isArray(snapData?.events) ? snapData.events : [];
      for (const ev of events) {
        const normalized = normalizeActivityPayload({ type: 'activity', event: ev });
        if (!normalized) continue;
        if (requestId && normalized.request_id && normalized.request_id !== requestId) continue;
        input.onEvent?.(normalized);
        if (normalized.event_type === 'request_completed') {
          reply =
            (typeof normalized.payload?.reply === 'string' && normalized.payload.reply) ||
            normalized.detail ||
            'Done.';
          terminal = true;
        }
        if (normalized.event_type === 'request_failed') {
          failed = true;
          error = normalized.detail || 'Agent request failed';
          reply = error;
          terminal = true;
        }
      }
    }

    if (!reply) {
      reply = failed ? error || 'Agent request failed' : 'Agent finished with no reply text.';
    }

    return { requestId, reply, failed, error, lastEventId };
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener('abort', onAbort);
  }
}
