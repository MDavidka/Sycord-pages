"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef } from "react"

// Glovix is a fully client-side application (WebContainers, Monaco, xterm, and
// browser-only APIs such as localStorage). It must never be server-rendered, so
// we load it lazily with `ssr: false`. The whole subtree below this boundary is
// a client island living inside the Next.js app.
const GlovixApp = dynamic(() => import("@/glovix/App"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-[#18191B]" />,
})

interface GlovixBuilderProps {
  /** When provided (from the dashboard site page), the builder will sync
   * created/edited files to the project's pages via the API instead of only
   * persisting them in localStorage. */
  projectId?: string
  /** The signed-in user's avatar URL (e.g. Google profile picture) shown in the
   * embedded mobile header. */
  userImage?: string | null
  /** Called when the user taps the back button in the embedded mobile header. */
  onBack?: () => void
  /** Shadcn preset ID (e.g. "b27GcrRo") that injects section components. */
  preset?: string
}

export default function GlovixBuilder({ projectId, userImage, onBack, preset }: GlovixBuilderProps) {
  // Keep unstable callback props out of the projectId effect deps — an inline
  // onBack from the Syra page was re-running cleanup on every parent render and
  // briefly clearing window.__glovixProjectId, which made /api/workspace/preview
  // return "Invalid project ID".
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  // Set synchronously during render so the ssr:false Glovix bundle can read the
  // project id on its very first render (child effects run before this parent's
  // effect, so a useEffect alone would be too late for embedded-mode detection).
  if (typeof window !== "undefined" && projectId) {
    ;(window as any).__glovixProjectId = projectId
    ;(window as any).__glovixChatId = `project_${projectId}`
    ;(window as any).__glovixUserImage = userImage ?? undefined
    ;(window as any).__glovixOnBack = () => onBackRef.current?.()
    if (preset) (window as any).__glovixPreset = preset
  }

  // Expose the projectId to the Glovix store so the internal save logic can
  // route writes to the correct API endpoint. We write directly to
  // window.__glovixProjectId so the ssr:false bundle can read it synchronously
  // without any React context bridge.
  useEffect(() => {
    if (projectId) {
      ;(window as any).__glovixProjectId = projectId
      ;(window as any).__glovixChatId = `project_${projectId}`
    }
    ;(window as any).__glovixUserImage = userImage ?? undefined
    ;(window as any).__glovixOnBack = () => onBackRef.current?.()
    if (preset) {
      ;(window as any).__glovixPreset = preset
    } else {
      ;(window as any).__glovixPreset = undefined
    }
    return () => {
      // Only clear values we still own. Clearing unconditionally races with a
      // remount / Strict Mode re-run that already wrote the next project id.
      if ((window as any).__glovixProjectId === projectId) {
        ;(window as any).__glovixProjectId = undefined
        ;(window as any).__glovixChatId = undefined
      }
      ;(window as any).__glovixUserImage = undefined
      ;(window as any).__glovixOnBack = undefined
      if ((window as any).__glovixPreset === preset) {
        ;(window as any).__glovixPreset = undefined
      }
    }
  }, [projectId, userImage, preset])

  return (
    <div className="glovix-root h-full w-full">
      <GlovixApp />
    </div>
  )
}
