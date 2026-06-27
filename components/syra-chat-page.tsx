"use client"

import dynamic from "next/dynamic"

// SyraChat lives inside the Glovix bundle which requires a MemoryRouter context
// (for useNavigate) and uses Zustand with localStorage — must be client-only.
const SyraChatApp = dynamic(
  () => import("@/glovix/components/SyraChatApp"),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#121214]" />,
  }
)

export default function SyraChatPage() {
  return (
    <div className="h-full w-full">
      <SyraChatApp />
    </div>
  )
}
