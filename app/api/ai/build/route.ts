import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { callModel, extractJson, extractCode, type ChatMessage } from "@/lib/ai-provider"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { readFileSync, existsSync } from "fs"
import { join } from "path"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// ── Types ────────────────────────────────────────────────────────

interface PageStructure {
  name: string
  usedFor: string
  description: string
  route: string
  priority: number
}

// ── shadcn/ui → npm dependency map ───────────────────────────────

const SHADCN_DEP_MAP: Record<string, string[]> = {
  accordion:      ["@radix-ui/react-accordion"],
  "alert-dialog": ["@radix-ui/react-alert-dialog"],
  alert:          [],
  "aspect-ratio": ["@radix-ui/react-aspect-ratio"],
  avatar:         ["@radix-ui/react-avatar"],
  badge:          [],
  breadcrumb:     [],
  button:         ["@radix-ui/react-slot", "class-variance-authority"],
  calendar:       ["react-day-picker", "date-fns"],
  card:           [],
  carousel:       ["embla-carousel-react"],
  chart:          ["recharts"],
  checkbox:       ["@radix-ui/react-checkbox"],
  collapsible:    ["@radix-ui/react-collapsible"],
  combobox:       ["cmdk", "@radix-ui/react-popover"],
  command:        ["cmdk"],
  "context-menu": ["@radix-ui/react-context-menu"],
  "data-table":   [],
  "date-picker":  ["react-day-picker", "date-fns", "@radix-ui/react-popover"],
  dialog:         ["@radix-ui/react-dialog"],
  drawer:         ["vaul"],
  "dropdown-menu":["@radix-ui/react-dropdown-menu"],
  empty:          [],
  field:          [],
  form:           ["react-hook-form", "@hookform/resolvers", "zod"],
  "hover-card":   ["@radix-ui/react-hover-card"],
  input:          [],
  "input-group":  [],
  "input-otp":    ["input-otp"],
  item:           [],
  kbd:            [],
  label:          ["@radix-ui/react-label"],
  menubar:        ["@radix-ui/react-menubar"],
  "navigation-menu": ["@radix-ui/react-navigation-menu"],
  pagination:     [],
  popover:        ["@radix-ui/react-popover"],
  progress:       ["@radix-ui/react-progress"],
  "radio-group":  ["@radix-ui/react-radio-group"],
  resizable:      ["react-resizable-panels"],
  "scroll-area":  ["@radix-ui/react-scroll-area"],
  select:         ["@radix-ui/react-select"],
  separator:      ["@radix-ui/react-separator"],
  sheet:          ["@radix-ui/react-dialog"],
  sidebar:        [],
  skeleton:       [],
  slider:         ["@radix-ui/react-slider"],
  sonner:         ["sonner"],
  spinner:        [],
  switch:         ["@radix-ui/react-switch"],
  table:          [],
  tabs:           ["@radix-ui/react-tabs"],
  textarea:       [],
  toast:          ["@radix-ui/react-toast"],
  toggle:         ["@radix-ui/react-toggle"],
  "toggle-group": ["@radix-ui/react-toggle-group"],
  tooltip:        ["@radix-ui/react-tooltip"],
  typography:     [],
}

const CORE_DEPS = [
  "next",
  "react",
  "react-dom",
]
const CORE_DEV_DEPS = [
  "typescript",
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "tailwindcss",
  "@tailwindcss/postcss",
  "postcss",
  "autoprefixer",
]
const UTILITY_DEPS = [
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "lucide-react",
  "tailwindcss-animate",
]

function buildDependencyMap(usedComponents: Set<string>) {
  const deps = new Set<string>()
  for (const [slug, pkgs] of Object.entries(SHADCN_DEP_MAP)) {
    if (usedComponents.has(slug)) {
      for (const pkg of pkgs) {
        if (!pkg.startsWith("@radix-ui/")) {
          deps.add(pkg)
        }
      }
    }
  }
  return deps
}

function buildDependencyReport(): string {
  const lines: string[] = []
  for (const [slug, pkgs] of Object.entries(SHADCN_DEP_MAP)) {
    if (pkgs.length === 0) continue
    lines.push(`  ${slug} → ${pkgs.join(", ")}`)
  }
  return lines.join("\n")
}

// ── Cheatsheet loader ────────────────────────────────────────────

function loadCheatsheet(): string {
  const root = process.cwd()
  const path = join(root, "components.json")
  if (existsSync(path)) {
    try {
      const raw = readFileSync(path, "utf-8")
      const data = JSON.parse(raw) as { components?: Array<{ slug: string; name: string; import_path: string; exports: string[]; purpose: string; composition?: string; common_props?: Record<string, string[]> }> }
      if (data?.components) {
        return data.components.map(c => {
          const deps = SHADCN_DEP_MAP[c.slug]
          const depsBlock = deps && deps.length > 0 ? `\n  npm deps: ${deps.join(", ")}` : "  npm deps: none (pure styling)"
          const propsBlock = c.common_props
            ? `  Props: ${Object.entries(c.common_props).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join("|") : v}`).join(", ")}`
            : ""
          return [
            `${c.name} (slug: ${c.slug})`,
            `  Import: import { ${(c.exports || []).join(", ")} } from "${c.import_path}"`,
            `  Purpose: ${c.purpose}`,
            depsBlock,
            c.composition ? `  Composition: ${c.composition}` : "",
            propsBlock,
          ].filter(Boolean).join("\n")
        }).join("\n\n")
      }
    } catch {}
  }
  return "No shadcn cheatsheet found"
}

// ── Prompts ──────────────────────────────────────────────────────

const STRUCTURE_RULES = `You are a Next.js App Router architect. Produce a JSON array of EVERY file needed for a deployable Next.js App Router project.

CRITICAL — MANDATORY FILES (must be included):
  • "package.json"         — npm metadata + ALL dependencies (MANDATORY, priority 1)
  • "tsconfig.json"        — TypeScript compiler options (MANDATORY, priority 2)
  • "lib/types.ts"         — shared TypeScript interfaces (MANDATORY, priority 3)
  • "lib/utils.ts"         — cn() helper using clsx + tailwind-merge (MANDATORY, priority 4)
  • "app/globals.css"      — Tailwind directives + design tokens (MANDATORY, priority 5)
  • "app/layout.tsx"       — root layout with metadata, fonts, providers (MANDATORY, priority 6)
  • "app/page.tsx"         — homepage/landing (MANDATORY, priority 7)

Optional route pages (pick the ones that make sense):
  • "app/[route]/page.tsx"
  • "app/[route]/loading.tsx"
  • "app/[route]/error.tsx"

Optional shared components:
  • "components/site-header.tsx"
  • "components/site-footer.tsx"
  • "components/[name].tsx"

Fields per object:
  - name: file path (ALL .tsx for pages/components, .ts for lib, .json for config)
  - usedFor: short tag
  - description: what this file contains (2-3 sentences)
  - route: URL path or "n/a"
  - priority: 1-100 (1 = generate FIRST — dependencies before dependents)

Keep 7-14 files total. Return ONLY the JSON array.`

function generateStructurePrompt(userPrompt: string, cheatsheet: string, depReport: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        STRUCTURE_RULES,
        `\nAVAILABLE shadcn/ui COMPONENTS:\n${cheatsheet}`,
        `\nNPM DEPENDENCY MAP (what each shadcn component needs in package.json):\n${depReport}`,
      ].join("\n"),
    },
    { role: "user", content: userPrompt },
  ]
}

const CODE_RULES = `Production Next.js App Router + TypeScript developer. Generate complete, buildable, deployable code.

═══════════════════════════════════════════════════════════
100% SHADCN/UI RULE — NO raw HTML form elements:
═══════════════════════════════════════════════════════════
  NEVER: <button>  <input>  <select>  <textarea>  <label>  <form>
  ALWAYS: <Button> <Input> <Select/SelectTrigger/...> <Textarea> <Label> <Form/FormField/...>

For layout/composition use shadcn: Card, Separator, Tabs, Sheet, Dialog, Accordion, Badge, Avatar, Skeleton, Tooltip, Popover, DropdownMenu, NavigationMenu, Breadcrumb, Pagination.

ALLOWED raw HTML (structural wrappers only):
  div, span, section, main, header, footer, nav, article, aside,
  ul, ol, li, img, a, h1-h6, p, table/thead/tbody/tr/th/td,
  br, hr, pre, code, svg, picture, source, figure, figcaption, blockquote

═══════════════════════════════════════════════════════════
NEXT.JS CONVENTIONS:
═══════════════════════════════════════════════════════════
  - Server Components by default (no "use client")
  - "use client" ONLY when using: useState, useEffect, useRef, onClick, onChange, onSubmit, browser APIs
  - layout.tsx: export metadata object (title, description), wrap {children}, import fonts from next/font/google
  - page.tsx: export default async function Page() or function Page()
  - Always use: import { cn } from "@/lib/utils"
  - Always wrap classNames in cn()

═══════════════════════════════════════════════════════════
PACKAGE.JSON RULES:
═══════════════════════════════════════════════════════════
  - Include ALL npm dependencies the project needs (next, react, react-dom, tailwindcss, every radix package for every shadcn component you plan to use)
  - Use exact version format: "^X.Y.Z" for runtime deps, "^X" for @types
  - scripts: "dev": "next dev", "build": "next build", "start": "next start", "lint": "next lint"
  - List the npm dependency map below — DO NOT miss any dep or the build WILL fail

═══════════════════════════════════════════════════════════
DESIGN:
═══════════════════════════════════════════════════════════
  - Mobile-first responsive: base + sm: + md: + lg: breakpoints
  - Semantic tokens: bg-background, text-foreground, bg-card, text-muted-foreground,
    border-border, bg-primary, text-primary-foreground, bg-secondary, text-secondary-foreground,
    bg-muted, bg-accent, bg-destructive, text-destructive-foreground
  - Dark mode ready: class strategy, use dark: variants

Return ONLY the code. No markdown fences. No explanation.`

function generateCodePrompt(
  pages: PageStructure[],
  currentPage: PageStructure,
  previouslyGeneratedFiles: Array<{ name: string; code: string; usedFor?: string }>,
  cheatsheet: string,
  depReport: string,
  customBuilderPrompt?: string,
): ChatMessage[] {
  const pagesList = pages.map(p =>
    `- ${p.name} (route: ${p.route}, priority: ${p.priority}): ${p.description}`
  ).join("\n")

  let prevBlock = ""
  if (previouslyGeneratedFiles.length > 0) {
    prevBlock = "\n\nALREADY GENERATED FILES (import from these, DO NOT redefine):\n" +
      previouslyGeneratedFiles.map(f =>
        `--- ${f.name} (${f.usedFor || ""}) ---\n${f.code}`
      ).join("\n\n")
  }

  const parts: string[] = [
    CODE_RULES,
    `\nNPM DEPENDENCY MAP (every shadcn component's required npm packages):\n${depReport}`,
    `\nAVAILABLE shadcn/ui COMPONENTS:\n${cheatsheet}`,
  ]
  if (customBuilderPrompt && customBuilderPrompt.length > 10 && customBuilderPrompt !== "Generation code prompting is disabled.") {
    parts.push(`\nADDITIONAL BUILD RULES:\n${customBuilderPrompt}`)
  }
  parts.push(`\nALL PROJECT FILES:\n${pagesList}`)
  parts.push(prevBlock)

  return [
    { role: "system", content: parts.join("\n") },
    { role: "user", content: `Write the complete production code for ${currentPage.name} (${currentPage.usedFor}).` },
  ]
}

// ── Route handler ────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

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

      try {
        const body = await request.json().catch(() => ({}))
        const prompt = String(body.prompt ?? "").trim()
        const projectId = String(body.projectId ?? "")
        const model = { id: String(body.modelId ?? "deepseek-v4-pro"), provider: String(body.provider ?? "DeepSeek") }
        if (!prompt || !projectId) { push("error", { message: "prompt and projectId required" }); finish(); return }

        const cheatsheet = loadCheatsheet()
        const depReport = buildDependencyReport()

        let customBuilderCode = ""
        try {
          const { builderCode } = await getSystemPrompts()
          if (builderCode && builderCode.length > 10 && builderCode !== "Generation code prompting is disabled.") customBuilderCode = builderCode
        } catch {}

        // ══ STEP 1 ═══════════════════════════════════════════════
        push("step", { id: "step-1", title: "📝 Input received", content: `"${prompt}"\nModel: ${model.provider} · ${model.id}`, timestamp: Date.now() })

        // ══ STEP 2 ═══════════════════════════════════════════════
        push("step", { id: "step-2", title: "🏗️ Planning file structure", content: "Designing Next.js App Router file tree + dependency graph...", timestamp: Date.now() })

        const structResult = await callModel({ model, messages: generateStructurePrompt(prompt, cheatsheet, depReport), temperature: 0.3 })
        let pages: PageStructure[] = extractJson<PageStructure[]>(structResult.ok ? structResult.content : "[]") || []

        if (!Array.isArray(pages) || pages.length === 0) {
          pages = [
            { name: "package.json", usedFor: "npm config", description: "package.json with all required dependencies for Next.js + shadcn/ui deployment", route: "n/a", priority: 1 },
            { name: "tsconfig.json", usedFor: "TypeScript config", description: "tsconfig.json with paths alias, strict mode, bundler resolution", route: "n/a", priority: 2 },
            { name: "lib/types.ts", usedFor: "shared types", description: "TypeScript interfaces for the application data model", route: "n/a", priority: 3 },
            { name: "lib/utils.ts", usedFor: "cn utility", description: "cn() helper using clsx + tailwind-merge for className composition", route: "n/a", priority: 4 },
            { name: "app/globals.css", usedFor: "global styles", description: "Tailwind directives + design tokens + base layer styles", route: "n/a", priority: 5 },
            { name: "app/layout.tsx", usedFor: "root layout", description: "Root layout with metadata, fonts, providers wrapping {children}", route: "n/a", priority: 6 },
            { name: "app/page.tsx", usedFor: "homepage", description: "Landing page with hero, features, CTA", route: "/", priority: 7 },
          ]
        }

        push("step", { id: "step-2", title: "🏗️ Structure planned", content: `${pages.length} files:\n${pages.map(p => `  • ${p.name}  [prio ${p.priority}]  ${p.usedFor}`).join("\n")}`, timestamp: Date.now() })

        // ══ STEP 3 ═══════════════════════════════════════════════
        const generated: Array<{ name: string; code: string; usedFor: string; timestamp: number }> = []
        const sorted = [...pages].sort((a, b) => a.priority - b.priority)

        for (let i = 0; i < sorted.length; i++) {
          const page = sorted[i]
          push("step", { id: "step-3", title: `${i + 1}/${sorted.length} Generating: ${page.name}`, content: `Purpose: ${page.usedFor}\n${page.description}`, timestamp: Date.now() })

          const msgs = generateCodePrompt(sorted, page, generated, cheatsheet, depReport, customBuilderCode)
          const res = await callModel({ model, messages: msgs, temperature: 0.2 })

          if (res.ok) {
            const lang = page.name.endsWith(".tsx") || page.name.endsWith(".ts") ? "ts" : undefined
            let code = extractCode(res.content, lang) || res.content

            generated.push({ name: page.name, code, usedFor: page.usedFor, timestamp: Date.now() })
            push("step", { id: "step-3", title: `✅ ${page.name}`, content: `${code.length.toLocaleString()} chars`, timestamp: Date.now() })
            push("page", { name: page.name, code, usedFor: page.usedFor, timestamp: Date.now() })
          } else {
            push("step", { id: "step-3", title: `❌ ${page.name}`, content: `${res.message}\n${(res as any).details || ""}`, timestamp: Date.now() })
          }
        }

        // ══ STEP 4 ═══════════════════════════════════════════════
        push("step", { id: "step-4", title: "📦 Auditing dependencies", content: "Scanning shadcn/ui imports + cross-referencing package.json...", timestamp: Date.now() })

        const usedComponents = new Set<string>()
        const importRx = /from\s+["']@\/components\/ui\/([a-zA-Z0-9-]+)["']/g
        for (const page of generated) {
          let m: RegExpExecArray | null
          while ((m = importRx.exec(page.code)) !== null) usedComponents.add(m[1])
        }

        const root = process.cwd()
        const existing: string[] = []
        const missing: string[] = []
        for (const slug of usedComponents) {
          if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(slug)) continue
          existsSync(join(root, "components", "ui", `${slug}.tsx`)) ? existing.push(slug) : missing.push(slug)
        }

        // Validate package.json deps against used components
        const pkgJsonPage = generated.find(p => p.name === "package.json")
        let depGapReport = ""
        if (pkgJsonPage) {
          try {
            const pkg = JSON.parse(pkgJsonPage.code)
            const pkgDeps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }
            const needed = new Set<string>()
            for (const c of usedComponents) {
              for (const dep of (SHADCN_DEP_MAP[c] || [])) {
                needed.add(dep)
              }
            }
            for (const d of CORE_DEPS) needed.add(d)
            for (const d of UTILITY_DEPS) needed.add(d)

            const gaps = [...needed].filter(d => !pkgDeps[d])
            if (gaps.length > 0) {
              depGapReport = `\n\n⚠️  DEPLOYMENT WARNING — package.json missing these deps:\n${gaps.map(d => `  MISSING: ${d}  →  npx shadcn@latest add ${d.replace("@radix-ui/react-", "")}`).join("\n")}\n\nRun these before deploying or the build will fail.`
            }
          } catch {}
        }

        let report = `${usedComponents.size} shadcn/ui imports detected`
        if (existing.length) report += `\n\n✅ Available on disk (${existing.length}):\n${existing.map(s => `  • ${s} → components/ui/${s}.tsx`).join("\n")}`
        if (missing.length) report += `\n\n⬜ Need install (${missing.length}):\n${missing.map(s => `  • npx shadcn@latest add ${s}`).join("\n")}`
        if (usedComponents.size === 0) report = "No shadcn/ui imports detected."
        report += depGapReport

        push("step", { id: "step-4", title: "📦 Dependency audit", content: report, timestamp: Date.now() })

        // ══ SAVE ═════════════════════════════════════════════════
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
            push("step", { id: "step-done", title: "💾 Saved", content: `${generated.length} files saved to project.`, timestamp: Date.now() })
          } catch (e: any) {
            push("step", { id: "step-done", title: "⚠️ DB save failed", content: e.message, timestamp: Date.now() })
          }
        }

        finish()
      } catch (err: any) {
        push("error", { message: `Pipeline crashed: ${err.message}` })
        finish()
      }
    },
    cancel() { closed = true },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  })
}
