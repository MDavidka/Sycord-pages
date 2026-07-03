"use client"

import { useParams } from "next/navigation"
import { useSession } from "next-auth/react"
import GlovixBuilder from "@/components/glovix-builder"

/**
 * Isolated Syra shell — loaded in an iframe from the project dashboard.
 * COOP/COEP headers are scoped to this route so WebContainer can boot even
 * when the parent dashboard document is not cross-origin isolated.
 */
export default function SyraEmbedPage() {
  const { id } = useParams() as { id: string }
  const { data: session } = useSession()

  return (
    <div className="h-[100dvh] w-full overflow-hidden bg-[#18191B]">
      <GlovixBuilder
        projectId={id}
        userImage={session?.user?.image}
        onBack={() => {
          if (window.parent !== window) {
            window.parent.postMessage({ type: "syra-navigate-back" }, "*")
          } else {
            window.history.back()
          }
        }}
      />
    </div>
  )
}
