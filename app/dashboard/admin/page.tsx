"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function AdminPage() {
  const [cheatSheet, setCheatSheet] = useState("")

  const handleSave = async () => {
    // In a real app, you would save this to the db
    localStorage.setItem("admin_cheat_sheet", cheatSheet)
    alert("Cheat sheet saved locally!")
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Admin Settings</h1>

      <div className="space-y-4 bg-zinc-900 p-6 rounded-xl border border-zinc-800">
        <h2 className="text-xl font-semibold">AI Builder Configuration</h2>

        <div className="space-y-2">
          <Label htmlFor="cheatsheet">Cheat Sheet (Context for Stage 1 Architect)</Label>
          <Textarea
            id="cheatsheet"
            placeholder="Paste your shadcn_library_complete.json or cheat sheet here..."
            className="min-h-[300px] font-mono text-xs"
            value={cheatSheet}
            onChange={(e) => setCheatSheet(e.target.value)}
          />
          <p className="text-xs text-zinc-400">
            This JSON represents the components the AI is allowed to use during the layout planning phase.
          </p>
        </div>

        <Button onClick={handleSave}>Save Settings</Button>
      </div>
    </div>
  )
}
