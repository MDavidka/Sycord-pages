"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Loader2, Globe, Edit2, Package, Sparkles, Zap, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"

interface WebsitePreviewCardProps {
  fallbackHtml?: string
  domain: string
  isLive: boolean
  deploymentId?: string
  projectId?: string
  businessName?: string
  createdAt?: string
  chatSession?: { title?: string; messageCount?: number } | null
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
  chatSession,
  onDelete,
  style = "default",
}: WebsitePreviewCardProps) {
  const [frameLoading, setFrameLoading] = useState(true)
  const [frameError, setFrameError] = useState(false)
  const [iframeScale, setIframeScale] = useState(0.26)
  const [isVisible, setIsVisible] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const fullUrl = domain.startsWith("http") ? domain : `https://${domain}`
  const displayDomain = domain.replace(/^https?:\/\//, "")
  const formattedDate = new Date(createdAt).toLocaleDateString("hu-HU")
  const IconComp = style === "browse" ? Sparkles : style === "ai" ? Zap : Package

  // Scale iframe to fill card width
  const updateScale = useCallback(() => {
    if (wrapperRef.current) setIframeScale(wrapperRef.current.offsetWidth / 1440)
  }, [])

  useEffect(() => {
    updateScale()
    const ro = new ResizeObserver(updateScale)
    if (wrapperRef.current) ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [updateScale])

  // Only load iframe when card enters viewport
  useEffect(() => {
    if (!cardRef.current) return
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true) },
      { rootMargin: "200px" }
    )
    io.observe(cardRef.current)
    return () => io.disconnect()
  }, [])

  /* ── NOT LIVE ─────────────────────────────────────────────── */
  if (!isLive) {
    return (
      <div ref={cardRef} className="flex flex-col rounded-2xl overflow-hidden" style={{ background: "#1c1c1e" }}>
        <div className="w-full flex flex-col items-center justify-center gap-3 relative overflow-hidden" style={{ aspectRatio: "16/10", background: "#252527" }}>
          {fallbackHtml && isVisible ? (
            <iframe
              srcDoc={fallbackHtml}
              title={`Preview of ${displayDomain}`}
              className="absolute inset-0 border-0 block pointer-events-none select-none"
              style={{ width: "1440px", height: "900px", transformOrigin: "top left", transform: `scale(${iframeScale})` }}
              sandbox="allow-scripts"
              tabIndex={-1}
            />
          ) : (
            <>
              <div className="relative h-10 w-10 rounded-full flex items-center justify-center" style={{ background: "#2e2e30", border: "1px solid rgba(255,255,255,0.07)" }}>
                <Loader2 className="h-4 w-4 text-zinc-400 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-zinc-200">Building Project</p>
              <p className="text-xs text-zinc-500">Waiting for deployment…</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-3 px-4 py-3" style={{ borderTop: "1px solid #2e2e30" }}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#2e2e30" }}>
            <IconComp className="h-3.5 w-3.5 text-zinc-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-zinc-100 truncate">{businessName}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">Created {formattedDate}</p>
          </div>
          <Link href={`/dashboard/sites/${projectId}`}>
            <Button variant="ghost" size="sm" className="h-8 shrink-0 text-xs px-3 rounded-full text-zinc-400 hover:text-white" style={{ background: "#2e2e30" }}>
              <Edit2 className="h-3 w-3 mr-1.5" />Edit
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  /* ── LIVE ─────────────────────────────────────────────────── */
  return (
    <div ref={cardRef} className="flex flex-col rounded-2xl overflow-hidden" style={{ background: "#1c1c1e" }}>
      <div ref={wrapperRef} className="relative w-full overflow-hidden" style={{ aspectRatio: "16/10", background: "#252527" }}>
        {frameLoading && !frameError && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: "#252527" }}>
            <Loader2 className="h-5 w-5 text-zinc-500 animate-spin" />
          </div>
        )}
        {frameError ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            <Globe className="h-7 w-7 text-zinc-700" />
            <p className="text-xs text-zinc-500">Preview unavailable</p>
          </div>
        ) : isVisible ? (
          <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
            <iframe
              src={fullUrl}
              title={`Preview of ${displayDomain}`}
              className="border-0 block"
              style={{ width: "1440px", height: "900px", transformOrigin: "top left", transform: `scale(${iframeScale})` }}
              onLoad={() => setFrameLoading(false)}
              onError={() => { setFrameError(true); setFrameLoading(false) }}
              sandbox="allow-scripts"
              tabIndex={-1}
            />
          </div>
        ) : null}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none" style={{ background: "linear-gradient(to bottom, transparent 45%, rgba(28,28,30,0.65) 100%)" }} />
        <div aria-label="Your site is now live" className="absolute bottom-0 left-0" style={{ zIndex: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "8px 14px", borderTopRightRadius: "16px", background: "#22a846" }}>
            <CheckCircle2 aria-hidden style={{ width: "12px", height: "12px", color: "rgba(255,255,255,0.85)", flexShrink: 0 }} />
            <span style={{ fontSize: "11.5px", fontWeight: 700, color: "#fff", lineHeight: 1.2, whiteSpace: "nowrap" }}>Your site is now live!</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2.5 px-4 py-3" style={{ borderTop: "1px solid #2e2e30" }}>
        <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#2e2e30" }}>
          <IconComp className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        <span className="flex-1 text-[13px] font-semibold text-zinc-100 truncate min-w-0">{displayDomain}</span>
        <Link href={`/dashboard/sites/${projectId}`} className="shrink-0">
          <div className="inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-[11px] font-semibold text-white transition-opacity hover:opacity-85 cursor-pointer" style={{ background: "#2e2e30" }}>
            <Edit2 className="h-3 w-3" />Settings
          </div>
        </Link>
      </div>
      <div className="flex items-center justify-between px-4 pb-3 pt-0">
        <p className="text-[11px] text-zinc-600">{businessName} · {formattedDate}{chatSession?.messageCount ? ` · Syra: ${chatSession.messageCount} msg` : ""}</p>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: "#2e2e30" }}>
          <span className="relative flex h-1.5 w-1.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
          </span>
          <span className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Live</span>
        </div>
      </div>
    </div>
  )
}
