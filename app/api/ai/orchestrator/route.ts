import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"
import { logAiDebug } from "@/lib/logger"

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
    const prompts = await getSystemPrompts()

    // The Handling Converter cheat sheet maps "ComponentName" -> "Import/Export Code"
    let converterMap = {}
    try {
      converterMap = JSON.parse(prompts.builderFunction)
    } catch (e) {
      console.warn("Could not parse Handling Converter map, using empty map", e)
    }

    const files = []

    // 1. Generate standard package.json and vite.config.ts if this was a full project...
    // But since the AI builder currently generates files sequentially to the UI, we'll
    // focus on generating the TSX components for each page.

    // Convert a JSON node to JSX string
    function jsonToJsx(node: any): string {
      if (!node) return ""
      if (typeof node === "string") return `{\`${node}\`}`
      if (node.text) return node.text

      const Comp = node.component || "div"

      // Serialize props
      let propsStr = ""
      if (node.props) {
        propsStr = Object.entries(node.props)
          .map(([k, v]) => {
            if (typeof v === "string") return `${k}="${v}"`
            return `${k}={${JSON.stringify(v)}}`
          })
          .join(" ")
      }

      const hasChildren = Array.isArray(node.children) && node.children.length > 0

      if (!hasChildren) {
        return `<${Comp} ${propsStr} />`
      }

      const childrenJsx = node.children.map((c: any) => jsonToJsx(c)).join("\n")
      return `<${Comp} ${propsStr}>\n${childrenJsx}\n</${Comp}>`
    }

    function extractUsedComponents(node: any, set: Set<string>) {
      if (!node) return
      if (typeof node.component === "string" && node.component[0] === node.component[0].toUpperCase()) {
        set.add(node.component)
      }
      if (node.children && Array.isArray(node.children)) {
        node.children.forEach((c: any) => extractUsedComponents(c, set))
      }
    }

    // Convert each page in the JSON Plan into a React TSX file
    for (const page of jsonPlan) {
      try {
        const pageName = page.title ? page.title.replace(/\s+/g, '') : "Page"
        const path = page.path || `/${pageName.toLowerCase()}`
        const fileName = `src/pages${path === '/' ? '/index' : path}.tsx`

        const usedComponents = new Set<string>()
        extractUsedComponents(page.structure, usedComponents)

        const imports = []
        usedComponents.forEach(comp => {
          if (converterMap[comp]) {
            // Basic hack to extract just the import statement from the converter map string
            const match = converterMap[comp].match(/import\s+.*?\s+from\s+['"].*?['"];?/)
            if (match) imports.push(match[0])
          } else {
            // Fallback
            imports.push(`import { ${comp} } from '@/components/ui/${comp.toLowerCase()}'`)
          }
        })

        // Deduplicate imports
        const uniqueImports = [...new Set(imports)]

        const jsx = jsonToJsx(page.structure)

        const code = `import React from 'react'\n${uniqueImports.join("\n")}\n\nexport default function ${pageName}() {\n  return (\n    ${jsx}\n  )\n}`

        files.push({
          name: fileName,
          code: code,
          timestamp: Date.now()
        })
      } catch (pageError: any) {
        const failingPageName = page?.title || page?.path || "unknown"
        throw new Error(`Failed to convert page "${failingPageName}": ${pageError?.message || "Unknown conversion error"}`)
      }
    }

    // Save the raw JSON plan as well
    for (let i = 0; i < jsonPlan.length; i++) {
        const page = jsonPlan[i];
        const pageName = page.title ? page.title.replace(/\s+/g, '') : `Page${i}`;
        files.push({
            name: `src/cache/plan-${pageName.toLowerCase()}.json`,
            code: JSON.stringify(page, null, 2),
            timestamp: Date.now()
        });
    }

    // We can also generate an App.tsx router if needed...
    const routeImports = jsonPlan.map((p: any) => {
        const pageName = p.title ? p.title.replace(/\s+/g, '') : "Page"
        const path = p.path || `/${pageName.toLowerCase()}`
        return `import ${pageName} from './pages${path === '/' ? '/index' : path}'`
    }).join("\n")

    const routeDefs = jsonPlan.map((p: any) => {
        const pageName = p.title ? p.title.replace(/\s+/g, '') : "Page"
        const path = p.path || `/${pageName.toLowerCase()}`
        return `      <Route path="${path}" element={<${pageName} />} />`
    }).join("\n")

    const appCode = `import React from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
${routeImports}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
${routeDefs}
      </Routes>
    </BrowserRouter>
  )
}`

    files.push({
      name: "src/App.tsx",
      code: appCode,
      timestamp: Date.now()
    })

    await logAiDebug('Orchestrator Success', { generatedFilesCount: files.length })

    return NextResponse.json({ files })
  } catch (error: any) {
    console.error("Orchestrator Error:", error)
    await logAiDebug('Orchestrator Fatal Error', { error: error.message, stack: error.stack })
    return NextResponse.json(
      {
        message: "JSON to TypeScript conversion failed",
        details: error?.message || "Internal server error",
      },
      { status: 500 }
    )
  }
}
