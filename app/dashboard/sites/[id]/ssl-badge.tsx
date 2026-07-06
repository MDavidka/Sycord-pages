"use client"
/**
 * SSLBadge — small pill shown next to the domain name in the overview tab.
 *
 * sslActive = true   → green lock + "SSL" pill
 * sslActive = null   → yellow spinner (checking / pending)
 * sslActive = false  → red triangle + "No SSL"
 */
import { Lock, Loader2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

export function SSLBadge({
  sslActive,
  className,
}: {
  sslActive: boolean | null
  className?: string
}) {
  if (sslActive === true) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/20 shrink-0",
          className
        )}
        title="SSL certificate active"
      >
        <Lock className="h-3 w-3" />
        SSL
      </span>
    )
  }

  if (sslActive === null) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 shrink-0",
          className
        )}
        title="SSL certificate pending"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        SSL
      </span>
    )
  }

  // false — explicitly no SSL
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-400 border border-red-500/20 shrink-0",
        className
      )}
      title="No SSL certificate"
    >
      <AlertTriangle className="h-3 w-3" />
      No SSL
    </span>
  )
}
