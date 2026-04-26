import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logAiDebug } from "@/lib/logger"
import { callModel, extractCode, type ModelSelection } from "@/lib/ai-provider"
import {
  renderManifestForPrompt,
  type ProjectManifest,
} from "@/lib/project-manifest"

// Stage 3 of the pipeline: "TypeScript for logic".
//
// Given the raw style JSON for a page, ask the model to produce a standalone
// TypeScript module that implements the $handler.* functions referenced in
// the tree. The file is later merged into the generated page by the
// converter/orchestrator stage.

interface HandlerCollectionResult {
  stateNames: Set<string>
  handlerNames: Set<string>
}

function collectBindings(node: unknown, acc: HandlerCollectionResult): void {
  if (!node || typeof node !== "object") return
  const n = node as Record<string, unknown>
  const props = n.props
  if (props && typeof props === "object") {
    for (const val of Object.values(props as Record<string, unknown>)) {
      if (typeof val === "string") {
        const state = val.match(/^\$state\.([A-Za-z_][A-Za-z0-9_]*)$/)
        const handler = val.match(/^\$handler\.([A-Za-z_][A-Za-z0-9_]*)$/)
        if (state) acc.stateNames.add(state[1])
        if (handler) acc.handlerNames.add(handler[1])
      }
    }
  }
  const children = n.children
  if (Array.isArray(children)) {
    for (const c of children) collectBindings(c, acc)
  }
}

// Handlers named `set<State>` collide with the useState setter the converter
// auto-generates. The orchestrator drops them from the Props interface, so
// there's no point asking the model to implement them either — skip them
// here and keep the logic module focused on real business logic.
function nonSetterHandlers(handlers: Set<string>, states: Set<string>): string[] {
  const out: string[] = []
  for (const h of handlers) {
    const m = h.match(/^set([A-Z][A-Za-z0-9_]*)$/)
    if (m) {
      const stateName = m[1].charAt(0).toLowerCase() + m[1].slice(1)
      if (states.has(stateName)) continue
    }
    out.push(h)
  }
  return out
}

function stubLogicFile(pageName: string, handlers: string[], pageFileHint: string): string {
  const body = handlers
    .map(
      (h) => `export function ${h}(event?: unknown): void {
  const e = event as { preventDefault?: () => void } | undefined
  e?.preventDefault?.()
  // TODO: replace with real implementation for ${h}
  if (typeof window !== 'undefined') {
    window.alert('${h} called — implement in ${pageFileHint}')
  }
}`,
    )
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
    features?: string[]
    model?: ModelSelection
    manifest?: ProjectManifest
    route?: string
  }
  const { pageName, tree, prompt, features, model, manifest, route } = body

  if (!pageName || !tree) {
    return NextResponse.json({ message: "pageName and tree are required" }, { status: 400 })
  }
  if (!model?.id || !model?.provider) {
    return NextResponse.json({ message: "Model selection is required" }, { status: 400 })
  }

  const collection: HandlerCollectionResult = {
    stateNames: new Set(),
    handlerNames: new Set(),
  }
  const root = (tree as { component?: unknown }).component ?? tree
  collectBindings(root, collection)
  const handlers = nonSetterHandlers(collection.handlerNames, collection.stateNames)

  if (handlers.length === 0) {
    // Only setter-style handlers were referenced; the converter handles
    // those via useState. No logic file needed for this page.
    return NextResponse.json({ code: null, handlers: [] })
  }

  // Prefer the manifest's logic file path when we have it (slug-based, matches
  // what the orchestrator writes to disk). Fall back to the legacy hint when
  // the caller didn't pass a manifest.
  const manifestPage = manifest?.pages.find(
    (p) => (route ? p.route === route : p.componentName === pageName),
  )
  const pageFileHint = manifestPage?.logicFile ?? `src/lib/${pageName.toLowerCase()}-logic.ts`

  await logAiDebug("Logic Request", {
    pageName,
    handlers,
    modelId: model.id,
    provider: model.provider,
  })

  const messages = [
    {
      role: "system" as const,
      content: `You are the "Logic" stage of a deterministic Vite + React + TypeScript build pipeline.

Your output is a single self-contained TypeScript module that will live at \`src/lib/<page>-logic.ts\` inside the generated project. The page component (a sibling .tsx) will \`import { ... } from '@/lib/<page>-logic'\` and attach each exported function to an event handler.

STRICT OUTPUT CONTRACT
- Output ONLY TypeScript source — no prose, no markdown fences, no backticks, no explanations.
- Export exactly ONE function per handler name listed below. Function names must match EXACTLY.
- Each function must have a real, deployable implementation. Never a \`console.log\`-only stub, never an empty body, never just a TODO comment.
- The file is compiled by Vite with strict TypeScript — no \`any\`, no unused imports, no syntax errors.
- Allowed external imports: none. The file must compile with pure browser-standard APIs.

IMPLEMENTATION GUIDELINES (based on handler name semantics)
- \`onSubmit*\` / \`handleSubmit*\`: accept \`event: React.FormEvent\` typed as \`{ preventDefault(): void }\`; call \`event.preventDefault()\`, then gather form data from \`(event.target as HTMLFormElement)\`, optionally POST with \`fetch\` to a plausible route (e.g. '/api/contact'), and surface success/error via \`window.alert\`. Wrap in try/catch.
- \`onClick*\` / \`handleClick*\`: accept \`event: { preventDefault(): void }\` and perform the action implied by the name — e.g. navigation via \`window.location.href\`, opening a link, toggling class, or scrolling to an element.
- \`loadData\` / \`fetch*\` / \`refresh*\`: use \`fetch\` against a plausible endpoint, parse JSON, and return the result; swallow errors with a sensible fallback.
- \`logout\` / \`signOut\`: clear localStorage auth keys and redirect to '/' via \`window.location.href\`.
- For anything ambiguous, provide a minimal but working side-effect (navigation, alert, localStorage update) — never a silent no-op.

OUTPUT SHAPE EXAMPLE
\`\`\`
export function onSubmitContact(event: { preventDefault(): void, target: unknown }): void {
  event.preventDefault()
  const form = event.target as HTMLFormElement
  const data = new FormData(form)
  fetch('/api/contact', { method: 'POST', body: data }).then(() => {
    window.alert('Thanks! We will be in touch.')
    form.reset()
  }).catch(() => {
    window.alert('Something went wrong. Please try again.')
  })
}
\`\`\`

Return ONLY raw TypeScript — the first non-whitespace character must be \`export\` or an allowed top-level statement.

CROSS-FILE CONTRACT (use the manifest below to understand the rest of the app; you may reference route paths when navigating):
${manifest ? renderManifestForPrompt(manifest) : "(no manifest supplied)"}`,
    },
    {
      role: "user" as const,
      content: `Website brief: ${prompt ?? "(no extra context)"}

Page: ${pageName}
Target file path: ${pageFileHint}
${manifestPage ? `Route: ${manifestPage.route}\nPage title (for window.document.title and post-submit copy): ${JSON.stringify(manifestPage.pageTitle)}` : ""}
${features && features.length > 0 ? `\nPage features (from the Plan stage — use these to decide what each handler should do):\n${features.map((f) => `- ${f}`).join("\n")}` : ""}

UI tree (for context — do not render it; only use it to infer what each handler should do):
${JSON.stringify(tree)}

Handlers to implement (exact names — one \`export function\` each):
${handlers.map((h) => `- ${h}`).join("\n")}

Emit the complete TypeScript module now.`,
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
      code: stubLogicFile(pageName, handlers, pageFileHint),
      handlers,
      fallback: true,
      message: result.message,
    })
  }

  let code = extractCode(result.content, "ts")
  if (!code) code = extractCode(result.content)
  // Final pass: drop any stray triple-backtick lines. extractCode already
  // does this for the first fence it matched, but if the model emits more
  // than one ```…``` block we might still have leftovers.
  code = code.replace(/^[\t ]*```[a-zA-Z0-9]*[\t ]*$/gm, "").trim()

  // Guarantee every requested handler is exported. If the model skipped one,
  // splice in a real (not console.log) stub implementation so the page's
  // import always resolves.
  const missing = handlers.filter(
    (h) => !new RegExp(`export\\s+(?:async\\s+)?function\\s+${h}\\b`).test(code)
      && !new RegExp(`export\\s+const\\s+${h}\\b`).test(code),
  )
  if (missing.length > 0) {
    await logAiDebug("Logic Patch Missing", { pageName, missing })
    const patch = missing
      .map(
        (h) => `\nexport function ${h}(event?: unknown): void {
  const e = event as { preventDefault?: () => void } | undefined
  e?.preventDefault?.()
  if (typeof window !== 'undefined') {
    window.alert('${h} called — implement in ${pageFileHint}')
  }
}`,
      )
      .join("\n")
    code = code + patch
  }

  // Sanity check: if after patching there is still nothing that looks like a
  // TS module, fall back entirely so the build doesn't die.
  const looksLikeTs = /export\s+function\s+/.test(code) || /export\s+const\s+/.test(code)
  if (!looksLikeTs) {
    await logAiDebug("Logic Fallback", { pageName, reason: "no exported function detected" })
    return NextResponse.json({
      code: stubLogicFile(pageName, handlers, pageFileHint),
      handlers,
      fallback: true,
    })
  }

  await logAiDebug("Logic Parse Success", { pageName, length: code.length, patched: missing.length })
  return NextResponse.json({ code, handlers })
}
