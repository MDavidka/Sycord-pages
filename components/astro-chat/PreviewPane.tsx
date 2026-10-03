"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  RotateCw,
  ExternalLink,
  Globe,
  Copy,
  Check,
  Monitor,
  Tablet,
  Smartphone,
  AlertTriangle,
  Loader2,
  Play,
  RefreshCw,
} from "lucide-react"
import { PreviewState } from "./types"

interface PreviewPaneProps {
  projectId?: string
  previewState: PreviewState
  onStartRequested: () => Promise<void>
  onUrlChanged?: (url: string) => void
  isDark?: boolean
}

type DeviceMode = "desktop" | "tablet" | "mobile"

export function PreviewPane({
  projectId,
  previewState,
  onStartRequested,
  onUrlChanged,
  isDark = true,
}: PreviewPaneProps) {
  const [device, setDevice] = useState<DeviceMode>("desktop")
  const [copied, setCopied] = useState(false)
  const [iframeError, setIframeError] = useState<string | null>(null)
  const [useProxy, setUseProxy] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [retryCountdown, setRetryCountdown] = useState<number | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const activeUrl = previewState.url || previewState.directUrl || ""

  // Resolve target frame URL (direct or proxy fallback)
  const resolvedFrameUrl = React.useMemo(() => {
    if (!activeUrl) return ""
    if (useProxy) {
      return `/api/workspace/preview-frame?url=${encodeURIComponent(activeUrl)}`
    }
    return activeUrl
  }, [activeUrl, useProxy])

  const copyUrl = async () => {
    if (!activeUrl) return
    try {
      await navigator.clipboard.writeText(activeUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  const reloadIframe = () => {
    setIsLoading(true)
    setIframeError(null)
    if (iframeRef.current && resolvedFrameUrl) {
      const u = new URL(resolvedFrameUrl, window.location.href)
      u.searchParams.set("_r", String(Date.now()))
      iframeRef.current.src = u.toString()
    }
    setTimeout(() => setIsLoading(false), 1200)
  }

  const handleIframeLoad = () => {
    setIsLoading(false)
    setIframeError(null)
  }

  const handleIframeError = () => {
    setIsLoading(false)
    if (!useProxy && activeUrl.startsWith("http")) {
      // Auto-fallback to proxy if direct embed fails
      setUseProxy(true)
    } else {
      setIframeError("Unable to connect to the dev server. It may still be compiling.")
    }
  }

  // Pre-flight check when activeUrl changes
  useEffect(() => {
    if (!activeUrl) {
      setIframeError(null)
      return
    }
    setIframeError(null)
    setUseProxy(false)
    setIsLoading(true)
  }, [activeUrl])

  return (
    <div className={`flex flex-col h-full w-full overflow-hidden ${isDark ? "bg-[#141416] text-[#e0e0e0]" : "bg-gray-50 text-gray-900"}`}>
      {/* Top Controls Bar */}
      <div className={`flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b text-xs flex-shrink-0 ${isDark ? "bg-[#18181b] border-zinc-800 text-zinc-300" : "bg-white border-zinc-200 text-zinc-700"}`}>
        {/* Device Switcher */}
        <div className="flex items-center gap-1 rounded-lg p-0.5 bg-zinc-800/40 border border-zinc-700/50">
          <button
            onClick={() => setDevice("desktop")}
            className={`p-1.5 rounded transition-colors ${device === "desktop" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            title="Desktop View"
          >
            <Monitor className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDevice("tablet")}
            className={`p-1.5 rounded transition-colors ${device === "tablet" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            title="Tablet View (768px)"
          >
            <Tablet className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => setDevice("mobile")}
            className={`p-1.5 rounded transition-colors ${device === "mobile" ? "bg-zinc-700 text-white" : "text-zinc-400 hover:text-zinc-200"}`}
            title="Mobile View (375px)"
          >
            <Smartphone className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* URL Address Bar */}
        <div className="flex-1 min-w-[180px] max-w-md mx-2">
          {activeUrl ? (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border font-mono text-[11px] truncate ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-300" : "bg-gray-100 border-zinc-200 text-zinc-600"}`}>
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${previewState.status === "running" ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`} />
              <span className="truncate flex-1">{activeUrl}</span>
              <button onClick={copyUrl} className="text-zinc-400 hover:text-white transition-colors" title="Copy URL">
                {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
              </button>
            </div>
          ) : (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] ${isDark ? "bg-zinc-900 border-zinc-800 text-zinc-500" : "bg-gray-100 border-zinc-200 text-zinc-400"}`}>
              <Globe className="h-3 w-3 opacity-40" />
              <span>No dev preview server active</span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-1.5">
          {previewState.status === "starting" ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[11px]">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Booting…</span>
            </div>
          ) : activeUrl ? (
            <>
              <button
                onClick={reloadIframe}
                disabled={isLoading}
                className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
                title="Reload Preview"
              >
                <RotateCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin text-indigo-400" : ""}`} />
              </button>
              <a
                href={activeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-md hover:bg-zinc-800/80 text-zinc-400 hover:text-white transition-colors"
                title="Open in New Tab"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={onStartRequested}
                className="flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-[11px] transition-colors"
                title="Restart dev server"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Restart</span>
              </button>
            </>
          ) : (
            <button
              onClick={onStartRequested}
              className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-[11px] transition-colors shadow-sm"
            >
              <Play className="h-3 w-3" />
              <span>Start Preview</span>
            </button>
          )}
        </div>
      </div>

      {/* Frame / Content Area */}
      <div className="relative flex-1 min-h-0 w-full overflow-hidden flex items-center justify-center p-2 bg-[#09090b]">
        {previewState.status === "starting" ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-sm rounded-xl border border-zinc-800 bg-zinc-900/60 backdrop-blur-md">
            <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-zinc-100">Booting Preview Server</h4>
              <p className="text-xs text-zinc-400">
                Syncing workspace components and compiling HMR dev server…
              </p>
            </div>
          </div>
        ) : !activeUrl ? (
          <div className="flex flex-col items-center justify-center gap-4 p-8 text-center max-w-md rounded-2xl border border-zinc-800/80 bg-zinc-900/40 backdrop-blur-sm">
            <div className="h-12 w-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
              <Globe className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-zinc-100">Live Preview Standby</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Start the preview server to test and hot-reload components in real time. The agent will also start it automatically during verification.
              </p>
            </div>
            <button
              onClick={onStartRequested}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md hover:shadow-indigo-500/20"
            >
              <Play className="h-3.5 w-3.5" />
              <span>Start Dev Preview Server</span>
            </button>
          </div>
        ) : iframeError ? (
          <div className="flex flex-col items-center justify-center gap-3 p-8 text-center max-w-md rounded-xl border border-amber-500/30 bg-zinc-900/80">
            <AlertTriangle className="h-8 w-8 text-amber-400" />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-zinc-100">Preview Server Starting or Rebuilding</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                The preview dev server is still booting or compiling packages. It will be available momentarily.
              </p>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                onClick={reloadIframe}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 text-xs font-medium transition-colors"
              >
                <RotateCw className="h-3.5 w-3.5" />
                <span>Retry Now</span>
              </button>
              <button
                onClick={onStartRequested}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Restart Dev Server</span>
              </button>
            </div>
          </div>
        ) : (
          <div
            className={`h-full transition-all duration-300 ease-in-out bg-white rounded-lg shadow-xl overflow-hidden relative border border-zinc-800/50 ${
              device === "mobile"
                ? "w-[375px] max-w-full"
                : device === "tablet"
                ? "w-[768px] max-w-full"
                : "w-full"
            }`}
          >
            {isLoading && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
                <Loader2 className="h-6 w-6 animate-spin text-white" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={resolvedFrameUrl}
              onLoad={handleIframeLoad}
              onError={handleIframeError}
              className="h-full w-full border-0 bg-white"
              title="Astro Live Preview"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
              referrerPolicy="no-referrer-when-downgrade"
            />
          </div>
        )}
      </div>
    </div>
  )
}
