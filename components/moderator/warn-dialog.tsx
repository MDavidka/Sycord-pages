"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Send } from "lucide-react"

interface WarnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    userId: string
    email: string
    name: string
  } | null
  onSuccess: () => void
}

export function WarnDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: WarnDialogProps) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSendWarning = async () => {
    if (!user || !reason.trim()) {
      toast.error("Please provide a reason for the warning")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/moderator/warn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.userId,
          reason: reason.trim(),
        }),
      })

      const data = await res.json()
      if (data.ok) {
        toast.success(`Warning issued to ${user.email}`)
        onOpenChange(false)
        setReason("")
        onSuccess()
      } else {
        toast.error(`Failed to send warning: ${data.error || "Unknown error"}`)
      }
    } catch (err: any) {
      toast.error(`Error sending warning: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            Send Warning
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Issue a formal moderation warning to <span className="font-medium text-foreground">{user?.email}</span>. This will be recorded in the moderation history.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-2">
          <label className="text-xs font-medium text-muted-foreground">Warning Reason</label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Explain why this warning is being issued..."
            rows={3}
            className="text-xs resize-none"
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            size="sm"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSendWarning}
            disabled={loading || !reason.trim()}
            variant="default"
            size="sm"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <Send className="w-3.5 h-3.5" />
            Send Warning
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
