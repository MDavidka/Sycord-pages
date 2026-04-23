"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Loader2, CheckCircle2, XCircle, Zap, Code, Server, ArrowLeft, Copy, Check,  } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── MODEL LIST (same as ai-website-builder.tsx) ──────────────────────────────

interface ModelOption {
  id: string
  name: string
  provider: string
  fast?: boolean
}

const MODELS: ModelOption[] = [
  { id: "grok-4-1-fast-non-reasoning", name: "Grok 4.1 Fast", provider: "xAI", fast: true },
  { id: "openai/gpt-oss-20b:free", name: "GPT-OSS 20B Free", provider: "OpenRouter" },
]

// ─── PIPELINE STEP TYPES ──────────────────────────────────────────────────────

type StepStatus = "idle" | "running" | "done" | "error"

interface PipelineStep {
  id: string
  label: string
  description: string
  icon: React.ReactNode
  status: StepStatus
  error?: string
}

// ─── COPY BUTTON ──────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={handleCopy}
      className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied" : "Copy"}
    </button>
  )
}

// ─── STATUS BAR ───────────────────────────────────────────────────────────────

function StatusBar({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex flex-col gap-2">
      {steps.map((step, idx) => (
        <div
          key={step.id}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-300",
            step.status === "idle" && "border-white/[0.06] bg-white/[0.02] opacity-50",
            step.status === "running" && "border-blue-500/30 bg-blue-500/5",
            step.status === "done" && "border-emerald-500/30 bg-emerald-500/5",
            step.status === "error" && "border-red-500/30 bg-red-500/5",
          )}
        >
          {/* Step number / icon */}
          <div
            className={cn(
              "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold",
              step.status === "idle" && "bg-white/[0.06] text-white/30",
              step.status === "running" && "bg-blue-500/20 text-blue-400",
              step.status === "done" && "bg-emerald-500/20 text-emerald-400",
              step.status === "error" && "bg-red-500/20 text-red-400",
            )}
          >
            {step.status === "running" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {step.status === "done" && <CheckCircle2 className="h-3.5 w-3.5" />}
            {step.status === "error" && <XCircle className="h-3.5 w-3.5" />}
            {step.status === "idle" && <span>{idx + 1}</span>}
          </div>

          {/* Label + description */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-sm font-medium",
                  step.status === "idle" && "text-white/30",
                  step.status === "running" && "text-blue-300",
                  step.status === "done" && "text-emerald-300",
                  step.status === "error" && "text-red-300",
                )}
              >
                {step.label}
              </span>
              {step.status === "running" && (
                <span className="text-xs text-blue-400/70 animate-pulse">Processing…</span>
              )}
              {step.status === "done" && (
                <span className="text-xs text-emerald-400/70">Complete</span>
              )}
              {step.status === "error" && (
                <span className="text-xs text-red-400/70">Failed</span>
              )}
            </div>
            <p
              className={cn(
                "text-xs mt-0.5 truncate",
                step.status === "idle" && "text-white/20",
                step.status !== "idle" && "text-white/40",
              )}
            >
              {step.error ?? step.description}
            </p>
          </div>

          {/* Step icon */}
          <div
            className={cn(
              "flex-shrink-0",
              step.status === "idle" && "text-white/20",
              step.status === "running" && "text-blue-400",
              step.status === "done" && "text-emerald-400",
              step.status === "error" && "text-red-400",
            )}
          >
            {step.icon}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── OUTPUT PANEL ─────────────────────────────────────────────────────────────

function OutputPanel({
  title,
  content,
  language,
  visible,
}: {
  title: string
  content: string
  language: string
  visible: boolean
}) {
  if (!visible || !content) return null
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06]">
        <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">{title}</span>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-[10px] border-white/[0.08] text-white/30 py-0">
            {language}
          </Badge>
          <CopyButton text={content} />
        </div>
      </div>
      <pre className="p-4 text-xs text-white/70 overflow-x-auto overflow-y-auto max-h-72 font-mono leading-relaxed whitespace-pre-wrap break-words">
        {content}
      </pre>
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function GeneratorPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS[0])
  const [prompt, setPrompt] = useState("")
  const [componentName, setComponentName] = useState("GeneratedComponent")
  const [isGenerating, setIsGenerating] = useState(false)

  const [rawJson, setRawJson] = useState("")
  const [tsCode, setTsCode] = useState("")
  const [flaskOutput, setFlaskOutput] = useState("")
  const [globalError, setGlobalError] = useState<string | null>(null)

  const [steps, setSteps] = useState<PipelineStep[]>([
    {
      id: "json",
      label: "Raw JSON Style Output",
      description: "Generate ui-tree JSON strictly following cheat_sheat.json",
      icon: <Code className="h-4 w-4" />,
      status: "idle",
    },
    {
      id: "typescript",
      label: "TypeScript Logic",
      description: "Convert JSON to TypeScript using sample-converter logic",
      icon: <Zap className="h-4 w-4" />,
      status: "idle",
    },
    {
      id: "flask",
      label: "Flask VM Build",
      description: "Generate Flask runner output targeting VM deployment",
      icon: <Server className="h-4 w-4" />,
      status: "idle",
    },
  ])

  const updateStep = (id: string, patch: Partial<PipelineStep>) => {
    setSteps(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)))
  }

  const resetSteps = () => {
    setSteps(prev => prev.map(s => ({ ...s, status: "idle" as StepStatus, error: undefined })))
  }

  const handleGenerate = async () => {
    if (!prompt.trim()) return
    setIsGenerating(true)
    setGlobalError(null)
    setRawJson("")
    setTsCode("")
    setFlaskOutput("")
    resetSteps()

    // Mark step 1 running
    updateStep("json", { status: "running" })

    try {
      const res = await fetch("/api/ai/json-generator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          model: selectedModel.id,
          componentName: componentName.trim() || "GeneratedComponent",
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        // Determine which step failed
        const failedStep = data.step ?? "json"
        updateStep(failedStep, { status: "error", error: data.error ?? "Unknown error" })
        // Mark subsequent steps idle (already idle)
        setGlobalError(data.error ?? "Generation failed")
        // Set partial outputs
        if (data.rawJson) setRawJson(data.rawJson)
        if (data.tsCode) setTsCode(data.tsCode)
        return
      }

      // All 3 steps succeeded — animate them in sequence
      updateStep("json", { status: "done" })
      setRawJson(data.rawJson ?? "")

      await new Promise(r => setTimeout(r, 300))
      updateStep("typescript", { status: "running" })
      await new Promise(r => setTimeout(r, 400))
      updateStep("typescript", { status: "done" })
      setTsCode(data.tsCode ?? "")

      await new Promise(r => setTimeout(r, 300))
      updateStep("flask", { status: "running" })
      await new Promise(r => setTimeout(r, 400))
      updateStep("flask", { status: "done" })
      setFlaskOutput(data.flaskOutput ?? "")
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      updateStep("json", { status: "error", error: msg })
      setGlobalError(msg)
    } finally {
      setIsGenerating(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

  const hasOutput = rawJson || tsCode || flaskOutput
  const allDone = steps.every(s => s.status === "done")

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] bg-zinc-950/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-1.5 text-white/40 hover:text-white/70 transition-colors text-sm"
          >
            <ArrowLeft className="h-4 w-4" />
            Dashboard
          </button>
          <span className="text-white/20">/</span>
          <span className="text-sm font-medium text-white/80">JSON Generator</span>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="outline" className="border-white/[0.08] text-white/40 text-[10px]">
              cheat_sheat.json
            </Badge>
            <Badge variant="outline" className="border-white/[0.08] text-white/40 text-[10px]">
              sample-converter
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-white">JSON-Based Component Generator</h1>
          <p className="text-sm text-white/40 mt-1">
            One model handles the full pipeline: JSON style → TypeScript logic → Flask VM build
          </p>
        </div>

        {/* Config row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Model selector */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Model</label>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.05] transition-colors text-sm text-white/80">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{selectedModel.name}</span>
                    <span className="text-xs text-white/30">{selectedModel.provider}</span>
                    {selectedModel.fast && (
                      <Badge className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
                        Fast
                      </Badge>
                    )}
                  </div>
                  <ChevronDown className="h-4 w-4 text-white/30" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-72 bg-zinc-900 border-white/[0.08] rounded-xl"
              >
                {MODELS.map(m => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setSelectedModel(m)}
                    className={cn(
                      "flex items-center justify-between cursor-pointer rounded-lg",
                      selectedModel.id === m.id && "bg-white/[0.06]",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white/80">{m.name}</span>
                      <span className="text-xs text-white/30">{m.provider}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {m.fast && (
                        <Badge className="text-[10px] py-0 px-1.5 bg-amber-500/10 text-amber-400 border-amber-500/20">
                          Fast
                        </Badge>
                      )}
                      {selectedModel.id === m.id && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      )}
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Component name */}
          <div className="space-y-1.5">
            <label className="text-xs text-white/50 font-medium">Component Name</label>
            <Input
              value={componentName}
              onChange={e => setComponentName(e.target.value)}
              placeholder="GeneratedComponent"
              className="bg-white/[0.03] border-white/[0.08] text-white/80 rounded-xl placeholder:text-white/20 font-mono text-sm"
            />
          </div>
        </div>

        {/* Prompt */}
        <div className="space-y-1.5">
          <label className="text-xs text-white/50 font-medium">Prompt</label>
          <Textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe the UI component you want to generate… e.g. 'A login card with email and password inputs and a submit button'"
            rows={4}
            className="bg-white/[0.03] border-white/[0.08] text-white/80 rounded-xl placeholder:text-white/20 text-sm resize-none"
          />
        </div>

        {/* Generate button */}
        <Button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className="w-full sm:w-auto px-8 py-2.5 rounded-xl font-semibold bg-white text-zinc-900 hover:bg-white/90 disabled:opacity-40"
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Generating…
            </>
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Generate
            </>
          )}
        </Button>

        {/* Pipeline status bar */}
        {steps.some(s => s.status !== "idle") && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              Pipeline Status
            </h2>
            <StatusBar steps={steps} />
          </div>
        )}

        {/* Global error */}
        {globalError && (
          <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
            <XCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">Generation Error</p>
              <p className="text-xs text-red-400/70 mt-0.5 font-mono">{globalError}</p>
            </div>
          </div>
        )}

        {/* Output panels */}
        {hasOutput && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <h2 className="text-xs font-semibold text-white/40 uppercase tracking-wider">
                Build Output
              </h2>
              {allDone && (
                <Badge className="text-[10px] py-0 px-2 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                  All steps complete
                </Badge>
              )}
            </div>

            <OutputPanel
              title="Step 1 — Raw JSON (ui-tree)"
              content={rawJson}
              language="JSON"
              visible={!!rawJson}
            />
            <OutputPanel
              title="Step 2 — TypeScript Component"
              content={tsCode}
              language="TypeScript"
              visible={!!tsCode}
            />
            <OutputPanel
              title="Step 3 — Flask VM Runner"
              content={flaskOutput}
              language="Python"
              visible={!!flaskOutput}
            />
          </div>
        )}
      </div>
    </div>
  )
}
