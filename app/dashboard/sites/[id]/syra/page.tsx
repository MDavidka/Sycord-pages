"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
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
  const { data: session } = useSession()
  const router = useRouter()
  const [projectName, setProjectName] = useState<string | null>(null)

  useEffect(() => {
    initErudaIfPresent()
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/projects/${id}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.businessName) {
          setProjectName(data.businessName)
        }
      })
      .catch(() => {})
  }, [id])

  const onBack = useCallback(() => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "syra-navigate-back" }, "*")
    } else {
      router.push(`/dashboard/sites/${id}`)
    }
  }, [id, router])

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#151515]">
      <GlovixBuilder
        projectId={id}
        projectName={projectName}
        userImage={session?.user?.image || undefined}
        onBack={onBack}
      />
    </div>
  )
}
