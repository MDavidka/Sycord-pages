// Client-side event model for the rebuilt Syra agent stream.
//
// The Syte activity stream is consumed in the compact "tagged" SSE encoding
// (?format=tagged), where each `data:` frame carries one record shaped like
// `[tag]<{...json...}>`. This module turns those raw frames into a small,
// strongly-typed activity model the UI can render directly.
//
// Tagged vocabulary (see https://sycord.site/api/#agent):
//   [session] [start] [processing] [think] [tool:start] [tool:result]
//   [delta] [message] [done] [error] [status] [ping] [reconnect]
//
// Turn lifecycle (correlate by request_id):
//   request_started → processing → thinking? → (tool_call_started/finished)* →
//   request_completed | request_failed

export type SyraEventTag =
  | "session"
  | "start"
  | "processing"
  | "think"
  | "tool:start"
  | "tool:result"
  | "delta"
  | "message"
  | "done"
  | "error"
  | "status"
  | "ping"
  | "reconnect"

/** A raw record decoded from a single tagged frame. */
export interface SyraTaggedRecord {
  tag: SyraEventTag | string
  data: Record<string, any>
}

/**
 * Parse one EventSource `data:` payload. In tagged mode the payload looks like
 * `[tag]<json>`. Returns null for anything that isn't a well-formed record.
 */
export function parseTaggedFrame(payload: string): SyraTaggedRecord | null {
  if (!payload) return null
  const trimmed = payload.trim()
  const match = /^\[([^\]]+)\]<([\s\S]*)>$/.exec(trimmed)
  if (!match) return null
  const [, tag, json] = match
  try {
    const data = json ? JSON.parse(json) : {}
    return { tag, data: data && typeof data === "object" ? data : { value: data } }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Normalised activity model
// ---------------------------------------------------------------------------

/** High-level kind used to pick an icon + verb in the UI. */
export type ActivityKind =
  | "read"
  | "write"
  | "edit"
  | "delete"
  | "command"
  | "search"
  | "list"
  | "plan"
  | "deploy"
  | "generic"

export type ActivityStatus = "running" | "done" | "error"

export interface SyraActivity {
  /** Stable id: the tool_call_started event id (finished updates the same row). */
  id: string
  kind: ActivityKind
  /** Raw tool name from the runtime, kept for debugging/tooltips. */
  tool: string
  status: ActivityStatus
  /** Optional path/target for file activities — never the raw command string. */
  detail?: string
  requestId?: string
  createdAt: number
}

export type SyraPhase =
  | "idle"
  | "starting"
  | "thinking"
  | "planning"
  | "working"
  | "done"
  | "error"

/** One conversation turn (user message + the agent's reasoning/activities/reply). */
export interface SyraTurn {
  /** Client id until the runtime assigns a request_id, then that. */
  id: string
  requestId?: string
  role: "user" | "assistant"
  userMessage?: string
  phase: SyraPhase
  thinking: string
  activities: SyraActivity[]
  reply?: string
  error?: string
  createdAt: number
}

/**
 * Map a runtime tool name to a coarse kind. The runtime may use a variety of
 * names (read_file, readFile, write_file, edit_file, run_command, grep, …) so we
 * match loosely on substrings.
 */
export function toolKind(tool: string): ActivityKind {
  const t = (tool || "").toLowerCase()
  if (/(delete|remove|rm_file|unlink)/.test(t)) return "delete"
  if (/(edit|modify|patch|apply|str_replace|update_file)/.test(t)) return "edit"
  if (/(write|create|new_file|add_file|batch)/.test(t)) return "write"
  if (/(read|open_file|cat|view_file|get_file)/.test(t)) return "read"
  if (/(command|shell|exec|run_|terminal|bash|npm|install)/.test(t)) return "command"
  if (/(search|grep|find|lookup|ripgrep)/.test(t)) return "search"
  if (/(list|ls|tree|glob|dir)/.test(t)) return "list"
  if (/(plan|todo|checklist)/.test(t)) return "plan"
  if (/(deploy|publish|ship|build)/.test(t)) return "deploy"
  return "generic"
}

/** Verb pair [running, done] per kind. Commands never show the raw command. */
export const KIND_VERBS: Record<ActivityKind, [string, string]> = {
  read: ["Reading file", "Read file"],
  write: ["Creating file", "Created file"],
  edit: ["Editing file", "Edited file"],
  delete: ["Deleting file", "Deleted file"],
  command: ["Running command", "Ran command"],
  search: ["Searching files", "Searched files"],
  list: ["Listing files", "Listed files"],
  plan: ["Planning", "Planned"],
  deploy: ["Deploying", "Deployed"],
  generic: ["Working", "Done"],
}

/**
 * Best-effort extraction of a human-friendly detail (a file path) from tool
 * arguments. Commands are intentionally excluded — the UI shows "Ran command"
 * only, never the executed command string.
 */
export function extractDetail(kind: ActivityKind, args: any): string | undefined {
  if (kind === "command") return undefined
  if (args == null) return undefined
  let parsed: any = args
  if (typeof args === "string") {
    try {
      parsed = JSON.parse(args)
    } catch {
      // A bare string arg for a file tool is likely the path itself.
      return kind === "search" || kind === "list" ? undefined : args
    }
  }
  if (parsed && typeof parsed === "object") {
    const candidate =
      parsed.path ||
      parsed.file ||
      parsed.filename ||
      parsed.target ||
      (Array.isArray(parsed.paths) ? `${parsed.paths.length} files` : undefined) ||
      (Array.isArray(parsed.files) ? `${parsed.files.length} files` : undefined) ||
      parsed.query ||
      parsed.pattern
    if (typeof candidate === "string") return candidate
  }
  return undefined
}


// ---------------------------------------------------------------------------
// History reconstruction
// ---------------------------------------------------------------------------

/** Raw event shape returned by the activity snapshot (non-tagged JSON). */
export interface SyteActivityEvent {
  id: number
  event_type: string
  role?: string
  title?: string
  detail?: string
  payload?: {
    request_id?: string
    tool?: string
    arguments?: unknown
    ok?: boolean
    is_error?: boolean
    reply?: string
    error?: string
    path?: string
    text?: string
  }
  source?: string
  created_at?: string
}

/** Map a workspace edit event_type to an activity kind. */
function eventTypeKind(eventType: string): ActivityKind {
  switch (eventType) {
    case "file_created":
      return "write"
    case "file_modified":
      return "edit"
    case "file_deleted":
      return "delete"
    case "command_run":
      return "command"
    default:
      return "generic"
  }
}

let histSeq = 0

/**
 * Reduce a chronological list of persisted activity events into finished turns.
 * Used to restore the full conversation when (re)opening a durable project.
 * Every produced turn is terminal (done/error) since it is replayed history.
 */
export function buildTurnsFromEvents(events: SyteActivityEvent[]): {
  turns: SyraTurn[]
  lastId: number
} {
  const turns: SyraTurn[] = []
  const byRequest = new Map<string, SyraTurn>()
  let lastId = 0

  const ensureTurn = (requestId: string | undefined, userMessage?: string): SyraTurn => {
    let turn = requestId ? byRequest.get(requestId) : undefined
    if (!turn) {
      turn = {
        id: `hist-${++histSeq}`,
        requestId,
        role: "user",
        userMessage,
        phase: "done",
        thinking: "",
        activities: [],
        createdAt: Date.now(),
      }
      turns.push(turn)
      if (requestId) byRequest.set(requestId, turn)
    } else if (userMessage && !turn.userMessage) {
      turn.userMessage = userMessage
    }
    return turn
  }

  const sorted = [...events].sort((a, b) => (a.id || 0) - (b.id || 0))

  for (const ev of sorted) {
    if (typeof ev.id === "number" && ev.id > lastId) lastId = ev.id
    const rid = ev.payload?.request_id
    const detail = ev.detail || ev.payload?.text || ev.payload?.reply

    switch (ev.event_type) {
      case "user_message":
      case "request_started": {
        ensureTurn(rid, detail)
        break
      }
      case "processing": {
        ensureTurn(rid)
        break
      }
      case "thinking": {
        const t = ensureTurn(rid)
        t.thinking += ev.detail || ev.payload?.text || ""
        break
      }
      case "tool_call_started": {
        const t = ensureTurn(rid)
        const tool = ev.payload?.tool || ev.title || "tool"
        const kind = toolKind(tool)
        t.activities.push({
          id: String(ev.id),
          kind,
          tool,
          status: "running",
          detail: extractDetail(kind, ev.payload?.arguments),
          requestId: rid,
          createdAt: Date.now(),
        })
        break
      }
      case "tool_call_finished": {
        const t = ensureTurn(rid)
        const tool = ev.payload?.tool || ev.title || "tool"
        const isError = ev.payload?.is_error === true || ev.payload?.ok === false
        for (let i = t.activities.length - 1; i >= 0; i--) {
          if (t.activities[i].tool === tool && t.activities[i].status === "running") {
            t.activities[i] = { ...t.activities[i], status: isError ? "error" : "done" }
            break
          }
        }
        break
      }
      case "file_created":
      case "file_modified":
      case "file_deleted":
      case "command_run": {
        const t = ensureTurn(rid)
        const kind = eventTypeKind(ev.event_type)
        t.activities.push({
          id: String(ev.id),
          kind,
          tool: ev.event_type,
          status: "done",
          // Commands never expose the executed command string.
          detail: kind === "command" ? undefined : ev.payload?.path || ev.detail,
          requestId: rid,
          createdAt: Date.now(),
        })
        break
      }
      case "request_completed": {
        const t = ensureTurn(rid)
        t.reply = ev.payload?.reply || ev.detail || t.reply
        t.phase = "done"
        t.activities = t.activities.map((a) =>
          a.status === "running" ? { ...a, status: "done" } : a,
        )
        break
      }
      case "request_failed": {
        const t = ensureTurn(rid)
        t.error = ev.payload?.error || ev.detail || "Request failed"
        t.phase = "error"
        break
      }
      default:
        break
    }
  }

  return { turns, lastId }
}
