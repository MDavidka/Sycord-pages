import path from "node:path"
import { scanMissingShadcnImports } from "@/lib/shadcn-shared"
import {
  filterActionableDiagnostics,
  formatDiagnosticsForAI,
  isIgnoredDiagnostic,
} from "@/lib/workspace/diagnostics-filter"
import { loadProject, materializeWorkspace, projectFiles, requireUserId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

type DiagnosticEntry = { file: string; line: number; message: string }

export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId()
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").toString()

  const project = await loadProject(userId, projectId)
  if (!project) return Response.json({ message: "Project not found" }, { status: 404 })

  const files = projectFiles(project)
  const projectFileNames = files.map((f) => f.name.replace(/\\/g, "/"))
  let root: string
  try {
    root = await materializeWorkspace(projectId, files)
  } catch (err: any) {
    return Response.json({ message: err?.message || "Failed to prepare workspace" }, { status: 400 })
  }

  const tsModule = await import("typescript")
  const ts = (tsModule as any).default ?? tsModule

  const fileNames = files
    .map((f) => f.name)
    .filter((name) => /\.(tsx?|jsx?)$/.test(name) && !/\.d\.ts$/.test(name))
    .map((name) => path.join(root, name))

  if (fileNames.length === 0) {
    return Response.json({ errors: [] as DiagnosticEntry[], rawCount: 0, filteredCount: 0 })
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

  let rawErrors: DiagnosticEntry[] = []
  let errors: DiagnosticEntry[] = []

  try {
    const program = ts.createProgram(fileNames, options)
    const diagnostics = ts.getPreEmitDiagnostics(program)

    rawErrors = diagnostics
      .filter((d: any) => {
        if (!d.file || typeof d.start !== "number" || typeof d.code !== "number") return false
        const message = ts.flattenDiagnosticMessageText(d.messageText, "\n")
        return !isIgnoredDiagnostic(d.code, message)
      })
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

    const merged = [...rawErrors, ...importScan]
    errors = filterActionableDiagnostics(merged, projectFileNames)
  } catch (err: any) {
    return Response.json({ message: err?.message || "Type check failed" }, { status: 500 })
  }

  return Response.json({
    errors,
    rawCount: rawErrors.length,
    filteredCount: errors.length,
    summary: formatDiagnosticsForAI(errors, { rawCount: rawErrors.length }),
  })
}
