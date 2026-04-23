import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { logAiDebug } from "@/lib/logger"
import { convertTreeToTypeScript, type UINode, type UITreeRoot } from "@/sample-conveter"

function toPascalCase(input: string): string {
  const candidate = (
    input
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
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
        .replace(/[^A-Za-z0-9._\[\]-]/g, "-")
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
    .replace(/[\/\[\]]+/g, "-")
    .replace(/[^A-Za-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()

  if (normalized) return normalized
  return fallbackPageName.toLowerCase().replace(/[^a-z0-9-]/g, "-")
}

function toNode(node: any): UINode {
  if (!node || typeof node !== "object") {
    return { name: "div", text: String(node ?? "") }
  }

  const name = typeof node.name === "string"
    ? node.name
    : (typeof node.component === "string" ? node.component : "div")

  return {
    name,
    props: (node.props && typeof node.props === "object") ? node.props : undefined,
    text: typeof node.text === "string" ? node.text : undefined,
    children: Array.isArray(node.children) ? node.children.map(toNode) : undefined,
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { jsonPlan } = body

  await logAiDebug('Orchestrator Request', { pagesCount: Array.isArray(jsonPlan) ? jsonPlan.length : 'invalid' })

  if (!jsonPlan || !Array.isArray(jsonPlan)) {
    return NextResponse.json({ message: "Valid jsonPlan array is required" }, { status: 400 })
  }

  try {
    const files: Array<{ name: string; code: string; timestamp: number }> = []

    for (let i = 0; i < jsonPlan.length; i++) {
      const page = jsonPlan[i]
      const pageName = toPascalCase(page?.title || `Page ${i + 1}`)
      const routePath = typeof page?.path === "string" ? page.path : `/${pageName.toLowerCase()}`
      const normalizedRoutePath = sanitizeRoutePath(routePath)
      const fileName = `src/pages${normalizedRoutePath === "/" ? "/index" : normalizedRoutePath}.tsx`

      const structureNode = page?.structure || page?.component || page
      const uiTree: UITreeRoot = {
        type: "ui-tree",
        version: "1.0",
        component: toNode(structureNode),
      }

      const converted = convertTreeToTypeScript(uiTree, pageName)
      files.push({ name: fileName, code: converted.component, timestamp: Date.now() })

      // Generate a logic file for any handler functions referenced in the page
      if (converted.handlerNames.length > 0) {
        const logicFileName = `src/lib/${logicFileBaseFromPagePath(fileName, pageName)}-logic.ts`
        const handlerStubs = converted.handlerNames
          .map(h => `export function ${h}() {\n  // TODO: implement ${h}\n}`)
          .join('\n\n')
        const logicCode = `// Auto-generated logic handlers for ${pageName}\n\n${handlerStubs}\n`
        files.push({ name: logicFileName, code: logicCode, timestamp: Date.now() })
      }
    }

    await logAiDebug('Orchestrator Success', { generatedFilesCount: files.length })
    return NextResponse.json({ files })
  } catch (error: any) {
    console.error("Orchestrator Error:", error)
    await logAiDebug('Orchestrator Fatal Error', { error: error.message, stack: error.stack })
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
