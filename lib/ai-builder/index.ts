// Public entry point for the v0-style AI website builder.
//
// runAIWebsiteBuilder(userPrompt) drives the full pipeline:
//   1. AI Planning (GOOGLE_AIAGENT_API → strict-JSON SitePlan)
//   2. Manifest (deterministic projection)
//   3. Component context (load components.json, expand subset per page)
//   4. Scaffold (deterministic Next.js base files)
//   5. AI page JSON generation (per page, using the verified subset)
//   6. Validate JSON (with one AI repair attempt; otherwise safe fallback)
//   7. Convert JSON → Next.js page TSX
//   8. Generate handler/action files (real implementations only)
//   9. Build + fix (deterministic static checks)
//  10. Output { files, build, logs, plan, manifest }

import { generateSitePlan } from "./plan"
import { buildManifest } from "./manifest"
import { loadComponentsCheatsheet } from "./components-context"
import { generateScaffoldFiles } from "./scaffold"
import { generatePageUITree, parseUITreeJson } from "./page-json"
import { validatePageTree } from "./validate"
import { buildFallbackTree } from "./fallback"
import { convertPageToTsx } from "./convert"
import { collectUsedHandlers, generateHandlerFile, getKnownHandlers } from "./handlers"
import { validateBuild } from "./build"
import { callModel } from "@/lib/ai-provider"

import type {
  BuilderLogEntry,
  BuilderResult,
  GeneratedFile,
  ManifestPage,
  PageUITree,
  RunAIWebsiteBuilderOptions,
  SiteManifest,
  SitePlan,
} from "./types"
import type { ComponentsCheatsheet } from "./types"
import { PAGE_JSON_SYSTEM_PROMPT } from "./page-json"

export type {
  BuilderLogEntry,
  BuilderResult,
  GeneratedFile,
  RunAIWebsiteBuilderOptions,
  SiteManifest,
  SitePlan,
} from "./types"

export async function runAIWebsiteBuilder(
  userPrompt: string,
  options: RunAIWebsiteBuilderOptions = {},
): Promise<BuilderResult> {
  const logs: BuilderLogEntry[] = []
  const log = (entry: BuilderLogEntry) => logs.push(entry)

  if (!userPrompt || userPrompt.trim().length === 0) {
    throw new Error("userPrompt is required")
  }

  const cheatsheet = await loadComponentsCheatsheet()
  log({ step: "components", status: "ok", message: `Loaded ${Object.keys(cheatsheet.bySlug).length} shadcn components` })

  // 1. Planning.
  let plan: SitePlan
  try {
    plan = await generateSitePlan(userPrompt, options)
    log({ step: "plan", status: "ok", message: `AI plan: ${plan.projectName} (${plan.siteType}, ${plan.pages.length} pages)` })
  } catch (err) {
    log({ step: "plan", status: "error", message: errMsg(err) })
    throw err
  }

  // 2. Manifest.
  const manifest = buildManifest(plan, cheatsheet as ComponentsCheatsheet)
  log({ step: "manifest", status: "ok", message: `Manifest with ${manifest.pages.length} pages` })

  // 3+4. Scaffold (uses manifest).
  const files: GeneratedFile[] = []
  files.push(...generateScaffoldFiles(manifest))
  log({ step: "scaffold", status: "ok", message: `Wrote ${files.length} scaffold files` })

  // 5+6+7. Per-page JSON generation, validation/repair, conversion to TSX.
  for (const page of manifest.pages) {
    const tree = await getValidatedPageTree({
      userPrompt,
      plan,
      manifest,
      page,
      cheatsheet: cheatsheet as ComponentsCheatsheet,
      options,
      log,
    })
    const pageFile = convertPageToTsx({
      page,
      manifest,
      tree,
      cheatsheet: cheatsheet as ComponentsCheatsheet,
    })
    files.push(pageFile)
    log({ step: "convert", status: "ok", message: `Converted ${page.path} → ${pageFile.path}` })
  }

  // 8. Handlers — only generate handlers actually used.
  const usedHandlers = collectUsedHandlers(manifest)
  const knownUsed = usedHandlers.filter((h) => getKnownHandlers().includes(h))
  const handlerFile = generateHandlerFile(knownUsed)
  if (handlerFile) {
    files.push(handlerFile)
    log({ step: "handlers", status: "ok", message: `Wrote ${knownUsed.length} handlers` })
  } else {
    log({ step: "handlers", status: "ok", message: "No handlers required" })
  }

  // 9. Build / static validation.
  let build = validateBuild(files)
  if (!build.ok) {
    log({ step: "build", status: "warn", message: `First build had ${build.errors.length} errors; attempting deterministic fixes` })
    const fixed = applyDeterministicFixes(files, build.errors)
    build = validateBuild(fixed)
  }
  log({
    step: "build",
    status: build.ok ? "ok" : "error",
    message: build.ok ? "Build validation passed" : `Build still has errors: ${build.errors.join("; ")}`,
  })

  return { files, plan, manifest, build, logs }
}

interface ValidatedTreeArgs {
  userPrompt: string
  plan: SitePlan
  manifest: SiteManifest
  page: ManifestPage
  cheatsheet: ComponentsCheatsheet
  options: RunAIWebsiteBuilderOptions
  log: (e: BuilderLogEntry) => void
}

async function getValidatedPageTree(args: ValidatedTreeArgs): Promise<PageUITree> {
  if (args.options.offline) {
    return buildFallbackTree(args.page)
  }

  let firstResult: { tree: PageUITree; raw: string } | null = null
  try {
    firstResult = await generatePageUITree(
      {
        userPrompt: args.userPrompt,
        plan: args.plan,
        manifest: args.manifest,
        page: args.page,
        cheatsheet: args.cheatsheet,
      },
      args.options,
    )
  } catch (err) {
    args.log({ step: "page-json", status: "warn", message: `${args.page.path}: AI failed (${errMsg(err)}); using fallback` })
    return buildFallbackTree(args.page)
  }

  const validation = validatePageTree({
    page: args.page,
    tree: firstResult.tree,
    cheatsheet: args.cheatsheet,
  })
  if (validation.ok) {
    return firstResult.tree
  }

  args.log({
    step: "validate",
    status: "warn",
    message: `${args.page.path}: invalid (${validation.issues.map((i) => i.message).join("; ")}); attempting AI repair`,
  })

  const repaired = await tryRepairPage({
    userPrompt: args.userPrompt,
    page: args.page,
    cheatsheet: args.cheatsheet,
    invalidJsonRaw: firstResult.raw,
    issues: validation.issues.map((i) => i.message),
    options: args.options,
  })

  if (repaired) {
    const v2 = validatePageTree({ page: args.page, tree: repaired, cheatsheet: args.cheatsheet })
    if (v2.ok) return repaired
    args.log({
      step: "validate",
      status: "warn",
      message: `${args.page.path}: AI repair still invalid; using fallback`,
    })
  }

  return buildFallbackTree(args.page)
}

async function tryRepairPage(args: {
  userPrompt: string
  page: ManifestPage
  cheatsheet: ComponentsCheatsheet
  invalidJsonRaw: string
  issues: string[]
  options: RunAIWebsiteBuilderOptions
}): Promise<PageUITree | null> {
  const repairPrompt = `The previous JSON UI tree for "${args.page.path}" failed validation. Issues:
${args.issues.map((i) => `- ${i}`).join("\n")}

Re-emit ONLY the corrected JSON. Same schema. Same rules. Use ONLY components from the allowed subset for this page (${JSON.stringify(args.page.shadcnComponents)}). No header/footer. Mobile-first.

Previous (invalid) JSON:
${args.invalidJsonRaw}
`
  const result = await callModel({
    model: { id: args.options.modelId ?? "gemini-2.5-pro", provider: args.options.modelProvider ?? "Google" },
    messages: [
      { role: "system", content: PAGE_JSON_SYSTEM_PROMPT },
      { role: "user", content: repairPrompt },
    ],
    temperature: 0.2,
  })
  if (!result.ok) return null
  try {
    return parseUITreeJson(result.content)
  } catch {
    return null
  }
}

// Minimal deterministic fix-up pass that addresses the only build-time
// failure shape we know how to repair without re-prompting: a page
// importing a handler we never generated. Drop the import to keep the
// project compilable. AI repair handles structural issues earlier.
function applyDeterministicFixes(files: GeneratedFile[], errors: string[]): GeneratedFile[] {
  if (errors.length === 0) return files
  const handlerErr = errors.find((e) => /imports unknown handler/.test(e))
  if (!handlerErr) return files
  return files.map((f) => {
    if (!f.path.endsWith(".tsx")) return f
    const without = f.content.replace(
      /import\s*\{\s*[^}]+\s*\}\s*from\s*["']@\/lib\/handlers["']\n?/,
      "",
    )
    if (without === f.content) return f
    return { ...f, content: without }
  })
}

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}
