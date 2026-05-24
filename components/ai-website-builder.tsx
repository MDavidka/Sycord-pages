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
  Loader2,
  ChevronDown,
  CheckCircle2,
  Send,
  Zap,
  Paperclip,
  X,
  Coins,
  Gem,
  Circle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { BEST_COST_PER_FILE, FAST_COST_PER_FILE, tierOf, formatCredits, type ModelTier } from "@/lib/credits"

// ── Types ────────────────────────────────────────────────────────

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

interface DebugStep {
  id: number
  title: string
  detail: string
  status: "pending" | "active" | "done"
}

const STEP_TEMPLATES: Array<Pick<DebugStep, "title" | "detail">> = [
  { title: "1. Validate request", detail: "Waiting for prompt analysis..." },
  { title: "2. Plan site structure", detail: "Waiting to draft routes and sections..." },
  { title: "3. Generate page code", detail: "Waiting to create component code..." },
  { title: "4. Resolve UI dependencies", detail: "Waiting to map required UI components..." },
]

// ── Input Bar ────────────────────────────────────────────────────

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
              placeholder="Describe the website you want to build..."
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
            <Button variant="ghost" size="icon" className="h-8 w-8 text-zinc-500 hover:text-zinc-300 rounded-lg" onClick={() => fileInputRef.current?.click()}>
              <Paperclip className="h-3.5 w-3.5" />
            </Button>

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
                    <span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(bestCost)}</span>
                  </div>
                  {MODELS.filter(m => !m.fast).map(m => (
                    <ModelRow key={m.id} model={m} selected={selectedModel.id === m.id} onSelect={() => setSelectedModel(m)} tier="best" />
                  ))}
                  <div className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500 flex items-center gap-1.5 mt-1">
                    <Zap className="h-3 w-3" /> Fast
                    <span className="ml-auto font-medium normal-case tracking-normal text-zinc-500">−{formatCredits(fastCost)}</span>
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

// ── AIWebsiteBuilder Shell ────────────────────────────────────────

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
  const [debugSteps, setDebugSteps] = useState<DebugStep[]>([])

  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])
  const [attachments, setAttachments] = useState<File[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [bestCost, setBestCost] = useState<number>(BEST_COST_PER_FILE)
  const [fastCost, setFastCost] = useState<number>(FAST_COST_PER_FILE)

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

  const initializeSteps = () => {
    setDebugSteps(
      STEP_TEMPLATES.map((step, index) => ({
        id: index + 1,
        title: step.title,
        detail: step.detail,
        status: "pending" as const,
      }))
    )
  }

  const beginStep = (id: number, detail: string) => {
    setDebugSteps((prev) =>
      prev.map((step) => {
        if (step.id < id && step.status !== "done") return { ...step, status: "done" as const }
        if (step.id === id) return { ...step, status: "active" as const, detail }
        return step
      })
    )
  }

  const completeStep = (id: number, detail: string) => {
    setDebugSteps((prev) =>
      prev.map((step) => (step.id === id ? { ...step, status: "done" as const, detail } : step))
    )
  }

  const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

  const handleSend = async () => {
    if (!input.trim() || isLoading) return
    setIsLoading(true)
    initializeSteps()

    try {
      // 1. User input
      beginStep(1, "Parsing prompt, selected model, and attached files...")
      const prompt = input.trim()
      const attachmentSummary = attachments.length ? `${attachments.length} attachment(s) ready.` : "No attachments provided."
      await wait(250)
      completeStep(1, `Prompt: "${prompt}"\nModel: ${selectedModel.name} (${selectedModel.provider})\n${attachmentSummary}`)

      // 2. Temporary structure JSON
      const structure = {
        pages: [
          {
            name: "Landing",
            route: "/",
            usedFor: "Main marketing page",
            content: ["Hero section", "Feature cards", "CTA"],
          },
          {
            name: "About",
            route: "/about",
            usedFor: "Brand story and team",
            content: ["Intro", "Mission", "Team grid"],
          },
          {
            name: "Contact",
            route: "/contact",
            usedFor: "Lead collection",
            content: ["Contact form", "Support details"],
          },
        ],
      }

      const structureStepId = beginStep("2. Website structure", "Drafting page map and content sections...")
      await wait(250)
      completeStep(structureStepId, `Temporary structure JSON:\n${JSON.stringify(structure, null, 2)}`)

      // 3. Generate code using predefined shadcn components + prompt
      const generatedCode = `import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground p-8">
      <section className="max-w-4xl mx-auto space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Welcome to your AI generated website</CardTitle>
          </CardHeader>
          <CardContent>
            <p>This page was generated from your Syra AI prompt.</p>
            <Button className="mt-4">Get started</Button>
          </CardContent>
        </Card>
      </section>
    </main>
  )
}`

      beginStep(3, "Composing React page using Syra generation templates...")
      await wait(250)
      completeStep(3, "Generated landing page with shadcn Card and Button building blocks.")

      // 4. Backend loads referenced components in components/ui
      const usedComponents = ["card", "button"]
      beginStep(4, "Inspecting generated code imports and resolving component dependencies...")
      await wait(200)
      completeStep(4, `Resolved UI dependencies: ${usedComponents.join(", ")} from components/ui.`)

      setGeneratedPages((prev) => [
        ...prev,
        {
          name: "landing-page.tsx",
          code: generatedCode,
          timestamp: Date.now(),
          usedFor: "Main marketing page",
        },
      ])
      setInput("")
      setAttachments([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">
      <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex-1 flex flex-col items-center justify-center px-3 sm:px-4">
        <div className="flex-1 flex flex-col items-center justify-center text-center py-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
          <div className="space-y-1">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
              Hi {userName},
            </h1>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
              What are we building?
            </h2>
          </div>
        </div>

        {debugSteps.length > 0 && (
          <div className="w-full max-w-2xl mx-auto pb-5 sm:pb-6">
            <div className="rounded-2xl border border-white/[0.08] bg-zinc-900/70 p-4 space-y-3">
              <p className="text-xs uppercase tracking-wider text-zinc-400">Syra debug chat steps</p>
              {debugSteps.map((step) => (
                <div key={step.id} className={cn("rounded-xl border p-3 transition-colors", step.status === "done" ? "border-emerald-400/20 bg-emerald-500/[0.05]" : step.status === "active" ? "border-blue-400/30 bg-blue-500/[0.07]" : "border-white/[0.06] bg-white/[0.02]")}>
                  <p className="text-sm font-medium text-white flex items-center gap-2">
                    {step.status === "done" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : step.status === "active" ? <Loader2 className="h-4 w-4 text-blue-300 animate-spin" /> : <Circle className="h-3.5 w-3.5 text-zinc-500" />}
                    {step.title}
                    {step.status === "active" && <span className="text-[10px] uppercase tracking-wider text-blue-300/90">In progress</span>}
                  </p>
                  <pre className="mt-2 text-xs text-zinc-300 whitespace-pre-wrap font-mono">{step.detail || "Waiting..."}</pre>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="w-full pb-8 sm:pb-12">
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
    </div>
  )
}

export default AIWebsiteBuilder
