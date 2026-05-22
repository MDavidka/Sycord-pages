// Syra SSE Streaming — real-time pipeline progress over Server-Sent Events.
//
// The stream endpoint sends JSON-encoded ProgressEvent objects as SSE messages.
// The client chat UI renders these as a live progress block with:
//   - Step-by-step pipeline stages with status icons (✔ ⚡ ◌)
//   - Progress percentage bar
//   - Streaming detail messages
//   - Final generated files manifest

import type { ProgressEvent } from "./types"

export function createSSEStream(write: (chunk: string) => void) {
  const encoder = new TextEncoder()

  return {
    write(chunk: string) {
      write(chunk)
    },
    event(event: ProgressEvent) {
      write(`data: ${JSON.stringify(event)}\n\n`)
    },
    error(code: string, message: string) {
      write(`event: error\ndata: ${JSON.stringify({ code, message })}\n\n`)
    },
    done() {
      write(`data: [DONE]\n\n`)
    },
  }
}

// In-memory stream state for the pipeline
export function streamPipelineProgress(
  events: ProgressEvent[],
  onChunk: (chunk: string) => void,
) {
  const encoder = new TextEncoder()

  for (const event of events) {
    const line = `data: ${JSON.stringify(event)}\n\n`
    onChunk(line)
  }

  onChunk(`data: [DONE]\n\n`)
}

export function buildStreamingResponse(
  stream: ReadableStream<Uint8Array>,
): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  })
}

// Progress UI helper — converts pipeline state to formatted text for chat UI
export function formatProgressForChat(state: {
  steps: Record<string, string>
  progress: number
  detail?: string
}): string {
  const stepEmojis: Record<string, string> = {
    pending: "◌",
    running: "⚡",
    done: "✔",
    error: "✖",
  }

  const lines: string[] = []

  if (state.detail) {
    lines.push(`${state.detail}\n`)
  }

  lines.push(`Progress: ${state.progress}%`)
  lines.push(`[${"■".repeat(Math.floor(state.progress / 5))}${"□".repeat(20 - Math.floor(state.progress / 5))}] ${state.progress}%\n`)

  const stageOrder = ["planning", "manifest", "compiling", "validating", "persisting"]
  for (const stage of stageOrder) {
    const status = state.steps[stage] || "pending"
    const emoji = stepEmojis[status] || "◌"
    const label = stage.charAt(0).toUpperCase() + stage.slice(1)
    lines.push(`  ${emoji} Step ${stageOrder.indexOf(stage) + 1}: ${label} (${status === "done" ? "Done" : status === "running" ? "Running" : "Pending"})`)
  }

  return lines.join("\n")
}
