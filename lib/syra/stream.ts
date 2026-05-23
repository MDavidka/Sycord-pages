// Syra SSE — streaming events + progress formatter

import type { ProgressEvent, PipelineState } from "./types"

export function formatProgressForChat(state: PipelineState): string {
  const icon: Record<string, string> = { pending: "◌", running: "⚡", done: "✔", error: "✖" }

  const lines = [
    `🎨 **Building your site...**`,
    ``,
    `**Progress:** ${state.overallProgress}%`,
    `[\`${"■".repeat(Math.max(1, Math.floor(state.overallProgress / 4)))}${"□".repeat(25 - Math.max(1, Math.floor(state.overallProgress / 4)))}\`]`,
    ``,
    `**Pipeline Stages:**`,
  ]

  for (const step of state.steps) {
    const ico = icon[step.status] || "◌"
    lines.push(`  ${ico} **${step.label}**${step.status === "running" && state.detail ? ` ~ ${state.detail}` : ""}`)
  }

  if (state.warnings.length > 0) {
    lines.push(``, `⚠️ Warnings:`)
    for (const w of state.warnings.slice(0, 3)) lines.push(`  - ${w}`)
  }

  return lines.join("\n")
}
