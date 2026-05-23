import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { callModel, extractJson, extractCode, type ChatMessage } from "@/lib/ai-provider"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

interface PageStructure {
  name: string
  usedFor: string
  description: string
  route: string
  priority: number
  action?: "add" | "rewrite" | "delete" | "move"
  target?: string
}

interface BuildHistoryEntry {
  prompt: string
  model: string
  timestamp: number
  files: string[]
  steps: Array<{ title: string; content: string }>
}

const SHADCN_DEP_MAP: Record<string, string[]> = {
  accordion:["@radix-ui/react-accordion"],"alert-dialog":["@radix-ui/react-alert-dialog"],alert:[],
  "aspect-ratio":["@radix-ui/react-aspect-ratio"],avatar:["@radix-ui/react-avatar"],badge:[],breadcrumb:[],
  button:["@radix-ui/react-slot","class-variance-authority"],calendar:["react-day-picker","date-fns"],card:[],
  carousel:["embla-carousel-react"],chart:["recharts"],checkbox:["@radix-ui/react-checkbox"],
  collapsible:["@radix-ui/react-collapsible"],combobox:["cmdk","@radix-ui/react-popover"],command:["cmdk"],
  "context-menu":["@radix-ui/react-context-menu"],"data-table":[],"date-picker":["react-day-picker","date-fns","@radix-ui/react-popover"],
  dialog:["@radix-ui/react-dialog"],drawer:["vaul"],"dropdown-menu":["@radix-ui/react-dropdown-menu"],
  empty:[],field:[],form:["react-hook-form","@hookform/resolvers","zod"],
  "hover-card":["@radix-ui/react-hover-card"],input:[],"input-group":[],"input-otp":["input-otp"],item:[],kbd:[],
  label:["@radix-ui/react-label"],menubar:["@radix-ui/react-menubar"],
  "navigation-menu":["@radix-ui/react-navigation-menu"],pagination:[],popover:["@radix-ui/react-popover"],
  progress:["@radix-ui/react-progress"],"radio-group":["@radix-ui/react-radio-group"],
  resizable:["react-resizable-panels"],"scroll-area":["@radix-ui/react-scroll-area"],select:["@radix-ui/react-select"],
  separator:["@radix-ui/react-separator"],sheet:["@radix-ui/react-dialog"],sidebar:[],skeleton:[],
  slider:["@radix-ui/react-slider"],sonner:["sonner"],spinner:[],switch:["@radix-ui/react-switch"],table:[],
  tabs:["@radix-ui/react-tabs"],textarea:[],toast:["@radix-ui/react-toast"],toggle:["@radix-ui/react-toggle"],
  "toggle-group":["@radix-ui/react-toggle-group"],tooltip:["@radix-ui/react-tooltip"],typography:[],
}

const CORE_DEPS = ["next","react","react-dom"]
const UTILITY_DEPS = ["clsx","tailwind-merge","class-variance-authority","lucide-react","tailwindcss-animate"]
const HISTORY_MAX = 50

function buildDependencyReport(): string {
  return Object.entries(SHADCN_DEP_MAP)
    .filter(([,v]) => v.length > 0)
    .map(([k,v]) => `  ${k} → ${v.join(", ")}`)
    .join("\n")
}

function loadCheatsheet(): string {
  const path = join(process.cwd(), "components.json")
  if (!existsSync(path)) return "No shadcn cheatsheet found"
  try {
    const data = JSON.parse(readFileSync(path, "utf-8"))
    if (!data?.components) return "No shadcn cheatsheet found"
    return (data.components as Array<{ slug:string; name:string; import_path:string; exports:string[]; purpose:string; composition?:string; common_props?:Record<string,string[]> }>).map(c => {
      const deps = SHADCN_DEP_MAP[c.slug] ?? []
      const d = deps.length ? `\n  npm deps: ${deps.join(", ")}` : "  npm deps: none (pure styling)"
      const props = c.common_props ? `  Props: ${Object.entries(c.common_props).map(([k,v]) => `${k}=${Array.isArray(v)?v.join("|"):v}`).join(", ")}` : ""
      return [`${c.name} (slug: ${c.slug})`,`  Import: import { ${(c.exports||[]).join(", ")} } from "${c.import_path}"`,`  Purpose: ${c.purpose}`,d,c.composition?`  Composition: ${c.composition}`:"",props].filter(Boolean).join("\n")
    }).join("\n\n")
  } catch { return "No shadcn cheatsheet found" }
}

function stripFencesAndDescription(code: string): string {
  if (!code) return ""
  let out = code
  out = out.replace(/^```[a-zA-Z0-9]*\s*\n?/gm, "")
  out = out.replace(/\n?```\s*$/gm, "")
  out = out.replace(/^Here['']s the code[.:].*/gmi, "")
  out = out.replace(/^The (generated|updated|modified) code[.:].*/gmi, "")
  out = out.replace(/^(Let me know|Feel free|I['']ve|This is|Below is).*$/gmi, "")
  const start = Math.max(
    out.search(/(?:^|\n)\s*(?:import\b|export\b|"use client\b|"use strict\b|const\b|let\b|var\b|function\b|interface\b|type\b|class\b|@tailwind|@layer|\/\/|{)/m),
    0,
  )
  if (start > 0) out = out.slice(start)
  const endMarkers = /^(Let me|Feel free|I hope|This (code|file|component)|The (code|file|component)|If you|You can|Run |Install |Test |Check |See |Note[ :])/mi
  const endMatch = out.match(new RegExp(endMarkers.source, "m"))
  if (endMatch && endMatch.index !== undefined && endMatch.index > 0) {
    out = out.slice(0, endMatch.index)
  }
  out = out.replace(/^```[a-zA-Z0-9]*\s*$/gm, "")
  return out.trim()
}

async function loadExistingPages(projectId: string, userId: string): Promise<Array<{ name: string; code: string; usedFor: string }>> {
  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne(
      { id: userId, projects: { $elemMatch: { _id: new ObjectId(projectId) } } },
      { projection: { "projects.$": 1 } },
    )
    return user?.projects?.[0]?.pages?.map((p: any) => ({ name: p.name, code: p.content || p.code || "", usedFor: p.usedFor || "" })) || []
  } catch { return [] }
}

async function saveHistory(projectId: string, userId: string, entry: BuildHistoryEntry) {
  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne({ id: userId })
    if (!user) return
    const project = user.projects?.find((p: any) => p._id.toString() === projectId)
    if (!project) return
    const history = (project.buildHistory || []) as BuildHistoryEntry[]
    history.unshift(entry)
    if (history.length > HISTORY_MAX) history.length = HISTORY_MAX
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      { $set: { "projects.$.buildHistory": history } },
    )
  } catch {}
}

// ═══════════════════════════════════════════════════════════════════
// PROMPTS
// ═══════════════════════════════════════════════════════════════════

const STRUCTURE_RULES = `Next.js App Router architect. Output ONLY a JSON array of file objects.

MANDATORY: "package.json"(1) "tsconfig.json"(2) "lib/types.ts"(3) "lib/utils.ts"(4) "app/globals.css"(5) "app/layout.tsx"(6) "app/page.tsx"(7)

Fields: name, usedFor, description, route, priority(1-100). Keep 7-14 files. Return ONLY the JSON array.`

function generateStructurePrompt(prompt: string, cheatsheet: string, depReport: string): ChatMessage[] {
  return [
    { role: "system", content: [STRUCTURE_RULES, `\nAVAILABLE shadcn/ui:\n${cheatsheet}`, `\nNPM DEPS:\n${depReport}`].join("\n") },
    { role: "user", content: prompt },
  ]
}

const CODE_RULES = `Production Next.js App Router + TypeScript dev. Output raw code, first char must be code, last char must be code. No fences, no description before/after.

100% SHADCN/UI: Never <button> <input> <select> <textarea> <label> <form>. Always use shadcn equivalents.
Allowed raw HTML: div span section main header footer nav article aside ul ol li img a h1-h6 p table/thead/tbody/tr/th/td br hr pre code svg picture source figure figcaption blockquote.

Next.js: Server Components default. "use client" only for hooks/events. layout.tsx exports metadata. Always import { cn } from "@/lib/utils". Use cn() for every className. Mobile-first responsive. Semantic Tailwind tokens.

PACKAGE.JSON must include ALL npm deps needed. No missing deps.

OUTPUT ONLY THE CODE. FIRST CHARACTER = CODE. LAST CHARACTER = CODE. NO FENCES. NO EXPLANATION.`

const EDIT_RULES = `You are editing an existing Next.js project. You see the current code for each FILE below. Your job: apply the user's requested change.

You can respond with ONE OR MORE file blocks in this format:
### FILE: path/to/file.tsx
<raw code here>
### FILE: other/file.tsx
<raw code here>

Special actions:
- To DELETE a file: ### FILE: path/to/file.tsx\nDELETE
- To MOVE/RENAME a file: ### FILE: old/path.tsx\nMOVE_TO: new/path.tsx
- To ADD a new file that doesn't exist: ### FILE: new/path.tsx\n<code>

For each FILE block, output the COMPLETE new content (not diffs). If the user only wants to modify one file, output just that file's block.

Same rules apply: 100% shadcn/ui, cn() for classNames, no raw <button>/<input>/etc., mobile-first, semantic Tailwind tokens.

FIRST CHARACTER must be "#". LAST CHARACTER must be code. No extra description.`

function generateCodePrompt(
  pages: PageStructure[],
  current: PageStructure,
  prevFiles: Array<{ name: string; code: string; usedFor?: string }>,
  cheatsheet: string,
  depReport: string,
  custom?: string,
): ChatMessage[] {
  const list = pages.map(p => `- ${p.name} (${p.usedFor}): ${p.description}`).join("\n")
  let prevBlock = ""
  if (prevFiles.length > 0) {
    prevBlock = "\n\nALREADY GENERATED:\n" + prevFiles.map(f => `--- ${f.name} ---\n${f.code}`).join("\n\n")
  }
  const parts = [CODE_RULES, `\nNPM DEPS:\n${depReport}`, `\nshadcn/ui:\n${cheatsheet}`]
  if (custom && custom.length > 10 && custom !== "Generation code prompting is disabled.") parts.push(`\nBUILD RULES:\n${custom}`)
  parts.push(`\nALL FILES:\n${list}`, prevBlock)
  return [
    { role: "system", content: parts.join("\n") },
    { role: "user", content: `Write the production code for ${current.name} (${current.usedFor}).` },
  ]
}

function generateEditPrompt(
  userRequest: string,
  existingFiles: Array<{ name: string; code: string; usedFor: string }>,
  cheatsheet: string,
  depReport: string,
  custom?: string,
): ChatMessage[] {
  const fileListing = existingFiles.map(f => `--- ${f.name} (${f.usedFor || "no tag"}) ---\n${f.code}`).join("\n\n")
  const parts = [EDIT_RULES, `\nNPM DEPS:\n${depReport}`, `\nshadcn/ui:\n${cheatsheet}`]
  if (custom && custom.length > 10 && custom !== "Generation code prompting is disabled.") parts.push(`\nBUILD RULES:\n${custom}`)
  parts.push(`\nEXISTING PROJECT FILES:\n${fileListing}`)
  return [
    { role: "system", content: parts.join("\n") },
    { role: "user", content: `Apply this change: ${userRequest}` },
  ]
}

// ═══════════════════════════════════════════════════════════════════
// PARSE EDIT RESPONSE
// ═══════════════════════════════════════════════════════════════════

interface EditOp {
  name: string
  action: "rewrite" | "delete" | "move" | "add"
  code: string
  target?: string
}

function parseEditResponse(content: string): EditOp[] {
  const ops: EditOp[] = []
  const blocks = content.split(/^### FILE:\s*/gm)
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const newlineIdx = trimmed.indexOf("\n")
    const name = (newlineIdx > 0 ? trimmed.slice(0, newlineIdx) : trimmed).trim()
    const body = newlineIdx > 0 ? trimmed.slice(newlineIdx + 1).trim() : ""

    if (body === "DELETE") {
      ops.push({ name, action: "delete", code: "" })
    } else if (body.startsWith("MOVE_TO:")) {
      const target = body.slice(8).trim()
      ops.push({ name, action: "move", code: "", target })
    } else if (body) {
      const clean = stripFencesAndDescription(body)
      const exists = name && clean
      if (exists) {
        ops.push({ name, action: "rewrite", code: clean })
      }
    }
  }

  if (ops.length === 0) {
    const clean = stripFencesAndDescription(content)
    if (clean) ops.push({ name: "edit", action: "rewrite", code: clean })
  }
  return ops
}

// ═══════════════════════════════════════════════════════════════════
// GET — Read project codebase
// ═══════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId") || ""
  const fileName = url.searchParams.get("file") || ""
  const historyOnly = url.searchParams.get("history") === "1"

  if (!projectId || !ObjectId.isValid(projectId)) {
    return NextResponse.json({ error: "Invalid projectId" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne(
      { id: session.user.id, projects: { $elemMatch: { _id: new ObjectId(projectId) } } },
      { projection: { "projects.$": 1 } },
    )
    if (!user?.projects?.[0]) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    const project = user.projects[0]
    const pages = (project.pages || []).map((p: any) => ({ name: p.name, usedFor: p.usedFor || "", code: p.content || p.code || "", updatedAt: p.updatedAt }))
    const history = project.buildHistory || []

    if (historyOnly) return NextResponse.json({ history: history.slice(0, HISTORY_MAX) })

    if (fileName) {
      const page = pages.find((p: any) => p.name === fileName)
      return page
        ? NextResponse.json({ file: page })
        : NextResponse.json({ error: "File not found" }, { status: 404 })
    }

    return NextResponse.json({ pages, history: history.slice(0, HISTORY_MAX) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// ═══════════════════════════════════════════════════════════════════
// POST — Build pipeline (generate + edit modes)
// ═══════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: string, data: unknown) => {
        if (closed) return
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) } catch { closed = true }
      }
      const finish = () => {
        if (closed) return
        try { controller.enqueue(encoder.encode("event: done\ndata: {}\n\n")); controller.close() } catch {}
        closed = true
      }

      const historySteps: Array<{ title: string; content: string }> = []

      try {
        const body = await request.json().catch(() => ({}))
        const prompt = String(body.prompt ?? "").trim()
        const projectId = String(body.projectId ?? "")
        const mode = String(body.mode ?? "generate")
        const model = { id: String(body.modelId ?? "deepseek-v4-pro"), provider: String(body.provider ?? "DeepSeek") }

        if (!prompt || !projectId) { push("error", { message: "prompt and projectId required" }); finish(); return }

        const cheatsheet = loadCheatsheet()
        const depReport = buildDependencyReport()
        let customBuilderCode = ""
        try {
          const { builderCode } = await getSystemPrompts()
          if (builderCode && builderCode.length > 10 && builderCode !== "Generation code prompting is disabled.") customBuilderCode = builderCode
        } catch {}

        // ═══ STEP 1 ═══════════════════════════════════════════
        const s1 = { id: "step-1", title: mode === "edit" ? "🔄 Edit request" : "📝 Input", content: `"${prompt}"\nModel: ${model.provider} · ${model.id}`, timestamp: Date.now() }
        push("step", s1)
        historySteps.push({ title: s1.title, content: s1.content })

        // ═══ EDIT MODE ════════════════════════════════════════
        if (mode === "edit") {
          push("step", { id: "step-2", title: "📂 Loading project files", content: "Reading existing codebase...", timestamp: Date.now() })
          const existingFiles = await loadExistingPages(projectId, session.user.id)
          push("step", { id: "step-2", title: "📂 Project loaded", content: `${existingFiles.length} existing file${existingFiles.length===1?"":"s"}`, timestamp: Date.now() })

          const existingNames = new Set(existingFiles.map(f => f.name))
          push("step", { id: "step-3", title: "🤖 AI analyzing changes", content: `Files: ${existingFiles.map(f => f.name).join(", ")}`, timestamp: Date.now() })
          historySteps.push({ title: "🤖 Editing", content: `Files: ${existingFiles.map(f => f.name).join(", ")}` })

          const editMsgs = generateEditPrompt(prompt, existingFiles, cheatsheet, depReport, customBuilderCode)
          const editRes = await callModel({ model, messages: editMsgs, temperature: 0.2 })

          if (!editRes.ok) {
            push("step", { id: "step-error", title: "❌ Edit failed", content: editRes.message, timestamp: Date.now() })
            historySteps.push({ title: "❌ Failed", content: editRes.message })
            await saveHistory(projectId, session.user.id, { prompt, model: model.id, timestamp: Date.now(), files: [], steps: historySteps })
            finish()
            return
          }

          const ops = parseEditResponse(editRes.content)
          const applied: string[] = []

          for (const op of ops) {
            if (op.action === "delete") {
              push("step", { id: "step-3", title: `🗑️ Delete: ${op.name}`, content: "Marked for deletion", timestamp: Date.now() })
              push("page", { name: op.name, code: "", usedFor: "deleted", timestamp: Date.now() })
              applied.push(`-${op.name}`)
            } else if (op.action === "move") {
              push("step", { id: "step-3", title: `📁 Move: ${op.name} → ${op.target}`, content: "Renamed/moved", timestamp: Date.now() })
              push("page", { name: op.name, code: "MOVE_TO:" + (op.target || ""), usedFor: "moved", timestamp: Date.now() })
              if (op.target) push("page", { name: op.target, code: existingFiles.find(f => f.name === op.name)?.code || "", usedFor: "moved", timestamp: Date.now() })
              applied.push(`${op.name}→${op.target}`)
            } else if (op.action === "rewrite" || op.action === "add") {
              const isNew = !existingNames.has(op.name)
              const action = isNew ? "➕" : "✏️"
              push("step", { id: "step-3", title: `${action} ${isNew?"Add":"Rewrite"}: ${op.name}`, content: `${op.code.length.toLocaleString()} chars`, timestamp: Date.now() })
              push("page", { name: op.name, code: op.code, usedFor: "updated", timestamp: Date.now() })
              applied.push((isNew ? "+" : "~") + op.name)
            }
          }

          push("step", { id: "step-4", title: "✅ Changes applied", content: applied.join("\n"), timestamp: Date.now() })
          historySteps.push({ title: "✅ Changes", content: applied.join("\n") })
          historySteps.push({ title: "📦 Files count", content: `${ops.length} operation${ops.length===1?"":"s"}` })

          // Save edit operations to DB
          if (ObjectId.isValid(projectId)) {
            try {
              const client = await clientPromise
              const db = client.db()
              for (const op of ops) {
                if (op.action === "delete") {
                  await db.collection("users").updateOne(
                    { id: session.user.id, "projects._id": new ObjectId(projectId) },
                    { $pull: { "projects.$.pages": { name: op.name } } as any },
                  )
                } else if (op.action === "move") {
                  const srcPg = existingFiles.find(f => f.name === op.name)
                  if (srcPg && op.target) {
                    await db.collection("users").updateOne(
                      { id: session.user.id, "projects._id": new ObjectId(projectId) },
                      { $pull: { "projects.$.pages": { name: op.name } } as any },
                    )
                    await db.collection("users").updateOne(
                      { id: session.user.id, "projects._id": new ObjectId(projectId) },
                      { $push: { "projects.$.pages": { name: op.target, content: srcPg.code, usedFor: srcPg.usedFor, createdAt: new Date(), updatedAt: new Date() } } as any },
                    )
                  }
                } else if (op.code) {
                  const updateResult = await db.collection("users").updateOne(
                    { id: session.user.id, projects: { $elemMatch: { _id: new ObjectId(projectId), "pages.name": op.name } } },
                    { $set: { "projects.$[proj].pages.$[pg].content": op.code, "projects.$[proj].pages.$[pg].usedFor": "updated", "projects.$[proj].pages.$[pg].updatedAt": new Date() } },
                    { arrayFilters: [{ "proj._id": new ObjectId(projectId) }, { "pg.name": op.name }] },
                  )
                  if (updateResult.matchedCount === 0) {
                    await db.collection("users").updateOne(
                      { id: session.user.id, "projects._id": new ObjectId(projectId) },
                      { $push: { "projects.$.pages": { name: op.name, content: op.code, usedFor: "new", createdAt: new Date(), updatedAt: new Date() } } as any },
                    )
                  }
                }
              }
              push("step", { id: "step-done", title: "💾 Saved", content: `${ops.length} operations saved.`, timestamp: Date.now() })
            } catch (e: any) {
              push("step", { id: "step-done", title: "⚠️ DB fail", content: e.message, timestamp: Date.now() })
            }
          }

          await saveHistory(projectId, session.user.id, { prompt, model: model.id, timestamp: Date.now(), files: applied, steps: historySteps })
          finish()
          return
        }

        // ═══ GENERATE MODE ═══════════════════════════════════

        push("step", { id: "step-2", title: "🏗️ Planning structure", content: "Designing file tree + deps...", timestamp: Date.now() })

        const structResult = await callModel({ model, messages: generateStructurePrompt(prompt, cheatsheet, depReport), temperature: 0.3 })
        let pages: PageStructure[] = extractJson<PageStructure[]>(structResult.ok ? structResult.content : "[]") || []

        if (!Array.isArray(pages) || pages.length === 0) {
          pages = [
            { name:"package.json",usedFor:"npm config",description:"package.json with all dependencies",route:"n/a",priority:1 },
            { name:"tsconfig.json",usedFor:"TypeScript config",description:"tsconfig with paths, strict, bundler",route:"n/a",priority:2 },
            { name:"lib/types.ts",usedFor:"shared types",description:"TypeScript interfaces for data model",route:"n/a",priority:3 },
            { name:"lib/utils.ts",usedFor:"cn utility",description:"cn() helper with clsx+tailwind-merge",route:"n/a",priority:4 },
            { name:"app/globals.css",usedFor:"global styles",description:"Tailwind directives + design tokens",route:"n/a",priority:5 },
            { name:"app/layout.tsx",usedFor:"root layout",description:"Root layout with metadata, fonts, providers",route:"n/a",priority:6 },
            { name:"app/page.tsx",usedFor:"homepage",description:"Landing page with hero, features, CTA",route:"/",priority:7 },
          ]
        }

        push("step", { id: "step-2", title: "🏗️ Structure", content: `${pages.length} files:\n${pages.map(p => `  • ${p.name} [${p.priority}] ${p.usedFor}`).join("\n")}`, timestamp: Date.now() })
        historySteps.push({ title: "🏗️ Structure", content: `${pages.length} files planned` })

        const generated: Array<{ name:string; code:string; usedFor:string; timestamp:number }> = []
        const sorted = [...pages].sort((a,b) => a.priority - b.priority)

        for (let i = 0; i < sorted.length; i++) {
          const page = sorted[i]
          push("step", { id: "step-3", title: `${i+1}/${sorted.length} Generating: ${page.name}`, content: page.description, timestamp: Date.now() })

          const msgs = generateCodePrompt(sorted, page, generated, cheatsheet, depReport, customBuilderCode)
          const res = await callModel({ model, messages: msgs, temperature: 0.2 })

          if (res.ok) {
            const lang = page.name.endsWith(".tsx")||page.name.endsWith(".ts")?"ts":undefined
            let code = stripFencesAndDescription(res.content)
            if (!code || code.length < 2) code = extractCode(res.content, lang) || res.content
            generated.push({ name:page.name, code, usedFor:page.usedFor, timestamp:Date.now() })
            push("step", { id: "step-3", title: `✅ ${page.name}`, content: `${code.length.toLocaleString()} chars`, timestamp: Date.now() })
            push("page", { name:page.name, code, usedFor:page.usedFor, timestamp:Date.now() })
          } else {
            push("step", { id: "step-3", title: `❌ ${page.name}`, content: res.message, timestamp: Date.now() })
          }
        }

        // ═══ STEP 4 ═══════════════════════════════════════════
        push("step", { id: "step-4", title: "📦 Dependency audit", content: "Scanning imports + cross-referencing package.json...", timestamp: Date.now() })

        const usedComponents = new Set<string>()
        for (const page of generated) {
          for (const m of page.code.matchAll(/from\s+["']@\/components\/ui\/([a-zA-Z0-9-]+)["']/g)) usedComponents.add(m[1])
        }
        const root = process.cwd()
        const existingComps: string[] = []
        const missingComps: string[] = []
        for (const slug of usedComponents) {
          if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(slug)) continue
          if (existsSync(join(root, "components", "ui", `${slug}.tsx`))) existingComps.push(slug)
          else missingComps.push(slug)
        }

        const pkgJson = generated.find(p => p.name === "package.json")
        let depGap = ""
        if (pkgJson) {
          try {
            const pkg = JSON.parse(pkgJson.code)
            const pkgDeps = { ...(pkg.dependencies||{}), ...(pkg.devDependencies||{}) }
            const needed = new Set<string>()
            for (const c of usedComponents) for (const d of (SHADCN_DEP_MAP[c]||[])) needed.add(d)
            for (const d of CORE_DEPS) needed.add(d)
            for (const d of UTILITY_DEPS) needed.add(d)
            const gaps = [...needed].filter(d => !pkgDeps[d])
            if (gaps.length) depGap = `\n\n⚠️  DEPLOYMENT WARNING — missing deps:\n${gaps.map(d => `  MISSING: ${d}`).join("\n")}\n\nRun these before deploying or build will fail.`
          } catch {}
        }

        let report = `${usedComponents.size} shadcn/ui imports`
        if (existingComps.length) report += `\n\n✅ On disk (${existingComps.length}):\n${existingComps.map(s => `  • ${s} → components/ui/${s}.tsx`).join("\n")}`
        if (missingComps.length) report += `\n\n⬜ Need install (${missingComps.length}):\n${missingComps.map(s => `  • npx shadcn@latest add ${s}`).join("\n")}`
        if (!usedComponents.size) report = "No shadcn/ui imports detected."
        report += depGap
        push("step", { id: "step-4", title: "📦 Dependency audit", content: report, timestamp: Date.now() })
        historySteps.push({ title: "📦 Audit", content: `${usedComponents.size} component${usedComponents.size===1?"":"s"} used` })

        // Save to DB
        if (ObjectId.isValid(projectId) && generated.length > 0) {
          try {
            const client = await clientPromise
            const db = client.db()
            for (const page of generated) {
              const upd = await db.collection("users").updateOne(
                { id: session.user.id, projects: { $elemMatch: { _id: new ObjectId(projectId), "pages.name": page.name } } },
                { $set: { "projects.$[proj].pages.$[pg].content": page.code, "projects.$[proj].pages.$[pg].usedFor": page.usedFor, "projects.$[proj].pages.$[pg].updatedAt": new Date() } },
                { arrayFilters: [{ "proj._id": new ObjectId(projectId) }, { "pg.name": page.name }] },
              )
              if (upd.matchedCount === 0) {
                await db.collection("users").updateOne(
                  { id: session.user.id, "projects._id": new ObjectId(projectId) },
                  { $push: { "projects.$.pages": { name: page.name, content: page.code, usedFor: page.usedFor, createdAt: new Date(), updatedAt: new Date() } } as any },
                )
              }
            }
            push("step", { id: "step-done", title: "💾 Saved", content: `${generated.length} files saved.`, timestamp: Date.now() })
          } catch (e: any) {
            push("step", { id: "step-done", title: "⚠️ DB fail", content: e.message, timestamp: Date.now() })
          }
        }

        historySteps.push({ title: "💾 Files", content: `${generated.length} generated` })
        await saveHistory(projectId, session.user.id, {
          prompt,
          model: model.id,
          timestamp: Date.now(),
          files: generated.map(p => p.name),
          steps: historySteps,
        })

        finish()
      } catch (err: any) {
        push("error", { message: `Pipeline crashed: ${err.message}` })
        historySteps.push({ title: "❌ Crash", content: err.message })
        finish()
      }
    },
    cancel() { closed = true },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  })
}
