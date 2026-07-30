"use client"

import { Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SitePreviewDashboard } from "@/components/site-preview-dashboard"
import { ArrowLeft } from "lucide-react"

function PreviewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const url = searchParams.get("url") ?? ""
  const siteName = searchParams.get("name") ?? undefined
  const isLive = searchParams.get("live") !== "false"

  // If no URL provided, show a helpful empty state
  if (!url) {
    return (
      <div
        className="flex flex-col items-center justify-center w-full h-full gap-4"
        style={{ background: "#1a1a1c" }}
      >
        <p className="text-sm text-zinc-500">No URL specified.</p>
        <p className="text-xs text-zinc-700 font-mono">
          Add <code className="text-zinc-400">?url=https://your-site.com</code> to the path.
        </p>
      </div>
    )
  }

  return (
    <SitePreviewDashboard
      url={url}
      siteName={siteName}
      isLive={isLive}
      onClose={() => router.back()}
    />
  )
}

export default function DashboardPreviewPage() {
  return (
    /*
      Full-viewport preview shell.
      The header is intentionally omitted per instructions (layout.tsx
      already provides the global app header on authenticated routes).
      This page occupies the full remaining viewport height.
    */
    <div
      className="flex flex-col"
      style={{ height: "100dvh", background: "#1a1a1c" }}
    >
      <Suspense
        fallback={
          <div
            className="flex flex-col items-center justify-center flex-1 gap-3"
            style={{ background: "#1a1a1c" }}
          >
            <div
              className="h-8 w-8 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin"
            />
            <p className="text-xs text-zinc-600">Loading preview…</p>
          </div>
        }
      >
        <PreviewContent />
      </Suspense>
    </div>
  )
}
