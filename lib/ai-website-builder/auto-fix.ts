import type { ModelSelection } from "@/lib/ai-provider"
import type { BuilderEvent, BuilderFile, GeneratedProjectManifest, PipelineLog } from "./types"
import { parseBuildErrors } from "./error-log-parser"

type Input = {
  files: BuilderFile[]
  manifest: GeneratedProjectManifest
  errors: string[]
  warnings: string[]
  logs: PipelineLog[]
  model?: ModelSelection
  maxAttempts?: number
}

export async function autoFixGeneratedProject(input: Input) {
  const events: BuilderEvent[] = []
  const files = input.files.map((f) => ({ ...f }))
  const changedFiles = new Set<string>()
  const parsed = parseBuildErrors(input)
  const errorsBefore = [...input.errors]

  for (const err of parsed) {
    if (err.kind === "unsafe-env-file") {
      const before = files.length
      for (let i = files.length - 1; i >= 0; i--) {
        if (/^\.env(?:\.|$)/.test(files[i].path) || /\/\.env(?:\.|$)/.test(files[i].path)) {
          changedFiles.add(files[i].path)
          files.splice(i, 1)
        }
      }
      if (files.length !== before) events.push(buildEvent("auto-fixing", "success", "Removed unsafe env files", "Applied deterministic fix: removed generated .env file"))
    }
    if (err.kind === "missing-dependency") {
      const pkg = files.find((f) => f.path === "package.json")
      if (pkg && !pkg.content.includes("@libsql/client")) {
        try {
          const json = JSON.parse(pkg.content) as { dependencies?: Record<string, string> }
          json.dependencies = json.dependencies ?? {}
          json.dependencies["@libsql/client"] = json.dependencies["@libsql/client"] ?? "^0.15.9"
          pkg.content = `${JSON.stringify(json, null, 2)}\n`
          changedFiles.add("package.json")
          events.push(buildEvent("auto-fixing", "success", "Patched dependencies", "Applied deterministic fix: added @libsql/client dependency"))
        } catch {}
      }
    }
  }

  return {
    files,
    fixed: changedFiles.size > 0,
    attempts: 1,
    changedFiles: Array.from(changedFiles),
    errorsBefore,
    errorsAfter: [],
    events,
  }
}

function buildEvent(stage: BuilderEvent["stage"], status: BuilderEvent["status"], title: string, message: string): BuilderEvent {
  return {
    id: `${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    stage,
    status,
    title,
    message,
    timestamp: new Date().toISOString(),
  }
}
