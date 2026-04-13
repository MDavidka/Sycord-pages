"use client"

import { useState } from "react"

export interface CollabInvite {
  _id: string
  projectId: string
  projectName: string
  inviterUserId: string
  inviterName: string
  inviteeEmail: string
  status: "pending" | "accepted" | "ignored"
  createdAt: string
}

interface CollabInvitePopupProps {
  invite: CollabInvite
  onDismiss: () => void
}

export function CollabInvitePopup({ invite, onDismiss }: CollabInvitePopupProps) {
  const [isLoading, setIsLoading] = useState<"accept" | "ignore" | null>(null)
  const [done, setDone] = useState<"accepted" | "ignored" | null>(null)

  const senderInitial = invite.inviterName?.charAt(0)?.toUpperCase() || "?"

  async function respond(action: "accept" | "ignore") {
    setIsLoading(action)
    try {
      const res = await fetch(`/api/collab/invites/${invite._id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })

      if (!res.ok) {
        console.error("[v0] Collab respond error:", await res.text())
      }

      setDone(action === "accept" ? "accepted" : "ignored")
      // Brief pause so user sees the result before the popup closes
      setTimeout(() => onDismiss(), 900)
    } catch (err) {
      console.error("[v0] Collab respond network error:", err)
    } finally {
      setIsLoading(null)
    }
  }

  return (
    // Backdrop
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Card */}
      <div
        className="w-full max-w-xs rounded-3xl p-8 flex flex-col items-center gap-5 shadow-2xl"
        style={{ background: "#1e1e20" }}
        role="dialog"
        aria-modal="true"
        aria-label="Collaboration invitation"
      >
        {done ? (
          <div className="py-6 text-center">
            <p className="text-base font-semibold text-foreground">
              {done === "accepted" ? "Invitation accepted!" : "Invitation ignored."}
            </p>
            {done === "accepted" && (
              <p className="text-xs text-muted-foreground mt-1">
                The project has been added to your dashboard.
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Sender avatar + message */}
            <div className="flex flex-col items-center gap-4">
              <div
                className="h-16 w-16 rounded-2xl flex items-center justify-center text-2xl font-bold text-foreground"
                style={{ background: "#3a3a3c" }}
                aria-hidden="true"
              >
                {senderInitial}
              </div>

              <p className="text-sm font-semibold text-center text-foreground leading-snug">
                <span className="font-bold">{invite.inviterName}</span>
                {" invited you to collaborate on their project"}
              </p>

              {invite.projectName && (
                <p className="text-xs text-muted-foreground text-center">
                  &ldquo;{invite.projectName}&rdquo;
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 w-full mt-1">
              <button
                onClick={() => respond("accept")}
                disabled={!!isLoading}
                className="flex-1 py-3 rounded-full text-sm font-semibold text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#3a3a3c" }}
              >
                {isLoading === "accept" ? "..." : "Accept"}
              </button>
              <button
                onClick={() => respond("ignore")}
                disabled={!!isLoading}
                className="flex-1 py-3 rounded-full text-sm font-semibold text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: "#3a3a3c" }}
              >
                {isLoading === "ignore" ? "..." : "Ignore"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
