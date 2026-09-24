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
import { Ban, UserCheck, Loader2, AlertTriangle } from "lucide-react"

interface BanDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    userId: string
    email: string
    name: string
    isBlocked?: boolean
  } | null
  onSuccess: () => void
}

export function BanDialog({
  open,
  onOpenChange,
  user,
  onSuccess,
}: BanDialogProps) {
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)

  const isBanning = !user?.isBlocked

  const handleBanToggle = async () => {
    if (!user) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(user.userId)}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isBlocked: isBanning,
          reason: reason.trim(),
        }),
      })

      const data = await res.json()
      if (data.success || data.ok) {
        toast.success(`User ${user.email} has been ${isBanning ? "banned" : "unbanned"}`)
        onOpenChange(false)
        setReason("")
        onSuccess()
      } else {
        toast.error(`Operation failed: ${data.error || "Unknown error"}`)
      }
    } catch (err: any) {
      toast.error(`Error: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            {isBanning ? (
              <AlertTriangle className="w-4 h-4 text-muted-foreground" />
            ) : (
              <UserCheck className="w-4 h-4 text-muted-foreground" />
            )}
            {isBanning ? "Ban User Account" : "Unban User Account"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isBanning
              ? `Are you sure you want to ban ${user?.email}? The user will immediately be signed out and prevented from logging in.`
              : `Restore account access for ${user?.email}?`}
          </DialogDescription>
        </DialogHeader>

        {isBanning && (
          <div className="space-y-1.5 py-2">
            <label className="text-xs font-medium text-muted-foreground">Ban Reason / Policy Violation</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Repeated Terms of Service violation, scraping, malicious automation..."
              rows={3}
              className="text-xs resize-none"
            />
          </div>
        )}

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
            onClick={handleBanToggle}
            disabled={loading}
            variant={isBanning ? "destructive" : "default"}
            size="sm"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isBanning ? <Ban className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
            {isBanning ? "Confirm Ban" : "Confirm Unban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
