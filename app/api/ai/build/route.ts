import { NextRequest } from "next/server"
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
}

interface BuildStep {
  id: string
  title: string
  content: string
  timestamp: number
}

function safeJson<T>(text: string): T | null {
  try { return JSON.parse(text) as T } catch { return null }
}

function loadCheatsheet(): string {
  const root = process.cwd()
  const cheatsheetPath = join(root, "components.json")
  if (existsSync(cheatsheetPath)) {
    try {
      const raw = readFileSync(cheatsheetPath, "utf-8")
      const data = safeJson<{ components?: Array<{ slug: string; name: string; import_path: string; exports: string[]; purpose: string; composition?: string; common_props?: Record<string, string[]> }> }>(raw)
      if (data?.components) {
        return data.components.map(c => {
          const propsBlock = c.common_props
            ? `\n  Props: ${Object.entries(c.common_props).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : v}`).join(", ")}`
            : ""
          return `Component: ${c.name} (slug: ${c.slug})\n  Import: import { ${(c.exports || []).join(", ")} } from "${c.import_path}"\n  Purpose: ${c.purpose}${c.composition ? `\n  Composition: ${c.composition}` : ""}${propsBlock}`
        }).join("\n\n")
      }
    } catch {}
  }
  return "No shadcn cheatsheet found"
}

const NEXTJS_STRUCTURE_RULES = `
You are a Next.js website architect. Given a user's website request, produce a JSON array describing every file needed for a production-ready Next.js App Router application.

ALL files MUST be .tsx (TypeScript + JSX) for pages/components and .ts for lib/utilities.

Output ONLY a JSON array of objects:
- name: Next.js file path. Choose from:
  • "app/layout.tsx" — root layout with metadata, fonts, providers (MANDATORY)
  • "app/page.tsx" — homepage/landing (MANDATORY)
  • "app/globals.css" — global styles with Tailwind + design tokens (MANDATORY)
  • "lib/types.ts" — shared TypeScript interfaces (MANDATORY)
  • "lib/utils.ts" — cn() helper with clsx + tailwind-merge (MANDATORY)
  • "app/[route]/page.tsx" — nested route pages (e.g. "app/about/page.tsx")
  • "components/site-header.tsx" — shared header/navigation
  • "components/site-footer.tsx" — shared footer
  • "components/[name].tsx" — custom components
  • "app/[route]/loading.tsx" — route loading states
  • "app/[route]/error.tsx" — route error boundaries
- usedFor: short tag like "root layout", "homepage", "about page", "header", "types"
- description: detailed description of what this file contains (2-3 sentences)
- route: URL route path like "/" or "/about". Use "n/a" for non-page files.
- priority: number 1-100 where 1 = must generate FIRST (dependencies first)

GENERATION ORDER (priority):
1. "lib/types.ts" (priority 1) — all other files depend on types
2. "lib/utils.ts" (priority 2) — cn() helper needed everywhere
3. "app/globals.css" (priority 3) — design tokens
4. "app/layout.tsx" (priority 4) — root shell
5. Shared components (priority 5-10)
6. Route pages (priority 11+)
7. "app/page.tsx" — homepage often last since it composes shared components

Keep 5-12 files total. Mobile-first, semantic Tailwind tokens.`

function generateStructurePrompt(userPrompt: string, cheatsheet: string): ChatMessage[] {
  return [
    { role: "system", content: NEXTJS_STRUCTURE_RULES + `\n\nAVAILABLE shadcn/ui COMPONENTS:\n${cheatsheet}\n\nReturn ONLY the JSON array.` },
    { role: "user", content: userPrompt },
  ]
}

const CODE_RULES = `You are a production Next.js App Router + TypeScript developer. Generate complete, deployable code.

CRITICAL — 100% SHADCN/UI RULE:
You MUST use shadcn/ui components for ALL UI elements. NEVER use raw HTML <button>, <input>, <select>, <textarea>, <label>, <form> directly.
Instead use: Button, Input, Textarea, Select/SelectTrigger/SelectContent/SelectItem, Label, Checkbox, Switch, RadioGroup, Form/FormField/FormItem/FormLabel/FormControl/FormMessage.
For layout: Card/CardHeader/CardContent/CardFooter, Separator, Tabs/TabsContent/TabsList/TabsTrigger, Sheet/SheetTrigger/SheetContent, Dialog/DialogTrigger/DialogContent, Accordion, Badge, Avatar, Skeleton, Tooltip, Popover, DropdownMenu.
For navigation: NavigationMenu, Breadcrumb, Pagination, Sidebar.

ALLOWED raw HTML (structural only): div, span, section, main, header, footer, nav, article, aside, ul, ol, li, img, a, h1-h6, p, table/thead/tbody/tr/th/td, br, hr, pre, code, svg, picture, source, figure, figcaption, blockquote.

IMPORTS: import { cn } from "@/lib/utils" for className merging. Always use cn().

FILE CONVENTIONS:
- Server Components by default (no "use client")
- Add "use client" ONLY when using: useState, useEffect, useRef, onClick, onChange, onSubmit, event handlers, browser APIs
- layout.tsx: wrap children, import fonts from next/font/google, set metadata export
- page.tsx: export default async function or function, use Next.js metadata API

DESIGN:
- Mobile-first responsive: base classes + sm: + md: + lg: breakpoints
- Semantic Tailwind tokens: bg-background, text-foreground, bg-card, text-muted-foreground, border-border, bg-primary, text-primary-foreground, bg-secondary, text-secondary-foreground, bg-muted, bg-accent, bg-destructive, text-destructive-foreground
- Dark mode compatible via class strategy (use dark: variants where needed)

Return ONLY the code. No markdown fences, no explanation.`

function generateCodePrompt(
  pages: PageStructure[],
  currentPage: PageStructure,
  previouslyGeneratedFiles: Array<{ name: string; code: string; usedFor?: string }>,
  cheatsheet: string,
  customBuilderPrompt?: string,
): ChatMessage[] {
  const pagesContext = pages.map(p =>
    `- ${p.name} (route: ${p.route}, priority: ${p.priority}): ${p.description}`
  ).join("\n")

  let prevContext = ""
  if (previouslyGeneratedFiles.length > 0) {
    prevContext = "\n\nALREADY GENERATED (import from these, DO NOT redefine types/exports):\n" +
      previouslyGeneratedFiles.map(f =>
        `--- ${f.name} (${f.usedFor || ""}) ---\n${f.code}`
      ).join("\n\n---\n\n")
  }

  const fullSystem = [
    CODE_RULES,
    `\nAVAILABLE shadcn/ui COMPONENTS:\n${cheatsheet}`,
    customBuilderPrompt && customBuilderPrompt.length > 10 && customBuilderPrompt !== "Generation code prompting is disabled."
      ? `\nADDITIONAL BUILD RULES:\n${customBuilderPrompt}`
      : "",
    `\nALL FILES IN THIS PROJECT:\n${pagesContext}`,
    prevContext,
    `\nNOW GENERATE: ${currentPage.name}\nPurpose: ${currentPage.usedFor}\nDescription: ${currentPage.description}`,
  ].filter(Boolean).join("\n")

  return [
    { role: "system", content: fullSystem },
    { role: "user", content: `Write the complete production code for ${currentPage.name}.` },
  ]
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()
  let isClosed = false

  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        if (isClosed) return
        try { controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)) } catch {}
      }
      const done = () => {
        if (isClosed) return
        try { controller.enqueue(encoder.encode("event: done\ndata: {}\n\n")); controller.close() } catch {}
        isClosed = true
      }

      try {
        const body = await request.json().catch(() => ({}))
        const prompt = String(body.prompt ?? "").trim()
        const projectId = String(body.projectId ?? "")
        const model = {
          id: String(body.modelId ?? "deepseek-v4-pro"),
          provider: String(body.provider ?? "DeepSeek"),
        }

        if (!prompt || !projectId) { enqueue("error", { message: "prompt and projectId required" }); done(); return }

        const cheatsheet = loadCheatsheet()
        let customBuilderCode = ""
        try {
          const { builderCode } = await getSystemPrompts()
          if (builderCode && builderCode.length > 10 && builderCode !== "Generation code prompting is disabled.") {
            customBuilderCode = builderCode
          }
        } catch {}

        // STEP 1 ───────────────────────────────────────────────────
        enqueue("step", { id: "step-1", title: "📝 Input Received", content: `"${prompt}"\nModel: ${model.provider} · ${model.id}`, timestamp: Date.now() })

        // STEP 2 ───────────────────────────────────────────────────
        enqueue("step", { id: "step-2", title: "🏗️ Generating structure", content: "Planning Next.js App Router file tree...", timestamp: Date.now() })

        const structResult = await callModel({ model, messages: generateStructurePrompt(prompt, cheatsheet), temperature: 0.3 })

        let pages: PageStructure[] = []
        if (structResult.ok) {
          pages = extractJson<PageStructure[]>(structResult.content) || []
        }
        if (!Array.isArray(pages) || pages.length === 0) {
          pages = [
            { name: "lib/types.ts", usedFor: "shared types", description: "TypeScript interfaces for the application data model", route: "n/a", priority: 1 },
            { name: "lib/utils.ts", usedFor: "cn utility", description: "cn() helper using clsx + tailwind-merge for className composition", route: "n/a", priority: 2 },
            { name: "app/globals.css", usedFor: "global styles", description: "Tailwind directives + design tokens + base styles", route: "n/a", priority: 3 },
            { name: "app/layout.tsx", usedFor: "root layout", description: "Root layout with metadata, fonts, providers wrapping children", route: "n/a", priority: 4 },
            { name: "app/page.tsx", usedFor: "homepage", description: "Landing page with hero section, feature highlights, CTA", route: "/", priority: 6 },
          ]
        }

        enqueue("step", { id: "step-2", title: "🏗️ Structure planned", content: `${pages.length} files:\n${pages.map(p => `  • ${p.name} (${p.usedFor}) → ${p.route}`).join("\n")}`, timestamp: Date.now() })

        // STEP 3 ───────────────────────────────────────────────────
        const generated: Array<{ name: string; code: string; usedFor: string; timestamp: number }> = []
        const sorted = [...pages].sort((a, b) => a.priority - b.priority)

        for (let i = 0; i < sorted.length; i++) {
          const page = sorted[i]
          enqueue("step", {
            id: "step-3",
            title: `${i + 1}/${sorted.length} Generating: ${page.name}`,
            content: `Purpose: ${page.usedFor}\nDescription: ${page.description}`,
            timestamp: Date.now(),
          })

          const msgs = generateCodePrompt(sorted, page, generated, cheatsheet, customBuilderCode)
          const result = await callModel({ model, messages: msgs, temperature: 0.2 })

          if (result.ok) {
            const lang = page.name.endsWith(".tsx") || page.name.endsWith(".ts") ? "ts" : undefined
            const code = extractCode(result.content, lang) || result.content
            generated.push({ name: page.name, code, usedFor: page.usedFor, timestamp: Date.now() })

            enqueue("step", { id: "step-3", title: `✅ ${page.name}`, content: `${code.length.toLocaleString()} chars`, timestamp: Date.now() })
            enqueue("page", { name: page.name, code, usedFor: page.usedFor, timestamp: Date.now() })
          } else {
            enqueue("step", { id: "step-3", title: `❌ ${page.name}`, content: `${result.message}\n${(result as any).details || ""}`, timestamp: Date.now() })
          }
        }

        // STEP 4 ───────────────────────────────────────────────────
        enqueue("step", { id: "step-4", title: "📦 Checking shadcn/ui components", content: "Scanning imports...", timestamp: Date.now() })

        const usedComponents = new Set<string>()
        const importRx = /from\s+["']@\/components\/ui\/([a-zA-Z0-9-]+)["']/g
        for (const page of generated) {
          let m: RegExpExecArray | null
          while ((m = importRx.exec(page.code)) !== null) usedComponents.add(m[1])
        }

        const root = process.cwd()
        const existing: string[] = []
        const missing: string[] = []
        const invalid = new Set<string>()

        for (const slug of usedComponents) {
          if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(slug)) { invalid.add(slug); continue }
          if (existsSync(join(root, "components", "ui", `${slug}.tsx`))) existing.push(slug)
          else missing.push(slug)
        }

        let report = `Detected ${usedComponents.size} component imports\n`
        if (existing.length) report += `\n✅ Installed (${existing.length}):\n${existing.map(s => `  • ${s}  →  components/ui/${s}.tsx`).join("\n")}`
        if (missing.length) report += `\n\n⬜ Missing (${missing.length}):\n${missing.map(s => `  • ${s}  →  npx shadcn@latest add ${s}`).join("\n")}`
        if (invalid.size) report += `\n\n⚠️  Invalid slugs: ${Array.from(invalid).join(", ")}`
        if (usedComponents.size === 0) report = "No shadcn/ui imports detected."

        enqueue("step", { id: "step-4", title: "📦 Component audit", content: report, timestamp: Date.now() })

        // SAVE TO DB ───────────────────────────────────────────────
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
            enqueue("step", { id: "step-done", title: "💾 Saved", content: `${generated.length} pages saved to project database.`, timestamp: Date.now() })
          } catch (e: any) {
            enqueue("step", { id: "step-done", title: "⚠️ DB save failed", content: e.message, timestamp: Date.now() })
          }
        }

        done()
      } catch (err: any) {
        enqueue("error", { message: `Pipeline crashed: ${err.message}` })
        done()
      }
    },
    cancel() { isClosed = true },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  })
}
