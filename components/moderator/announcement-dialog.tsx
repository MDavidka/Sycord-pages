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
import { Megaphone, Loader2 } from "lucide-react"

interface AnnouncementDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AnnouncementDialog({
  open,
  onOpenChange,
  onSuccess,
}: AnnouncementDialogProps) {
  const [title, setTitle] = useState("")
  const [message, setMessage] = useState("")
  const [type, setType] = useState<"info" | "maintenance" | "warning" | "important">("info")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !message.trim()) {
      toast.error("Please provide both title and message")
      return
    }

    setLoading(true)
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          type,
        }),
      })

      const data = await res.json()
      if (data.ok) {
        toast.success("Server announcement published successfully!")
        onOpenChange(false)
        setTitle("")
        setMessage("")
        setType("info")
        onSuccess()
      } else {
        toast.error(`Failed to publish announcement: ${data.error || "Unknown error"}`)
      }
    } catch (err: any) {
      toast.error(`Error publishing announcement: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-muted-foreground" />
            New Server Announcement
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Broadcast a platform-wide announcement to all active users on their dashboard.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Scheduled Maintenance Notice"
              className="h-9 text-xs"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Severity / Type</label>
            <select
              value={type}
              onChange={(e: any) => setType(e.target.value)}
              className="w-full bg-input/30 border border-input text-foreground h-9 rounded-md px-3 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="info">Info (Standard)</option>
              <option value="maintenance">Maintenance (Scheduled Downtime)</option>
              <option value="warning">Warning (Degraded Performance)</option>
              <option value="important">Important (Urgent Update)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Details about the update, ETA, or changes..."
              rows={4}
              className="text-xs resize-none"
              required
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0 pt-2">
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
              type="submit"
              disabled={loading || !title.trim() || !message.trim()}
              variant="default"
              size="sm"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Publish Announcement
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
