"use client"

import { useState, useRef, useEffect, useCallback } from "react"
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
} from "lucide-react"
import { cn } from "@/lib/utils"

type DeviceMode = "desktop" | "mobile"

export interface SitePreviewDashboardProps {
  fallbackHtml?: string;
  /** The deployed URL to preview (full https:// or bare domain) */
  url: string
  /** Display name of the site */
  siteName?: string
  /** Whether the site is flagged as live */
  isLive?: boolean
  /** Called when user explicitly closes / navigates away */
  onClose?: () => void
  /** Optional class names for the root wrapper */
  className?: string
}

export function SitePreviewDashboard({
  url,
  siteName,
  isLive = true,
  onClose,
  className,
  fallbackHtml,
}: SitePreviewDashboardProps) {
  const [deviceMode, setDeviceMode] = useState<DeviceMode>("desktop")
  const [frameLoading, setFrameLoading] = useState(true)
  const [frameError, setFrameError] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const [iframeScale, setIframeScale] = useState(1)
  const viewportRef = useRef<HTMLDivElement>(null)

  const fullUrl = url.startsWith("http") ? url : `https://${url}`
  const displayUrl = url.replace(/^https?:\/\//, "")
  const label = siteName || displayUrl

  // Mobile phone frame dimensions (CSS pixels at 1x)
  const PHONE_W = 390
  const PHONE_H = 844

  // Desktop: scale iframe to viewport; mobile: scale phone frame to viewport
  const updateScale = useCallback(() => {
    if (!viewportRef.current) return
    if (deviceMode === "mobile") {
      const availH = viewportRef.current.offsetHeight - 48 // leave breathing room
      const availW = viewportRef.current.offsetWidth - 32
      const scaleH = availH / (PHONE_H + 48) // +48 for phone chrome
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
        className="flex items-center gap-2 px-4 py-2.5 shrink-0"
        style={{ borderBottom: "1px solid #2e2e30" }}
      >
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
          {/* Live dot */}
          {isLive && (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
            </span>
          )}
          <span className="flex-1 text-[12px] text-zinc-400 truncate font-mono">
            {displayUrl}
          </span>
          {/* Copy URL */}
          <button
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

        {/* Refresh */}
        <button
          onClick={handleRefresh}
          aria-label="Refresh preview"
          className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors shrink-0"
          style={{ background: "#252527" }}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", frameLoading && "animate-spin")} />
        </button>

        {/* Open in new tab */}
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

      {/* ── Live banner (shown only when site is live) ── */}
      {isLive && (
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
      )}

      {/* ── Preview viewport ── */}
      <div
        ref={viewportRef}
        className="flex-1 min-h-0 flex items-start justify-center overflow-hidden"
        style={{ background: "#111113", paddingTop: deviceMode === "mobile" ? "24px" : "0" }}
      >
        {deviceMode === "desktop" ? (
          /* ── DESKTOP: full-bleed iframe ── */
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
                src={fullUrl || undefined}
                srcDoc={!fullUrl && fallbackHtml ? fallbackHtml : undefined}
                title={`Preview of ${displayUrl}`}
                className="w-full h-full border-0 block"
                onLoad={() => setFrameLoading(false)}
                onError={() => {
                  setFrameError(true)
                  setFrameLoading(false)
                }}
                sandbox="allow-scripts"
              />
            )}
          </div>
        ) : (
          /* ── MOBILE: phone chrome frame ── */
          <div
            style={{
              transform: `scale(${iframeScale})`,
              transformOrigin: "top center",
              flexShrink: 0,
            }}
          >
            {/* Phone outer shell */}
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
              {/* Status bar notch */}
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

              {/* iframe content */}
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
                    src={fullUrl || undefined}
                    srcDoc={!fullUrl && fallbackHtml ? fallbackHtml : undefined}
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
                    sandbox="allow-scripts"
                  />
                )}
              </div>

              {/* Home bar */}
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
