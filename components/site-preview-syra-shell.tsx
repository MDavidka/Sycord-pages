"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  AudioLines,
  ChevronDown,
  Globe,
  Info,
  Loader2,
  Mic,
  Rocket,
  Slash,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isSytePreviewUrl } from "@/glovix/lib/previewEmbed"
import { MODEL_CHOICES, type ModelChoice } from "@/glovix/lib/ai"

export const SYRA_PENDING_PROMPT_KEY = "syra_pending_prompt"

type StageKind = "preview" | "production"

type Stage = {
  id: StageKind
  label: string
  url: string | null
  ready: boolean
}

function resolveFrameSrc(url: string): string {
  const fullUrl = url.startsWith("http") ? url : `https://${url}`
  try {
    const host = new URL(fullUrl).hostname.toLowerCase()
    const isSycord =
      host.endsWith(".sycord.site") ||
      host.endsWith(".sycord.com") ||
      host === "sycord.site" ||
      host === "sycord.com"
    if (isSycord || isSytePreviewUrl(fullUrl)) {
      return `/api/workspace/preview-frame?url=${encodeURIComponent(fullUrl)}`
    }
  } catch {
    /* fall through */
  }
  return fullUrl
}

function displayHost(url: string | null): string {
  if (!url) return "Not ready"
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname
  } catch {
    return url.replace(/^https?:\/\//, "")
  }
}

export interface SitePreviewSyraShellProps {
  projectId: string
  siteName?: string
  /** Public / production URL (cloudflare / syte live) */
  productionUrl?: string | null
  /** Optional known Syte HMR preview URL */
  sytePreviewUrl?: string | null
  className?: string
  /** Open Syra (optionally with a pending prompt already stored) */
  onOpenSyra: (prompt?: string) => void
  onPublish?: () => void
}

/**
 * Preview tab shell matching the Syra edit mockup:
 * sitemap carousel (preview → production) + private notice + Syra composer.
 * If production is not deployed yet, preview is the active card.
 */
export function SitePreviewSyraShell({
  projectId,
  siteName,
  productionUrl,
  sytePreviewUrl: initialSytePreview,
  className,
  onOpenSyra,
  onPublish,
}: SitePreviewSyraShellProps) {
  const [sytePreviewUrl, setSytePreviewUrl] = useState<string | null>(initialSytePreview ?? null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [input, setInput] = useState("")
  const [modelChoice, setModelChoice] = useState<ModelChoice>(MODEL_CHOICES[1] ?? MODEL_CHOICES[0])
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [frameLoading, setFrameLoading] = useState(true)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const production = (productionUrl || "").trim() || null

  // Prefer live Syte HMR preview; fall back to production so the carousel always has something.
  const preview = (sytePreviewUrl || "").trim() || null

  const stages: Stage[] = useMemo(() => {
    return [
      {
        id: "preview",
        label: "Preview",
        url: preview,
        ready: Boolean(preview),
      },
      {
        id: "production",
        label: "Production",
        url: production,
        ready: Boolean(production),
      },
    ]
  }, [preview, production])

  // Default selection: preview when available (or when not deployed); production only when preview missing.
  useEffect(() => {
    if (preview) setActiveIndex(0)
    else if (production) setActiveIndex(1)
    else setActiveIndex(0)
  }, [preview, production])

  // Resolve / refresh Syte preview URL for this project (private sitemap node).
  useEffect(() => {
    if (!projectId) return
    let cancelled = false
    setPreviewLoading(true)

    const load = async () => {
      try {
        const statusRes = await fetch(`/api/workspace/preview?projectId=${encodeURIComponent(projectId)}`)
        const statusData = await statusRes.json().catch(() => ({} as any))
        if (!cancelled && statusRes.ok && statusData?.previewUrl) {
          setSytePreviewUrl(statusData.previewUrl)
          setPreviewLoading(false)
          return
        }

        // Start a warm preview when the workspace exists but preview is idle.
        const startRes = await fetch("/api/workspace/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, syncFiles: true, issueDomain: false }),
        })
        const startData = await startRes.json().catch(() => ({} as any))
        if (!cancelled && startData?.previewUrl) {
          setSytePreviewUrl(startData.previewUrl)
        }
      } catch {
        /* non-fatal — production card may still work */
      } finally {
        if (!cancelled) setPreviewLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [projectId])

  const activeStage = stages[activeIndex] ?? stages[0]
  const activeUrl = activeStage?.url ?? null
  const frameSrc = activeUrl ? resolveFrameSrc(activeUrl) : null
  const showingPrivatePreview = Boolean(activeUrl && isSytePreviewUrl(activeUrl))
  const notDeployedYet = !production

  useEffect(() => {
    setFrameLoading(true)
  }, [frameSrc])

  const scrollToIndex = useCallback((index: number) => {
    setActiveIndex(index)
    const el = scrollerRef.current
    if (!el) return
    const card = el.children[index] as HTMLElement | undefined
    card?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [])

  const handleScrollerScroll = () => {
    const el = scrollerRef.current
    if (!el) return
    const mid = el.scrollLeft + el.clientWidth / 2
    let best = 0
    let bestDist = Infinity
    Array.from(el.children).forEach((child, i) => {
      const node = child as HTMLElement
      const center = node.offsetLeft + node.offsetWidth / 2
      const dist = Math.abs(center - mid)
      if (dist < bestDist) {
        bestDist = dist
        best = i
      }
    })
    if (best !== activeIndex) setActiveIndex(best)
  }

  const submitToSyra = (prompt?: string) => {
    const text = (prompt ?? input).trim()
    if (text) {
      try {
        sessionStorage.setItem(SYRA_PENDING_PROMPT_KEY, text)
      } catch {
        /* ignore */
      }
    }
    try {
      sessionStorage.setItem("syra_pending_model", modelChoice.modelType)
    } catch {
      /* ignore */
    }
    onOpenSyra(text || undefined)
  }

  const handlePublish = () => {
    onPublish?.()
    onOpenSyra()
  }

  // Progress dashes: preview always step 0; production step 1 when ready.
  const progressFilled = production ? 2 : preview || previewLoading ? 1 : 0

  return (
    <div
      className={cn("flex h-full min-h-0 w-full flex-col", className)}
      style={{ background: "#121214" }}
    >
      {/* ── Sitemap carousel: Preview → Production ── */}
      <div className="relative shrink-0 pt-5 pb-2">
        <div
          ref={scrollerRef}
          onScroll={handleScrollerScroll}
          className="flex gap-4 overflow-x-auto px-5 pb-3 snap-x snap-mandatory scrollbar-hide"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {stages.map((stage, index) => {
            const selected = index === activeIndex
            const urlLabel = stage.url
              ? (stage.url.startsWith("http") ? stage.url : `https://${stage.url}`)
              : stage.id === "preview"
                ? previewLoading
                  ? "Starting preview…"
                  : "Preview not ready"
                : "Not deployed yet"

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => scrollToIndex(index)}
                className={cn(
                  "relative snap-center shrink-0 overflow-hidden rounded-[22px] text-left transition-all",
                  "w-[min(88vw,420px)] aspect-[16/10]",
                  selected
                    ? "ring-1 ring-white/35 shadow-[0_18px_50px_rgba(0,0,0,0.45)]"
                    : "ring-1 ring-white/10 opacity-80"
                )}
                style={{ background: "#1c1c1e" }}
                aria-pressed={selected}
                aria-label={`${stage.label} ${displayHost(stage.url)}`}
              >
                {stage.url ? (
                  <iframe
                    key={stage.url}
                    src={resolveFrameSrc(stage.url)}
                    title={`${stage.label} preview`}
                    className="pointer-events-none absolute inset-0 h-[200%] w-[200%] origin-top-left border-0 bg-white"
                    style={{ transform: "scale(0.5)" }}
                    sandbox="allow-scripts allow-same-origin allow-forms"
                    tabIndex={-1}
                    onLoad={() => selected && setFrameLoading(false)}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
                    {stage.id === "preview" && previewLoading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
                    ) : (
                      <Globe className="h-7 w-7 text-zinc-600" />
                    )}
                    <p className="text-sm font-medium text-zinc-400">
                      {stage.id === "preview"
                        ? previewLoading
                          ? "Booting preview…"
                          : "No private preview yet"
                        : "Production not deployed"}
                    </p>
                    <p className="text-[11px] text-zinc-600 max-w-[220px]">
                      {stage.id === "preview"
                        ? "Build with Syra — your private preview appears here."
                        : "Publish when you are ready to go live."}
                    </p>
                  </div>
                )}

                {/* Soft vignette + URL chip */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to top, rgba(18,18,20,0.92) 0%, rgba(18,18,20,0.15) 42%, transparent 70%)",
                  }}
                />
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      {stage.label}
                    </p>
                    <p className="truncate text-[12px] font-medium text-white/90">
                      {urlLabel}
                    </p>
                  </div>
                  {stage.id === "production" && stage.ready && (
                    <span className="shrink-0 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">
                      Live
                    </span>
                  )}
                  {stage.id === "preview" && stage.ready && (
                    <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
                      Private
                    </span>
                  )}
                </div>

                {selected && stage.url && frameLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-[#121214]/50">
                    <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Progress dashes — sitemap toward production */}
        <div className="mt-1 flex items-center justify-center gap-1.5 px-6">
          {Array.from({ length: 6 }).map((_, i) => {
            // First three dashes = preview path; last three = production
            const active =
              (i < 3 && progressFilled >= 1) ||
              (i >= 3 && progressFilled >= 2)
            return (
              <span
                key={i}
                className={cn(
                  "h-[3px] w-5 rounded-full transition-colors",
                  active ? "bg-[#E8B84A]" : "bg-white/15"
                )}
              />
            )
          })}
        </div>
      </div>

      {/* ── Notice + publish ── */}
      <div className="flex flex-col items-center gap-3 px-6 py-4 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => scrollToIndex(0)}
            className={cn(
              "h-8 rounded-lg px-3 text-[12px] font-semibold transition-colors",
              activeIndex === 0
                ? "text-[#18191B]"
                : "text-zinc-400 hover:text-zinc-200"
            )}
            style={
              activeIndex === 0
                ? { background: "#E8B84A" }
                : { background: "#2a2a2c" }
            }
          >
            Preview
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(1)}
            disabled={!production}
            className={cn(
              "h-8 rounded-lg px-3 text-[12px] font-semibold transition-colors",
              activeIndex === 1
                ? "text-[#18191B]"
                : "text-zinc-400 hover:text-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed"
            )}
            style={
              activeIndex === 1
                ? { background: "#E8B84A" }
                : { background: "#2a2a2c" }
            }
          >
            Production
          </button>
        </div>

        <p className="flex items-start gap-2 max-w-md text-center text-[13px] leading-relaxed text-zinc-400">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" aria-hidden />
          <span>
            {showingPrivatePreview || notDeployedYet ? (
              <>
                Preview is a version{" "}
                <span className="font-semibold text-white">only you see</span>
                , to publish to your community click to publish
              </>
            ) : (
              <>
                Showing{" "}
                <span className="font-semibold text-white">
                  {siteName || "your live site"}
                </span>
                . Switch to Preview for the private draft.
              </>
            )}
          </span>
        </p>

        {(showingPrivatePreview || notDeployedYet) && (
          <button
            type="button"
            onClick={handlePublish}
            className="inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold text-[#18191B] transition-transform active:scale-[0.97]"
            style={{ background: "#E8B84A" }}
          >
            <Rocket className="h-3.5 w-3.5" />
            Publish
          </button>
        )}
      </div>

      {/* Spacer */}
      <div className="min-h-0 flex-1" />

      {/* ── Syra composer ── */}
      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submitToSyra()
          }}
          className="mx-auto w-full max-w-[760px]"
        >
          <div
            className="rounded-[28px] border px-2 pt-1.5 pb-2"
            style={{ background: "#1c1d1f", borderColor: "#2a2b2e" }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value)
                const target = e.target
                target.style.height = "auto"
                target.style.height = `${Math.min(target.scrollHeight, 120)}px`
              }}
              placeholder="Help you write code, debug and ship production-ready work."
              rows={2}
              className="w-full resize-none overflow-y-auto bg-transparent px-3 pb-2 pt-2.5 text-[16px] leading-relaxed text-[#e5e5e5] placeholder:text-[#6b6c6f] focus:outline-none max-h-[120px]"
              style={{ minHeight: "76px" }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  submitToSyra()
                }
              }}
            />

            <div className="flex items-center gap-2 px-1">
              <button
                type="button"
                aria-label="Attach"
                onClick={() => submitToSyra(input || "Open Syra")}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#3a3b3e] text-[#9a9b9e] transition-colors hover:bg-white/5 hover:text-white"
              >
                <Slash className="h-3.5 w-3.5" />
              </button>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowModelMenu((v) => !v)}
                  className="flex h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-medium text-[#c5c6c9] transition-colors hover:bg-white/5"
                >
                  {modelChoice.label}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </button>
                {showModelMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowModelMenu(false)} />
                    <div
                      className="absolute bottom-full left-0 z-20 mb-2 min-w-[200px] overflow-hidden rounded-xl border border-[#2a2b2e] shadow-xl"
                      style={{ background: "#1c1d1f" }}
                    >
                      <div className="p-1.5">
                        {MODEL_CHOICES.map((choice) => (
                          <button
                            key={choice.id}
                            type="button"
                            onClick={() => {
                              setModelChoice(choice)
                              setShowModelMenu(false)
                            }}
                            className={cn(
                              "flex w-full flex-col rounded-lg px-3 py-2 text-left",
                              choice.id === modelChoice.id
                                ? "bg-white/10"
                                : "hover:bg-[#26272a]"
                            )}
                          >
                            <span className="text-[13px] font-medium text-[#e5e5e5]">
                              {choice.label}
                            </span>
                            <span className="text-[11px] text-[#6b6c6f]">{choice.subtitle}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Voice input"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#9a9b9e] transition-colors hover:bg-white/5 hover:text-white"
                >
                  <Mic className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Voice mode"
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-[#9a9b9e] transition-colors hover:bg-white/5 hover:text-white"
                >
                  <AudioLines className="h-5 w-5" />
                </button>
                <button
                  type="submit"
                  disabled={!input.trim()}
                  aria-label="Send to Syra"
                  className={cn(
                    "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-all active:scale-95",
                    input.trim()
                      ? "bg-white text-black hover:bg-gray-200"
                      : "bg-white/15 text-white/30 cursor-not-allowed"
                  )}
                >
                  <ArrowUp className="h-5 w-5" strokeWidth={2.2} />
                </button>
              </div>
            </div>
          </div>

          {/* Pane dots — Preview tab ↔ Syra */}
          <div className="mt-3 flex items-center justify-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-white/80" />
            <span className="h-1.5 w-1.5 rounded-full bg-white/25" />
          </div>
        </form>
      </div>
    </div>
  )
}
