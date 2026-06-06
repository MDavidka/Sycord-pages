// Syra agent pipeline.
//
// Orchestrates the full flow and streams granular events (steps, tool calls,
// file changes, debug logs) to the caller so the UI can render live progress:
//
//   prompt -> inspect -> read -> cache -> plan -> generate -> save -> validate -> summary
//
// The "filesystem" is a VirtualFs seeded from the project's stored pages. The
// caller persists `result.changes` once the run completes.

import type { Content, Part } from "@google/genai"
import {
  cacheProjectContext,
  generate,
  getAiClient,
  releaseContextCache,
  type AiClient,
  type ProjectContextHandle,
} from "./gemini"
import { buildStableContext, detectFramework, importantFilesToRead } from "./detect"
import { ensureDeployable, injectDesignSystem } from "./scaffold"
import { designSystemReference } from "./shadcn"
import { SYRA_SYSTEM, buildGeneratePrompt, buildPlanPrompt, parsePlan } from "./prompts"
import { FUNCTION_DECLARATIONS, executeTool, type ToolContext } from "./tools"
import { validateFiles, type ValidationIssue } from "./validate"
import { VirtualFs } from "./vfs"
import type { FileChange, SyraEvent, SyraEventInput, SyraPlan, SyraStepKey, StepStatus } from "./types"
import { iconForTool } from "./types"

export interface RunOptions {
  prompt: string
  initialFiles: { path: string; content: string }[]
  emit: (event: SyraEventInput) => void
  signal?: AbortSignal
  /** Persists the final diff to storage during the "save" step. */
  persist?: (changes: FileChange[]) => Promise<{ saved: string[]; removed: string[]; skipped: { path: string; reason: string }[] }>
}

export interface RunResult {
  success: boolean
  summary: string
  changes: FileChange[]
  finalFiles: { path: string; content: string }[]
  created: string[]
  modified: string[]
  deleted: string[]
  previewPath: string | null
  error?: string
}

const MAX_TOOL_ROUNDS = 26

export async function runSyra(opts: RunOptions): Promise<RunResult> {
  const { prompt, initialFiles, signal } = opts

  let counter = 0
  const emit = (event: SyraEventInput) => opts.emit({ ...event, id: counter++ } as SyraEvent)
  const log = (message: string, level: "info" | "warn" | "error" = "info") =>
    emit({ type: "log", level, message })
  const step = (key: SyraStepKey, status: StepStatus, label: string, detail?: string) =>
    emit({ type: "step", key, status, label, detail })

  const aborted = () => signal?.aborted

  const vfs = new VirtualFs(initialFiles)
  let client: AiClient
  let handle: ProjectContextHandle | null = null

  try {
    // ---------- Step: prompt ----------
    step("prompt", "running", "Understanding your prompt")
    log(`Received prompt (${prompt.length} chars).`)
    client = getAiClient()
    log(`AI runtime: ${client.mode} · model ${client.model}.`)
    step("prompt", "success", "Prompt understood", prompt.slice(0, 140))

    // ---------- Step: inspect ----------
    step("inspect", "running", "Inspecting the codebase")
    emit({ type: "tool", tool: "list_files", status: "running", label: "Listing project files" })
    const allFiles = vfs.list()
    emit({
      type: "tool",
      tool: "list_files",
      status: "success",
      label: `Found ${allFiles.length} file${allFiles.length === 1 ? "" : "s"}`,
    })
    log(allFiles.length ? `Project files:\n${vfs.tree()}` : "Project is empty — Syra will scaffold from scratch.")

    emit({ type: "tool", tool: "detect_framework", status: "running", label: "Detecting framework" })
    const framework = detectFramework(vfs)
    emit({
      type: "tool",
      tool: "detect_framework",
      status: "success",
      label: `${framework.framework} · ${framework.router} router · ${framework.styling}`,
    })
    log(
      `Detected ${framework.framework} (${framework.router} router, ${framework.language}, ${framework.styling}). Home: ${framework.entryFile}; components: ${framework.componentsDir}.`,
    )
    framework.notes.forEach((n) => log(n, "warn"))
    step("inspect", "success", `${framework.framework} · ${framework.router}`)

    if (aborted()) return abortResult(vfs)

    // ---------- Pre-install the design system (so the model can see + import it) ----------
    emit({ type: "tool", tool: "ensure_deployable", status: "running", label: "Installing shadcn/ui design system" })
    const design = injectDesignSystem(vfs, framework)
    for (const path of design.changed) {
      const change = vfs.changes().find((c) => c.path === path)
      if (change) emit({ type: "file", change })
    }
    if (design.changed.length) {
      design.notes.forEach((n) => log(n))
      emit({
        type: "tool",
        tool: "ensure_deployable",
        status: "success",
        label: `Installed ${design.changed.length} design-system file${design.changed.length === 1 ? "" : "s"}`,
      })
      log(`Design system files now available to import: ${design.changed.join(", ")}`)
    } else {
      emit({ type: "tool", tool: "ensure_deployable", status: "success", label: "Design system already present" })
    }

    if (aborted()) return abortResult(vfs)

    // ---------- Step: read ----------
    step("read", "running", "Reading key files")
    const toRead = importantFilesToRead(vfs, framework)
    if (toRead.length) {
      emit({ type: "tool", tool: "read_files", status: "running", label: `Reading ${toRead.length} key files`, args: toRead })
      log(`Reading key files: ${toRead.join(", ")}`)
      emit({ type: "tool", tool: "read_files", status: "success", label: `Read ${toRead.length} files` })
      step("read", "success", `Read ${toRead.length} key file${toRead.length === 1 ? "" : "s"}`)
    } else {
      step("read", "skipped", "No existing files to read")
      log("No existing key files to read.")
    }

    // ---------- Step: cache ----------
    step("cache", "running", "Caching project context")
    const stableContext = [
      buildStableContext(vfs, framework, toRead),
      "",
      designSystemReference(),
      "",
      "# Current project files (exact paths, case-sensitive)",
      "```",
      vfs.tree(),
      "```",
    ].join("\n")
    log(`Stable context built (${stableContext.length} chars, incl. design system + file tree).`)
    handle = await cacheProjectContext(client, stableContext)
    if (handle.cached) {
      emit({ type: "context", cached: true, tokens: handle.tokens, detail: `Vertex AI context cache created (${handle.tokens ?? "?"} tokens).` })
      step("cache", "success", `Context cached (${handle.tokens ?? "?"} tokens)`)
      log(`Context cache: ${handle.cacheName}`)
    } else {
      emit({ type: "context", cached: false, tokens: handle.tokens, detail: "Context inlined into the system prompt (cache skipped)." })
      step("cache", "success", "Context inlined")
      log("Context cache skipped (context below the cache minimum) — inlining instead.")
    }

    if (aborted()) return abortResult(vfs)

    // ---------- Step: plan ----------
    step("plan", "running", "Planning the build")
    emit({ type: "tool", tool: "log_action", status: "running", label: "Generating plan" })
    const planRes = await generate({
      client,
      handle,
      systemInstruction: SYRA_SYSTEM,
      contents: [{ role: "user", parts: [{ text: buildPlanPrompt(prompt, framework) }] }],
      responseJson: true,
      temperature: 0.4,
    })
    const planText = safeText(planRes)
    logUsage(planRes, log)
    const plan: SyraPlan = parsePlan(planText)
    emit({ type: "tool", tool: "log_action", status: "success", label: "Plan ready" })
    emit({ type: "plan", plan })
    log(`Plan: ${plan.summary}`)
    plan.steps.forEach((s, i) => log(`  ${i + 1}. ${s}`))
    if (plan.files.length) log(`Planned files: ${plan.files.map((f) => f.path).join(", ")}`)
    step("plan", "success", plan.summary)

    if (aborted()) return abortResult(vfs)

    // ---------- Step: generate ----------
    step("generate", "running", "Generating files")
    const ctx: ToolContext = {
      vfs,
      framework,
      memory: new Map(),
      onFileChange: (path, kind) => {
        const change = vfs
          .changes()
          .find((c) => c.path === path && c.kind === kind) || { path, kind, content: vfs.read(path) || "" }
        emit({ type: "file", change })
      },
      onLog: (m) => log(m),
    }

    const finalSummary = await runToolLoop({
      client,
      handle,
      ctx,
      emit,
      log,
      aborted,
      firstUserMessage: buildGeneratePrompt(prompt, plan, framework),
    })
    step("generate", "success", `Generated ${vfs.changes().filter((c) => c.kind !== "deleted").length} file change(s)`)

    if (aborted()) return abortResult(vfs)

    // ---------- Deployable scaffold (within the generate step) ----------
    // Guarantee the project has everything needed to `npm install && next build
    // && next start`: package.json (build/start scripts + every imported dep),
    // next.config, tsconfig/jsconfig, layout/globals, Tailwind config, public
    // assets and a home page. Only fills in what the model didn't already write.
    emit({ type: "tool", tool: "ensure_deployable", status: "running", label: "Ensuring deployable Next.js project" })
    const beforeScaffold = new Set(vfs.changes().map((c) => c.path))
    const scaffold = ensureDeployable(vfs, framework)
    if (scaffold.changed.length) {
      for (const path of scaffold.changed) {
        const change = vfs.changes().find((c) => c.path === path)
        if (change) emit({ type: "file", change })
      }
      scaffold.notes.forEach((n) => log(n))
      const newOnes = scaffold.changed.filter((p) => !beforeScaffold.has(p))
      emit({
        type: "tool",
        tool: "ensure_deployable",
        status: "success",
        label: `Added/updated ${scaffold.changed.length} deployment file${scaffold.changed.length === 1 ? "" : "s"}`,
      })
      log(`Deployment scaffold touched: ${scaffold.changed.join(", ")}${newOnes.length ? `` : ""}`)
    } else {
      emit({ type: "tool", tool: "ensure_deployable", status: "success", label: "Project already deployable" })
      log("Project already had all required deployment files.")
    }

    if (aborted()) return abortResult(vfs)

    // ---------- Step: validate (+ one repair round) ----------
    step("validate", "running", "Validating output")
    let issues = validateFiles(vfs, framework)
    let errors = issues.filter((i) => i.level === "error")
    issues.forEach((i) => log(`[${i.level}] ${i.path}: ${i.message}`, i.level === "error" ? "error" : "warn"))

    if (errors.length) {
      emit({ type: "tool", tool: "log_action", status: "running", label: `Fixing ${errors.length} issue(s)` })
      log(`Attempting automated repair of ${errors.length} issue(s)…`, "warn")
      await runToolLoop({
        client,
        handle,
        ctx,
        emit,
        log,
        aborted,
        firstUserMessage: buildRepairMessage(errors),
        maxRounds: 10,
      })
      issues = validateFiles(vfs, framework)
      errors = issues.filter((i) => i.level === "error")
      emit({ type: "tool", tool: "log_action", status: errors.length ? "error" : "success", label: errors.length ? `${errors.length} issue(s) remain` : "Issues fixed" })
    }
    step("validate", errors.length ? "error" : "success", errors.length ? `${errors.length} unresolved issue(s)` : "Validation passed")

    if (aborted()) return abortResult(vfs)

    // ---------- Step: save ----------
    const changes = vfs.changes()
    if (opts.persist && changes.length) {
      step("save", "running", `Saving ${changes.length} file change(s)`)
      log(`Persisting ${changes.length} change(s) to the project…`)
      try {
        const saveRes = await opts.persist(changes)
        saveRes.saved.forEach((p) => log(`saved ${p}`))
        saveRes.removed.forEach((p) => log(`removed ${p}`))
        saveRes.skipped.forEach((s) => log(`skipped ${s.path}: ${s.reason}`, "warn"))
        step("save", "success", `Saved ${saveRes.saved.length}, removed ${saveRes.removed.length}`)
      } catch (e: any) {
        log(`Save failed: ${e?.message || e}`, "error")
        step("save", "error", "Save failed")
      }
    } else if (!changes.length) {
      step("save", "skipped", "No changes to save")
    } else {
      step("save", "skipped", "Persistence not configured")
    }

    // ---------- Step: summary ----------
    const created = changes.filter((c) => c.kind === "created").map((c) => c.path)
    const modified = changes.filter((c) => c.kind === "modified").map((c) => c.path)
    const deleted = changes.filter((c) => c.kind === "deleted").map((c) => c.path)
    const previewPath = pickPreview(vfs, framework.entryFile)
    const success = errors.length === 0 && changes.length > 0

    step("summary", success ? "success" : "error", success ? "Build complete" : "Completed with issues")
    const summary = finalSummary?.trim() || defaultSummary(plan, created, modified)
    emit({
      type: "result",
      success,
      summary,
      created,
      modified,
      deleted,
      previewPath,
    })

    return {
      success,
      summary,
      changes,
      finalFiles: vfs.snapshot(),
      created,
      modified,
      deleted,
      previewPath,
    }
  } catch (err: any) {
    const message = err?.message || "Syra failed unexpectedly."
    log(message, "error")
    emit({ type: "result", success: false, summary: message, created: [], modified: [], deleted: [], previewPath: null, error: message })
    return {
      success: false,
      summary: message,
      changes: vfs.changes(),
      finalFiles: vfs.snapshot(),
      created: [],
      modified: [],
      deleted: [],
      previewPath: null,
      error: message,
    }
  } finally {
    if (client! && handle) await releaseContextCache(client, handle)
  }
}

/* ------------------------------------------------------------------ */
/* Tool-calling loop                                                   */
/* ------------------------------------------------------------------ */

async function runToolLoop(args: {
  client: AiClient
  handle: ProjectContextHandle
  ctx: ToolContext
  emit: (e: SyraEventInput) => void
  log: (m: string, level?: "info" | "warn" | "error") => void
  aborted: () => boolean | undefined
  firstUserMessage: string
  maxRounds?: number
}): Promise<string> {
  const { client, handle, ctx, emit, log, aborted } = args
  const maxRounds = args.maxRounds ?? MAX_TOOL_ROUNDS
  const fileList = () => {
    const files = ctx.vfs.list()
    return `Current project files (${files.length}) — import using these EXACT paths (case-sensitive):\n${files.join("\n")}`
  }
  const contents: Content[] = [
    { role: "user", parts: [{ text: `${args.firstUserMessage}\n\n${fileList()}` }] },
  ]
  let finalText = ""

  for (let round = 0; round < maxRounds; round++) {
    if (aborted()) break
    log(`Model round ${round + 1}…`)
    const res = await generate({
      client,
      handle,
      systemInstruction: SYRA_SYSTEM,
      contents,
      tools: FUNCTION_DECLARATIONS,
      temperature: 0.75,
      maxOutputTokens: 32768,
    })
    logUsage(res, log)

    const modelContent = res.candidates?.[0]?.content
    if (modelContent) contents.push(modelContent)

    const text = safeText(res)
    if (text && text.trim()) {
      finalText = text
      log(`Model: ${text.trim().slice(0, 300)}`)
    }

    const calls = res.functionCalls ?? []
    if (!calls.length) break

    const responseParts: Part[] = []
    for (const call of calls) {
      const name = call.name || "unknown"
      const argSummary = summarizeArgs(name, call.args)
      emit({ type: "tool", tool: name, status: "running", label: `${labelForTool(name)}${argSummary ? ` · ${argSummary}` : ""}`, args: call.args })
      try {
        const result = await executeTool(name, call.args, ctx)
        emit({ type: "tool", tool: name, status: "success", label: result.label })
        log(`${iconForTool(name)} ${name} → ${result.label}`)
        responseParts.push({ functionResponse: { name, response: asObject(result.data) } })
      } catch (e: any) {
        const msg = e?.message || "tool error"
        emit({ type: "tool", tool: name, status: "error", label: `${name} failed: ${msg}` })
        log(`${name} failed: ${msg}`, "error")
        responseParts.push({ functionResponse: { name, response: { error: msg } } })
      }
    }
    // Re-send the live file structure every round so the model never guesses a
    // path or capitalization — it always sees the exact current filenames.
    responseParts.push({ text: fileList() })
    contents.push({ role: "user", parts: responseParts })
  }

  return finalText
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function safeText(res: any): string {
  try {
    return res?.text ?? ""
  } catch {
    return ""
  }
}

function logUsage(res: any, log: (m: string, level?: "info" | "warn" | "error") => void) {
  const u = res?.usageMetadata
  if (u && (u.totalTokenCount || u.candidatesTokenCount)) {
    log(`tokens — prompt: ${u.promptTokenCount ?? "?"}, output: ${u.candidatesTokenCount ?? "?"}, total: ${u.totalTokenCount ?? "?"}`)
  }
}

function asObject(data: unknown): Record<string, unknown> {
  if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>
  return { value: data }
}

function summarizeArgs(name: string, rawArgs: any): string {
  const a = rawArgs || {}
  switch (name) {
    case "write_file":
    case "read_file":
    case "edit_file":
    case "delete_file":
      return String(a.path || "")
    case "write_files":
      return Array.isArray(a.files) ? a.files.map((f: any) => f?.path).filter(Boolean).join(", ") : ""
    case "read_files":
      return Array.isArray(a.paths) ? `${a.paths.length} files` : ""
    case "list_files":
      return a.path ? String(a.path) : "root"
    case "get_icon_suggestions":
      return String(a.section || "")
    case "generate_color_palette":
      return String(a.style || "")
    case "log_action":
      return String(a.action || "")
    default:
      return ""
  }
}

function labelForTool(name: string): string {
  switch (name) {
    case "write_file":
      return "Writing file"
    case "write_files":
      return "Writing files"
    case "edit_file":
      return "Editing file"
    case "delete_file":
      return "Deleting file"
    case "read_file":
    case "read_files":
      return "Reading"
    case "list_files":
      return "Listing files"
    case "detect_framework":
      return "Detecting framework"
    case "get_project_structure":
      return "Reading structure"
    case "get_package_info":
      return "Reading package.json"
    case "get_icon_suggestions":
      return "Suggesting icons"
    case "generate_color_palette":
      return "Building palette"
    case "log_action":
      return "Note"
    default:
      return name
  }
}

function buildRepairMessage(errors: ValidationIssue[]): string {
  return `Your generated code has validation errors. Fix ALL of them using tools (read_file then edit_file/write_file). Do not introduce new files unless required.

ERRORS:
${errors.map((e) => `- ${e.path}: ${e.message}`).join("\n")}

After fixing, reply with a short confirmation (no tool call).`
}

function pickPreview(vfs: VirtualFs, entryFile: string): string | null {
  if (vfs.exists(entryFile)) return entryFile
  const firstPage = vfs.list().find((p) => /(^|\/)(page|index)\.(tsx|jsx)$/.test(p))
  return firstPage || null
}

function defaultSummary(plan: SyraPlan, created: string[], modified: string[]): string {
  const parts = [plan.summary]
  if (created.length) parts.push(`Created ${created.length} file(s).`)
  if (modified.length) parts.push(`Updated ${modified.length} file(s).`)
  return parts.join(" ")
}

function abortResult(vfs: VirtualFs): RunResult {
  const changes = vfs.changes()
  return {
    success: false,
    summary: "Generation cancelled.",
    changes,
    finalFiles: vfs.snapshot(),
    created: changes.filter((c) => c.kind === "created").map((c) => c.path),
    modified: changes.filter((c) => c.kind === "modified").map((c) => c.path),
    deleted: changes.filter((c) => c.kind === "deleted").map((c) => c.path),
    previewPath: null,
    error: "aborted",
  }
}
