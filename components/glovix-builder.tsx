"use client"

import dynamic from "next/dynamic"

// Glovix is a fully client-side application (WebContainers, Monaco, xterm, and
// browser-only APIs such as localStorage). It must never be server-rendered, so
// we load it lazily with `ssr: false`. The whole subtree below this boundary is
// a client island living inside the Next.js app.
const GlovixApp = dynamic(() => import("@/glovix/App"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full flex-col items-center justify-center bg-[#0a0a0a]">
      <div className="text-xl font-light tracking-widest text-white">Glovix Technologies</div>
      <div className="mt-6 h-0.5 w-8 overflow-hidden bg-white/20">
        <div className="h-full w-full animate-[loading_1s_ease-in-out_infinite] bg-white" />
      </div>
    </div>
  ),
})

export default function GlovixBuilder() {
  return (
    <div className="glovix-root h-full w-full">
      <GlovixApp />
    </div>
  )
}
