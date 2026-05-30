"use client"

import React, { useState, useRef, useEffect, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Loader2,
  ChevronDown,
  Sparkles,
  CheckCircle2,
  Send,
  Zap,
  Paperclip,
  X,
  Coins,
  Gem,
  FileText,
  AlertCircle,
  Clock,
  Brain,
  Wrench,
  FileCode,
  FolderOpen,
  Eye,
  Copy,
  Check,
  ChevronRight,
  Code2,
  Terminal,
  Layers,
  Palette,
  Package,
  ShieldCheck,
  PenTool,
  PlayCircle,
  Rocket,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BEST_COST_PER_FILE, FAST_COST_PER_FILE, tierOf, formatCredits, type ModelTier } from "@/lib/credits"

interface ModelOption {
  id: string
  name: string
  provider: string
  fast?: boolean
}

const DEFAULT_MODEL_ID = "grok-4-1-fast-non-reasoning"

const MODELS: ModelOption[] = [
  { id: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast", provider: "xAI", fast: true },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B Free", provider: "OpenRouter" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash", provider: "DeepSeek", fast: true },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro", provider: "DeepSeek" },
  { id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash", provider: "Google", fast: true },
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro", provider: "Google" },
]

export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
  usedFor?: string
}

interface StageStep {
  id: string
  stage: string
  title: string
  message: string
  status: "pending" | "running" | "done" | "error"
  timestamp: number
  mode?: string
  file?: string
  action?: string
  chars?: number
  changedFiles?: string[]
  fullFiles?: string[]
  summaryCount?: number
  cacheHit?: boolean
  memoryHit?: boolean
  revision?: string
  severity?: "error" | "warning" | "info"
  code?: string
  errors?: number
  retryable?: boolean
  filesToCreate?: Array<{ name: string; usedFor: string }>
  filesToModify?: Array<{ name: string; usedFor: string }>
  filesToDelete?: string[]
}

interface FileGenStatus {
  name: string
  status: "pending" | "generating" | "done" | "error"
  chars?: number
  usedFor?: string
}

const STAGE_LABELS: Record<string, string> = {
  starting: "Starting",
  intent: "Understanding request",
  memory: "Reading project memory",
  context: "Selecting relevant files",
  planning: "Planning changes",
  writing: "Writing files",
  validating: "Validating project",
  repair: "Auto-repairing",
  saving: "Saving project",
  cache: "Cache",
}

const STAGE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  starting: Sparkles,
  memory: Brain,
  planning: PenTool,
  writing: Code2,
  validating: ShieldCheck,
  repair: Wrench,
  saving: Package,
  cache: Layers,
}

const InputBar = ({
  input, setInput, onSend, disabled,
  selectedModel, setSelectedModel,
  attachments, setAttachments,
  credits, bestCost, fastCost,
}: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean
  selectedModel: ModelOption; setSelectedModel: (m: ModelOption) => void
  attachments: File[]; setAttachments: React.Dispatch<React.SetStateAction<File[]>>
  credits: number | null; bestCost: number; fastCost: number
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectedTier: ModelTier = tierOf(selectedModel)
  const selectedCost = selectedTier === "best" ? bestCost : fastCost
  const insufficient = credits !== null && selectedCost > credits

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4">
      <div className="relative group">
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-r from-zinc-700/50 via-zinc-600/30 to-zinc-700/50 opacity-0 group-focus-within:opacity-100 transition-opacity duration-300" />
        <div className="relative flex items-end gap-2 bg-zinc-900/80 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-2 shadow-2xl">
          <div className="flex-1 flex flex-col gap-1 min-h-0">
            <textarea
              placeholder="Describe what you want to build or change..."
              className="w-full resize-none bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none px-3 py-2 min-h-[40px] max-h-32"
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() }
              }}
              disabled={disabled}
            />
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-1">
                {attachments.map((file, i) => (
                  <div key={i} className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] bg-white/[0.06] border border-white/[0.06] rounded-full text-zinc-400">
                    {file.name.slice(0, 20)}
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} className="hover:text-zinc-200"><X className="h-2.5 w-2.5" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
              if (e.target.files) setAttachments(prev => [...prev, ...Array.from(e.target.files!)])
            }} />
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-300 rounded-lg" onClick={() => fileInputRef.current?.click()}>
                    <Paperclip className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Attach files (txt, md, json, ts, tsx, css)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <div className="relative">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg px-2 text-[11px]">
                    {selectedModel.name.slice(0, 14)}
                    <ChevronDown className="h-3 w-3 opacity-50" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 p-1.5 bg-zinc-900/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl">
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5">
                    <Gem className="h-3 w-3" /> Best
                    <span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">-{formatCredits(bestCost)}</span>
                  </div>
                  {MODELS.filter(m => !m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="best" />
                  ))}
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mt-1">
                    <Zap className="h-3 w-3" /> Fast
                    <span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">-{formatCredits(fastCost)}</span>
                  </div>
                  {MODELS.filter(m => m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="fast" />
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {credits !== null && (
              <div className={cn("hidden sm:inline-flex items-center gap-1 h-6 px-2 rounded-full text-[10px] font-semibold tabular-nums shrink-0", insufficient ? "bg-rose-500/10 text-rose-300" : "bg-white/[0.04] text-zinc-400")} title={`${formatCredits(credits)} credits remaining`}>
                <Coins className="h-3 w-3" /> {formatCredits(credits)}
              </div>
            )}

            <Button onClick={onSend} className={cn("h-8 w-8 sm:h-9 sm:w-9 transition-all active:scale-95 shrink-0 shadow-none rounded-lg p-0", input.trim() && !disabled && !insufficient ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-800/50 text-zinc-700")} disabled={!input.trim() || disabled || insufficient}>
              {disabled ? <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin text-zinc-700" /> : <Send className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

const ModelRow = ({ model, selected, onSelect, tier }: { model: ModelOption; selected: boolean; onSelect: () => void; tier: ModelTier }) => (
  <DropdownMenuItem onClick={onSelect} className={cn("text-xs rounded-xl px-2.5 py-2 flex items-center gap-2.5 border transition-all", selected ? "text-white bg-white/[0.10] border-white/20" : "text-zinc-300 border-transparent hover:bg-white/[0.05] hover:border-white/10")}>
    {tier === "fast" ? <Zap className="h-3 w-3 text-yellow-400 shrink-0" /> : <Gem className="h-3 w-3 text-violet-400 shrink-0" />}
    <span className="flex-1 min-w-0 truncate">{model.name}</span>
    <span className="text-[10px] text-zinc-500 shrink-0 px-1.5 py-0.5 rounded bg-white/[0.04] border border-white/[0.06]">{model.provider}</span>
    {selected && <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />}
  </DropdownMenuItem>
)

function parseSSEChunk(chunk: string): Array<{ event: string; data: any }> {
  const results: Array<{ event: string; data: any }> = []
  const parts = chunk.split("\n\n")
  for (const part of parts) {
    if (!part.trim()) continue
    const lines = part.split("\n")
    let event = ""
    let data = ""
    for (const line of lines) {
      if (line.startsWith("event: ")) event = line.slice(7).trim()
      else if (line.startsWith("data: ")) data = line.slice(6)
    }
    if (event && data) {
      try { results.push({ event, data: JSON.parse(data) }) }
      catch { /* skip malformed */ }
    }
  }
  return results
}

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
  onDeploy?: () => void
  hasExistingFiles?: boolean
}

const AIWebsiteBuilder = ({ projectId, generatedPages, setGeneratedPages, onDeploy, hasExistingFiles }: AIWebsiteBuilderProps) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(" ")[0] || "there"

  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [buildSteps, setBuildSteps] = useState<StageStep[]>([])
  const [fileStatuses, setFileStatuses] = useState<FileGenStatus[]>([])
  const [error, setError] = useState<string | null>(null)
  const [buildComplete, setBuildComplete] = useState(false)
  const [changedFiles, setChangedFiles] = useState<string[]>([])
  const [detectedMode, setDetectedMode] = useState<string | null>(null)
  const [planSummary, setPlanSummary] = useState<string | null>(null)
  const [planFiles, setPlanFiles] = useState<{ create: Array<{ name: string; usedFor: string }>; modify: Array<{ name: string; usedFor: string }>; delete: string[] } | null>(null)
  const [validationErrors, setValidationErrors] = useState<Array<{ file: string; code: string; message: string }>>([])
  const [repairPass, setRepairPass] = useState(0)
  const [expandedAccordion, setExpandedAccordion] = useState<string>("")

  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState<number>(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState<number>(FAST_COST_PER_FILE)

  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    let cancelled = false
    const loadCredits = async () => {
      try {
        const res = await fetch("/api/user/credits")
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (cancelled) return
        if (typeof data?.credits === "number") setCredits(data.credits)
        if (typeof data?.bestCost === "number") setBestCost(data.bestCost)
        if (typeof data?.fastCost === "number") setFastCost(data.fastCost)
      } catch { /* ignore */ }
    }
    loadCredits()
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const totalFiles = fileStatuses.length
  const completedFiles = fileStatuses.filter(f => f.status === "done").length
  const currentFile = fileStatuses.find(f => f.status === "generating")

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    setBuildSteps([])
    setFileStatuses([])
    setError(null)
    setBuildComplete(false)
    setChangedFiles([])
    setDetectedMode(null)
    setPlanSummary(null)
    setPlanFiles(null)
    setValidationErrors([])
    setRepairPass(0)
    setExpandedAccordion("")

    const controller = new AbortController()
    abortRef.current = controller

    const attachmentData: Array<{ name: string; type: string; text: string }> = []
    for (const file of attachments) {
      try {
        const text = await file.text()
        attachmentData.push({ name: file.name, type: file.type || "text/plain", text })
      } catch { /* skip binary/unreadable files */ }
    }

    try {
      const res = await fetch("/api/ai/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: input.trim(),
          projectId,
          modelId: selectedModel.id,
          provider: selectedModel.provider,
          mode: "auto",
          attachments: attachmentData,
        }),
        signal: controller.signal,
      })

      if (!res.ok) {
        setError(`Server returned ${res.status}`)
        setIsLoading(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) { setIsLoading(false); return }

      const decoder = new TextDecoder()
      let buffer = ""

      const upsertStep = (stage: string, status: StageStep["status"], title: string, message: string, extra?: Partial<StageStep>) => {
        const id = `syra-${stage}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

        if (stage === "writing" && extra?.file) {
          setFileStatuses(prev => {
            const existingIdx = prev.findIndex(f => f.name === extra!.file)
            if (existingIdx >= 0) {
              const updated = [...prev]
              updated[existingIdx] = {
                ...updated[existingIdx],
                status: status === "running" ? "generating" : status === "done" ? "done" : status === "error" ? "error" : "pending",
                chars: extra?.chars,
                usedFor: extra?.action,
              }
              return updated
            }
            return [...prev, {
              name: extra!.file!,
              status: "generating",
              chars: extra?.chars,
              usedFor: extra?.action,
            }]
          })
        }

        if (stage === "validating" && extra?.severity === "error" && extra?.file && extra?.code && extra?.message) {
          setValidationErrors(prev => [...prev, { file: extra.file!, code: extra.code!, message: extra.message! }])
        }
        if (stage === "repair" && status === "running") {
          setRepairPass(extra?.errors ?? 0)
        }
        if (stage === "planning" && extra?.mode) {
          setDetectedMode(extra.mode)
          setPlanSummary(message)
          const creates = (extra?.filesToCreate ?? []).map((f: { name: string; usedFor: string }) => ({ name: f.name, usedFor: f.usedFor || "" }))
          const mods = (extra?.filesToModify ?? []).map((f: { name: string; usedFor: string }) => ({ name: f.name, usedFor: f.usedFor || "" }))
          setPlanFiles({ create: creates, modify: mods, delete: extra?.filesToDelete ?? [] })
          const allFileNames = [...creates, ...mods].map(f => f.name)
          setFileStatuses(allFileNames.map(name => ({ name, status: "pending" as const })))
        }
        if (stage === "saving" && extra?.changedFiles) {
          setChangedFiles(extra.changedFiles)
        }

        setBuildSteps(prev => {
          const existingIdx = prev.findIndex(s => s.stage === stage && s.status === "running")
          if (existingIdx >= 0 && (status === "done" || status === "error")) {
            const updated = [...prev]
            updated[existingIdx] = { ...updated[existingIdx], ...extra, status, title, message } as StageStep
            return updated
          }
          const newStep: StageStep = { id, stage, title, message, status, timestamp: Date.now(), ...extra }
          return [...prev, newStep]
        })

        if (status === "running") {
          setExpandedAccordion(stage)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        const parts = buffer.split("\n\n")
        buffer = parts.pop() || ""

        for (const part of parts) {
          if (!part.trim()) continue
          const lines = part.split("\n")
          let event = ""
          let data = ""
          for (const line of lines) {
            if (line.startsWith("event: ")) event = line.slice(7).trim()
            else if (line.startsWith("data: ")) data = line.slice(6)
          }
          if (!event || !data) continue

          let parsed: any
          try { parsed = JSON.parse(data) } catch { continue }

          if (event === "stage") {
            upsertStep(parsed.stage || "unknown", parsed.status || "running", parsed.title || "", parsed.message || "", parsed)
          } else if (event === "memory") {
            upsertStep("memory", parsed.status || "done", parsed.title || "", parsed.message || "", parsed)
          } else if (event === "cache") {
            upsertStep("cache", "done", parsed.title || "Cache", "Cache operation", parsed)
          } else if (event === "plan") {
            upsertStep("planning", "done", parsed.title || "Plan ready", parsed.message || "", parsed)
          } else if (event === "file") {
            upsertStep("writing", parsed.status || "done", parsed.title || "", parsed.message || "", parsed)
            if (parsed.status === "done" && parsed.file) {
              setGeneratedPages(prev => {
                const idx = prev.findIndex(p => p.name === parsed.file)
                const page: GeneratedPage = {
                  name: parsed.file,
                  code: `// ${parsed.chars ? parsed.chars + " chars" : ""}`,
                  timestamp: Date.now(),
                  usedFor: parsed.action || "",
                }
                if (idx >= 0) {
                  const copy = [...prev]
                  copy[idx] = page
                  return copy
                }
                return [...prev, page]
              })
            }
          } else if (event === "diagnostic") {
            upsertStep("validating", parsed.severity === "error" ? "error" : "done", parsed.message || "Validation", parsed.message || "", parsed)
          } else if (event === "repair") {
            upsertStep("repair", parsed.status || "done", parsed.title || "", parsed.message || "", parsed)
          } else if (event === "saved") {
            upsertStep("saving", "done", parsed.title || "Saved", parsed.message || "", parsed)
          } else if (event === "error") {
            setError(parsed.message || "An error occurred")
            upsertStep(parsed.stage || "error", "error", parsed.title || "Error", parsed.message || "", parsed)
          } else if (event === "done") {
            setBuildComplete(true)
          }
        }
      }

      if (buffer.trim()) {
        for (const { event, data } of parseSSEChunk(buffer)) {
          if (event === "done") setBuildComplete(true)
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Connection failed")
      }
    } finally {
      setIsLoading(false)
      setInput("")
      setAttachments([])
    }
  }

  const isBuilding = isLoading || (buildSteps.length > 0 && buildSteps.some(s => s.status === "running"))

  const stageGroups = buildSteps.reduce<Record<string, StageStep[]>>((acc, step) => {
    if (!acc[step.stage]) acc[step.stage] = []
    acc[step.stage].push(step)
    return acc
  }, {})

  const stageOrder = ["starting", "memory", "cache", "intent", "context", "planning", "writing", "validating", "repair", "saving"]
  const currentRunningStage = buildSteps.find(s => s.status === "running")

  const fileProgress = totalFiles > 0 ? Math.min(100, Math.round((completedFiles / totalFiles) * 100)) : 0

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center px-3 sm:px-4 overflow-y-auto custom-scrollbar">
        {/* IDLE STATE */}
        {!isBuilding && buildSteps.length === 0 && !buildComplete && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="space-y-1 mb-6">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
                Hi {userName},
              </h1>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
                What are we building?
              </h2>
            </div>

            {hasExistingFiles && (
              <div className="flex items-center gap-2 mb-6">
                <Badge variant="secondary" className="gap-1.5">
                  <Brain className="h-3 w-3" />
                  {generatedPages.length} files in memory
                </Badge>
                <Badge variant="secondary" className="gap-1.5">
                  <Sparkles className="h-3 w-3" />
                  Editing existing project
                </Badge>
              </div>
            )}

            <div className="flex flex-wrap gap-2 justify-center">
              {[
                "Build a SaaS landing page",
                "Add pricing to this site",
                "Fix the latest deploy error",
                "Make it look premium",
              ].map((example) => (
                <button
                  key={example}
                  onClick={() => { if (!isLoading) { setInput(example) } }}
                  className="px-3 py-1.5 text-xs text-zinc-500 bg-white/[0.03] border border-white/[0.06] rounded-full hover:bg-white/[0.06] hover:text-zinc-300 transition-colors"
                >
                  {example}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* BUILD STATES */}
        {(isBuilding || buildSteps.length > 0 || buildComplete) && (
          <div className="flex-1 w-full max-w-2xl flex flex-col py-8 gap-4">
            {/* ─── CURRENTLY GENERATING CARD ─── */}
            {(isBuilding && (currentRunningStage || currentFile)) && (
              <Card className="border-white/[0.08] bg-zinc-900/70 overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {currentFile ? (
                        <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                      )}
                      <span className="text-xs uppercase tracking-wider text-zinc-400 font-semibold">
                        {currentFile ? "Currently generating" : currentRunningStage?.stage ? STAGE_LABELS[currentRunningStage.stage] || currentRunningStage.title : "Building"}
                      </span>
                    </div>
                    {detectedMode && (
                      <Badge variant={detectedMode === "edit" ? "secondary" : detectedMode === "fix" ? "destructive" : "default"}>
                        {detectedMode === "generate" ? "New Build" : detectedMode === "edit" ? "Edit" : detectedMode === "fix" ? "Fix" : detectedMode}
                      </Badge>
                    )}
                  </div>

                  {currentFile && (
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.04] p-4 mb-3">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 shrink-0">
                          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <FileCode className="h-4 w-4 text-amber-400" />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-amber-200 font-mono">{currentFile.name}</span>
                            <Badge variant="secondary" className="text-[10px] h-4">
                              {currentFile.usedFor || "updating"}
                            </Badge>
                          </div>
                          {currentFile.chars ? (
                            <span className="text-xs text-amber-400/60">{currentFile.chars.toLocaleString()} characters generated</span>
                          ) : (
                            <div className="flex items-center gap-2 mt-1">
                              <Loader2 className="h-3 w-3 animate-spin text-amber-400/60" />
                              <span className="text-xs text-amber-400/60">Generating code...</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* File progress bar */}
                  {totalFiles > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">{completedFiles} of {totalFiles} files written</span>
                        <span className="text-zinc-600">{fileProgress}%</span>
                      </div>
                      <Progress value={fileProgress} className="h-1.5" />
                    </div>
                  )}

                  {/* File status pills */}
                  {fileStatuses.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {fileStatuses.map((f) => {
                        const isGenerating = f.status === "generating"
                        const isDone = f.status === "done"
                        const isError = f.status === "error"
                        return (
                          <Badge
                            key={f.name}
                            variant={isError ? "destructive" : "secondary"}
                            className={cn(
                              "text-[10px] gap-1 py-0.5",
                              isGenerating && "border-blue-500/30 bg-blue-500/10 text-blue-300 animate-pulse",
                              isDone && "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
                            )}
                          >
                            {isGenerating ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin" />
                            ) : isDone ? (
                              <CheckCircle2 className="h-2.5 w-2.5" />
                            ) : isError ? (
                              <AlertCircle className="h-2.5 w-2.5" />
                            ) : (
                              <span className="w-2.5 h-2.5 rounded-full border border-zinc-600" />
                            )}
                            {f.name.split("/").pop()}
                          </Badge>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── COMPLETE CARD ─── */}
            {buildComplete && (
              <Card className="border-emerald-500/10 bg-emerald-500/[0.02]">
                <CardContent className="p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-semibold text-emerald-300">Build complete</span>
                    {detectedMode && (
                      <Badge variant={detectedMode === "edit" ? "secondary" : detectedMode === "fix" ? "destructive" : "default"} className="ml-2">
                        {detectedMode === "generate" ? "New Build" : detectedMode === "edit" ? "Edit" : detectedMode === "fix" ? "Fix" : detectedMode}
                      </Badge>
                    )}
                  </div>

                  {changedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {changedFiles.filter(f => !f.startsWith("-")).map(file => (
                        <Badge key={file} variant="secondary" className="text-[10px] gap-1">
                          <FileCode className="h-3 w-3" />
                          {file}
                        </Badge>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2">
                    {onDeploy && (
                      <Button onClick={onDeploy} size="sm" className="gap-2">
                        <Rocket className="h-3.5 w-3.5" /> Deploy Changes
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Plan Card */}
            {planSummary && (
              <Card className="border-white/[0.08] bg-zinc-900/50">
                <CardContent className="p-4 space-y-2">
                  <p className="text-sm font-medium text-zinc-200">{planSummary}</p>
                  {planFiles && (
                    <div className="flex flex-wrap gap-1.5">
                      {planFiles.create.map(f => (
                        <Badge key={f.name} className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-300 border-emerald-500/20">
                          <FileCode className="h-3 w-3" />
                          + {f.name}
                        </Badge>
                      ))}
                      {planFiles.modify.map(f => (
                        <Badge key={f.name} className="text-[10px] gap-1 bg-amber-500/10 text-amber-300 border-amber-500/20">
                          <FileCode className="h-3 w-3" />
                          ~ {f.name}
                        </Badge>
                      ))}
                      {planFiles.delete.map(f => (
                        <Badge key={f} className="text-[10px] gap-1 bg-red-500/10 text-red-300 border-red-500/20">
                          - {f}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* ─── STEPS TIMELINE ─── */}
            {buildSteps.length > 0 && (
              <Card className="border-white/[0.08] bg-zinc-900/50">
                <Accordion
                  type="single"
                  collapsible
                  value={expandedAccordion}
                  onValueChange={setExpandedAccordion}
                >
                  {stageOrder.filter(s => stageGroups[s]).map((stage) => {
                    const steps = stageGroups[stage]
                    const lastStep = steps[steps.length - 1]
                    const isRunning = lastStep?.status === "running"
                    const isDone = lastStep?.status === "done"
                    const isError = lastStep?.status === "error"
                    const Icon = STAGE_ICONS[stage] || Code2

                    return (
                      <AccordionItem key={stage} value={stage} className="border-b border-white/[0.05] last:border-0">
                        <AccordionTrigger className="px-5 py-3 hover:no-underline group">
                          <div className="flex items-center gap-3 w-full">
                            <div className={cn(
                              "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                              isRunning && "bg-blue-500/10",
                              isDone && "bg-emerald-500/10",
                              isError && "bg-red-500/10",
                              !isRunning && !isDone && !isError && "bg-white/[0.03]"
                            )}>
                              {isRunning ? (
                                <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                              ) : isError ? (
                                <AlertCircle className="h-4 w-4 text-red-400" />
                              ) : isDone ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                              ) : (
                                <Icon className="h-4 w-4 text-zinc-600" />
                              )}
                            </div>
                            <div className="flex-1 text-left min-w-0">
                              <div className={cn(
                                "text-sm font-medium",
                                isRunning && "text-blue-300",
                                isDone && "text-zinc-300",
                                isError && "text-red-300",
                                !isRunning && !isDone && !isError && "text-zinc-500"
                              )}>
                                {STAGE_LABELS[stage] || stage}
                              </div>
                              <div className="text-xs text-zinc-500 truncate">{lastStep?.title}</div>
                            </div>
                            <ChevronRight className={cn("h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200", expandedAccordion === stage && "rotate-90")} />
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="px-5 pb-3 space-y-1">
                            {steps.map((step) => (
                              <div key={step.id} className="flex items-start gap-2 pl-11 py-1">
                                <div className={cn(
                                  "w-4 h-4 rounded-full flex items-center justify-center mt-0.5 shrink-0",
                                  step.status === "running" && "bg-blue-500/20",
                                  step.status === "done" && "bg-emerald-500/20",
                                  step.status === "error" && "bg-red-500/20",
                                  step.status === "pending" && "bg-white/[0.04]",
                                )}>
                                  {step.status === "running" ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                                  ) : step.status === "done" ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                  ) : step.status === "error" ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                  ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs text-zinc-400">{step.message}</span>
                                  {step.file && (
                                    <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1">
                                      {step.file.split("/").pop()}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    )
                  })}
                </Accordion>
              </Card>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">{validationErrors.length} validation {validationErrors.length === 1 ? "issue" : "issues"}</AlertTitle>
                <AlertDescription>
                  <div className="mt-2 space-y-1">
                    {validationErrors.map((e, i) => (
                      <div key={i} className="text-xs text-red-300/80">
                        <span className="font-mono">{e.file}</span>: {e.message}
                      </div>
                    ))}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Changed Files */}
            {changedFiles.length > 0 && !buildComplete && (
              <Card className="border-emerald-500/10 bg-emerald-500/[0.02]">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-300">Files saved</p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {changedFiles.filter(f => !f.startsWith("-")).map(file => (
                      <Badge key={file} variant="secondary" className="text-[10px] gap-1">
                        <FileCode className="h-3 w-3" />
                        {file}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm">Build Error</AlertTitle>
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}
          </div>
        )}
      </div>

      <div className="w-full pb-8 sm:pb-12 shrink-0">
        <InputBar
          input={input}
          setInput={setInput}
          onSend={handleSend}
          disabled={isLoading}
          selectedModel={selectedModel}
          setSelectedModel={setSelectedModel}
          attachments={attachments}
          setAttachments={setAttachments}
          credits={credits}
          bestCost={bestCost}
          fastCost={fastCost}
        />
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
