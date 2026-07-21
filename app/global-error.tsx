"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app] Unhandled error:", error)
  }, [error])

  return (
    <html lang="en">
      <body className="min-h-screen bg-[#181818] text-white antialiased">
        <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
          <p className="text-sm text-white/60">
            An unexpected error crashed this page. You can try again, or go back to the dashboard.
          </p>
          <div className="flex gap-3 pt-2">
            <Button type="button" onClick={reset}>
              Try again
            </Button>
            <Button type="button" variant="outline" onClick={() => { window.location.href = "/dashboard" }}>
              Dashboard
            </Button>
          </div>
        </main>
      </body>
    </html>
  )
}
