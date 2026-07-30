"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function BuilderError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[builder] Error boundary:", error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 bg-[#181818] px-6 text-center text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Builder hit an error</h1>
      <p className="text-sm text-white/60">
        The AI builder UI crashed while rendering. Retry to reopen the chat, or return to your sites.
      </p>
      <div className="flex gap-3 pt-2">
        <Button type="button" onClick={reset}>
          Retry builder
        </Button>
        <Button type="button" variant="outline" onClick={() => { window.location.href = "/dashboard" }}>
          Back to sites
        </Button>
      </div>
    </main>
  )
}
