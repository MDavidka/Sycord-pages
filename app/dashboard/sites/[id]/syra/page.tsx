"use client"

import { useCallback, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import GlovixBuilder from "@/components/glovix-builder"
import { initErudaIfPresent } from "@/glovix/lib/init-eruda"

/**
 * Isolated Syra shell at /dashboard/sites/[id]/syra.
 * Loaded as a top-level page (not nested in the dashboard SPA) so COOP/COEP
 * headers apply. Preview uses Syte on all browsers; WebContainer only boots on
 * Chromium when crossOriginIsolated is true (Safari cannot boot WebContainers).
 */
export default function SyraEmbedPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  useEffect(() => {
    initErudaIfPresent()
  }, [])

  const onBack = useCallback(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "syra-navigate-back" }, "*")
    } else {
      router.push(`/dashboard/sites/${id}`)
    }
  }, [id, router])

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#18191B]">
      <GlovixBuilder projectId={id} onBack={onBack} />
    </div>
  )
}
