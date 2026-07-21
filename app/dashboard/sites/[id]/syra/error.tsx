"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function SyraError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[syra] Error boundary:", error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 bg-[#181818] px-6 text-center text-white">
      <h1 className="text-2xl font-semibold tracking-tight">Syra crashed</h1>
      <p className="text-sm text-white/60">
        A render error stopped the Syra builder. Retry this page or open the site dashboard.
      </p>
      <div className="flex gap-3 pt-2">
        <Button type="button" onClick={reset}>
          Retry
        </Button>
        <Button type="button" variant="outline" onClick={() => { window.history.back() }}>
          Go back
        </Button>
      </div>
    </main>
  )
}
