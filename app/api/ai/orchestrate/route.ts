import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[]
interface JsonObject {
  [key: string]: JsonValue
}

interface StyleNode {
  id?: string
  component?: string
  props?: Record<string, JsonValue>
  children?: StyleNode[]
}

interface StyleJson {
  pageId: string
  path?: string
  layout?: StyleNode[]
}

interface LogicBlock {
  type?: string
  code?: string
  targetId?: string
  event?: string
  handler?: string
}

interface FunctionJson {
  targetPage?: string
  logicBlocks?: LogicBlock[]
}

interface GeneratedFile {
  name: string
  content: string
  usedFor: string
}

const SHADCN_IMPORTS: Record<string, { from: string; symbol: string }> = {
  Button: { from: "@/components/ui/button", symbol: "Button" },
  Card: { from: "@/components/ui/card", symbol: "Card" },
  CardHeader: { from: "@/components/ui/card", symbol: "CardHeader" },
  CardTitle: { from: "@/components/ui/card", symbol: "CardTitle" },
  CardDescription: { from: "@/components/ui/card", symbol: "CardDescription" },
  CardContent: { from: "@/components/ui/card", symbol: "CardContent" },
  CardFooter: { from: "@/components/ui/card", symbol: "CardFooter" },
  Input: { from: "@/components/ui/input", symbol: "Input" },
  Textarea: { from: "@/components/ui/textarea", symbol: "Textarea" },
  Label: { from: "@/components/ui/label", symbol: "Label" },
  Badge: { from: "@/components/ui/badge", symbol: "Badge" },
}

function parseMaybeJson<T>(value: unknown): T {
  if (typeof value === "string") return JSON.parse(value) as T
  return value as T
}

function decodeHtmlArrows(value: string): string {
  return value.replace(/=&gt;/g, "=>").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
}

function toAttr(key: string, value: JsonValue): string {
  if (value === null || typeof value === "undefined") return ""
  if (typeof value === "string") return `${key}=${JSON.stringify(value)}`
  if (typeof value === "number" || typeof value === "boolean") return `${key}={${String(value)}}`
  return `${key}={${JSON.stringify(value)}}`
}

function isSafePropKey(key: string): boolean {
  if (!/^[a-zA-Z][\w:-]*$/.test(key)) return false
  if (/^on[A-Z]/.test(key)) return false
  if (key === "dangerouslySetInnerHTML") return false
  return true
}

function renderNode(
  node: StyleNode,
  indent = 2,
  eventHandlers: Record<string, { event: string; handlerName: string }>
): string {
  const component = node.component && /^[A-Za-z_][A-Za-z0-9_]*$/.test(node.component) ? node.component : "div"
  const props = node.props || {}
  const attrs: string[] = []
  const childrenProp = typeof props.children === "string" ? props.children : ""

  for (const [key, val] of Object.entries(props)) {
    if (key === "children") continue
    if (!isSafePropKey(key)) continue
    attrs.push(toAttr(key, val))
  }

  if (node.id) attrs.push(`data-node-id=${JSON.stringify(node.id)}`)

  const attached = node.id ? eventHandlers[node.id] : undefined
  if (attached?.event && attached?.handlerName) {
    attrs.push(`${attached.event}={${attached.handlerName}}`)
  }

  const pad = " ".repeat(indent)
  const openTag = attrs.length > 0 ? `<${component} ${attrs.filter(Boolean).join(" ")}>` : `<${component}>`
  const childNodes = Array.isArray(node.children)
    ? node.children.map((child) => renderNode(child, indent + 2, eventHandlers)).join("\n")
    : ""

  if (!childrenProp && !childNodes) return `${pad}${openTag}</${component}>`
  if (!childNodes) return `${pad}${openTag}${childrenProp}</${component}>`
  return `${pad}${openTag}\n${childNodes}\n${pad}</${component}>`
}

function sanitizeName(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_]/g, "_")
}

function buildPageComponent(styleJson: StyleJson, functionJson: FunctionJson): { pageFileName: string; pageComponentName: string; content: string } {
  const pageId = sanitizeName(styleJson.pageId || "home_001")
  const pageComponentName = `${pageId.charAt(0).toUpperCase()}${pageId.slice(1)}Page`
  const pageFileName = `src/components/page-${pageId}.tsx`

  const logicBlocks = Array.isArray(functionJson.logicBlocks) ? functionJson.logicBlocks : []
  const stateBlocks = logicBlocks.filter((b) => b.type === "state" && typeof b.code === "string").map((b) => decodeHtmlArrows(String(b.code)))
  const effectBlocks = logicBlocks.filter((b) => b.type === "effect" && typeof b.code === "string").map((b) => decodeHtmlArrows(String(b.code)))
  const handlerBlocks = logicBlocks.filter((b) => b.targetId && b.event && b.handler)

  const eventHandlers: Record<string, { event: string; handlerName: string }> = {}
  const handlerCode: string[] = []

  for (const block of handlerBlocks) {
    const handler = decodeHtmlArrows(String(block.handler))
    const nameMatch = handler.match(/const\s+([A-Za-z_][A-Za-z0-9_]*)/)
    const handlerName = nameMatch?.[1]
    if (!handlerName || !block.targetId || !block.event) continue
    handlerCode.push(handler)
    eventHandlers[String(block.targetId)] = { event: String(block.event), handlerName }
  }

  const hooks = new Set<string>()
  if (stateBlocks.length) hooks.add("useState")
  if (effectBlocks.length) hooks.add("useEffect")
  const reactImport = hooks.size ? `import { ${Array.from(hooks).join(", ")} } from "react"` : `import React from "react"`

  const usedComponents = new Set<string>()
  const walk = (n?: StyleNode[]) => {
    for (const item of n || []) {
      if (item.component) usedComponents.add(item.component)
      walk(item.children)
    }
  }
  walk(styleJson.layout)

  const importsByPath = new Map<string, Set<string>>()
  for (const comp of usedComponents) {
    const entry = SHADCN_IMPORTS[comp]
    if (!entry) continue
    if (!importsByPath.has(entry.from)) importsByPath.set(entry.from, new Set<string>())
    importsByPath.get(entry.from)!.add(entry.symbol)
  }

  const shadcnImports = Array.from(importsByPath.entries())
    .map(([from, symbols]) => `import { ${Array.from(symbols).sort().join(", ")} } from "${from}"`)
    .join("\n")

  const layout = (styleJson.layout || []).map((node) => renderNode(node, 4, eventHandlers)).join("\n")
  const fallback = `    <div className="p-8">Empty layout</div>`

  const content = `${reactImport}
${shadcnImports}

export function ${pageComponentName}(): JSX.Element {
  ${stateBlocks.join("\n  ")}
  ${handlerCode.join("\n  ")}
  ${effectBlocks.join("\n  ")}

  return (
    <main className="min-h-screen bg-background text-foreground">
${layout || fallback}
    </main>
  )
}
`

  return { pageFileName, pageComponentName, content }
}

function buildProjectFiles(styleJson: StyleJson, functionJson: FunctionJson): GeneratedFile[] {
  const { pageFileName, pageComponentName, content: pageContent } = buildPageComponent(styleJson, functionJson)
  const pagePath = styleJson.path || "/"

  return [
    {
      name: "package.json",
      usedFor: "Vite + React + TypeScript package configuration",
      content: `{
  "name": "ai-orchestrated-site",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "check": "tsc --noEmit"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "tailwindcss": "^3.4.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0",
    "lucide-react": "^0.469.0"
  },
  "devDependencies": {
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "@vitejs/plugin-react": "^4.3.1",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0"
  }
}`,
    },
    {
      name: "tsconfig.json",
      usedFor: "TypeScript compiler settings",
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "useDefineForClassFields": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"]
}`,
    },
    {
      name: "vite.config.ts",
      usedFor: "Vite build and alias configuration",
      content: `import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  build: {
    outDir: "dist",
  },
})
`,
    },
    {
      name: "src/style.css",
      usedFor: "Global style tokens",
      content: `:root {
  --background: #ffffff;
  --foreground: #111827;
}

.dark {
  --background: #09090b;
  --foreground: #f4f4f5;
}

body {
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font-family: Inter, system-ui, -apple-system, sans-serif;
}
`,
    },
    {
      name: "src/types.ts",
      usedFor: "Shared type definitions",
      content: `export interface RouteConfig {
  pageId: string
  path: string
}
`,
    },
    {
      name: "src/utils.ts",
      usedFor: "Utility helpers",
      content: `export function normalizePath(path: string): string {
  if (!path) return "/"
  return path.startsWith("/") ? path : \`/\${path}\`
}
`,
    },
    {
      name: pageFileName,
      usedFor: `Route component generated from style JSON (${styleJson.pageId})`,
      content: pageContent,
    },
    {
      name: "src/main.tsx",
      usedFor: "React entrypoint",
      content: `import React from "react"
import ReactDOM from "react-dom/client"
import "./style.css"
import { ${pageComponentName} } from "./components/page-${sanitizeName(styleJson.pageId || "home_001")}"

function App(): JSX.Element {
  return <${pageComponentName} />
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
`,
    },
    {
      name: "index.html",
      usedFor: "Vite HTML shell",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${styleJson.pageId}</title>
    <meta name="description" content="Route ${pagePath}" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      name: ".gitignore",
      usedFor: "Ignore generated artifacts",
      content: `node_modules/
dist/
*.log
`,
    },
    {
      name: "README.md",
      usedFor: "Generated project documentation",
      content: `# AI Orchestrated Project

This project was generated with the style/function/orchestration pipeline.
`,
    },
  ]
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const styleJson = parseMaybeJson<StyleJson>(body.styleJson)
    const functionJson = parseMaybeJson<FunctionJson>(body.functionJson)

    if (!styleJson?.pageId) {
      return NextResponse.json({ message: "styleJson.pageId is required" }, { status: 400 })
    }

    const files = buildProjectFiles(styleJson, functionJson || {})
    return NextResponse.json({ files, metadata: { pageId: styleJson.pageId, path: styleJson.path || "/" } })
  } catch (error: any) {
    console.error("[AI Orchestration] Error:", error)
    return NextResponse.json({ message: error.message || "Failed to orchestrate files" }, { status: 500 })
  }
}
