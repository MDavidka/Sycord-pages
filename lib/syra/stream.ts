// Syra SSE Stream — server-sent events for real-time pipeline progress.
// Used by the chat UI to render live pipeline stage cards.

import type { ProgressEvent, PipelineState } from "./types"

export function createSSEStream(): {
  write: (chunk: string) => void
  event: (e: ProgressEvent) => void
  close: () => void
  state: () => string
} {
  let buffer = ""

  return {
    write(chunk: string) { buffer += chunk },
    event(e: ProgressEvent) { buffer += `data: ${JSON.stringify(e)}\n\n` },
    close() { buffer += "data: [DONE]\n\n" },
    state() { return buffer },
  }
}

export function formatProgressForChat(state: PipelineState): string {
  const statusIcon: Record<string, string> = {
    pending: "◌", running: "⚡", done: "✔", error: "✖",
  }

  const lines: string[] = [
    `🎨 **${state.detail || "Building your site..."}**`,
    "",
    `**Progress:** ${state.overallProgress}%`,
    `[\`${"■".repeat(Math.max(1, Math.floor(state.overallProgress / 5)))}${"□".repeat(20 - Math.max(1, Math.floor(state.overallProgress / 5)))}\`]`,
    "",
    "**Pipeline Stages:**",
  ]

  for (const step of state.steps) {
    const icon = statusIcon[step.status] || "◌"
    const label = step.label
    const detail = step.status === "running" && step.detail ? ` — ${step.detail}` : ""
    const strike = step.status === "error" ? " ~~" + label + "~~" : ` **${label}**`
    lines.push(`  ${icon} ${label}${detail}`)
  }

  if (state.warnings.length > 0) {
    lines.push("")
    lines.push("⚠️ Warnings:")
    for (const w of state.warnings.slice(0, 3)) lines.push(`  - ${w}`)
  }

  return lines.join("\n")
}
