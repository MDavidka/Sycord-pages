/**
 * Model-learn (debug) — auto log of every tool/command with reason + full output.
 * Injected into prompts so Syra avoids repeating failed commands.
 */

export type ModelLearnEntry = {
  id: string
  timestamp: number
  toolName: string
  /** Short label e.g. command string or file path */
  displayLabel: string
  /** Why the AI chose this action (assistant text before the call) */
  reason: string
  /** Full environment output — never trimmed on failure */
  output: string
  success: boolean
  toolCallId?: string
  turnIndex?: number
}

const MAX_STORED_ENTRIES = 200
const MAX_PROMPT_ENTRIES = 24
const MAX_PROMPT_OUTPUT_CHARS = 2500

let entryCounter = 0

export function createModelLearnEntry(
  partial: Omit<ModelLearnEntry, "id" | "timestamp">,
): ModelLearnEntry {
  entryCounter += 1
  return {
    id: `ml-${Date.now()}-${entryCounter}`,
    timestamp: Date.now(),
    ...partial,
  }
}

function classifySuccess(toolName: string, output: string): boolean {
  if (!output) return false
  if (
    output.startsWith("Error ") ||
    output.startsWith("[SYSTEM] ❌") ||
    output.includes("Command exited with code") ||
    output.includes("Command failed")
  ) {
    return false
  }
  if (output.startsWith("[SYSTEM] ✅") || output.includes("Command succeeded")) {
    return true
  }
  if (toolName === "readFile" || toolName === "grep" || toolName === "listFiles") {
    return !output.startsWith("Error")
  }
  return !output.startsWith("Error")
}

export function buildDisplayLabel(toolName: string, argsString: string): string {
  try {
    const args = JSON.parse(argsString || "{}")
    if (toolName === "executeCommand" && args.command) return String(args.command)
    if (args.path) return String(args.path)
    if (args.command) return String(args.command)
    if (Array.isArray(args.commands) && args.commands.length) {
      return args.commands.length === 1 ? String(args.commands[0]) : `${args.commands.length} commands`
    }
    if (args.pattern) return String(args.pattern)
    if (args.query) return String(args.query)
    if (args.action && toolName === "planning") return `planning:${args.action}`
    if (args.component) return String(args.component)
    if (Array.isArray(args.components)) return args.components.join(", ")
  } catch {
    /* fall through */
  }
  return toolName
}

export function recordToolLearnEntry(input: {
  toolName: string
  argsString: string
  output: string
  reason: string
  toolCallId?: string
  turnIndex?: number
}): ModelLearnEntry {
  return createModelLearnEntry({
    toolName: input.toolName,
    displayLabel: buildDisplayLabel(input.toolName, input.argsString),
    reason: input.reason.trim() || "(no reason captured — explain before calling tools)",
    output: input.output,
    success: classifySuccess(input.toolName, input.output),
    toolCallId: input.toolCallId,
    turnIndex: input.turnIndex,
  })
}

/** Cap store size while keeping failures (never drop failed entries first). */
export function trimModelLearnLog(entries: ModelLearnEntry[]): ModelLearnEntry[] {
  if (entries.length <= MAX_STORED_ENTRIES) return entries
  const failures = entries.filter((e) => !e.success)
  const successes = entries.filter((e) => e.success)
  const keepFailures = failures.slice(-80)
  const budget = MAX_STORED_ENTRIES - keepFailures.length
  const keepSuccesses = successes.slice(-Math.max(0, budget))
  return [...keepSuccesses, ...keepFailures].sort((a, b) => a.timestamp - b.timestamp)
}

export function buildModelLearnContext(entries: ModelLearnEntry[]): string {
  if (entries.length === 0) return ""

  const recent = entries.slice(-MAX_PROMPT_ENTRIES)
  const lines = [
    "## 🧠 MODEL-LEARN (debug) — past tool/command outcomes (read before repeating commands)",
    "Do NOT re-run commands that failed below. Learn from full error output.",
    "",
  ]

  for (const e of recent) {
    const status = e.success ? "OK" : "FAILED"
    lines.push(`### ${status}: ${e.toolName} — ${e.displayLabel}`)
    if (e.reason) lines.push(`**Why:** ${e.reason.slice(0, 400)}`)
    const out =
      e.output.length > MAX_PROMPT_OUTPUT_CHARS && e.success
        ? `${e.output.slice(0, MAX_PROMPT_OUTPUT_CHARS)}\n… [truncated success output]`
        : e.output
    lines.push(`**Output:**\n\`\`\`\n${out}\n\`\`\``)
    lines.push("")
  }

  return lines.join("\n")
}

export function exportModelLearnLog(entries: ModelLearnEntry[]): string {
  return JSON.stringify(entries, null, 2)
}
