"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import {
  Loader2,
  Globe,
  Edit2,
  Package,
  Sparkles,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface WebsitePreviewCardProps {
  fallbackHtml?: string;
  domain: string
  isLive: boolean
  deploymentId?: string
  projectId?: string
  businessName?: string
  createdAt?: string
  onDelete?: (id: string) => void
  style?: string
}

export function WebsitePreviewCard({
  fallbackHtml,
  domain,
  isLive,
  deploymentId,
  projectId,
  businessName = "Website",
  createdAt = new Date().toISOString(),
  onDelete,
  style = "default",
}: WebsitePreviewCardProps) {
  const [frameLoading, setFrameLoading] = useState(true)
  const [frameError, setFrameError] = useState(false)
  const [iframeScale, setIframeScale] = useState(0.26)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const fullUrl = domain.startsWith("http") ? domain : `https://${domain}`
  const displayDomain = domain.replace(/^https?:\/\//, "")
  const formattedDate = new Date(createdAt).toLocaleDateString("hu-HU")
  const IconComp = style === "browse" ? Sparkles : style === "ai" ? Zap : Package

  // Compute iframe scale from actual card width so preview fills the card
  // exactly on every screen size without hardcoded breakpoints.
  const updateScale = useCallback(() => {
    if (wrapperRef.current) {
      setIframeScale(wrapperRef.current.offsetWidth / 1440)
    }
  }, [])

  useEffect(() => {
    updateScale()
    const ro = new ResizeObserver(updateScale)
    if (wrapperRef.current) ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [updateScale])

  /* ── NOT LIVE ─────────────────────────────────────────────── */
  if (!isLive) {
    return (
      <div
        className="flex flex-col rounded-2xl overflow-hidden"
        style={{ background: "#1c1c1e" }}
      >
        {/* Placeholder preview */}
        <div
          className="w-full flex flex-col items-center justify-center gap-3 relative overflow-hidden"
          style={{ aspectRatio: "4/3", background: "#252527" }}
        >
          {fallbackHtml ? (
              <iframe
                srcDoc={fallbackHtml}
                title={`Preview of ${displayDomain}`}
                className="absolute inset-0 w-full h-full border-0 block pointer-events-none select-none"
                style={{
                  width: "1440px",
                  height: "1080px",
                  transformOrigin: "top left",
                  transform: `scale(${iframeScale})`,
                }}
                sandbox="allow-scripts"
                tabIndex={-1}
              />
          ) : (
            <>
              <div className="relative">
                <div className="absolute inset-0 rounded-full bg-white/10 blur-xl opacity-20 animate-pulse" />
                <div
                  className="relative h-12 w-12 rounded-full flex items-center justify-center"
                  style={{ background: "#2e2e30", border: "1px solid rgba(255,255,255,0.07)" }}
                >
                  <Loader2 className="h-5 w-5 text-zinc-400 animate-spin" />
                </div>
              </div>
              <p className="text-sm font-semibold text-zinc-200">Building Project</p>
              <p className="text-xs text-zinc-500">Waiting for deployment…</p>
            </>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderTop: "1px solid #2e2e30" }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: "#2e2e30" }}
          >
            <IconComp className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-zinc-100 truncate">{businessName}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Created {formattedDate}</p>
          </div>
          <Link href={`/dashboard/sites/${projectId}`}>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 shrink-0 text-xs px-3 rounded-full text-zinc-400 hover:text-white"
              style={{ background: "#2e2e30" }}
            >
              <Edit2 className="h-3 w-3 mr-1.5" />
              Edit
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  /* ── LIVE ─────────────────────────────────────────────────── */
  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden"
      style={{ background: "#1c1c1e" }}
    >
      {/* ── Live iframe preview region ── */}
      <div
        ref={wrapperRef}
        className="relative w-full overflow-hidden"
        style={{ aspectRatio: "4/3", background: "#252527" }}
      >
        {/* Loading spinner */}
        {frameLoading && !frameError && (
          <div
            className="absolute inset-0 flex items-center justify-center z-10"
            style={{ background: "#252527" }}
          >
            <Loader2 className="h-6 w-6 text-zinc-500 animate-spin" />
          </div>
        )}

        {frameError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Globe className="h-8 w-8 text-zinc-700" />
            <p className="text-xs text-zinc-500">Preview unavailable</p>
          </div>
        ) : (
          /* iframe scaled to fill the card exactly */
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            <iframe
              src={fullUrl}
              title={`Preview of ${displayDomain}`}
              className="border-0 block"
              style={{
                width: "1440px",
                height: "1080px",
                transformOrigin: "top left",
                transform: `scale(${iframeScale})`,
              }}
              onLoad={() => setFrameLoading(false)}
              onError={() => {
                setFrameError(true)
                setFrameLoading(false)
              }}
              sandbox="allow-same-origin allow-scripts allow-forms"
              tabIndex={-1}
            />
          </div>
        )}

        {/* Vignette so banner reads clearly */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(to bottom, transparent 45%, rgba(28,28,30,0.65) 100%)",
          }}
        />

        {/* ── "Your site is now live!" banner ── */}
        <div
          aria-label="Your site is now live"
          className="absolute bottom-0 left-0"
          style={{ zIndex: 10 }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "10px 16px",
              borderTopRightRadius: "18px",
              background: "#22a846",
            }}
          >
            <CheckCircle2
              aria-hidden="true"
              style={{
                width: "13px",
                height: "13px",
                color: "rgba(255,255,255,0.85)",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "12.5px",
                fontWeight: 700,
                color: "#ffffff",
                lineHeight: 1.2,
                whiteSpace: "nowrap",
              }}
            >
              Your site is now live!
            </span>
          </div>
        </div>
      </div>

      {/* ── Domain row ── */}
      <div
        className="flex items-center gap-2.5 px-4 py-3"
        style={{ borderTop: "1px solid #2e2e30" }}
      >
        {/* Site icon */}
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "#2e2e30" }}
        >
          <IconComp className="h-4 w-4 text-zinc-400" />
        </div>

        {/* Domain */}
        <span className="flex-1 text-[13px] font-semibold text-zinc-100 truncate min-w-0">
          {displayDomain}
        </span>

        {/* Settings pill (Primary Action) */}
        <Link href={`/dashboard/sites/${projectId}`} className="shrink-0">
          <div
            className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold text-white transition-opacity hover:opacity-85 active:opacity-70 cursor-pointer"
            style={{ background: "#2e2e30" }}
          >
            <Edit2 className="h-3 w-3" aria-hidden="true" />
            Settings
          </div>
        </Link>
      </div>

      {/* ── Footer: name + live badge ── */}
      <div className="flex items-center justify-between px-4 pb-4 pt-0">
        <p className="text-[11px] text-zinc-600">
          {businessName} · {formattedDate}
        </p>
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full"
          style={{ background: "#2e2e30" }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
            Live
          </span>
        </div>
      </div>
    </div>
  )
}
