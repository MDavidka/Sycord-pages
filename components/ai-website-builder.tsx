"use client"

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { BuilderTopBar } from "@/components/builder/BuilderTopBar"
import { BuilderChatPanel } from "@/components/builder/BuilderChatPanel"
import { PreviewCanvas } from "@/components/builder/PreviewCanvas"
import { BuilderInspector } from "@/components/builder/BuilderInspector"
import {
  DEFAULT_MODEL_ID,
  INITIAL_STATE,
  MODELS,
  type BuilderLog,
  type BuilderPhase,
  type BuilderState,
  type ChatMessage,
  type DeployResult,
  type InspectorTab,
  type ModelOption,
  type GeneratedPage,
} from "@/components/builder/types"
import { BEST_COST_PER_FILE, FAST_COST_PER_FILE } from "@/lib/credits"
import type { ProjectManifest } from "@/lib/project-manifest"
import type { PlanEntry } from "@/lib/plan-types"

export type { GeneratedPage } from "@/components/builder/types"

// ---------------------------------------------------------------------------
// AIWebsiteBuilder — v0-like 3-panel shell driving the 13-phase pipeline.
//
// The component is intentionally "stateful + thin": it owns the BuilderState
// reducer, calls the existing /api/ai/* endpoints in order, and renders the
// modular sub-panels under components/builder/. The 13 phases match the
// rebuild spec verbatim (intake → planning → designing → scaffolding →
// styling → validating-json → logic → converting → assembling → building →
// fixing → deploying → done).
//
// Non-negotiables preserved from the legacy builder:
//   * model IDs / providers (MODELS) — same shape callModel expects on server
//   * external props contract — page.tsx still passes projectId +
//     generatedPages + setGeneratedPages + autoFixLogs
//   * GeneratedPage shape — auto-fix-modal still imports it from this file
// ---------------------------------------------------------------------------

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
  autoFixLogs?: string[] | null
}

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

const AIWebsiteBuilder = ({
  projectId,
  generatedPages,
  setGeneratedPages,
  autoFixLogs,
}: AIWebsiteBuilderProps) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [state, setState] = useState<BuilderState>({
    ...INITIAL_STATE,
    files: generatedPages,
  })
  const [selectedModel, setSelectedModel] = useState<ModelOption>(
    () => MODELS.find((m) => m.id === DEFAULT_MODEL_ID) ?? MODELS[0],
  )
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState(FAST_COST_PER_FILE)
  const cancelledRef = useRef(false)

  // Keep parent's generatedPages in sync so existing legacy parents (the
  // dashboard sites/[id] page) and the auto-fix modal continue to work.
  useEffect(() => {
    setGeneratedPages(state.files)
  }, [state.files, setGeneratedPages])

  // Pull credits / cost-per-file once.
  useEffect(() => {
    let cancelled = false
    fetch("/api/user/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled || !data) return
        if (typeof data.credits === "number") setCredits(data.credits)
        if (typeof data.bestCost === "number") setBestCost(data.bestCost)
        if (typeof data.fastCost === "number") setFastCost(data.fastCost)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // Surface auto-fix logs from the parent page in the Logs inspector.
  useEffect(() => {
    if (!autoFixLogs || autoFixLogs.length === 0) return
    setState((s) => ({
      ...s,
      logs: [
        ...s.logs,
        ...autoFixLogs.map<BuilderLog>((line) => ({
          id: uid(),
          level: /error|fail|exception/i.test(line) ? "error" : "info",
          phase: "fixing",
          message: line,
          timestamp: Date.now(),
        })),
      ],
    }))
  }, [autoFixLogs])

  const log = useCallback(
    (phase: BuilderPhase | "system", message: string, level: BuilderLog["level"] = "info") => {
      setState((s) => ({
        ...s,
        logs: [...s.logs, { id: uid(), level, phase, message, timestamp: Date.now() }],
      }))
    },
    [],
  )

  const setPhase = useCallback((phase: BuilderPhase) => {
    setState((s) => ({ ...s, phase }))
  }, [])

  const pushMessage = useCallback((msg: Omit<ChatMessage, "id">) => {
    setState((s) => ({ ...s, messages: [...s.messages, { ...msg, id: uid() }] }))
  }, [])

  const setPrompt = useCallback((prompt: string) => {
    setState((s) => ({ ...s, prompt }))
  }, [])

  const setAttachments = useCallback<React.Dispatch<React.SetStateAction<File[]>>>(
    (updater) => {
      setState((s) => ({
        ...s,
        attachments: typeof updater === "function" ? (updater as (a: File[]) => File[])(s.attachments) : updater,
      }))
    },
    [],
  )

  const setActiveFile = useCallback((name: string | null) => {
    setState((s) => ({ ...s, activeFile: name }))
  }, [])

  const setInspectorTab = useCallback((t: InspectorTab) => {
    setState((s) => ({ ...s, inspectorTab: t }))
  }, [])

  const setDevice = useCallback((d: BuilderState["device"]) => {
    setState((s) => ({ ...s, device: d }))
  }, [])

  const reset = useCallback(() => {
    cancelledRef.current = true
    setState({ ...INITIAL_STATE })
  }, [])

  const updateProgress = useCallback(
    (phase: BuilderPhase, done: number, total: number) => {
      setState((s) => ({ ...s, progress: { ...s.progress, [phase]: { done, total } } }))
    },
    [],
  )

  const handleSubmit = useCallback(async () => {
    const promptText = state.prompt.trim()
    if (!promptText) return
    cancelledRef.current = false

    const userMsg: Omit<ChatMessage, "id"> = {
      role: "user",
      content: promptText,
      attachments: state.attachments.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    }
    setState((s) => ({
      ...s,
      messages: [...s.messages, { ...userMsg, id: uid() }],
      prompt: "",
      attachments: [],
      error: null,
      warnings: [],
      logs: [],
      files: [],
      manifest: null,
      brief: null,
      deploy: null,
      progress: {},
    }))
    pushMessage({
      role: "assistant",
      content: "Starting the 13-phase build pipeline. I'll plan the sitemap, derive a design genome, then generate, validate, build and deploy each page.",
    })

    try {
      // Phase 1 — Intake.
      setPhase("intake")
      log("intake", `Brief received (${promptText.length} chars, ${state.attachments.length} attachments).`)

      // Phase 2 — Planning. Server returns plan + manifest (which already
      // includes chrome / design / layoutSignature thanks to the architect's
      // enrichManifestDesign call).
      setPhase("planning")
      const archRes = await fetch("/api/ai/architect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText, model: selectedModel }),
      })
      if (!archRes.ok) throw new Error(`Architect failed (${archRes.status})`)
      const archJson = (await archRes.json()) as { plan: PlanEntry[]; manifest: ProjectManifest }
      if (cancelledRef.current) return
      log("planning", `Plan returned with ${archJson.plan.length} pages.`)

      // Phase 3 — Designing. The architect already produced chrome + design
      // genome; we simply confirm and surface them to the user.
      setPhase("designing")
      setState((s) => ({ ...s, brief: archJson.plan, manifest: archJson.manifest }))
      if (archJson.manifest.chrome) {
        log(
          "designing",
          `Chrome: ${archJson.manifest.chrome.brandName} · nav=${archJson.manifest.chrome.navVariant} · footer=${archJson.manifest.chrome.footerVariant}`,
        )
      }
      if (archJson.manifest.design) {
        log(
          "designing",
          `Design genome: ${archJson.manifest.design.visualStyle} · ${archJson.manifest.design.sectionRhythm} · cards=${archJson.manifest.design.cardTreatment}`,
        )
      }

      // Phase 4 — Scaffolding. The orchestrator emits scaffold files later;
      // for the user-visible pipeline we just signal that the manifest is the
      // scaffold contract.
      setPhase("scaffolding")
      log("scaffolding", `Scaffold contract: ${archJson.manifest.pages.length} routes, ${archJson.manifest.router.routes.length} router entries.`)

      // Phase 5 — Styling JSON (per page).
      setPhase("styling")
      const styleResults: Array<{ page: PlanEntry; tree: unknown }> = []
      for (let i = 0; i < archJson.plan.length; i++) {
        if (cancelledRef.current) return
        const page = archJson.plan[i]
        updateProgress("styling", i, archJson.plan.length)
        log("styling", `Generating JSON for ${page.path} (${page.title})…`)
        const res = await fetch("/api/ai/generate-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page,
            prompt: promptText,
            model: selectedModel,
            sitemap: archJson.plan,
            manifest: archJson.manifest,
          }),
        })
        if (!res.ok) throw new Error(`Style failed for ${page.path} (${res.status})`)
        const data = await res.json() as { tree: unknown; fallback?: boolean }
        if (data.fallback) {
          log("styling", `Fallback tree used for ${page.path}.`, "warn")
          setState((s) => ({ ...s, warnings: [...s.warnings, `[${page.title}] AI returned no JSON — used layout-aware fallback.`] }))
        }
        styleResults.push({ page, tree: data.tree })
      }
      updateProgress("styling", archJson.plan.length, archJson.plan.length)

      // Phase 6 — Validate JSON. Lightweight client-side check for the
      // converter envelope; the converter already handles most issues.
      setPhase("validating-json")
      let valid = 0
      for (const r of styleResults) {
        const t = r.tree as { type?: string; component?: unknown } | null
        if (t && t.type === "ui-tree" && t.component && typeof t.component === "object") {
          valid++
        } else {
          log("validating-json", `Tree for ${r.page.path} is malformed; converter will recover.`, "warn")
        }
      }
      log("validating-json", `${valid}/${styleResults.length} trees pass envelope check.`)

      // Phase 7 — Logic (per page).
      setPhase("logic")
      const logicResults: Record<string, string | null> = {}
      for (let i = 0; i < styleResults.length; i++) {
        if (cancelledRef.current) return
        const { page, tree } = styleResults[i]
        updateProgress("logic", i, styleResults.length)
        log("logic", `Generating handlers for ${page.path}…`)
        const res = await fetch("/api/ai/generate-logic", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            page,
            tree,
            prompt: promptText,
            model: selectedModel,
            manifest: archJson.manifest,
          }),
        })
        if (res.ok) {
          const data = await res.json() as { logicCode?: string | null }
          logicResults[page.path] = data.logicCode ?? null
        } else {
          log("logic", `Logic stage failed for ${page.path}; orchestrator will emit stubs.`, "warn")
          logicResults[page.path] = null
        }
      }
      updateProgress("logic", styleResults.length, styleResults.length)

      // Phase 8 — Converter (server-side, deterministic).
      setPhase("converting")
      log("converting", "Running JSON → TSX converter…")
      const orchPayload = {
        jsonPlan: styleResults.map((r) => ({
          path: r.page.path,
          title: r.page.title,
          description: r.page.description,
          tree: r.tree,
          logicCode: logicResults[r.page.path] ?? null,
        })),
        manifest: archJson.manifest,
      }
      const orchRes = await fetch("/api/ai/orchestrator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orchPayload),
      })
      if (!orchRes.ok) throw new Error(`Orchestrator failed (${orchRes.status})`)
      const orchJson = await orchRes.json() as { files: GeneratedPage[]; warnings?: string[] }
      if (cancelledRef.current) return

      // Phase 9 — Assembling.
      setPhase("assembling")
      log("assembling", `Assembled ${orchJson.files.length} project files.`)
      if (orchJson.warnings && orchJson.warnings.length > 0) {
        for (const w of orchJson.warnings) log("converting", w, "warn")
        setState((s) => ({ ...s, warnings: [...s.warnings, ...(orchJson.warnings ?? [])] }))
      }
      setState((s) => ({ ...s, files: orchJson.files }))

      // Phase 10 — Build (delegated to the deploy endpoint, which builds + ships).
      setPhase("building")
      log("building", "Starting build + deploy…")

      // Persist files to the project's API so the existing dashboard preview
      // and the deploy endpoint can consume them. This mirrors the legacy
      // wiring (clear all + save each).
      try {
        await fetch(`/api/projects/${projectId}/pages?all=true`, { method: "DELETE" })
      } catch {
        // non-fatal
      }
      for (const f of orchJson.files) {
        try {
          await fetch(`/api/projects/${projectId}/pages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: f.name, code: f.code }),
          })
        } catch {
          // non-fatal — orchestrator already returned the files for the UI.
        }
      }

      // Phase 12 — Deploying.
      setPhase("deploying")
      const deployRes = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })
      const deployJson = (await deployRes.json().catch(() => ({}))) as DeployResult & {
        success?: boolean
        error?: string
      }
      if (!deployRes.ok || deployJson.success === false) {
        // Phase 11 — Auto-fix could be triggered here; for now we surface the
        // error and let the existing AutoFixModal flow on the parent page run.
        throw new Error(deployJson.error || `Deploy failed (${deployRes.status})`)
      }
      setState((s) => ({ ...s, deploy: { url: deployJson.url, githubUrl: deployJson.githubUrl, repoId: deployJson.repoId } }))
      log("deploying", `Deployed to ${deployJson.url ?? "(unknown URL)"}.`)

      // Phase 13 — Done.
      setPhase("done")
      pushMessage({
        role: "assistant",
        content: deployJson.url
          ? `All set — your site is live at ${deployJson.url}.`
          : "Build pipeline finished and deployed successfully.",
      })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      log("system", message, "error")
      setState((s) => ({ ...s, error: message }))
      pushMessage({ role: "assistant", content: message, isError: true })
    }
  }, [
    log,
    projectId,
    pushMessage,
    selectedModel,
    setPhase,
    state.attachments,
    state.prompt,
    updateProgress,
  ])

  const busy = useMemo(() => state.phase !== "idle" && state.phase !== "done", [state.phase])

  return (
    <div className="flex h-full w-full flex-col bg-background text-foreground">
      <BuilderTopBar state={state} onReset={reset} />
      <div className="flex flex-1 min-h-0 divide-x divide-border">
        <aside className="hidden md:flex w-[360px] shrink-0 flex-col">
          <BuilderChatPanel
            state={state}
            setPrompt={setPrompt}
            setAttachments={setAttachments}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            onSubmit={handleSubmit}
            busy={busy}
            credits={credits}
            bestCost={bestCost}
            fastCost={fastCost}
            userName={userName}
          />
        </aside>
        <section className="flex-1 min-w-0">
          <PreviewCanvas state={state} setDevice={setDevice} />
        </section>
        <aside className="hidden xl:flex w-[340px] shrink-0 flex-col">
          <BuilderInspector
            state={state}
            setActiveFile={setActiveFile}
            setInspectorTab={setInspectorTab}
          />
        </aside>
      </div>
      {/* On narrow viewports show a stacked chat at the bottom so the page is
          still usable without the desktop 3-panel layout. */}
      <div className="md:hidden border-t border-border bg-card/60 backdrop-blur">
        <BuilderChatPanel
          state={state}
          setPrompt={setPrompt}
          setAttachments={setAttachments}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          onSubmit={handleSubmit}
          busy={busy}
          credits={credits}
          bestCost={bestCost}
          fastCost={fastCost}
          userName={userName}
        />
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
