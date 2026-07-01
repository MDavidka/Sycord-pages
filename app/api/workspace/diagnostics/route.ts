import path from "node:path"
import { scanMissingShadcnImports } from "@/lib/shadcn-shared"
import {
  filterActionableDiagnostics,
  formatDiagnosticsForAI,
  isIgnoredDiagnostic,
} from "@/lib/workspace/diagnostics-filter"
import {
  ensureSyteWorkspace,
  syteExecuteCommand,
  syteSetEnv,
  syteSyncProjectFiles,
  useSyteWorkspace,
} from "@/lib/deploy/syte-client"
import { getProjectEnvVars } from "@/lib/deploy/runner-client"
import { loadProject, materializeWorkspace, projectFiles, requireUserId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120

type DiagnosticEntry = { file: string; line: number; message: string }

function parseTscOutput(output: string): DiagnosticEntry[] {
  const errors: DiagnosticEntry[] = []
  const lines = output.split("\n")
  for (const line of lines) {
    const match = line.match(/^(.+?)\((\d+),\d+\):\s*error TS\d+:\s*(.+)$/)
    if (match) {
      errors.push({
        file: match[1].replace(/^app\//, ""),
        line: Number(match[2]),
        message: match[3].trim(),
      })
    }
  }
  return errors
}

async function syteDiagnostics(project: any, projectId: string) {
  const workspaceName =
    project.businessName || project.name || `project-${projectId.slice(0, 8)}`
  const ensure = await ensureSyteWorkspace(projectId, workspaceName)
  if (!ensure.ok) {
    return Response.json({ message: ensure.error || "Syte workspace unavailable" }, { status: 502 })
  }

  const uuid = ensure.data?.uuid || projectId
  const files = projectFiles(project)
  const projectFileNames = files.map((f) => f.name.replace(/\\/g, "/"))

  await syteSyncProjectFiles(uuid, files)
  const env = getProjectEnvVars(project)
  if (Object.keys(env).length > 0) {
    await syteSetEnv(uuid, env, true)
  }

  const hasPackageJson = files.some((f) => f.name.replace(/^\/+/, "") === "package.json")
  if (hasPackageJson) {
    await syteExecuteCommand(uuid, "npm install --no-audit --no-fund", { cwd: "app", timeout: 600 })
  }

  const tsc = await syteExecuteCommand(uuid, "npx tsc --noEmit --pretty", {
    cwd: "app",
    timeout: 300,
  })

  const output = String((tsc.data as any)?.output || "")
  const exitCode = (tsc.data as any)?.exit_code ?? (tsc.data as any)?.exitCode ?? 1
  let rawErrors = parseTscOutput(output)

  const importScan = scanMissingShadcnImports(
    files.map((f) => ({ name: f.name, content: f.content ?? "" })),
  )
  rawErrors = [...rawErrors, ...importScan]
  const errors = filterActionableDiagnostics(rawErrors, projectFileNames)

  return Response.json({
    errors,
    rawCount: rawErrors.length,
    filteredCount: errors.length,
    summary:
      exitCode === 0 && errors.length === 0
        ? "[SYSTEM] ✅ TypeScript check passed in Syte workspace (npm install + tsc --noEmit)."
        : formatDiagnosticsForAI(errors, { rawCount: rawErrors.length }) +
          (output ? `\n\n--- tsc output (tail) ---\n${output.slice(-2500)}` : ""),
    platform: "syte",
    exitCode,
  })
}

export async function GET(req: Request): Promise<Response> {
  const userId = await requireUserId()
  if (!userId) return Response.json({ message: "Unauthorized" }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").toString()

  const project = await loadProject(userId, projectId)
  if (!project) return Response.json({ message: "Project not found" }, { status: 404 })

  if (useSyteWorkspace()) {
    return syteDiagnostics(project, projectId)
  }

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
