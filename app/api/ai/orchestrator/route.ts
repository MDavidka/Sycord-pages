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
  const { jsonPlan, model, prompt } = body

  await logAiDebug('Orchestrator Request', { pagesCount: Array.isArray(jsonPlan) ? jsonPlan.length : 'invalid', modelId: model?.id })

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
      let finalCode = converted.component

      // Generate actual logic for any handler functions referenced in the page
      if (converted.handlerNames.length > 0 && model && prompt) {
        const apiKey = process.env.OPENROUTER_API_KEY
        if (apiKey) {
          try {
            const systemPrompt = `You are an expert React developer.
Implement the following TypeScript functions for the component "${pageName}": ${converted.handlerNames.join(", ")}.
Original requirement: ${prompt}
UI Structure: ${JSON.stringify(structureNode)}

Guidelines:
- Return ONLY the TypeScript code for these functions.
- Each function must be exported.
- Do NOT include the component itself.
- You can use standard React hooks if needed (use React.useState, React.useEffect, etc. as 'React' is already imported).
- For navigation, use 'window.location.href'.
- Include any necessary imports at the top (e.g. from lucide-react or sonner).
- NO markdown, NO explanations.`

            const aiRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: model.id || "openai/gpt-oss-20b:free",
                messages: [{ role: "system", content: systemPrompt }, { role: "user", content: "Implement the handlers logic." }],
                temperature: 0.1,
              })
            })

            if (aiRes.ok) {
              const aiData = await aiRes.json()
              let logicCode = aiData.choices?.[0]?.message?.content || ""
              logicCode = logicCode.replace(/```(?:typescript|ts|javascript|js)?\s*([\s\S]*?)\s*```/g, '$1').trim()

              // Integrate logic into the component file
              const hasUseClient = finalCode.startsWith("'use client'")
              const strippedCode = hasUseClient ? finalCode.slice(12).trim() : finalCode

              finalCode = (hasUseClient ? "'use client'\n\n" : "") + logicCode + "\n\n" + strippedCode

              // Remove the props requirement from the component function signature
              const handlerList = [...converted.handlerNames].join(', ')
              const componentHeader = `export function ${pageName}({ ${handlerList} }: Props) {`
              const newHeader = `export function ${pageName}() {`
              finalCode = finalCode.replace(componentHeader, newHeader).replace(/interface Props \{[\s\S]*?\}/, '')
            }
          } catch (e) {
            console.error("Failed to generate AI logic:", e)
          }
        }
      }

      files.push({ name: fileName, code: finalCode, timestamp: Date.now() })
    }

    await logAiDebug('Orchestrator Success', { generatedFilesCount: files.length })
    return NextResponse.json({ files })
  } catch (error: any) {
    console.error("Orchestrator Error:", error)
    await logAiDebug('Orchestrator Fatal Error', { error: error.message, stack: error.stack })
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
