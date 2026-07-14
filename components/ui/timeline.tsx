"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * shadcn-style Timeline — a vertical feed of events (used for the agent
 * generation activity). Compose with <Timeline>, <TimelineItem>, and a
 * <TimelineDot> + <TimelineContent> inside each item.
 */
const Timeline = React.forwardRef<HTMLOListElement, React.HTMLAttributes<HTMLOListElement>>(
  ({ className, ...props }, ref) => (
    <ol ref={ref} className={cn("relative flex flex-col", className)} {...props} />
  ),
)
Timeline.displayName = "Timeline"

const TimelineItem = React.forwardRef<HTMLLIElement, React.HTMLAttributes<HTMLLIElement>>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn("relative flex gap-3 pb-5 last:pb-0", className)} {...props} />
  ),
)
TimelineItem.displayName = "TimelineItem"

const TimelineDot = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & { tone?: "default" | "agent" | "user" | "success" | "warn" | "error" }
>(({ className, tone = "default", ...props }, ref) => {
  const tones: Record<string, string> = {
    default: "border-border bg-muted text-muted-foreground",
    agent: "border-primary/40 bg-primary/15 text-primary",
    user: "border-sky-500/40 bg-sky-500/15 text-sky-400",
    success: "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
    warn: "border-amber-500/40 bg-amber-500/15 text-amber-400",
    error: "border-red-500/40 bg-red-500/15 text-red-400",
  }
  return (
    <span
      ref={ref}
      className={cn(
        "z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
        tones[tone],
        className,
      )}
      {...props}
    />
  )
})
TimelineDot.displayName = "TimelineDot"

const TimelineConnector = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      aria-hidden="true"
      className={cn("absolute left-[13px] top-7 h-[calc(100%-1rem)] w-px bg-border", className)}
      {...props}
    />
  ),
)
TimelineConnector.displayName = "TimelineConnector"

const TimelineContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex min-w-0 flex-1 flex-col gap-1", className)} {...props} />
  ),
)
TimelineContent.displayName = "TimelineContent"

const TimelineTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm font-medium leading-snug text-foreground", className)} {...props} />
  ),
)
TimelineTitle.displayName = "TimelineTitle"

const TimelineDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-[13px] leading-relaxed text-muted-foreground", className)} {...props} />
))
TimelineDescription.displayName = "TimelineDescription"

const TimelineTime = React.forwardRef<HTMLTimeElement, React.HTMLAttributes<HTMLTimeElement>>(
  ({ className, ...props }, ref) => (
    <time ref={ref} className={cn("text-[11px] tabular-nums text-muted-foreground/70", className)} {...props} />
  ),
)
TimelineTime.displayName = "TimelineTime"

export {
  Timeline,
  TimelineItem,
  TimelineDot,
  TimelineConnector,
  TimelineContent,
  TimelineTitle,
  TimelineDescription,
  TimelineTime,
}
