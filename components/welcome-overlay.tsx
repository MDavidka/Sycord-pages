"use client"

import { useEffect } from "react"
import Image from "next/image"

interface WelcomeOverlayProps {
  userName: string
  userImage?: string
  isVisible: boolean
  onComplete: () => void
}

export function WelcomeOverlay({ userName, userImage, isVisible, onComplete }: WelcomeOverlayProps) {
  useEffect(() => {
    if (!isVisible) return

    const hideTimer = setTimeout(() => {
      onComplete()
    }, 2000)

    return () => clearTimeout(hideTimer)
  }, [isVisible, onComplete])

  if (!isVisible) return null

  const userInitials =
    userName
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  return (
    <>
      <div className="fixed inset-0 bg-black z-40 pointer-events-none animate-in fade-in duration-300" />

      <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
        <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
          <div
            className="flex-shrink-0"
            style={{
              animation: "scale-in 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
            }}
          >
            {userImage ? (
              <div className="relative h-16 w-16 rounded-full overflow-hidden border-4 border-primary shadow-xl flex-shrink-0">
                <Image src={userImage || "/placeholder.svg"} alt={userName} fill className="object-cover" priority />
              </div>
            ) : (
              <div className="h-16 w-16 rounded-full bg-primary flex items-center justify-center border-4 border-primary shadow-xl flex-shrink-0">
                <span className="text-xl font-bold text-primary-foreground">{userInitials}</span>
              </div>
            )}
          </div>

          {/* Welcome Text */}
          <div className="text-center animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Welcome back, {userName}</h2>
            <p className="text-sm text-gray-300 mt-2">Ready to manage your websites</p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from {
            opacity: 0;
            transform: scale(0.3);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  )
}
