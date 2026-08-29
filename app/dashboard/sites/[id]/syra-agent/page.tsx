"use client"

// Rebuilt Syra experience at /dashboard/sites/[id]/syra-agent.
//
// Unlike the legacy WebContainer builder, this surface is a thin client over the
// Syte agent activity SSE stream: the cloud runtime does the work and streams a
// durable turn (starting → thinking → tools/commands/files → reply), which the
// activity feed renders live.

import { Suspense } from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import SyraAgentChat from "@/glovix/components/syra/SyraAgentChat"
// Shimmer keyframes + tool row styling live in the glovix stylesheet.
import "@/glovix/glovix.css"

function SyraAgentShell() {
  const { id } = useParams() as { id: string }
  const router = useRouter()
  // A newly created project opens with ?fresh=1 → fresh start, no history load.
  const freshStart = useSearchParams().get("fresh") === "1"

  return (
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-[#18191B]">
      <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-[#2a2b2e] px-3">
        <button
          type="button"
          onClick={() => router.push(`/dashboard/sites/${id}`)}
          aria-label="Back"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9a9b9e] transition-colors hover:bg-white/5 hover:text-white"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <span className="text-[14px] font-medium text-[#e5e5e5]">Syra</span>
      </header>
      <div className="min-h-0 flex-1">
        <SyraAgentChat projectId={id} freshStart={freshStart} />
      </div>
    </div>
  )
}

export default function SyraAgentPage() {
  // useSearchParams requires a Suspense boundary during prerendering.
  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-[#18191B]" />}>
      <SyraAgentShell />
    </Suspense>
  )
}
