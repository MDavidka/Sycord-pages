"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Check, X, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { useConfigStore } from "@/components/builder/store/config-store"
import { useEditorStore } from "@/components/builder/store/editor-store"
import { blockMetadata } from "@/lib/builder/block-metadata"
import { themePresets } from "@/lib/builder/theme-presets"
import type { BlockConfig } from "@/lib/builder/types"

interface ChatMessage {
  id: string
  role: "user" | "agent"
  text: string
  applied?: boolean
  patch?: {
    path: string
    blockId?: string
    propKey?: string
    value?: string
    added?: string[]
    removed?: string[]
  }
}

const initialMessages: ChatMessage[] = [
  {
    id: "1",
    role: "agent",
    text: "Hi! I can help you build and modify your site. Try asking me to add sections, change content, or tweak styles. Use \"Generate full site\" above for a complete AI build.",
  },
]

function TypingIndicator() {
  return (
    <div className="self-start flex gap-1 px-4 py-3 bg-accent rounded-2xl rounded-bl-sm border border-border">
      <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 thinking-dot-1" />
      <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 thinking-dot-2" />
      <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 thinking-dot-3" />
    </div>
  )
}

type AgentResult =
  | ChatMessage
  | { action: "addBlock"; block: BlockConfig; message: string }
  | { action: "removeBlock"; blockId: string; message: string }
  | { action: "changeVariant"; blockId: string; variant: string; message: string }
  | { action: "changeTheme"; themeId: string; message: string }

function generateResponse(input: string, blocks: { id: string; type: string; variant: string; props: Record<string, unknown> }[]): AgentResult {
  const lower = input.toLowerCase()
  const heroBlock = blocks.find((b) => b.type === "hero")

  if (lower.includes("change") && lower.includes("headline") && heroBlock) {
    const match = input.match(/["'](.+?)["']/) || input.match(/to\s+(.+)/i)
    const newHeadline = match?.[1]?.trim() || "Your New Headline"
    const oldHeadline = String(heroBlock.props.headline || "Build websites with JSON")
    return {
      id: `msg-${Date.now()}`,
      role: "agent",
      text: "I'll update the hero headline for you.",
      patch: { path: `blocks[${blocks.indexOf(heroBlock)}].props.headline`, blockId: heroBlock.id, propKey: "headline", value: newHeadline, removed: [`"${oldHeadline}"`], added: [`"${newHeadline}"`] },
    }
  }

  const addMatch = lower.match(/add\s+(?:a\s+)?(\w+)/)
  if (addMatch) {
    const blockType = addMatch[1].replace(/s$/, "")
    const meta = blockMetadata.find((b) => b.type === blockType || b.label.toLowerCase().includes(blockType))
    if (meta) {
      const block: BlockConfig = { id: `block-${Date.now()}`, type: meta.type, variant: meta.variants[0], props: { ...meta.defaultProps } }
      return { action: "addBlock", block, message: `Adding a ${meta.label} block.` }
    }
  }

  const removeMatch = lower.match(/(?:remove|delete)\s+(?:the\s+)?(\w+)/)
  if (removeMatch) {
    const blockType = removeMatch[1].replace(/s$/, "")
    const found = blocks.find((b) => b.type === blockType || b.type.includes(blockType))
    if (found) return { action: "removeBlock", blockId: found.id, message: `Removing the ${found.type} block.` }
  }

  const variantMatch = lower.match(/(?:make|change|switch)\s+(?:the\s+)?(\w+)\s+(?:to\s+|a\s+)?(\w+)/)
  if (variantMatch) {
    const blockType = variantMatch[1]
    const variant = variantMatch[2]
    const found = blocks.find((b) => b.type === blockType || b.type.includes(blockType))
    if (found) {
      const meta = blockMetadata.find((b) => b.type === found.type)
      const matchedVariant = meta?.variants.find((v) => v.includes(variant))
      if (matchedVariant) return { action: "changeVariant", blockId: found.id, variant: matchedVariant, message: `Changing ${found.type} to ${matchedVariant} variant.` }
    }
  }

  const themeMatch = lower.match(/(?:make it|switch to|use|apply)\s+(?:the\s+)?(\w+)\s*(?:theme)?/)
  if (themeMatch) {
    const themeName = themeMatch[1]
    const preset = themePresets.find((p) => p.id.includes(themeName) || p.name.toLowerCase().includes(themeName))
    if (preset) return { action: "changeTheme", themeId: preset.id, message: `Switching to the ${preset.name} theme.` }
  }

  return {
    id: `msg-${Date.now()}`,
    role: "agent",
    text: 'I can help with your site. Try:\n- "Change the headline to \'New Title\'"\n- "Add a pricing section"\n- "Remove the FAQ"\n- "Make the hero a split layout"\n- "Switch to ocean theme"',
  }
}

export function AgentPanel({ onGenerateSite }: { onGenerateSite?: (prompt: string) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [input, setInput] = useState("")
  const [showTyping, setShowTyping] = useState(false)
  const updateBlockProps = useConfigStore((s) => s.updateBlockProps)
  const addBlock = useConfigStore((s) => s.addBlock)
  const removeBlock = useConfigStore((s) => s.removeBlock)
  const updateBlock = useConfigStore((s) => s.updateBlock)
  const setTheme = useConfigStore((s) => s.setTheme)
  const setGenerating = useEditorStore((s) => s.setGenerating)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, showTyping])

  function handleApply(msg: ChatMessage) {
    if (!msg.patch?.blockId || !msg.patch?.propKey || !msg.patch?.value) {
      toast.error("Cannot apply: missing patch data")
      return
    }
    updateBlockProps(msg.patch.blockId, { [msg.patch.propKey]: msg.patch.value })
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, applied: true } : m)))
    toast("Patch applied")
  }

  function handleReject(msg: ChatMessage) {
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, applied: false, patch: undefined } : m)))
    toast("Patch rejected")
  }

  function handleSend() {
    const text = input.trim()
    if (!text) return

    const userMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "user", text }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setShowTyping(true)

    setTimeout(() => {
      const state = useConfigStore.getState()
      const pages = state.config.pages
      const currentBlocks = pages && pages.length > 0 ? (pages.find((p) => p.id === state.activePageId) ?? pages[0]).blocks : state.config.blocks
      const response = generateResponse(text, currentBlocks)
      setShowTyping(false)

      if ("action" in response) {
        const agentMsg: ChatMessage = { id: `msg-${Date.now()}`, role: "agent", text: response.message }
        setMessages((prev) => [...prev, agentMsg])

        if (response.action === "addBlock") {
          addBlock(response.block)
          toast(`${response.block.type} block added`)
        } else if (response.action === "removeBlock") {
          removeBlock(response.blockId)
          toast("Block removed")
        } else if (response.action === "changeVariant") {
          updateBlock(response.blockId, { variant: response.variant })
          toast(`Variant changed to ${response.variant}`)
        } else if (response.action === "changeTheme") {
          const preset = themePresets.find((p) => p.id === response.themeId)
          if (preset) {
            setTheme(preset.theme)
            toast(`Theme changed to ${preset.name}`)
          }
        }
      } else {
        setMessages((prev) => [...prev, response])
      }
    }, 600 + Math.random() * 500)
  }

  function handleHint(hint: string) {
    setInput(hint)
  }

  function handleGenerate() {
    const text = input.trim()
    if (!text) {
      toast.error("Describe the site you want to build first")
      return
    }
    setInput("")
    if (onGenerateSite) onGenerateSite(text)
    else setGenerating(text)
  }

  return (
    <div className="flex flex-col flex-1 overflow-hidden min-h-0">
      <div className="p-2.5 border-b border-border">
        <button onClick={handleGenerate} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-[12.5px] font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-1.5">
          <Sparkles size={14} />
          Generate full site with AI
        </button>
        <p className="text-[10.5px] text-muted-foreground/70 mt-1.5 text-center">Type a description below, then generate or quick-edit.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5 custom-scrollbar">
        {messages.map((msg) => (
          <div key={msg.id} className={`max-w-[94%] px-3 py-2.5 rounded-2xl text-[12.5px] leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "self-end bg-muted text-foreground rounded-br-sm" : "self-start bg-accent text-foreground rounded-bl-sm border border-border"}`}>
            {msg.text}
            {msg.patch && (
              <div className="bg-background border border-border rounded-lg p-2 mt-2 font-mono text-[10.5px] leading-relaxed">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-sans text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground/70">JSON Patch</span>
                  {!msg.applied && (
                    <div className="flex gap-1">
                      <button onClick={() => handleApply(msg)} className="px-1.5 py-0.5 rounded-md text-[9.5px] bg-primary/15 text-foreground hover:bg-primary/25 transition-colors flex items-center gap-0.5"><Check size={9} /> Apply</button>
                      <button onClick={() => handleReject(msg)} className="px-1.5 py-0.5 rounded-md text-[9.5px] bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors flex items-center gap-0.5"><X size={9} /> Reject</button>
                    </div>
                  )}
                  {msg.applied && <span className="text-[9.5px] text-foreground/80 font-medium flex items-center gap-0.5"><Check size={9} /> Applied</span>}
                </div>
                <div className="text-muted-foreground/70 text-[10px] mb-1">{msg.patch.path}</div>
                {msg.patch.removed?.map((line, i) => (
                  <div key={`r-${i}`} className="text-destructive/80 line-through opacity-70">- {line}</div>
                ))}
                {msg.patch.added?.map((line, i) => (
                  <div key={`a-${i}`} className="text-emerald-400">+ {line}</div>
                ))}
              </div>
            )}
          </div>
        ))}
        {showTyping && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-2.5 border-t border-border">
        <div className="frosted-input rounded-xl flex gap-1.5 p-1 items-center">
          <input
            type="text"
            placeholder="Ask the agent or describe a site..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSend() }}
            className="flex-1 px-2.5 py-1.5 bg-transparent text-foreground text-[13px] outline-none placeholder:text-muted-foreground/60"
          />
          <button onClick={handleSend} className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground shrink-0 hover:opacity-90 transition-opacity" aria-label="Send message">
            <Send size={14} />
          </button>
        </div>
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {["Change the headline", "Add a pricing section", "Make the hero split", "Switch to ocean theme"].map((hint) => (
            <span key={hint} onClick={() => handleHint(hint)} className="px-2 py-0.5 rounded-full text-[10.5px] text-muted-foreground border border-border bg-muted/40 cursor-pointer hover:border-foreground/20 hover:text-foreground hover:bg-accent transition-all">
              {hint}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
