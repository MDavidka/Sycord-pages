// Gemini Vertex AI bridge for the Glovix builder.
//
// Glovix speaks the OpenAI chat-completions protocol (streaming SSE with
// `tools` / `tool_calls`). This module lets the `/api/ai/chat` route serve those
// requests with Google Gemini on Vertex AI (the same engine the old "Syra"
// builder used) instead of an external OpenAI-compatible endpoint.
//
// It does two things:
//   1. Converts an OpenAI request (messages + tools) into Gemini `Content[]` +
//      `functionDeclarations`.
//   2. Streams Gemini's response back as OpenAI-compatible
//      `chat.completion.chunk` SSE events, so the Glovix client parser is
//      unchanged.
//
// Configuration (same env vars as the previous Vertex setup):
//   GOOGLE_AIAGENT_API        API key (Vertex express mode / Gemini Dev API)
//   GOOGLE_AIAGENT_MODEL      model id (default: gemini-3.5-flash)
//   GOOGLE_VERTEX_PROJECT     GCP project id -> full Vertex AI mode (ADC)
//   GOOGLE_VERTEX_LOCATION    region (default: global -> global endpoint)
//   GOOGLE_GENAI_USE_VERTEXAI "false" to force the Gemini Developer API

import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  type Content,
  type FunctionDeclaration,
  type GenerateContentConfig,
  type Part,
  type Schema,
} from "@google/genai"

export const GEMINI_MODEL = process.env.GOOGLE_AIAGENT_MODEL || "gemini-3.5-flash"

export type AiMode = "vertex" | "vertex-express" | "developer"

export interface AiClient {
  ai: GoogleGenAI
  mode: AiMode
  model: string
}

// The Vertex AI "global" location. Routing through the global endpoint spreads
// requests across every region, giving the largest aggregate capacity and far
// fewer 429 RESOURCE_EXHAUSTED errors than any single region. This is the
// default for the builder.
export const GLOBAL_LOCATION = "global"

function readEnv() {
  const apiKey = process.env.GOOGLE_AIAGENT_API || process.env.GOOGLE_AIAGENT_API_KEY || ""
  const project = process.env.GOOGLE_VERTEX_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || ""
  // Default to the GLOBAL endpoint. A specific region can still be pinned via
  // GOOGLE_VERTEX_LOCATION / GOOGLE_CLOUD_LOCATION, but absent that we always
  // use "global".
  const location =
    process.env.GOOGLE_VERTEX_LOCATION || process.env.GOOGLE_CLOUD_LOCATION || GLOBAL_LOCATION
  const useVertex = (process.env.GOOGLE_GENAI_USE_VERTEXAI ?? "true").toLowerCase() !== "false"
  return { apiKey, project, location, useVertex }
}

export function isConfigured(): boolean {
  const { apiKey, project, useVertex } = readEnv()
  return !!((useVertex && project) || apiKey)
}

// Global Vertex AI endpoint. The `global` location routes requests across all
// regions, which has the largest aggregate capacity and is far less likely to
// return 429 RESOURCE_EXHAUSTED than any single region. We pin the base URL
// explicitly so we always hit the global endpoint when the location is global.
const VERTEX_GLOBAL_BASE_URL = "https://aiplatform.googleapis.com/"

/** Construct the Gemini client, preferring Vertex AI on the GLOBAL endpoint. */
export function getAiClient(): AiClient {
  const { apiKey, project, location, useVertex } = readEnv()
  const isGlobal = location === GLOBAL_LOCATION
  // Force the global base URL whenever we're on the global location so the
  // request never falls back to a regional host (regional hosts 429 sooner).
  const globalHttpOptions = isGlobal ? { httpOptions: { baseUrl: VERTEX_GLOBAL_BASE_URL } } : {}

  if (useVertex && project) {
    // Full Vertex AI mode (Application Default Credentials). Default location is
    // "global"; a caller can still pin a region via GOOGLE_VERTEX_LOCATION /
    // GOOGLE_CLOUD_LOCATION.
    return {
      ai: new GoogleGenAI({
        vertexai: true,
        project,
        location,
        ...globalHttpOptions,
      }),
      mode: "vertex",
      model: GEMINI_MODEL,
    }
  }
  if (useVertex && apiKey) {
    // Vertex express mode (API key). Also target the global endpoint.
    return {
      ai: new GoogleGenAI({ vertexai: true, apiKey, ...globalHttpOptions }),
      mode: "vertex-express",
      model: GEMINI_MODEL,
    }
  }
  if (apiKey) {
    return { ai: new GoogleGenAI({ apiKey }), mode: "developer", model: GEMINI_MODEL }
  }
  throw new Error(
    "Gemini is not configured: set GOOGLE_VERTEX_PROJECT (Vertex AI + ADC) or GOOGLE_AIAGENT_API (API key).",
  )
}

function isRetryable(err: any): boolean {
  const code = err?.status ?? err?.code ?? err?.response?.status
  if (code === 429 || code === 503 || code === 500) return true
  const msg = String(err?.message || err || "").toLowerCase()
  return (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("resource exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("unavailable") ||
    msg.includes("overloaded") ||
    msg.includes("503")
  )
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export async function withRetry<T>(fn: () => Promise<T>, attempts = 4): Promise<T> {
  let lastErr: any
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i === attempts - 1 || !isRetryable(err)) break
      const backoff = Math.min(1000 * 2 ** i, 8000) + Math.floor(Math.random() * 400)
      await sleep(backoff)
    }
  }
  throw lastErr
}

// ---------------------------------------------------------------------------
// OpenAI -> Gemini request conversion
// ---------------------------------------------------------------------------

type OpenAIContent =
  | string
  | null
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>

interface OpenAIToolCall {
  id?: string
  type?: string
  function?: { name?: string; arguments?: string }
}

interface OpenAIMessage {
  role: "system" | "user" | "assistant" | "tool"
  content?: OpenAIContent
  tool_calls?: OpenAIToolCall[]
  tool_call_id?: string
  name?: string
}

function contentToText(content: OpenAIContent | undefined): string {
  if (content == null) return ""
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .filter((p) => p.type === "text")
      .map((p) => (p as { text: string }).text)
      .join("\n")
  }
  return String(content)
}

function parseArgs(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { value: parsed }
  } catch {
    return {}
  }
}

function wrapResponse(content: OpenAIContent | undefined): Record<string, unknown> {
  const text = contentToText(content)
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    return { result: parsed }
  } catch {
    return { result: text }
  }
}

// Gemini "thinking" models attach a `thoughtSignature` to functionCall parts
// that MUST be sent back when the call is replayed in history, or the API
// rejects the request (400 "Function call is missing a thought_signature").
// The OpenAI tool-call schema has nowhere to store it, so we smuggle it inside
// the tool-call `id` (which Glovix round-trips verbatim) using this delimiter.
const SIG_DELIM = "~~sig~~"

function makeToolCallId(index: number, sig?: string): string {
  return sig ? `fc-${index}-${Date.now()}${SIG_DELIM}${sig}` : `call_${index}_${Date.now()}`
}

function extractSignature(id: string | undefined): string | undefined {
  if (!id) return undefined
  const idx = id.indexOf(SIG_DELIM)
  return idx === -1 ? undefined : id.slice(idx + SIG_DELIM.length)
}

function userParts(content: OpenAIContent | undefined): Part[] {
  if (typeof content === "string") return [{ text: content }]
  if (Array.isArray(content)) {
    const parts: Part[] = []
    for (const p of content) {
      if (p.type === "text") {
        parts.push({ text: p.text })
      } else if (p.type === "image_url") {
        const url = p.image_url?.url || ""
        const m = /^data:([^;]+);base64,(.*)$/.exec(url)
        if (m) parts.push({ inlineData: { mimeType: m[1], data: m[2] } })
        else if (url) parts.push({ text: url })
      }
    }
    return parts.length ? parts : [{ text: "" }]
  }
  return [{ text: "" }]
}

export function convertMessages(messages: OpenAIMessage[]): {
  systemInstruction?: string
  contents: Content[]
} {
  const systemChunks: string[] = []
  const contents: Content[] = []

  // Map tool_call ids -> function name so tool results can reference the call.
  const idToName: Record<string, string> = {}
  for (const m of messages) {
    if (m.role === "assistant" && Array.isArray(m.tool_calls)) {
      for (const tc of m.tool_calls) {
        if (tc.id && tc.function?.name) idToName[tc.id] = tc.function.name
      }
    }
  }

  let i = 0
  while (i < messages.length) {
    const m = messages[i]

    if (m.role === "system") {
      const text = contentToText(m.content)
      if (text) systemChunks.push(text)
      i++
      continue
    }

    if (m.role === "tool") {
      // Merge consecutive tool results into a single function-response turn.
      const parts: Part[] = []
      while (i < messages.length && messages[i].role === "tool") {
        const tm = messages[i]
        const name = tm.name || (tm.tool_call_id ? idToName[tm.tool_call_id] : undefined) || "tool"
        parts.push({ functionResponse: { name, response: wrapResponse(tm.content) } })
        i++
      }
      contents.push({ role: "user", parts })
      continue
    }

    if (m.role === "user") {
      contents.push({ role: "user", parts: userParts(m.content) })
      i++
      continue
    }

    if (m.role === "assistant") {
      const parts: Part[] = []
      const text = contentToText(m.content)
      if (text) parts.push({ text })
      if (Array.isArray(m.tool_calls)) {
        let firstTcInMessage = true
        for (const tc of m.tool_calls) {
          const part: Part = {
            functionCall: { name: tc.function?.name || "tool", args: parseArgs(tc.function?.arguments) },
          }
          // Replay the thought signature captured when the call was emitted.
          // Per Gemini docs: only the FIRST functionCall part in each step needs
          // (and should have) a thoughtSignature. Subsequent parallel FC parts in
          // the same assistant message intentionally have no signature.
          if (firstTcInMessage) {
            const sig = extractSignature(tc.id)
            // `thoughtSignature` is a first-class field on Part — no cast needed.
            if (sig) (part as Part & { thoughtSignature: string }).thoughtSignature = sig
            firstTcInMessage = false
          }
          parts.push(part)
        }
      }
      contents.push({ role: "model", parts: parts.length ? parts : [{ text: "" }] })
      i++
      continue
    }

    i++
  }

  return { systemInstruction: systemChunks.join("\n\n") || undefined, contents }
}

// ---------------------------------------------------------------------------
// OpenAI tools -> Gemini function declarations
// ---------------------------------------------------------------------------

function toGeminiSchema(schema: any): Schema | undefined {
  if (!schema || typeof schema !== "object") return undefined
  const out: any = {}
  if (schema.type) out.type = String(schema.type).toUpperCase()
  if (schema.description) out.description = schema.description
  if (Array.isArray(schema.enum)) out.enum = schema.enum
  if (typeof schema.nullable === "boolean") out.nullable = schema.nullable
  if (schema.format && (out.type === "STRING" || out.type === "NUMBER" || out.type === "INTEGER")) {
    out.format = schema.format
  }
  if (schema.properties && typeof schema.properties === "object") {
    out.properties = {}
    for (const [k, v] of Object.entries(schema.properties)) {
      const converted = toGeminiSchema(v)
      if (converted) out.properties[k] = converted
    }
  }
  if (Array.isArray(schema.required)) out.required = schema.required
  if (schema.items) out.items = toGeminiSchema(schema.items)
  return out as Schema
}

export function toFunctionDeclarations(tools: any): FunctionDeclaration[] | undefined {
  if (!Array.isArray(tools)) return undefined
  const decls: FunctionDeclaration[] = []
  for (const t of tools) {
    const fn = t?.function
    if (t?.type !== "function" || !fn?.name) continue
    const params = toGeminiSchema(fn.parameters)
    const hasProps = !!(params && (params as any).properties && Object.keys((params as any).properties).length > 0)
    decls.push({
      name: fn.name,
      description: fn.description || "",
      ...(hasProps ? { parameters: params } : {}),
    })
  }
  return decls.length ? decls : undefined
}

// ---------------------------------------------------------------------------
// Streaming generation -> OpenAI-compatible SSE
// ---------------------------------------------------------------------------

export interface GenerateRequest {
  messages: OpenAIMessage[]
  tools?: any
  temperature?: number
  maxOutputTokens?: number
  model?: string
}

export function streamOpenAICompatible(req: GenerateRequest): Response {
  const encoder = new TextEncoder()
  const modelLabel = req.model || GEMINI_MODEL

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const id = `chatcmpl-${Date.now()}`
      const base = {
        id,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: modelLabel,
      }
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`))
      const done = () => controller.enqueue(encoder.encode("data: [DONE]\n\n"))

      try {
        const client = getAiClient()
        const { systemInstruction, contents } = convertMessages(req.messages)
        const functionDeclarations = toFunctionDeclarations(req.tools)

        const config: GenerateContentConfig = {
          temperature: req.temperature ?? 0.7,
          maxOutputTokens: Math.min(Math.max(req.maxOutputTokens ?? 8192, 1024), 32768),
        }
        if (systemInstruction) config.systemInstruction = systemInstruction
        if (functionDeclarations) {
          config.tools = [{ functionDeclarations }]
          config.toolConfig = {
            functionCallingConfig: { mode: FunctionCallingConfigMode.AUTO },
          }
        }

        const genStream = await withRetry(() =>
          client.ai.models.generateContentStream({ model: client.model, contents, config }),
        )

        let toolIndex = 0
        let sawToolCall = false
        let usage: any = null
        // Carries a thought signature forward to the function-call part it belongs
        // to. Gemini thinking models attach it to a preceding thought/text part OR
        // directly on the functionCall part itself. We collect ALL signatures seen
        // across the entire streaming response so that even if the thought chunk
        // arrives in a different SSE event than the functionCall chunk, we still
        // have the signature available. We only ever embed it on the FIRST function
        // call of each response (per the Gemini docs for parallel FCs), and we
        // DON'T clear it between chunks — only after the first FC consumes it.
        let pendingSig: string | undefined
        let firstFcSent = false

        for await (const chunk of genStream) {
          const parts: any[] = chunk.candidates?.[0]?.content?.parts ?? []
          for (const part of parts) {
            // Capture thoughtSignature from any part (thought parts, text parts,
            // or functionCall parts) — whichever arrives first.
            // The Vertex AI streaming response uses raw JSON with snake_case field
            // names (thought_signature), while the Gemini Developer API and the
            // SDK's non-streaming response use camelCase (thoughtSignature). We
            // must handle both so the signature is never silently dropped.
            const rawSig: string | undefined =
              (part as any).thoughtSignature || (part as any).thought_signature
            if (rawSig) {
              pendingSig = rawSig
            }

            // Plain assistant text (skip internal "thought" summary parts).
            if (typeof part.text === "string" && part.text.length > 0 && !part.thought) {
              send({ ...base, choices: [{ index: 0, delta: { content: part.text }, finish_reason: null }] })
            }

            if (part.functionCall) {
              sawToolCall = true
              // Signature goes on the FIRST functionCall only (per Gemini spec for
              // parallel calls). For sequential multi-step calls each step has its
              // own independent generation, so pendingSig is fresh each time.
              // Also handle snake_case from raw Vertex streaming JSON.
              const partSig: string | undefined =
                (part as any).thoughtSignature || (part as any).thought_signature
              const sig: string | undefined = partSig || (firstFcSent ? undefined : pendingSig)
              if (!firstFcSent) {
                firstFcSent = true
                // Don't clear pendingSig — the same signature may be referenced by
                // the very next part in an edge case; it will be naturally discarded
                // since firstFcSent guards further use.
              }
              send({
                ...base,
                choices: [
                  {
                    index: 0,
                    delta: {
                      tool_calls: [
                        {
                          index: toolIndex,
                          id: makeToolCallId(toolIndex, sig),
                          type: "function",
                          function: {
                            name: part.functionCall.name || "tool",
                            arguments: JSON.stringify(part.functionCall.args ?? {}),
                          },
                        },
                      ],
                    },
                    finish_reason: null,
                  },
                ],
              })
              toolIndex++
            }
          }

          if (chunk.usageMetadata) usage = chunk.usageMetadata
        }

        const finalChunk: any = {
          ...base,
          choices: [{ index: 0, delta: {}, finish_reason: sawToolCall ? "tool_calls" : "stop" }],
        }
        if (usage) {
          finalChunk.usage = {
            prompt_tokens: usage.promptTokenCount || 0,
            completion_tokens: usage.candidatesTokenCount || 0,
            total_tokens: usage.totalTokenCount || 0,
          }
        }
        send(finalChunk)
        done()
        controller.close()
      } catch (err: any) {
        // Surface the error to the chat UI rather than failing silently.
        const message = err?.message || "Gemini generation failed"
        send({
          ...base,
          choices: [{ index: 0, delta: { content: `\n\n[AI error] ${message}` }, finish_reason: "stop" }],
        })
        done()
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  })
}
