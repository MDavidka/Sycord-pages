// GET /api/workspace/diagnostics  — typeCheck (Structured TypeScript Diagnostics)
//
// A dedicated TypeScript program parses the project's workspace files and
// returns clean JSON instead of launching a heavy CLI compiler. The project's
// saved files (pages) are materialized into a temp workspace and type-checked
// with the TypeScript compiler API.
//
// Response: { "errors": [ { "file": "src/App.tsx", "line": 45, "message": "..." } ] }

import path from "node:path"
import { scanMissingShadcnImports } from "@/lib/shadcn-shared"
import { loadProject, materializeWorkspace, projectFiles, requireUserId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

type DiagnosticEntry = { file: string; line: number; message: string }

// TS error codes that are pure "environment/resolution" noise when the sandbox
// has no installed node_modules. TS2307 is still reported for @/components/ui/*
// and @/lib/* because those indicate missing shadcn installs in the project.
const IGNORED_TS_CODES = new Set<number>([
  2307,
  7016,
  2792,
  6142,
  2305,
])

function shouldReportMissingModule(message: string): boolean {
  const match = message.match(/Cannot find module '([^']+)'/)
  if (!match) return false
  const mod = match[1]
  return mod.startsWith("@/components/ui/") || mod.startsWith("@/lib/") || mod.startsWith("@/hooks/")
}

function isIgnoredDiagnostic(code: number, message: string): boolean {
  if (code === 2307 && shouldReportMissingModule(message)) return false
  return IGNORED_TS_CODES.has(code)
}

export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId()
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").toString()

  const project = await loadProject(userId, projectId)
  if (!project) return Response.json({ message: "Project not found" }, { status: 404 })

  const files = projectFiles(project)
  let root: string
  try {
    root = await materializeWorkspace(projectId, files)
  } catch (err: any) {
    return Response.json({ message: err?.message || "Failed to prepare workspace" }, { status: 400 })
  }

  // Dynamically import the TypeScript compiler (server-only dependency).
  const tsModule = await import("typescript")
  const ts = (tsModule as any).default ?? tsModule

  const fileNames = files
    .map((f) => f.name)
    .filter((name) => /\.(tsx?|jsx?)$/.test(name) && !/\.d\.ts$/.test(name))
    .map((name) => path.join(root, name))

  if (fileNames.length === 0) {
    return Response.json({ errors: [] as DiagnosticEntry[] })
  }

  const options = {
    noEmit: true,
    skipLibCheck: true,
    allowJs: true,
    checkJs: false,
    strict: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.ReactJSX,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    forceConsistentCasingInFileNames: true,
  }

  let errors: DiagnosticEntry[]
  try {
    const program = ts.createProgram(fileNames, options)
    const diagnostics = ts.getPreEmitDiagnostics(program)

    errors = diagnostics
      .filter(
        (d: any) => {
          if (!d.file || typeof d.start !== "number" || typeof d.code !== "number") return false
          const message = ts.flattenDiagnosticMessageText(d.messageText, "\n")
          return !isIgnoredDiagnostic(d.code, message)
        },
      )
      .map((d: any): DiagnosticEntry => {
        const { line } = d.file.getLineAndCharacterOfPosition(d.start)
        return {
          file: path.relative(root, d.file.fileName).split(path.sep).join("/"),
          line: line + 1,
          message: ts.flattenDiagnosticMessageText(d.messageText, "\n"),
        }
      })

    const importScan = scanMissingShadcnImports(
      files.map((f) => ({ name: f.name, content: f.content ?? "" })),
    )

    const seen = new Set(errors.map((e) => `${e.file}:${e.line}:${e.message}`))
    for (const err of importScan) {
      const key = `${err.file}:${err.line}:${err.message}`
      if (!seen.has(key)) {
        errors.push(err)
        seen.add(key)
      }
    }
  } catch (err: any) {
    return Response.json({ message: err?.message || "Type check failed" }, { status: 500 })
  }

  return Response.json({ errors })
}
