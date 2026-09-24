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
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Plus, Minus, Loader2, Coins } from "lucide-react"

interface CreditDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: {
    userId: string
    email: string
    name: string
    credits: number
  } | null
  actionType: "add" | "remove"
  onSuccess: () => void
}

export function CreditDialog({
  open,
  onOpenChange,
  user,
  actionType,
  onSuccess,
}: CreditDialogProps) {
  const [amount, setAmount] = useState<string>("50")
  const [reason, setReason] = useState<string>("")
  const [loading, setLoading] = useState(false)

  const isAdd = actionType === "add"

  const handleCreditChange = async () => {
    if (!user) return
    const num = parseFloat(amount)
    if (isNaN(num) || num <= 0) {
      toast.error("Please enter a valid positive number of credits")
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/moderator/users/${encodeURIComponent(user.userId)}/credits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: num,
          action: actionType,
          reason: reason.trim(),
        }),
      })

      const data = await res.json()
      if (data.ok) {
        toast.success(`Successfully ${isAdd ? "added" : "removed"} ${num} credits for ${user.email}`)
        onOpenChange(false)
        setReason("")
        onSuccess()
      } else {
        toast.error(`Failed to update credits: ${data.error || "Unknown error"}`)
      }
    } catch (err: any) {
      toast.error(`Error updating credits: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Coins className="w-4 h-4 text-muted-foreground" />
            {isAdd ? "Add Credits" : "Remove Credits"}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {isAdd ? "Grant additional AI generation credits to" : "Deduct AI generation credits from"}{" "}
            <span className="font-medium text-foreground">{user?.email}</span>. Current balance:{" "}
            <span className="font-semibold text-foreground">{user?.credits ?? 0}</span> credits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Amount</label>
            <div className="relative">
              <Input
                type="number"
                min="1"
                step="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Amount (e.g. 50)"
                className="pl-8 h-9 text-sm"
              />
              <span className="absolute left-2.5 top-2 text-muted-foreground text-xs">
                {isAdd ? "+" : "−"}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reason / Note (Audit Log)</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Support ticket goodwill refund, tier manual correction..."
              rows={2}
              className="text-xs resize-none"
            />
          </div>
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
            onClick={handleCreditChange}
            disabled={loading}
            variant={isAdd ? "default" : "destructive"}
            size="sm"
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isAdd ? <Plus className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
            {isAdd ? "Confirm Add" : "Confirm Deduct"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
