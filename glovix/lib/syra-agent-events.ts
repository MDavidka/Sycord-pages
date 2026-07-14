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
