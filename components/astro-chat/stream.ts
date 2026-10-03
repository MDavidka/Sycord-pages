import { ChatMessage, Plan, ToolCallItem, QuestionItem, PreviewState } from './types'

export interface StreamCallbacks {
  onTokenDelta: (delta: string) => void
  onThinkingDelta: (delta: string) => void
  onThinkingDone: (durationSeconds?: number) => void
  onToolCallStart: (tool: ToolCallItem) => void
  onToolCallDone: (tool: ToolCallItem) => void
  onPlan: (plan: Plan) => void
  onPlanUpdate: (stepId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed', notes?: string) => void
  onQuestion: (question: QuestionItem) => void
  onPreviewReady: (preview: { url: string; port?: number; domain?: string }) => void
  onError: (error: string) => void
  onDone: () => void
}

const TOOLS_SCHEMA = [
  {
    type: "function",
    function: {
      name: "create_plan",
      description: "Create an autonomous multi-step execution plan for the user request. Mandatory for code/build tasks.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Title of the plan" },
          steps: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                title: { type: "string" },
                status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] },
              },
              required: ["id", "title", "status"],
            },
          },
        },
        required: ["title", "steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_plan_step",
      description: "Update the status of a step in the implementation plan.",
      parameters: {
        type: "object",
        properties: {
          step_id: { type: "string" },
          status: { type: "string", enum: ["pending", "in_progress", "completed", "failed"] },
          notes: { type: "string" },
        },
        required: ["step_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description: "Create or overwrite a file in the workspace with complete production code.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path (e.g. src/App.tsx, package.json)" },
          content: { type: "string", description: "Full file content" },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Perform surgical find-and-replace on a file in the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path" },
          target: { type: "string", description: "Exact string to replace" },
          replacement: { type: "string", description: "New replacement string" },
        },
        required: ["path", "target", "replacement"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read file contents from the workspace.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Relative file path" },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_preview",
      description: "Start or verify the live development preview server and return the live URL.",
      parameters: {
        type: "object",
        properties: {
          port: { type: "number", description: "Optional preferred port" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ask_question",
      description: "Ask the user an interactive question when design trade-offs, preferences, or secrets are needed.",
      parameters: {
        type: "object",
        properties: {
          question: { type: "string", description: "The question prompt" },
          options: {
            type: "array",
            items: { type: "string" },
            description: "Suggested answer options",
          },
          allow_custom: { type: "boolean", description: "Allow custom write-in answers" },
        },
        required: ["question"],
      },
    },
  },
]

export async function executeWorkspaceTool(
  projectId: string,
  name: string,
  args: Record<string, any>
): Promise<any> {
  const normName = name.replace(/^syte_/, "")

  if (normName === "write_file" || normName === "create_file") {
    try {
      const res = await fetch("/api/workspace/file", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          path: args.path,
          content: args.content,
        }),
      })
      const data = await res.json().catch(() => ({}))
      return { ok: res.ok, message: `Saved ${args.path}`, path: args.path, ...data }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to write file" }
    }
  }

  if (normName === "start_preview") {
    try {
      const res = await fetch(`/api/workspace/preview?projectId=${encodeURIComponent(projectId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const data = await res.json().catch(() => ({}))
      return {
        ok: res.ok,
        preview_url: data.previewUrl || "",
        previewUrl: data.previewUrl || "",
        status: data.previewReady ? "running" : "starting",
        message: data.previewUrl ? `Preview ready on ${data.previewUrl}` : "Starting dev server...",
        ...data,
      }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to start preview" }
    }
  }

  if (normName === "read_file") {
    try {
      const res = await fetch(`/api/workspace/file?projectId=${encodeURIComponent(projectId)}&path=${encodeURIComponent(args.path)}`)
      if (res.ok) {
        const data = await res.json().catch(() => ({}))
        return { ok: true, content: data.content || "" }
      }
      return { ok: false, error: "File not found" }
    } catch (e: any) {
      return { ok: false, error: e?.message || "Failed to read file" }
    }
  }

  if (normName === "create_plan" || normName === "update_plan_step" || normName === "ask_question") {
    return { ok: true, ...args }
  }

  return { ok: true, message: `Tool ${name} executed.` }
}

export function parseSSELines(rawChunk: string): Array<{ event?: string; data: string }> {
  const events: Array<{ event?: string; data: string }> = []
  const blocks = rawChunk.split(/\r?\n\r?\n/)

  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue

    const lines = trimmed.split(/\r?\n/)
    let eventName: string | undefined
    const dataLines: string[] = []

    for (const line of lines) {
      if (line.startsWith(":")) continue // SSE comment / keep-alive
      if (line.startsWith("event:")) {
        eventName = line.slice(6).trim()
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim())
      }
    }

    if (dataLines.length > 0) {
      events.push({
        event: eventName,
        data: dataLines.join("\n"),
      })
    }
  }

  return events
}

export async function runAstroChatTurn(
  projectId: string,
  model: string,
  conversation: Array<{ role: string; content: string; tool_calls?: any[]; tool_call_id?: string }>,
  callbacks: StreamCallbacks,
  signal: AbortSignal
): Promise<{
  assistantContent: string
  toolCalls: ToolCallItem[]
  thinking: string
  previewUrl?: string
}> {
  const res = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: conversation,
      tools: TOOLS_SCHEMA,
      temperature: 0.7,
      stream: true,
    }),
    signal,
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => `HTTP ${res.status}`)
    throw new Error(`AI Chat request failed: ${errText}`)
  }

  if (!res.body) {
    throw new Error("No response body received from AI stream")
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""

  let fullContent = ""
  let fullThinking = ""
  let thinkingStart: number | null = null
  let pendingToolCalls: Map<string, { id: string; name: string; argsStr: string }> = new Map()
  let previewUrlDetected: string | undefined

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const sseBlocks = parseSSELines(buffer)
      
      // Keep only trailing partial block in buffer
      const lastDoubleNewline = buffer.lastIndexOf("\n\n")
      if (lastDoubleNewline !== -1) {
        buffer = buffer.slice(lastDoubleNewline + 2)
      }

      for (const item of sseBlocks) {
        if (item.data === "[DONE]") {
          continue
        }

        try {
          const payload = JSON.parse(item.data)

          // 1. Check for thinking / reasoning
          const reasoning = payload.choices?.[0]?.delta?.reasoning_content || payload.choices?.[0]?.delta?.thinking || payload.delta?.thinking || payload.thinking
          if (reasoning) {
            if (!thinkingStart) thinkingStart = Date.now()
            fullThinking += reasoning
            callbacks.onThinkingDelta(reasoning)
          }

          // 2. Check for content tokens
          const content = payload.choices?.[0]?.delta?.content || payload.delta?.content || payload.content
          if (content) {
            if (thinkingStart && !fullContent) {
              const dur = Math.round((Date.now() - thinkingStart) / 1000)
              callbacks.onThinkingDone(Math.max(1, dur))
              thinkingStart = null
            }
            fullContent += content
            callbacks.onTokenDelta(content)

            // Detect preview links emitted in markdown
            const previewMatch = content.match(/https?:\/\/[a-zA-Z0-9.-]+\.sycord\.site[^\s)\]]*/i)
            if (previewMatch && !previewUrlDetected) {
              previewUrlDetected = previewMatch[0]
              callbacks.onPreviewReady({ url: previewMatch[0] })
            }
          }

          // 3. Check for tool calls
          const deltas = payload.choices?.[0]?.delta?.tool_calls || payload.tool_calls
          if (Array.isArray(deltas)) {
            for (const dt of deltas) {
              const idxKey = String(dt.index ?? dt.id ?? "0")
              const existing = pendingToolCalls.get(idxKey) || {
                id: dt.id || `tc_${Math.random().toString(36).slice(2, 9)}`,
                name: dt.function?.name || "",
                argsStr: "",
              }
              if (dt.id) existing.id = dt.id
              if (dt.function?.name) existing.name = dt.function.name
              if (dt.function?.arguments) existing.argsStr += dt.function.arguments

              pendingToolCalls.set(idxKey, existing)

              callbacks.onToolCallStart({
                id: existing.id,
                name: existing.name,
                args: {},
                status: "running",
              })
            }
          }

          // 4. Handle dedicated backend events if present
          if (item.event === "preview_ready" || payload.event === "preview_ready") {
            const pUrl = payload.preview_url || payload.url
            if (pUrl) {
              previewUrlDetected = pUrl
              callbacks.onPreviewReady({
                url: pUrl,
                port: payload.preview_port,
                domain: payload.preview_domain,
              })
            }
          }

          if (item.event === "plan" || payload.event === "plan") {
            const p = payload.plan || payload
            if (p?.steps) callbacks.onPlan(p)
          }

          if (item.event === "plan_update" || payload.event === "plan_update") {
            callbacks.onPlanUpdate(payload.step_id, payload.status, payload.notes)
          }
        } catch {
          // Non-JSON SSE payload; ignore
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  // Parse completed tool calls
  const finalTools: ToolCallItem[] = []
  for (const [, item] of pendingToolCalls) {
    let parsedArgs: Record<string, any> = {}
    try {
      parsedArgs = item.argsStr ? JSON.parse(item.argsStr) : {}
    } catch {
      parsedArgs = { raw: item.argsStr }
    }
    finalTools.push({
      id: item.id,
      name: item.name,
      args: parsedArgs,
      status: "completed",
    })
  }

  return {
    assistantContent: fullContent,
    toolCalls: finalTools,
    thinking: fullThinking,
    previewUrl: previewUrlDetected,
  }
}
