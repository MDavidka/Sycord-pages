import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractCode, type ModelSelection } from "@/lib/ai-provider"

// Stage 3 of the pipeline: "TypeScript for logic".
//
// Given the raw style JSON for a page, ask the model to produce a standalone
// TypeScript module that implements the $handler.* functions referenced in
// the tree. The file is later merged into the generated page by the
// converter/orchestrator stage.

function collectHandlerNames(node: unknown, acc: Set<string>): void {
  if (!node || typeof node !== "object") return
  const n = node as Record<string, unknown>
  const props = n.props
  if (props && typeof props === "object") {
    for (const val of Object.values(props as Record<string, unknown>)) {
      if (typeof val === "string") {
        const m = val.match(/^\$handler\.([A-Za-z_][A-Za-z0-9_]*)$/)
        if (m) acc.add(m[1])
      }
    }
  }
  const children = n.children
  if (Array.isArray(children)) {
    for (const c of children) collectHandlerNames(c, acc)
  }
}

function stubLogicFile(pageName: string, handlers: string[]): string {
  const body = handlers
    .map((h) => `export function ${h}() {\n  // TODO: implement ${h}\n}`)
    .join("\n\n")
  return `// Auto-generated logic handlers for ${pageName}\n\n${body}\n`
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    pageName?: string
    tree?: unknown
    prompt?: string
    model?: ModelSelection
  }
  const { pageName, tree, prompt, model } = body

  if (!pageName || !tree) {
    return NextResponse.json({ message: "pageName and tree are required" }, { status: 400 })
  }
  if (!model?.id || !model?.provider) {
    return NextResponse.json({ message: "Model selection is required" }, { status: 400 })
  }

  const handlerSet = new Set<string>()
  const root = (tree as { component?: unknown }).component ?? tree
  collectHandlerNames(root, handlerSet)
  const handlers = [...handlerSet]

  if (handlers.length === 0) {
    // Nothing to generate — tell the client there is no logic file for this
    // page so it can skip writing one.
    return NextResponse.json({ code: null, handlers: [] })
  }

  await logAiDebug("Logic Request", {
    pageName,
    handlers,
    modelId: model.id,
    provider: model.provider,
  })

  const messages = [
    {
      role: "system" as const,
      content: `You are the "Logic" stage of a deterministic web-app build pipeline.

You must output a single self-contained TypeScript module that exports ONE function per handler listed below. The module will be imported by the generated page component; the page itself is created by a separate deterministic converter so DO NOT include JSX, React components, or imports from '@/components/...'.

STRICT RULES:
- Output ONLY TypeScript source code — no prose, no markdown fences, no comments explaining the output.
- Each handler MUST be exported with \`export function <name>(...) { ... }\`.
- For setters named \`setX\`, accept a single value argument of a plausible type (boolean / string / number) and call nothing external.
- For other handlers, accept no arguments by default. If the UI context implies an event (form submit, click), accept \`event?: unknown\` and call \`event?.preventDefault?.()\` when appropriate.
- Keep the logic lightweight and side-effect free where possible: console.log, state setters passed in, or TODO comments are fine. Do NOT invent fetch/network calls unless the handler name clearly implies one (e.g. \`onSubmitForm\`, \`loadData\`).
- Use strict TypeScript — no \`any\`, prefer \`unknown\` or explicit types.
- The file must compile on its own with no external imports other than standard TS.`,
    },
    {
      role: "user" as const,
      content: `Website context: ${prompt ?? "(no extra context)"}

Page: ${pageName}
UI tree (for reference only — do NOT render it):
${JSON.stringify(tree)}

Handlers to implement (one exported function each, exact names):
${handlers.map((h) => `- ${h}`).join("\n")}

Output the complete TypeScript module now.`,
    },
  ]

  const result = await callModel({
    model,
    messages,
    temperature: 0.1,
  })

  if (!result.ok) {
    await logAiDebug("Logic API Error", {
      status: result.status,
      message: result.message,
      details: result.details,
    })
    // Fall back to stubs so the build can still proceed — the user would rather
    // see a working scaffold than a hard failure from a free-tier model glitch.
    return NextResponse.json({
      code: stubLogicFile(pageName, handlers),
      handlers,
      fallback: true,
      message: result.message,
    })
  }

  let code = extractCode(result.content, "ts")
  if (!code) code = extractCode(result.content)
  // A minimal sanity check — if the model ignored the contract and returned
  // something that clearly isn't a TS module, fall back to stubs.
  const looksLikeTs = /export\s+function\s+/.test(code) || /export\s+const\s+/.test(code)
  if (!looksLikeTs) {
    await logAiDebug("Logic Fallback", { pageName, reason: "no exported function detected" })
    return NextResponse.json({
      code: stubLogicFile(pageName, handlers),
      handlers,
      fallback: true,
    })
  }

  await logAiDebug("Logic Parse Success", { pageName, length: code.length })
  return NextResponse.json({ code, handlers })
}
