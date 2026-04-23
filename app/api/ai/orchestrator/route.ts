import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logAiDebug } from "@/lib/logger"
import { convertTreeToTypeScript, type UINode, type UITreeRoot } from "@/sample-conveter"

// Stage 4 of the pipeline: deterministic "Converter".
//
// Takes the plan + per-page style trees + per-page logic code produced by the
// model and materialises a concrete set of project files using the helper
// converter (sample-conveter.ts). No AI calls happen here — the same input
// always produces the same output.

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
        return dynamicParam ? `[${dynamicParam}]` : "param"
      }

      const sanitized = decoded
        .replace(/\s+/g, "-")
        .replace(/[^A-Za-z0-9._[\]-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")

      return sanitized || "page"
    })

  return segments.length > 0 ? `/${segments.join("/")}` : "/"
}

function logicFileBaseFromPagePath(pageFilePath: string, fallbackPageName: string): string {
  const relative = pageFilePath
    .replace(/^src\/pages\//, "")
    .replace(/\.tsx$/, "")
  const normalized = relative
    .replace(/[/[\]]+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  if (normalized) return normalized
  return fallbackPageName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
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

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({})) as { jsonPlan?: OrchestratorPage[] }
  const { jsonPlan } = body

  await logAiDebug("Orchestrator Request", {
    pagesCount: Array.isArray(jsonPlan) ? jsonPlan.length : "invalid",
  })

  if (!jsonPlan || !Array.isArray(jsonPlan) || jsonPlan.length === 0) {
    return NextResponse.json({ message: "Valid jsonPlan array is required" }, { status: 400 })
  }

  try {
    const files: Array<{ name: string; code: string; timestamp: number }> = []

    for (let i = 0; i < jsonPlan.length; i++) {
      const page = jsonPlan[i] ?? {}
      const pageName = toPascalCase(page.title || `Page ${i + 1}`)
      const routePath = typeof page.path === "string" ? page.path : `/${pageName.toLowerCase()}`
      const normalizedRoutePath = sanitizeRoutePath(routePath)
      const fileName = `src/pages${normalizedRoutePath === "/" ? "/index" : normalizedRoutePath}.tsx`

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
      files.push({ name: fileName, code: converted.component, timestamp: Date.now() })

      // Logic file: prefer the code produced by the generate-logic stage.
      // Fall back to TODO stubs if the caller didn't include any (e.g. during
      // an isolated reconvert of an existing plan).
      if (converted.handlerNames.length > 0) {
        const logicFileName = `src/lib/${logicFileBaseFromPagePath(fileName, pageName)}-logic.ts`
        let logicCode: string
        if (typeof page.logicCode === "string" && page.logicCode.trim()) {
          logicCode = page.logicCode
        } else {
          const handlerStubs = converted.handlerNames
            .map((h) => `export function ${h}() {\n  // TODO: implement ${h}\n}`)
            .join("\n\n")
          logicCode = `// Auto-generated logic handlers for ${pageName}\n\n${handlerStubs}\n`
        }
        files.push({ name: logicFileName, code: logicCode, timestamp: Date.now() })
      }
    }

    await logAiDebug("Orchestrator Success", { generatedFilesCount: files.length })
    return NextResponse.json({ files })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error("Orchestrator Error:", error)
    await logAiDebug("Orchestrator Fatal Error", { error: message, stack })
    return NextResponse.json({ message: "Internal server error", details: message }, { status: 500 })
  }
}
