import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logAiDebug } from "@/lib/logger"
import { convertTreeToTypeScript, type UINode, type UITreeRoot } from "@/sample-conveter"
import { buildViteScaffold, type ScaffoldFile, type ScaffoldRoute } from "@/lib/vite-scaffold"
import type { ProjectManifest, ManifestPage } from "@/lib/project-manifest"

// Stage 4 of the pipeline: deterministic "Converter".
//
// Takes the plan + per-page style trees + per-page logic code produced by the
// model and materialises a COMPLETE Vite project — scaffold files
// (package.json, vite.config.ts, tsconfig, tailwind, main.tsx, App.tsx with
// router, vendored shadcn UI) plus one generated page file + one logic file
// per plan entry. Same input ⇒ same output; no AI calls happen here.

function toPascalCase(input: string): string {
  const candidate = (
    input
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join("") || "GeneratedPage"
  )
  return /^[A-Za-z_]/.test(candidate) ? candidate : `Page${candidate}`
}

function sanitizeRoutePath(input: unknown): string {
  const raw = typeof input === "string" ? input.trim() : ""
  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`
  const segments = withLeadingSlash
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      const decoded = decodeURIComponent(segment).trim()
      if (!decoded) return "page"

      if (decoded.startsWith(":")) {
        const dynamicParam = decoded.slice(1).replace(/[^A-Za-z0-9_]/g, "")
        return dynamicParam ? `:${dynamicParam}` : ":param"
      }

      const sanitized = decoded
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9._-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

      return sanitized || "page"
    })

  return segments.length > 0 ? `/${segments.join("/")}` : "/"
}

function pageFileSlug(routePath: string, fallbackPageName: string): string {
  // Map React-Router path → a filesystem-safe slug used in src/pages/<slug>.tsx
  // e.g. "/" → "index", "/about" → "about", "/users/:id" → "users-id"
  if (routePath === "/") return "index"
  const slug = routePath
    .replace(/^\//, "")
    .replace(/[/:]+/g, "-")
    .replace(/[^A-Za-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
  return slug || fallbackPageName.toLowerCase().replace(/[^a-z0-9-]/g, "-") || "index"
}

function toNode(node: unknown): UINode {
  if (!node || typeof node !== "object") {
    return { name: "div", text: String(node ?? "") }
  }

  const n = node as Record<string, unknown>
  const nameFromName = typeof n.name === "string" ? n.name : undefined
  const nameFromComponent = typeof n.component === "string" ? n.component : undefined
  const name = nameFromName ?? nameFromComponent ?? "div"

  return {
    name,
    props: n.props && typeof n.props === "object" ? (n.props as Record<string, unknown>) : undefined,
    text: typeof n.text === "string" ? n.text : undefined,
    children: Array.isArray(n.children) ? n.children.map(toNode) : undefined,
  }
}

interface OrchestratorPage {
  path?: string
  title?: string
  description?: string
  structure?: unknown
  tree?: unknown
  component?: unknown
  logicCode?: string | null
}

// Rewrite the converter's `import { foo } from '@/lib/<page>-logic'` stub so
// it actually points at the logic file we're emitting. The converter itself
// never emits a real import for handlers — it just references them as
// symbols in scope. Here we prepend the import so the page picks up the
// concrete handler implementations produced by the Logic stage.
function attachLogicImport(pageCode: string, handlerNames: string[], logicModule: string): string {
  if (handlerNames.length === 0) return pageCode
  const importLine = `import { ${handlerNames.join(", ")} } from '${logicModule}'`
  // Insert the import right after the first block of top-level imports so
  // generated .tsx keeps a canonical order (react, ui imports, then logic).
  const lines = pageCode.split("\n")
  let insertAt = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/^import\s.+from\s.+$/.test(line.trim())) {
      insertAt = i + 1
    } else if (line.trim() === "" && insertAt > 0) {
      continue
    } else if (insertAt > 0) {
      break
    }
  }
  lines.splice(insertAt, 0, importLine)
  return lines.join("\n")
}

// Belt-and-suspenders: strip any markdown fence markers (```typescript, ```,
// bare ```ts) and obvious prose prefixes from logic code before we emit it to
// disk. The Logic stage route already calls `extractCode`, but a stray
// leftover fence in the emitted .ts file causes Vite's esbuild transform to
// die with "Expected ';' but found 'is'" — which is the difference between
// a working build and a blank deployed page.
function sanitizeModelCode(code: string): string {
  if (!code) return code
  let out = code
  // Lone triple-backtick line anywhere in the file is always markdown noise.
  out = out.replace(/^[\t ]*```[a-zA-Z0-9]*[\t ]*$/gm, "")
  // If the file starts with a fenced block, try to keep only the body.
  const openingFence = out.match(/^\s*```[a-zA-Z0-9]*\s*\n([\s\S]*?)(?:```|$)/)
  if (openingFence?.[1] && /^\s*```/.test(out)) {
    out = openingFence[1]
  }
  // Strip leading lines that are obviously prose — nothing that starts with
  // `import`, `export`, `const`, `let`, `var`, `function`, `//`, `/*`, `@`,
  // `'use`, `"use` is a valid top-level TS statement head.
  const codeHead = /^(?:import\b|export\b|const\b|let\b|var\b|function\b|async\s+function\b|\/\/|\/\*|@|['"]use\s)/m
  if (!codeHead.test(out.slice(0, 200))) {
    const match = out.search(codeHead)
    if (match > 0) out = out.slice(match)
  }
  return out.trim() + "\n"
}

// Strip the `interface Props { ... }` block + function parameter destructure
// the converter emits. Since handlers now come from an imported logic module
// the page is a zero-prop component, which is what React Router expects.
function stripPropsInterface(pageCode: string): string {
  let out = pageCode.replace(/interface Props \{[\s\S]*?\n\}\n\n/, "")
  // Remove the destructured params in `export function Name({ foo, bar }: Props)`
  out = out.replace(
    /export function (\w+)\([^)]*\)/,
    "export function $1()",
  )
  return out
}

// Deterministically set document.title for each generated page from the
// manifest's pageTitle. We inject `React.useEffect(() => { document.title =
// "..." }, [])` at the top of the component body. This is one of the
// "details that currently get lost" — even if the model forgets the <title>,
// the runtime title is always correct. Safe on SSR/CSR because it runs only
// inside useEffect.
function injectDocumentTitle(pageCode: string, pageTitle: string): string {
  if (!pageTitle) return pageCode
  // Need React in scope. The converter imports React automatically when
  // useState is used; when neither state nor handlers are present it might
  // not — add an idempotent React import.
  let out = pageCode
  if (!/^import\s+React\b/m.test(out)) {
    out = `import React from 'react'\n${out}`
  }
  const titleLiteral = JSON.stringify(pageTitle)
  const hook = `  React.useEffect(() => { document.title = ${titleLiteral} }, [])\n`
  // Insert after the function signature's opening brace. Match the
  // canonical shape the converter emits: `export function Name() {`.
  return out.replace(/(export function \w+\([^)]*\)\s*\{)\n/, `$1\n${hook}`)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as {
    jsonPlan?: OrchestratorPage[]
    manifest?: ProjectManifest
  }
  const { jsonPlan, manifest } = body

  await logAiDebug("Orchestrator Request", {
    pagesCount: Array.isArray(jsonPlan) ? jsonPlan.length : "invalid",
    hasManifest: !!manifest,
  })

  if (!jsonPlan || !Array.isArray(jsonPlan) || jsonPlan.length === 0) {
    return NextResponse.json({ message: "Valid jsonPlan array is required" }, { status: 400 })
  }

  try {
    const pageFiles: ScaffoldFile[] = []
    const routes: ScaffoldRoute[] = []
    const usedSlugs = new Set<string>()

    for (let i = 0; i < jsonPlan.length; i++) {
      const page = jsonPlan[i] ?? {}
      const pageName = toPascalCase(page.title || `Page ${i + 1}`)
      const routePath = sanitizeRoutePath(
        typeof page.path === "string" ? page.path : `/${pageName.toLowerCase()}`,
      )

      // Prefer the manifest entry as source of truth so slug / file paths /
      // logic module are computed ONCE and match what the Style and Logic
      // stages already saw. Fall back to the old per-entry derivation when
      // the caller (older client) didn't send a manifest.
      const manifestPage: ManifestPage | undefined = manifest?.pages.find(
        (p) => p.route === routePath || p.componentName === pageName,
      )

      let slug: string
      if (manifestPage) {
        slug = manifestPage.slug
      } else {
        slug = pageFileSlug(routePath, pageName)
        let suffix = 2
        while (usedSlugs.has(slug)) {
          slug = `${pageFileSlug(routePath, pageName)}-${suffix++}`
        }
      }
      usedSlugs.add(slug)

      const pageFilePath = manifestPage?.pageFile ?? `src/pages/${slug}.tsx`
      const logicFilePath = manifestPage?.logicFile ?? `src/lib/${slug}-logic.ts`
      const logicModuleSpecifier = manifestPage?.logicModule ?? `@/lib/${slug}-logic`
      const pageTitle = manifestPage?.pageTitle ?? page.title ?? pageName

      // Accept any of the legacy/new shapes: the Style stage emits a
      // {type, component} envelope on `tree`; older callers might still send
      // `structure` / `component`.
      const treeCandidate =
        (page.tree && typeof page.tree === "object" && (page.tree as { component?: unknown }).component
          ? (page.tree as { component: unknown }).component
          : page.tree) ??
        page.structure ??
        page.component ??
        page

      const uiTree: UITreeRoot = {
        type: "ui-tree",
        version: "1.0",
        component: toNode(treeCandidate),
      }

      const converted = convertTreeToTypeScript(uiTree, pageName)

      // If there are any handlers left after the converter's setter-pruning,
      // route them to the logic module we're about to emit.
      let componentCode = converted.component
      if (converted.handlerNames.length > 0) {
        componentCode = attachLogicImport(componentCode, converted.handlerNames, logicModuleSpecifier)
        componentCode = stripPropsInterface(componentCode)
      }
      // Deterministic: always set document.title from the manifest so the
      // browser tab reflects the page name even if the model forgot a <title>.
      componentCode = injectDocumentTitle(componentCode, pageTitle)

      pageFiles.push({
        name: pageFilePath,
        code: sanitizeModelCode(componentCode),
        timestamp: Date.now(),
      })

      routes.push({
        path: routePath,
        importPath: `./pages/${slug}`,
        componentName: pageName,
      })

      if (converted.handlerNames.length > 0) {
        let logicCode: string
        if (typeof page.logicCode === "string" && page.logicCode.trim()) {
          logicCode = page.logicCode
        } else {
          // Fallback when the Logic stage didn't run or produced nothing
          // useful: emit implementations that are actually functional — a
          // preventDefault + a visible toast-style alert the user can replace.
          // Crucially we DO NOT emit state setters here: the converter already
          // generates those via useState, so stubs would just shadow them.
          const stubs = converted.handlerNames
            .map(
              (h) => `export function ${h}(event?: unknown): void {
  const e = event as { preventDefault?: () => void } | undefined
  e?.preventDefault?.()
  // TODO: replace with real implementation for ${h}
  if (typeof window !== 'undefined') {
    window.alert('${h} called — implement in ${logicFilePath}')
  }
}`,
            )
            .join("\n\n")
          logicCode = `// Auto-generated logic handlers for ${pageName}\n\n${stubs}\n`
        }
        pageFiles.push({
          name: logicFilePath,
          code: sanitizeModelCode(logicCode),
          timestamp: Date.now(),
        })
      }
    }

    // Scaffold: package.json, vite.config, tsconfig, tailwind, index.html,
    // main.tsx, App.tsx (routed), index.css, src/lib/utils.ts and the
    // vendored shadcn UI components. Emitted AFTER the page files so the
    // `files` array has a stable, human-readable ordering (pages first).
    const scaffoldFiles = buildViteScaffold(routes, manifest?.theme, manifest?.chrome)
    const files = [...pageFiles, ...scaffoldFiles]

    await logAiDebug("Orchestrator Success", {
      generatedFilesCount: files.length,
      routesCount: routes.length,
    })
    return NextResponse.json({ files })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error("Orchestrator Error:", error)
    await logAiDebug("Orchestrator Fatal Error", { error: message, stack })
    return NextResponse.json({ message: "Internal server error", details: message }, { status: 500 })
  }
}
