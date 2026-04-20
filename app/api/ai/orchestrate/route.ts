import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { extractStyleComponents, type FunctionJson, type StyleNode, type StyleJson } from "@/lib/ai-builder"

type GeneratedFile = { name: string; content: string; usedFor: string }

function getNodeChildrenInjection(nodeId: string, fnJson: FunctionJson) {
  const injection = fnJson.render_injections?.[nodeId]
  if (!injection) return null
  if (typeof injection === "object" && injection !== null && "children" in injection) return String((injection as any).children).trim()
  if (typeof injection === "string") {
    const match = injection.match(/children\s*:\s*([^}]+)/i)
    if (match?.[1]) return match[1].trim()
    return injection.trim()
  }
  return null
}

function renderNode(node: StyleNode, fnJson: FunctionJson, depth = 2): string {
  const indent = "  ".repeat(depth)
  const innerIndent = "  ".repeat(depth + 1)
  const { id, component, children = [], label, onClick, ...rest } = node
  const propParts: string[] = []

  if (onClick) propParts.push(`onClick={${onClick}}`)
  for (const [key, value] of Object.entries(rest)) {
    if (value === undefined || value === null) continue
    if (typeof value === "boolean") {
      if (value) propParts.push(key)
      continue
    }
    if (typeof value === "number") {
      propParts.push(`${key}={${value}}`)
      continue
    }
    if (typeof value === "string") {
      propParts.push(`${key}=${JSON.stringify(value)}`)
    }
  }

  const props = propParts.length ? ` ${propParts.join(" ")}` : ""
  const childNodes = children.map((child) => renderNode(child, fnJson, depth + 1))
  const injectedChildren = getNodeChildrenInjection(id, fnJson)
  const textChildren = label ? [JSON.stringify(label)] : []
  const exprChildren = injectedChildren ? [`{${injectedChildren.replace(/^\{|\}$/g, "").trim()}}`] : []
  const mergedChildren = [...exprChildren, ...textChildren, ...childNodes]

  if (mergedChildren.length === 0) return `${indent}<${component}${props} />`

  return `${indent}<${component}${props}>\n${mergedChildren
    .map((chunk) => (chunk.startsWith(" ".repeat(depth + 1)) ? chunk : `${innerIndent}${chunk}`))
    .join("\n")}\n${indent}</${component}>`
}

function buildUiLibraryFile(componentNames: string[]) {
  const names = new Set(componentNames)
  const lines: string[] = [
    `import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react"`,
  ]

  const divComponent = (name: string, baseClass: string) => `
export function ${name}({ children, className = "", ...props }: { children?: ReactNode; className?: string; [key: string]: any }) {
  return <div className={\`${baseClass} \${className}\`.trim()} {...props}>{children}</div>
}
`

  if (names.has("Card")) lines.push(divComponent("Card", "rounded-xl border border-white/15 bg-black/30 p-4"))
  if (names.has("CardHeader")) lines.push(divComponent("CardHeader", "mb-2"))
  if (names.has("CardContent")) lines.push(divComponent("CardContent", "space-y-3"))
  if (names.has("CardFooter")) lines.push(divComponent("CardFooter", "mt-4"))
  if (names.has("CardTitle")) lines.push(`export const CardTitle = ({ children, className = "", ...props }: any) => <h2 className={\`text-xl font-semibold \${className}\`.trim()} {...props}>{children}</h2>`)
  if (names.has("CardDescription")) lines.push(`export const CardDescription = ({ children, className = "", ...props }: any) => <p className={\`text-sm opacity-80 \${className}\`.trim()} {...props}>{children}</p>`)
  if (names.has("Button")) lines.push(`export const Button = ({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode; className?: string }) => <button className={\`rounded-md bg-white text-black px-4 py-2 font-medium hover:opacity-90 \${className}\`.trim()} {...props}>{children}</button>`)
  if (names.has("Input")) lines.push(`export const Input = ({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { className?: string }) => <input className={\`rounded-md border border-white/20 bg-transparent px-3 py-2 \${className}\`.trim()} {...props} />`)
  if (names.has("Textarea")) lines.push(`export const Textarea = ({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { className?: string }) => <textarea className={\`rounded-md border border-white/20 bg-transparent px-3 py-2 \${className}\`.trim()} {...props} />`)
  if (names.has("Label")) lines.push(`export const Label = ({ children, className = "", ...props }: any) => <label className={\`text-sm font-medium \${className}\`.trim()} {...props}>{children}</label>`)
  if (names.has("Badge")) lines.push(`export const Badge = ({ children, className = "", ...props }: any) => <span className={\`inline-flex rounded-full bg-white/15 px-2 py-1 text-xs \${className}\`.trim()} {...props}>{children}</span>`)
  if (names.has("Avatar")) lines.push(divComponent("Avatar", "h-10 w-10 rounded-full bg-white/20"))
  if (names.has("Alert")) lines.push(divComponent("Alert", "rounded-md border border-yellow-500/50 bg-yellow-500/10 p-3"))
  if (names.has("AlertTitle")) lines.push(`export const AlertTitle = ({ children, className = "", ...props }: any) => <div className={\`font-semibold \${className}\`.trim()} {...props}>{children}</div>`)
  if (names.has("AlertDescription")) lines.push(divComponent("AlertDescription", "text-sm opacity-90"))
  if (names.has("Dialog")) lines.push(divComponent("Dialog", ""))
  if (names.has("DialogContent")) lines.push(divComponent("DialogContent", "rounded-md border border-white/20 p-4"))
  if (names.has("DialogHeader")) lines.push(divComponent("DialogHeader", "mb-2"))
  if (names.has("DialogTitle")) lines.push(divComponent("DialogTitle", "font-semibold"))
  if (names.has("DialogDescription")) lines.push(divComponent("DialogDescription", "text-sm opacity-80"))
  if (names.has("DialogFooter")) lines.push(divComponent("DialogFooter", "mt-3"))
  if (names.has("Sheet")) lines.push(divComponent("Sheet", ""))
  if (names.has("SheetContent")) lines.push(divComponent("SheetContent", "rounded-md border border-white/20 p-4"))
  if (names.has("SheetHeader")) lines.push(divComponent("SheetHeader", "mb-2"))
  if (names.has("SheetTitle")) lines.push(divComponent("SheetTitle", "font-semibold"))
  if (names.has("SheetDescription")) lines.push(divComponent("SheetDescription", "text-sm opacity-80"))

  return `${lines.join("\n")}
`
}

function buildAppFile(style: StyleJson, functions: FunctionJson, componentNames: string[]) {
  const componentImport = componentNames.length ? `import { ${componentNames.sort().join(", ")} } from "./components/ui"` : ""
  const stateLines = functions.state?.filter(Boolean) ?? []
  const handlerLines = Object.values(functions.handlers ?? {}).filter(Boolean)
  const jsx = renderNode(style.root, functions, 2)

  return `import { useState } from "react"
${componentImport}
import "./style.css"

export default function App() {
${stateLines.length ? stateLines.map((line) => `  ${line}`).join("\n") : ""}
${handlerLines.length ? handlerLines.map((line) => `  ${line}`).join("\n") : ""}

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
${jsx}
    </div>
  )
}
`
}

function buildStaticFiles(appTsx: string, uiTsx: string): GeneratedFile[] {
  return [
    {
      name: "package.json",
      usedFor: "Vite/React package config",
      content: `{
  "name": "generated-app",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0"
  },
  "devDependencies": {
    "@types/react": "^19.2.2",
    "@types/react-dom": "^19.2.2",
    "@vitejs/plugin-react": "^5.1.0",
    "typescript": "^5.9.3",
    "vite": "^7.1.12"
  }
}
`,
    },
    {
      name: "tsconfig.json",
      usedFor: "TypeScript compiler config",
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
    },
    {
      name: "vite.config.ts",
      usedFor: "Vite build config",
      content: `import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],
  build: { outDir: "dist" },
})
`,
    },
    {
      name: "index.html",
      usedFor: "HTML shell",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      name: "src/main.tsx",
      usedFor: "React entrypoint",
      content: `import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`,
    },
    {
      name: "src/style.css",
      usedFor: "Global styles",
      content: `:root { color-scheme: light dark; }
html, body, #root { margin: 0; min-height: 100%; font-family: Inter, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
.bg-background { background: #0a0a0a; }
.text-foreground { color: #f4f4f5; }
`,
    },
    { name: "src/components/ui.tsx", usedFor: "Generated UI primitives", content: uiTsx },
    { name: "src/App.tsx", usedFor: "Generated app component", content: appTsx },
  ]
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { style, functions } = await request.json() as { style: StyleJson; functions: FunctionJson }
    if (!style?.root) {
      return NextResponse.json({ message: "Missing style.root" }, { status: 400 })
    }

    const componentNames = Array.from(extractStyleComponents(style.root))
    const appTsx = buildAppFile(style, functions || {}, componentNames)
    const uiTsx = buildUiLibraryFile(componentNames)
    const files = buildStaticFiles(appTsx, uiTsx)
    return NextResponse.json({ files })
  } catch (error: any) {
    console.error("[AI builder] Orchestration error:", error)
    return NextResponse.json({ message: error.message || "Failed to orchestrate files" }, { status: 500 })
  }
}
