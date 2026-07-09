"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import GlovixBuilder from "@/components/glovix-builder"
import { SyraMobileDashboardBar } from "@/components/syra-mobile-dashboard-bar"
import { initErudaIfPresent } from "@/glovix/lib/init-eruda"

/**
 * Isolated Syra shell at /dashboard/sites/[id]/syra.
 * Mobile loads here as a top-level page so preview can embed the Vite dev server.
 */
export default function SyraEmbedPage() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  const { data: session } = useSession()
  const [showDashboardHeader, setShowDashboardHeader] = useState(false)
  const [siteName, setSiteName] = useState<string | null>(null)

  useEffect(() => {
    initErudaIfPresent()
  }, [])

  useEffect(() => {
    if (!id) return
    fetch(`/api/projects/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((project) => {
        if (project?.businessName) setSiteName(project.businessName)
      })
      .catch(() => {})
  }, [id])

  const handleBack = () => {
    if (window.parent !== window) {
      window.parent.postMessage({ type: "syra-navigate-back" }, "*")
      return
    }
    setShowDashboardHeader(true)
  }

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#18191B]">
      {showDashboardHeader && (
        <SyraMobileDashboardBar
          siteName={siteName ?? undefined}
          onMenu={() => router.push(`/dashboard/sites/${id}`)}
        />
      )}
      <div className="min-h-0 flex-1">
        <GlovixBuilder
          projectId={id}
          userImage={session?.user?.image ?? null}
          onBack={handleBack}
        />
      </div>
    </div>
  )
}
