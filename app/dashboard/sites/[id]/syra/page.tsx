"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import GlovixBuilder from "@/components/glovix-builder"
// Import triggers the module-level IIFE — eruda is initialised before React mounts.
import { initErudaIfPresent } from "@/glovix/lib/init-eruda"

// Eagerly init at module evaluation time (before React hydration).
initErudaIfPresent()

/**
 * Isolated Syra shell at /dashboard/sites/[id]/syra.
 * Loaded as a top-level page (not nested in the dashboard SPA) so COOP/COEP
 * headers apply and WebContainer can boot.
 */
export default function SyraEmbedPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()

  useEffect(() => {
    // Re-run after hydration in case eruda was injected between module eval and mount.
    initErudaIfPresent()
  }, [])

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#18191B]">
      <GlovixBuilder
        projectId={id}
        onBack={() => {
          if (window.parent !== window) {
            window.parent.postMessage({ type: "syra-navigate-back" }, "*")
          } else {
            router.push(`/dashboard/sites/${id}`)
          }
        }}
      />
    </div>
  )
}
