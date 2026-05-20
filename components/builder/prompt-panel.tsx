"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useBuilderState } from "./builder-state"
import type { BuilderPatch } from "@/lib/ai-ui-builder/document/patches"
import type { BuilderDocument } from "@/lib/ai-ui-builder/document/types"

interface StreamMessage {
  type: "patch" | "patches" | "document" | "error" | "done"
  patch?: BuilderPatch
  patches?: BuilderPatch[]
  document?: BuilderDocument
  message?: string
}

export function PromptPanel() {
  const { document, selectedNodeId, applyPatch, applyPatches, setDocument } = useBuilderState()
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStreamMessage = (message: StreamMessage) => {
    if (message.type === "patch" && message.patch) applyPatch(message.patch)
    if (message.type === "patches" && message.patches) applyPatches(message.patches)
    if (message.type === "document" && message.document) setDocument(message.document)
    if (message.type === "error") setError(message.message ?? "Stream error")
  }

  const sendPrompt = async () => {
    if (!prompt.trim()) return
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/builder/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          document,
          selectedNodeId,
          quality: selectedNodeId ? "fast" : "best",
        }),
      })
      if (!response.body) {
        setError("Streaming not supported")
        return
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          try {
            const payload = JSON.parse(trimmed) as StreamMessage
            handleStreamMessage(payload)
          } catch {
            continue
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Stream failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Prompt</div>
      <Textarea
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Describe the change you want..."
        className="min-h-[120px]"
      />
      <div className="flex items-center gap-2">
        <Button onClick={sendPrompt} disabled={loading}>
          {loading ? "Streaming..." : "Send prompt"}
        </Button>
        {error ? <span className="text-xs text-red-500">{error}</span> : null}
      </div>
    </div>
  )
}
