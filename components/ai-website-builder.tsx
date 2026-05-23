"use client"

import React, { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import {
  Loader2, ChevronDown, Sparkles, CheckCircle2, Send, Zap,
  Paperclip, X, Coins, Gem, Terminal, Code2, LayoutGrid, Files, Box, AlertCircle, Clock,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BEST_COST_PER_FILE, FAST_COST_PER_FILE, tierOf, formatCredits, type ModelTier } from "@/lib/credits"

interface ModelOption { id: string; name: string; provider: string; fast?: boolean }
const DEFAULT_MODEL_ID = "grok-4-1-fast-non-reasoning"
const MODELS: ModelOption[] = [
  { id: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast", provider: "xAI", fast: true },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B Free", provider: "OpenRouter" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "DeepSeek", fast: true },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash", provider: "Google", fast: true },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "Google" },
]

export interface GeneratedPage { name: string; code: string; timestamp: number; usedFor?: string }
interface ChatMessage { id: string; role: "user" | "system" | "step"; content: string; stepTitle?: string; timestamp: number }
interface HistoryEntry { prompt: string; model: string; timestamp: number; files: string[]; steps: Array<{ title: string; content: string }> }

const stepIcons: Record<string, React.ReactNode> = {
  "step-1": <Terminal className="h-3.5 w-3.5 text-zinc-400" />,
  "step-2": <LayoutGrid className="h-3.5 w-3.5 text-blue-400" />,
  "step-3": <Code2 className="h-3.5 w-3.5 text-emerald-400" />,
  "step-4": <Box className="h-3.5 w-3.5 text-amber-400" />,
}

function ChatBubble({ msg }: { msg: ChatMessage }) {
  const isUser = msg.role === "user"
  const isStep = msg.role === "step"
  return (
    <div className={cn("flex gap-2.5 w-full", isUser ? "justify-end" : "justify-start")}>
      {!isUser && <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5"><Sparkles className="h-3.5 w-3.5 text-blue-400" /></div>}
      <div className={cn("max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed", isUser ? "bg-blue-500/15 border border-blue-500/20 text-blue-100" : isStep ? "bg-zinc-800/50 border border-white/5 text-zinc-300 w-full max-w-full" : "bg-white/5 border border-white/10 text-zinc-200")}>
        {isStep && msg.stepTitle && (
          <div className="flex items-center gap-1.5 mb-1.5">
            {(stepIcons as any)[msg.id] || <AlertCircle className="h-3.5 w-3.5 text-zinc-500" />}
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">{msg.stepTitle}</span>
          </div>
        )}
        {isStep ? <pre className="text-[11px] font-mono whitespace-pre-wrap leading-relaxed text-zinc-400">{msg.content}</pre> : <div className="whitespace-pre-wrap">{msg.content}</div>}
        <div className="text-[10px] text-zinc-600 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString()}</div>
      </div>
      {isUser && <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0 mt-0.5 text-[11px] font-bold text-blue-300">You</div>}
    </div>
  )
}

const InputBar = ({ input, setInput, onSend, disabled, selectedModel, setSelectedModel, attachments, setAttachments, credits, bestCost, fastCost, hasMessages }: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean
  selectedModel: ModelOption; setSelectedModel: (m: ModelOption) => void
  attachments: File[]; setAttachments: React.Dispatch<React.SetStateAction<File[]>>
  credits: number | null; bestCost: number; fastCost: number; hasMessages: boolean
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedTier = tierOf(selectedModel)
  const insufficient = credits !== null && (selectedTier === "best" ? bestCost : fastCost) > credits
  return (
    <div className={cn("w-full mx-auto px-3 sm:px-4", hasMessages ? "max-w-3xl" : "max-w-2xl")}>
      <div className="relative group">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-zinc-700/50 via-zinc-600/30 to-zinc-700/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-end gap-2 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 shadow-2xl">
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            <textarea placeholder={hasMessages ? "Describe changes or a new page..." : "Describe the website you want to build..."} className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none px-3 py-2 min-h-[40px] max-h-32" rows={1} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() } }} disabled={disabled} />
            {attachments.length > 0 && <div className="flex flex-wrap gap-1.5 px-3 pb-1">{attachments.map((f,i) => <div key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/[0.06] border border-white/[0.06] rounded-full text-zinc-400">{f.name.slice(0,20)}<button onClick={() => setAttachments(prev => prev.filter((_,j) => j!==i))} className="hover:text-zinc-200"><X className="h-2.5 w-2.5" /></button></div>)}</div>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={e => { if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)]) }} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-300 rounded-lg" onClick={() => fileInputRef.current?.click()}><Paperclip className="h-3.5 w-3.5" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg px-2 text-[11px]">{selectedModel.name.slice(0,14)}<ChevronDown className="h-3 w-3 opacity-50" /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5 bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl">
                <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5"><Gem className="h-3 w-3" /> Best<span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(bestCost)}</span></div>
                {MODELS.filter(m => !m.fast).map(m => <ModelBtn key={m.id} model={m} selected={selectedModel.id===m.id} onSelect={() => setSelectedModel(m)} tier="best" />)}
                <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mt-1"><Zap className="h-3 w-3" /> Fast<span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(fastCost)}</span></div>
                {MODELS.filter(m => m.fast).map(m => <ModelBtn key={m.id} model={m} selected={selectedModel.id===m.id} onSelect={() => setSelectedModel(m)} tier="fast" />)}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={onSend} className={cn("h-8 w-8 sm:h-9 sm:w-9 rounded-lg p-0 shadow-none transition-all active:scale-95 shrink-0", input.trim() && !disabled && !insufficient ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800/50 text-zinc-700")} disabled={!input.trim() || disabled || insufficient}>{disabled ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ModelBtn = ({ model, selected, onSelect, tier }: { model: ModelOption; selected: boolean; onSelect: () => void; tier: ModelTier }) => (
  <DropdownMenuItem onClick={onSelect} className={cn("text-xs rounded-xl px-2.5 py-2 flex items-center gap-2.5 border", selected ? "text-white bg-white/[0.10] border-white/20" : "text-zinc-300 border-transparent hover:bg-white/[0.05] hover:border-white/10")}>
    {tier === "fast" ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" /> : <Gem className="h-3 w-3 text-violet-400 shrink-0" />}
    <span className="flex-1 min-w-0 truncate">{model.name}</span>
    <span className="text-[10px] text-zinc-500 shrink-0 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{model.provider}</span>
    {selected && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
  </DropdownMenuItem>
)

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
  onDeploy?: () => void
}

const AIWebsiteBuilder = ({ projectId, generatedPages, setGeneratedPages, onDeploy }: AIWebsiteBuilderProps) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState(FAST_COST_PER_FILE)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const chatRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let c = false
    const load = async () => {
      try { const r = await fetch("/api/user/credits"); if (!c && r.ok) { const d = await r.json(); if (!c) { if (typeof d?.credits === "number") setCredits(d.credits); if (typeof d?.bestCost === "number") setBestCost(d.bestCost); if (typeof d?.fastCost === "number") setFastCost(d.fastCost) } } } catch {}
      try { const r = await fetch(`/api/ai/build?projectId=${projectId}&history=1`); if (!c && r.ok) { const d = await r.json(); if (!c && d.history) setHistory(d.history) } } catch {}
    }
    load()
    return () => { c = true }
  }, [projectId])

  useEffect(() => { if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight }, [messages])

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: input, timestamp: Date.now() }
    setMessages(prev => [...prev, userMsg])
    setIsLoading(true)
    const ct = new AbortController(); abortRef.current = ct
    const hasExistingFiles = generatedPages.length > 0
    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: input, projectId, modelId: selectedModel.id, provider: selectedModel.provider, mode: hasExistingFiles ? "edit" : "generate" }),
        signal: ct.signal,
      })
      if (!res.ok) { setMessages(p => [...p, { id: `err-${Date.now()}`, role: "step", stepTitle: "❌ API Error", content: `Server returned ${res.status}`, timestamp: Date.now() }]); setIsLoading(false); setInput(""); return }
      const reader = res.body?.getReader()
      if (!reader) { setIsLoading(false); setInput(""); return }
      const dec = new TextDecoder(); let buf = ""
      const proc = (line: string) => {
        if (!line.startsWith("event: ")) return
        const dataIdx = line.indexOf("data: ")
        if (dataIdx === -1) return
        const evt = line.slice(7, line.indexOf("\n")).trim()
        let data: any = {}
        try { data = JSON.parse(line.slice(dataIdx + 6)) } catch {}
        if (evt === "step") setMessages(p => [...p, { id: data.id || `s-${Date.now()}`, role: "step", stepTitle: data.title || "Step", content: data.content || "", timestamp: data.timestamp || Date.now() }])
        else if (evt === "page") setGeneratedPages(p => { const ex = p.find(g => g.name === data.name); return ex ? p.map(g => g.name === data.name ? { ...g, code: data.code, usedFor: data.usedFor, timestamp: data.timestamp } : g).filter(g => g.code !== "DELETE" && !g.code.startsWith("MOVE_TO:")) : data.code ? [...p, { name: data.name, code: data.code, usedFor: data.usedFor, timestamp: data.timestamp }] : p })
        else if (evt === "error") setMessages(p => [...p, { id: `err-${Date.now()}`, role: "step", stepTitle: "❌ Error", content: data.message || JSON.stringify(data), timestamp: Date.now() }])
        else if (evt === "done") { setIsLoading(false); setInput("") }
      }
      while (true) { const { done, value } = await reader.read(); if (done) break; buf += dec.decode(value, { stream: true }); const lines = buf.split("\n\n"); buf = lines.pop() || ""; for (const l of lines) proc(l.trim()) }
      if (buf.trim()) buf.split("\n\n").forEach(l => proc(l.trim()))
    } catch (e: any) { if (e.name === "AbortError") return; setMessages(p => [...p, { id: `err-${Date.now()}`, role: "step", stepTitle: "❌ Network Error", content: e.message || "Failed", timestamp: Date.now() }]) }
    finally { setIsLoading(false); setInput(""); abortRef.current = null }
    // Reload history
    try { const r = await fetch(`/api/ai/build?projectId=${projectId}&history=1`); if (r.ok) { const d = await r.json(); if (d.history) setHistory(d.history) } } catch {}
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      {hasMessages ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div ref={chatRef} className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 space-y-3">
            {history.length > 0 && messages.length <= 1 && (
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2"><Clock className="h-3.5 w-3.5 text-zinc-600" /><span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">Recent builds</span></div>
                {history.slice(0, 5).map((h, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02] rounded-md cursor-pointer transition-colors" onClick={() => { setInput(h.prompt) }}>
                    <span className="truncate flex-1">{h.prompt.slice(0, 80)}</span>
                    <span className="shrink-0 tabular-nums">{h.files.length} file{h.files.length!==1?"s":""}</span>
                  </div>
                ))}
              </div>
            )}
            {messages.map(m => <ChatBubble key={m.id} msg={m} />)}
            {isLoading && <div className="flex items-center gap-2 px-2"><Loader2 className="h-4 w-4 animate-spin text-blue-400" /><span className="text-xs text-zinc-500">Generating...</span></div>}
          </div>
          <div className="w-full pb-4 sm:pb-6 pt-2 border-t border-white/5">
            <InputBar input={input} setInput={setInput} onSend={handleSend} disabled={isLoading} selectedModel={selectedModel} setSelectedModel={setSelectedModel} attachments={attachments} setAttachments={setAttachments} credits={credits} bestCost={bestCost} fastCost={fastCost} hasMessages={hasMessages} />
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4">
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">Hi {userName},</h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">What are we building?</h2>
            </div>
            {generatedPages.length > 0 && <p className="text-sm text-zinc-500 mt-6 flex items-center gap-2"><Files className="h-3.5 w-3.5" />{generatedPages.length} file{generatedPages.length!==1?"s":""} in project</p>}
            {history.length > 0 && (
              <div className="mt-6 w-full max-w-md text-left">
                <div className="flex items-center gap-2 mb-2 px-1"><Clock className="h-3.5 w-3.5 text-zinc-600" /><span className="text-[11px] font-semibold text-zinc-600 uppercase tracking-wider">Last 50 builds</span></div>
                <div className="max-h-48 overflow-y-auto custom-scrollbar space-y-0.5">
                  {history.slice(0, 50).map((h, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-[11px] text-zinc-600 hover:text-zinc-400 hover:bg-white/[0.02] rounded-md cursor-pointer transition-colors" onClick={() => { setInput(h.prompt) }}>
                      <span className="truncate flex-1">{h.prompt.slice(0, 80)}</span>
                      <span className="shrink-0 tabular-nums">{h.files.length}f · {new Date(h.timestamp).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="w-full pb-8 sm:pb-12">
            <InputBar input={input} setInput={setInput} onSend={handleSend} disabled={isLoading} selectedModel={selectedModel} setSelectedModel={setSelectedModel} attachments={attachments} setAttachments={setAttachments} credits={credits} bestCost={bestCost} fastCost={fastCost} hasMessages={hasMessages} />
          </div>
        </div>
      )}
    </div>
  )
}

export default AIWebsiteBuilder
