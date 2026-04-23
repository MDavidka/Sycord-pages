"use client";
import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_AI_BUILDER_CHEATSHEET, DEFAULT_HANDLING_CONVERTER_CHEATSHEET } from "@/lib/default-cheat-sheet";

export default function AdminPage() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = useState<'ai' | 'converter'>('ai')

  const [aiCheatSheet, setAiCheatSheet] = useState(DEFAULT_AI_BUILDER_CHEATSHEET)
  const [converterCheatSheet, setConverterCheatSheet] = useState(DEFAULT_HANDLING_CONVERTER_CHEATSHEET)
  const [loading, setLoading] = useState(false)
  const [saveStatus, setSaveStatus] = useState('')

  useEffect(() => {
    async function fetchPrompts() {
      try {
        const res = await fetch('/api/admin/prompts')
        if (res?.ok) {
          const data = await res?.json()
          if (data?.aiCheatSheet) setAiCheatSheet(data?.aiCheatSheet)
          if (data?.converterCheatSheet) setConverterCheatSheet(data?.converterCheatSheet)
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchPrompts()
  }, [])

  const handleSave = async () => {
    setLoading(true)
    setSaveStatus('Saving...')
    try {
      const res = await fetch('/api/admin/prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aiCheatSheet, converterCheatSheet })
      })
      if (res?.ok) {
        setSaveStatus('Saved successfully!')
      } else {
        setSaveStatus('Failed to save.')
      }
    } catch (err) {
      setSaveStatus('Error saving.')
    }
    setLoading(false)
    setTimeout(() => setSaveStatus(''), 3000)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto text-white">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard: Cheat Sheets</h1>
      <div className="flex gap-4 mb-4">
        <Button
          variant={activeTab === 'ai' ? 'default' : 'outline'}
          onClick={() => setActiveTab('ai')}
        >
          AI Builder Cheat Sheet (JSON Docs)
        </Button>
        <Button
          variant={activeTab === 'converter' ? 'default' : 'outline'}
          onClick={() => setActiveTab('converter')}
        >
          Handling Converter (Code Map)
        </Button>
      </div>
      <div className="mb-4">
        {activeTab === 'ai' ? (
          <div>
            <p className="text-sm text-zinc-400 mb-2">This JSON describes the 43 components and their props. The Architect AI uses this to build UI structures.</p>
            <Textarea
              value={aiCheatSheet}
              onChange={e => setAiCheatSheet(e?.target?.value)}
              className="font-mono text-sm h-[500px] bg-zinc-900 border-zinc-700"
            />
          </div>
        ) : (
          <div>
            <p className="text-sm text-zinc-400 mb-2">This maps component names to their actual React/Tailwind implementation code. Used by the non-AI orchestrator.</p>
            <Textarea
              value={converterCheatSheet}
              onChange={e => setConverterCheatSheet(e?.target?.value)}
              className="font-mono text-sm h-[500px] bg-zinc-900 border-zinc-700"
            />
          </div>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={loading}>Save Changes</Button>
        {saveStatus && <span className="text-sm text-zinc-400">{saveStatus}</span>}
      </div>
    </div>
  );
}
