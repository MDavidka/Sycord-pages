"use client"

import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import {
  Globe,
  ExternalLink,
  Monitor,
  Smartphone,
  Loader2,
  CheckCircle2,
  RefreshCw,
  Copy,
  Check,
  Info,
  ArrowLeft,
  Rocket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { isSytePreviewUrl } from "@/glovix/lib/previewEmbed"

type DeviceMode = "desktop" | "mobile"

export interface SitePreviewDashboardProps {
  fallbackHtml?: string
  /** The deployed or Syte preview URL (full https:// or bare domain) */
  url: string
  /** Display name of the site */
  siteName?: string
  /** Whether the site is flagged as live */
  isLive?: boolean
  /** Called when user explicitly closes / navigates away */
  onClose?: () => void
  /** Open Syra / publish flow from the private-preview notice */
  onPublish?: () => void
  /** Optional class names for the root wrapper */
  className?: string
  /** Controlled device mode (optional) */
  deviceMode?: DeviceMode
  onDeviceModeChange?: (mode: DeviceMode) => void
}

/** Same-origin proxy for Syte / Sycord hosts so the iframe is not blanked by XFO. */
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

export function SitePreviewDashboard({
  url,
  siteName,
  isLive = true,
  onClose,
  onPublish,
  className,
  fallbackHtml,
  deviceMode: controlledMode,
  onDeviceModeChange,
}: SitePreviewDashboardProps) {
  const [internalMode, setInternalMode] = useState<DeviceMode>("desktop")
  const deviceMode = controlledMode ?? internalMode
  const setDeviceMode = (mode: DeviceMode) => {
    onDeviceModeChange?.(mode)
    if (controlledMode === undefined) setInternalMode(mode)
  }

  const [frameLoading, setFrameLoading] = useState(true)
  const [frameError, setFrameError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const [iframeScale, setIframeScale] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)

  const fullUrl = url.startsWith("http") ? url : `https://${url}`
  const displayUrl = url.replace(/^https?:\/\//, "")
  const label = siteName || displayUrl
  const isPrivatePreview = isSytePreviewUrl(fullUrl)
  const frameSrc = useMemo(() => resolveFrameSrc(url), [url])

  // Mobile phone frame dimensions (CSS pixels at 1x)
  const PHONE_W = 390
  const PHONE_H = 844

  const updateScale = useCallback(() => {
    if (!viewportRef.current) return
    if (deviceMode === "mobile") {
      const availH = viewportRef.current.offsetHeight - 48
      const availW = viewportRef.current.offsetWidth - 32
      const scaleH = availH / (PHONE_H + 48)
      const scaleW = availW / (PHONE_W + 24)
      setIframeScale(Math.min(scaleH, scaleW, 1))
    } else {
      setIframeScale(1)
    }
  }, [deviceMode])

  useEffect(() => {
    updateScale()
    const ro = new ResizeObserver(updateScale)
    if (viewportRef.current) ro.observe(viewportRef.current)
    return () => ro.disconnect()
  }, [updateScale])

  // Reset loading state when the URL changes so the warm shell feels instant.
  useEffect(() => {
    setFrameLoading(true)
    setFrameError(false)
  }, [frameSrc])

  const handleRefresh = () => {
    setFrameLoading(true)
    setFrameError(false)
    setRefreshKey((k) => k + 1)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(fullUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div
      className={cn("flex flex-col w-full h-full min-h-0", className)}
      style={{ background: "#1a1a1c" }}
    >
      {/* ── Top toolbar ── */}
      <div
        className="flex items-center gap-2 px-3 sm:px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid #2e2e30" }}
      >
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Back to edit page"
            className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
            style={{ background: "#252527" }}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
          </button>
        )}

        {/* Device mode toggle */}
        <div
          className="flex items-center rounded-lg p-0.5 shrink-0"
          style={{ background: "#252527" }}
        >
          {(["desktop", "mobile"] as DeviceMode[]).map((mode) => {
            const Icon = mode === "desktop" ? Monitor : Smartphone
            return (
              <button
                key={mode}
                type="button"
                onClick={() => setDeviceMode(mode)}
                aria-label={`${mode} preview`}
                className={cn(
                  "flex items-center justify-center w-8 h-7 rounded-md transition-colors",
                  deviceMode === mode
                    ? "text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                )}
                style={
                  deviceMode === mode
                    ? { background: "#3a3a3c" }
                    : {}
                }
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )
          })}
        </div>

        {/* URL bar */}
        <div
          className="flex items-center gap-2 flex-1 min-w-0 h-8 px-3 rounded-lg"
          style={{ background: "#252527" }}
        >
          {(isLive || isPrivatePreview) && (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span
                className={cn(
                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                  isPrivatePreview ? "bg-amber-400" : "bg-green-400"
                )}
              />
              <span
                className={cn(
                  "relative inline-flex rounded-full h-1.5 w-1.5",
                  isPrivatePreview ? "bg-amber-500" : "bg-green-500"
                )}
              />
            </span>
          )}
          <span className="flex-1 text-[12px] text-zinc-400 truncate font-mono">
            {displayUrl}
          </span>
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy URL"
            className="shrink-0 text-zinc-600 hover:text-zinc-300 transition-colors"
          >
            {copied ? (
              <Check className="h-3 w-3 text-green-400" />
            ) : (
              <Copy className="h-3 w-3" />
            )}
          </button>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          aria-label="Refresh preview"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
          style={{ background: "#252527" }}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", frameLoading && "animate-spin")} />
        </button>

        {/* External open stays as an escape hatch — primary path is in-page. */}
        <a
          href={fullUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open in new tab"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
          style={{ background: "#252527" }}
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* ── Status banner ── */}
      {isPrivatePreview ? (
        <div
          className="flex items-center gap-2.5 px-4 py-2 shrink-0"
          style={{ background: "rgba(245,158,11,0.10)", borderBottom: "1px solid rgba(245,158,11,0.18)" }}
        >
          <Info className="h-3.5 w-3.5 shrink-0 text-amber-400" aria-hidden="true" />
          <span className="text-[12px] text-zinc-300 min-w-0 flex-1">
            Preview is a version <span className="font-semibold text-zinc-100">only you see</span>
            {onPublish ? " — publish to share it with your community." : "."}
          </span>
          {onPublish && (
            <button
              type="button"
              onClick={onPublish}
              className="shrink-0 inline-flex items-center gap-1.5 h-7 px-3 rounded-full text-[11px] font-semibold text-[#18191B] transition-transform active:scale-[0.97]"
              style={{ background: "#E8B84A" }}
            >
              <Rocket className="h-3 w-3" />
              Publish
            </button>
          )}
        </div>
      ) : isLive ? (
        <div
          className="flex items-center gap-2.5 px-4 py-2 shrink-0"
          style={{ background: "rgba(34,168,70,0.12)", borderBottom: "1px solid rgba(34,168,70,0.18)" }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: "#22a846" }} aria-hidden="true" />
          <span className="text-[12px] font-semibold" style={{ color: "#22a846" }}>
            Your site is now live!
          </span>
          <span className="text-[12px] text-zinc-500 truncate min-w-0">— {label}</span>
        </div>
      ) : null}

      {/* ── Preview viewport ── */}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 flex items-start justify-center overflow-hidden"
        style={{ background: "#111113", paddingTop: deviceMode === "mobile" ? "24px" : "0" }}
      >
        {deviceMode === "desktop" ? (
          <div className="relative w-full h-full">
            {frameLoading && !frameError && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
                style={{ background: "#111113" }}
              >
                <Loader2 className="h-7 w-7 text-zinc-600 animate-spin" />
                <p className="text-xs text-zinc-600">Loading preview…</p>
              </div>
            )}
            {frameError ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                <Globe className="h-10 w-10 text-zinc-700" />
                <p className="text-sm text-zinc-500">Could not load preview</p>
                <button
                  type="button"
                  onClick={handleRefresh}
                  className="mt-1 text-xs px-4 py-1.5 rounded-full text-zinc-300 hover:text-white transition-colors"
                  style={{ background: "#2e2e30" }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <iframe
                key={refreshKey}
                src={frameSrc || undefined}
                srcDoc={!url && fallbackHtml ? fallbackHtml : undefined}
                title={`Preview of ${displayUrl}`}
                className="w-full h-full border-0 block"
                onLoad={() => setFrameLoading(false)}
                onError={() => {
                  setFrameError(true)
                  setFrameLoading(false)
                }}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                allow="clipboard-read; clipboard-write"
              />
            )}
          </div>
        ) : (
          <div
            style={{
              transform: `scale(${iframeScale})`,
              transformOrigin: "top center",
              flexShrink: 0,
            }}
          >
            <div
              className="relative flex flex-col overflow-hidden"
              style={{
                width: `${PHONE_W}px`,
                height: `${PHONE_H}px`,
                borderRadius: "48px",
                background: "#1c1c1e",
                boxShadow: "0 0 0 10px #2a2a2c, 0 32px 80px rgba(0,0,0,0.8)",
                border: "1.5px solid #3a3a3c",
              }}
            >
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 z-20 flex items-center justify-center"
                style={{
                  width: "126px",
                  height: "34px",
                  background: "#1c1c1e",
                  borderBottomLeftRadius: "18px",
                  borderBottomRightRadius: "18px",
                }}
                aria-hidden="true"
              >
                <div
                  className="rounded-full"
                  style={{ width: "12px", height: "12px", background: "#111113" }}
                />
              </div>

              <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: "46px" }}>
                {frameLoading && !frameError && (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10"
                    style={{ background: "#111113" }}
                  >
                    <Loader2 className="h-7 w-7 text-zinc-600 animate-spin" />
                    <p className="text-xs text-zinc-600">Loading preview…</p>
                  </div>
                )}
                {frameError ? (
                  <div
                    className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                    style={{ background: "#111113" }}
                  >
                    <Globe className="h-10 w-10 text-zinc-700" />
                    <p className="text-sm text-zinc-500">Could not load preview</p>
                    <button
                      type="button"
                      onClick={handleRefresh}
                      className="mt-1 text-xs px-4 py-1.5 rounded-full text-zinc-300 hover:text-white transition-colors"
                      style={{ background: "#2e2e30" }}
                    >
                      Try again
                    </button>
                  </div>
                ) : (
                  <iframe
                    key={refreshKey}
                    src={frameSrc || undefined}
                    srcDoc={!url && fallbackHtml ? fallbackHtml : undefined}
                    title={`Mobile preview of ${displayUrl}`}
                    className="border-0 block"
                    style={{
                      width: `${PHONE_W}px`,
                      height: `${PHONE_H}px`,
                    }}
                    onLoad={() => setFrameLoading(false)}
                    onError={() => {
                      setFrameError(true)
                      setFrameLoading(false)
                    }}
                    sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                    allow="clipboard-read; clipboard-write"
                  />
                )}
              </div>

              <div
                className="absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full z-20"
                style={{ width: "134px", height: "5px", background: "rgba(255,255,255,0.18)" }}
                aria-hidden="true"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
