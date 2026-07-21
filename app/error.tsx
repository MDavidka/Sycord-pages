"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app] Route error:", error)
  }, [error])

  return (
    <main className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-6 text-center text-white">
      <h1 className="text-2xl font-semibold tracking-tight">This view crashed</h1>
      <p className="text-sm text-white/60">
        Something went wrong while rendering. Your work is likely still saved — try reloading this view.
      </p>
      <div className="flex gap-3 pt-2">
        <Button type="button" onClick={reset}>
          Reload view
        </Button>
        <Button type="button" variant="outline" onClick={() => { window.location.href = "/dashboard" }}>
          Dashboard
        </Button>
      </div>
    </main>
  )
}
