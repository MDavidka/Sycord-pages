"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { SitePreviewDashboard } from "@/components/site-preview-dashboard"

/**
 * Standalone preview fallback (`/dashboard-preview?url=…`).
 * Prefer the in-page Preview tab on `/dashboard/sites/[id]` — it shares the
 * edit-page shell with Syra and avoids a cold new-tab load.
 */
function PreviewContent() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const url = searchParams.get("url") ?? ""
  const siteName = searchParams.get("name") ?? undefined
  const isLive = searchParams.get("live") !== "false"
  const siteId = searchParams.get("id")

  // When a site id is known, bounce into the edit-page Preview tab (faster warm path).
  useEffect(() => {
    if (!siteId) return
    router.replace(`/dashboard/sites/${siteId}?tab=preview`)
  }, [siteId, router])

  if (siteId) {
    return (
      <div
        className="flex flex-col items-center justify-center w-full h-full gap-3"
        style={{ background: "#1a1a1c" }}
      >
        <div className="h-8 w-8 rounded-full border-2 border-zinc-700 border-t-zinc-400 animate-spin" />
        <p className="text-xs text-zinc-600">Opening in-page preview…</p>
      </div>
    )
  }

  if (!url) {
    return (
      <div
        className="flex flex-col items-center justify-center w-full h-full gap-4"
        style={{ background: "#1a1a1c" }}
      >
        <p className="text-sm text-zinc-500">No URL specified.</p>
        <p className="text-xs text-zinc-700 font-mono">
          Add <code className="text-zinc-400">?url=https://your-site.com</code> to the path,
          or open Preview from the website edit page.
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
