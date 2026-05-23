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
      const data = safeJson<{ components?: Array<{ slug: string; name: string; import_path: string; exports: string[]; purpose: string; composition?: string }> }>(raw)
      if (data?.components) {
        return data.components.map(c =>
          `Component: ${c.name} (slug: ${c.slug})\n  Import: ${c.import_path}\n  Exports: ${(c.exports || []).join(", ")}\n  Purpose: ${c.purpose}${c.composition ? `\n  Composition: ${c.composition}` : ""}`
        ).join("\n\n")
      }
    } catch {}
  }
  return "No shadcn cheatsheet found"
}

function generateStructurePrompt(userPrompt: string, cheatsheet: string): ChatMessage[] {
  return [
    {
      role: "system",
      content: `You are a website architect. Given a user's website request, you must produce a JSON structure describing every page/section that will be built.

Output ONLY a JSON array of objects with these fields:
- name: file path like "src/index.html" or "src/about.html" (use .html for pages, .css for styles, .ts for scripts)
- usedFor: short tag like "homepage", "about page", "global styles", "header component"
- description: detailed content description (2-3 sentences about what this page/section contains)
- route: the URL route path like "/" or "/about" or "/contact"
- priority: number 1-10 where 1 is most important/root

Rules:
- Always include a home/landing page
- Always include a global CSS file (src/style.css)
- Always include shared TypeScript types file (src/types.ts)
- Include a navigation/header component if it makes sense
- Use mobile-first design approach
- Use semantic Tailwind tokens (bg-background, text-foreground, etc.)
- Keep the plan reasonable: 3-8 pages total

The following shadcn/ui components are available for the builder to use:
${cheatsheet}

Return ONLY the JSON array, no markdown fences, no extra text.`,
    },
    {
      role: "user",
      content: userPrompt,
    },
  ]
}

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
    prevContext = "\n\nPreviously generated files (you must import from these, NOT redefine types):\n" +
      previouslyGeneratedFiles.map(f => {
        // Only show full content for recent/small files, otherwise just exports
        const lines = f.code.split("\n")
        return `--- FILE: ${f.name} (${f.usedFor || "no tag"}) ---\n\`\`\`\n${f.code}\n\`\`\``
      }).join("\n\n")
  }

  const baseSystem = `You are an expert frontend developer building a website page/section using Next.js / React + TypeScript + Tailwind CSS + shadcn/ui components.

AVAILABLE shadcn/ui COMPONENTS (use ONLY these imports):
${cheatsheet}

RULES:
1. Generate valid TypeScript/TSX code for: ${currentPage.name}
2. This file's purpose: ${currentPage.usedFor}
3. Description: ${currentPage.description}
4. Import components ONLY from @/components/ui/{slug}
5. Use semantic Tailwind tokens: bg-background, text-foreground, bg-card, text-muted-foreground, border-border, bg-primary, text-primary-foreground
6. Keep layout mobile-first: base classes for mobile, sm:/md:/lg: for larger screens
7. Do NOT import from files that don't exist yet — only import types/utils/styles that appear in "Previously generated files"
8. Do NOT redefine types/interfaces already in src/types.ts
9. Return ONLY the code, no markdown fences, no explanation text
10. For .tsx pages: use "use client" if it needs interactivity; otherwise it can be a server component

ALL PAGES IN THIS PROJECT:
${pagesContext}
${prevContext}`

  let fullSystem = baseSystem
  if (customBuilderPrompt && customBuilderPrompt !== "Generation code prompting is disabled." && customBuilderPrompt.length > 10) {
    fullSystem = `${baseSystem}\n\nADDITIONAL BUILD RULES FROM PROJECT OWNER:\n${customBuilderPrompt}`
  }

  return [
    { role: "system", content: fullSystem },
    { role: "user", content: `Generate the complete code for ${currentPage.name} (${currentPage.usedFor}). This page should: ${currentPage.description}` },
  ]
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
      }
      const done = () => {
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`))
        controller.close()
      }

      try {
        const body = await request.json().catch(() => ({}))
        const prompt = String(body.prompt ?? "").trim()
        const projectId = String(body.projectId ?? "")
        const model = {
          id: String(body.modelId ?? "deepseek-v4-pro"),
          provider: String(body.provider ?? "DeepSeek"),
        }

        if (!prompt || !projectId) {
          enqueue("error", { message: "prompt and projectId are required" })
          done()
          return
        }

        const cheatsheet = loadCheatsheet()

        // Fetch custom prompts from DB
        let customBuilderCode = ""
        try {
          const { builderCode } = await getSystemPrompts()
          if (builderCode && builderCode !== "Generation code prompting is disabled." && builderCode.trim().length > 10) {
            customBuilderCode = builderCode
          }
        } catch {}

        // ── STEP 1: Echo user input ──────────────────────────────
        const step1: BuildStep = {
          id: "step-1",
          title: "📝 Input Received",
          content: `User request: "${prompt}"\nModel: ${model.provider} - ${model.id}`,
          timestamp: Date.now(),
        }
        enqueue("step", step1)

        // ── STEP 2: Generate website structure ────────────────────
        const step2Start: BuildStep = {
          id: "step-2",
          title: "🏗️ Generating Website Structure",
          content: "Analyzing requirements and planning pages...",
          timestamp: Date.now(),
        }
        enqueue("step", step2Start)

        const structureMessages = generateStructurePrompt(prompt, cheatsheet)
        const structureResult = await callModel({ model, messages: structureMessages, temperature: 0.3 })

        let pages: PageStructure[] = []
        if (structureResult.ok) {
          pages = extractJson<PageStructure[]>(structureResult.content) || []
          if (!Array.isArray(pages) || pages.length === 0) {
            // Fallback: create a minimal structure
            pages = [
              { name: "src/index.html", usedFor: "homepage", description: "Main landing page with hero section", route: "/", priority: 1 },
              { name: "src/style.css", usedFor: "global styles", description: "Global CSS with design tokens and Tailwind utilities", route: "n/a", priority: 2 },
              { name: "src/types.ts", usedFor: "shared types", description: "Shared TypeScript interfaces and types", route: "n/a", priority: 3 },
            ]
          }
        } else {
          enqueue("error", { message: `Structure generation failed: ${structureResult.message}`, details: (structureResult as any).details })
          done()
          return
        }

        const step2Complete: BuildStep = {
          id: "step-2",
          title: "🏗️ Structure Generated",
          content: `Planned ${pages.length} pages:\n${pages.map(p => `  • ${p.name} (${p.usedFor}) → ${p.route}`).join("\n")}`,
          timestamp: Date.now(),
        }
        enqueue("step", step2Complete)

        // ── STEP 3: Generate code for each page ───────────────────
        const generatedPages: Array<{ name: string; code: string; usedFor: string; timestamp: number }> = []

        // Sort by priority: most important first (lowest number = highest priority)
        const sortedPages = [...pages].sort((a, b) => a.priority - b.priority)

        for (let i = 0; i < sortedPages.length; i++) {
          const page = sortedPages[i]
          const step3Start: BuildStep = {
            id: "step-3",
            title: `⬛ Generating: ${page.name} (${i + 1}/${sortedPages.length})`,
            content: `Purpose: ${page.usedFor}\nDescription: ${page.description}`,
            timestamp: Date.now(),
          }
          enqueue("step", step3Start)

          const codeMessages = generateCodePrompt(sortedPages, page, generatedPages, cheatsheet, customBuilderCode)
          const codeResult = await callModel({ model, messages: codeMessages, temperature: 0.2 })

          if (codeResult.ok) {
            const cleanedCode = extractCode(codeResult.content, page.name.endsWith(".ts") || page.name.endsWith(".tsx") ? "ts" : undefined) || codeResult.content
            generatedPages.push({
              name: page.name,
              code: cleanedCode,
              usedFor: page.usedFor,
              timestamp: Date.now(),
            })

            const step3Complete: BuildStep = {
              id: "step-3",
              title: `✅ Generated: ${page.name}`,
              content: `Generated ${cleanedCode.length} characters of code`,
              timestamp: Date.now(),
            }
            enqueue("step", step3Complete)
            enqueue("page", { name: page.name, code: cleanedCode, usedFor: page.usedFor, timestamp: Date.now() })
          } else {
            const step3Error: BuildStep = {
              id: "step-3",
              title: `❌ Failed: ${page.name}`,
              content: `Error: ${codeResult.message}\n${(codeResult as any).details || ""}`,
              timestamp: Date.now(),
            }
            enqueue("step", step3Error)
          }
        }

        // ── STEP 4: Load shadcn components (non-AI) ───────────────
        const step4Start: BuildStep = {
          id: "step-4",
          title: "📦 Loading shadcn/ui Components",
          content: "Scanning generated code for shadcn/ui imports...",
          timestamp: Date.now(),
        }
        enqueue("step", step4Start)

        // Parse all generated code to find what shadcn components are used
        const usedShadcnComponents = new Set<string>()
        const importRegex = /@\/components\/ui\/([a-zA-Z0-9-]+)/g
        for (const page of generatedPages) {
          let match: RegExpExecArray | null
          while ((match = importRegex.exec(page.code)) !== null) {
            usedShadcnComponents.add(match[1])
          }
        }

        // Check which components already exist on disk
        const root = process.cwd()
        const existingComponents: string[] = []
        const missingComponents: string[] = []
        const invalidSlugs = new Set<string>()

        for (const slug of usedShadcnComponents) {
          // Validate slug contains only safe characters
          if (!/^[a-zA-Z0-9-]+$/.test(slug) || slug.startsWith("-") || slug.endsWith("-")) {
            invalidSlugs.add(slug)
            continue
          }
          const compPath = join(root, "components", "ui", `${slug}.tsx`)
          if (existsSync(compPath)) {
            existingComponents.push(slug)
          } else {
            missingComponents.push(slug)
          }
        }

        let componentReport = ""
        if (existingComponents.length > 0) {
          componentReport += `✅ Found (${existingComponents.length}): ${existingComponents.join(", ")}\n`
        }
        if (missingComponents.length > 0) {
          componentReport += `⬜ Not installed (${missingComponents.length}): ${missingComponents.join(", ")}\n`
          componentReport += `Run: ${missingComponents.map(s => `npx shadcn@latest add ${s}`).join(" && ")}`
        }
        if (invalidSlugs.size > 0) {
          componentReport += `\n⚠️ Invalid import paths skipped: ${Array.from(invalidSlugs).join(", ")}`
        }
        if (usedShadcnComponents.size === 0) {
          componentReport = "No shadcn/ui component imports detected in generated code."
        }

        const step4Complete: BuildStep = {
          id: "step-4",
          title: "📦 Component Audit Complete",
          content: `Total shadcn imports detected: ${usedShadcnComponents.size}\n${componentReport}`,
          timestamp: Date.now(),
        }
        enqueue("step", step4Complete)

        // ── Save generated pages to DB ──────────────────────────
        if (ObjectId.isValid(projectId) && generatedPages.length > 0) {
          try {
            const client = await clientPromise
            const db = client.db()
            for (const page of generatedPages) {
              // Try update first
              const updResult = await db.collection("users").updateOne(
                {
                  id: session.user.id,
                  "projects": {
                    $elemMatch: {
                      _id: new ObjectId(projectId),
                      "pages.name": page.name,
                    },
                  },
                },
                {
                  $set: {
                    "projects.$[proj].pages.$[pg].content": page.code,
                    "projects.$[proj].pages.$[pg].usedFor": page.usedFor,
                    "projects.$[proj].pages.$[pg].updatedAt": new Date(),
                  },
                },
                {
                  arrayFilters: [
                    { "proj._id": new ObjectId(projectId) },
                    { "pg.name": page.name },
                  ],
                },
              )
              if (updResult.matchedCount === 0) {
                await db.collection("users").updateOne(
                  { id: session.user.id, "projects._id": new ObjectId(projectId) },
                  {
                    $push: {
                      "projects.$.pages": {
                        name: page.name,
                        content: page.code,
                        usedFor: page.usedFor,
                        createdAt: new Date(),
                        updatedAt: new Date(),
                      },
                    } as any,
                  },
                )
              }
            }
            enqueue("step", {
              id: "step-done",
              title: "💾 Pages Saved",
              content: `Saved ${generatedPages.length} pages to project database.`,
              timestamp: Date.now(),
            })
          } catch (dbErr: any) {
            enqueue("step", {
              id: "step-done",
              title: "⚠️ Save Warning",
              content: `Pages generated but DB save failed: ${dbErr.message}`,
              timestamp: Date.now(),
            })
          }
        }

        done()
      } catch (err: any) {
        enqueue("error", { message: `Pipeline error: ${err.message}`, stack: err.stack })
        done()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
