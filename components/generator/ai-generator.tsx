"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { 
  Loader2, 
  Send, 
  Sparkles,
  RotateCcw,
  Bug
} from "lucide-react"
import { DebugPanel } from "./debug-panel"
import type { 
  CheatSheet, 
  StyleJSON, 
  FunctionJSON, 
  BlankFunction, 
  DebugState, 
  DebugStep 
} from "@/lib/generator/types"

interface AIGeneratorProps {
  onGenerated?: (tsx: string, pageId: string) => void
}

export function AIGenerator({ onGenerated }: AIGeneratorProps) {
  const [prompt, setPrompt] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [cheatSheet, setCheatSheet] = useState<CheatSheet | null>(null)
  const [debugExpanded, setDebugExpanded] = useState(true)
  const [debugState, setDebugState] = useState<DebugState>({
    steps: [],
    currentStep: 0,
    styleJSON: null,
    functionJSON: null,
    outputTSX: null,
    blankFunctions: []
  })

  // Fetch cheatsheet on mount
  useEffect(() => {
    const fetchCheatSheet = async () => {
      try {
        const res = await fetch("/api/admin/cheatsheet")
        if (res.ok) {
          const data = await res.json()
          setCheatSheet(data.cheatSheet)
        }
      } catch (err) {
        console.error("Failed to fetch cheatsheet:", err)
        toast.error("Failed to load component cheatsheet")
      }
    }
    fetchCheatSheet()
  }, [])

  const updateStep = useCallback((step: DebugStep["step"], updates: Partial<DebugStep>) => {
    setDebugState(prev => {
      const existingIndex = prev.steps.findIndex(s => s.step === step)
      const newSteps = [...prev.steps]
      
      if (existingIndex >= 0) {
        newSteps[existingIndex] = { ...newSteps[existingIndex], ...updates }
      } else {
        newSteps.push({ step, status: "pending", ...updates })
      }
      
      return { ...prev, steps: newSteps }
    })
  }, [])

  const resetDebugState = useCallback(() => {
    setDebugState({
      steps: [],
      currentStep: 0,
      styleJSON: null,
      functionJSON: null,
      outputTSX: null,
      blankFunctions: []
    })
  }, [])

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt")
      return
    }

    if (!cheatSheet) {
      toast.error("Cheatsheet not loaded")
      return
    }

    setIsGenerating(true)
    resetDebugState()

    try {
      // Step 1: Generate Style JSON
      updateStep("style", { status: "running", startTime: Date.now() })
      
      const styleRes = await fetch("/api/generator/style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, cheatSheet })
      })

      const styleData = await styleRes.json()
      
      if (!styleData.success) {
        throw new Error(styleData.error || "Style generation failed")
      }

      const styleJSON: StyleJSON = styleData.styleJSON
      const blankFunctions: BlankFunction[] = styleData.blankFunctions || []

      updateStep("style", { status: "complete", endTime: Date.now(), data: styleJSON })
      setDebugState(prev => ({ 
        ...prev, 
        styleJSON, 
        blankFunctions,
        currentStep: 1 
      }))

      // Step 2: Generate Function JSON
      updateStep("functions", { status: "running", startTime: Date.now() })

      const functionsRes = await fetch("/api/generator/functions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleJSON, blankFunctions, cheatSheet })
      })

      const functionsData = await functionsRes.json()

      if (!functionsData.success) {
        throw new Error(functionsData.error || "Function generation failed")
      }

      const functionJSON: FunctionJSON = functionsData.functionJSON

      // Mark filled functions
      const filledBlankFunctions = blankFunctions.map(f => ({
        ...f,
        filled: functionJSON.logicBlocks.some(
          block => "targetId" in block && block.targetId === f.targetId
        )
      }))

      updateStep("functions", { status: "complete", endTime: Date.now(), data: functionJSON })
      setDebugState(prev => ({ 
        ...prev, 
        functionJSON,
        blankFunctions: filledBlankFunctions,
        currentStep: 2 
      }))

      // Step 3: Orchestrate (non-AI)
      updateStep("orchestrate", { status: "running", startTime: Date.now() })

      const orchestrateRes = await fetch("/api/generator/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleJSON, functionJSON, cheatSheet })
      })

      const orchestrateData = await orchestrateRes.json()

      if (!orchestrateData.success) {
        throw new Error(orchestrateData.error || "Orchestration failed")
      }

      const outputTSX: string = orchestrateData.outputTSX

      updateStep("orchestrate", { status: "complete", endTime: Date.now(), data: outputTSX })
      setDebugState(prev => ({ 
        ...prev, 
        outputTSX,
        currentStep: 3 
      }))

      toast.success("Generation complete!")
      onGenerated?.(outputTSX, styleJSON.pageId)

    } catch (error) {
      console.error("[Generator Error]", error)
      const errorMessage = error instanceof Error ? error.message : "Generation failed"
      toast.error(errorMessage)

      // Mark current step as error
      const currentStepName = ["style", "functions", "orchestrate"][debugState.currentStep] as DebugStep["step"]
      updateStep(currentStepName, { status: "error", endTime: Date.now(), error: errorMessage })

    } finally {
      setIsGenerating(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      generate()
    }
  }

  return (
    <div className="flex flex-col h-full bg-[#101010] rounded-2xl border border-white/[0.06] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <h3 className="text-sm font-medium text-white">AI Generator</h3>
          <Badge 
            variant="outline" 
            className="text-[10px] px-2 py-0 h-5 bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
          >
            Debug Mode
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          {cheatSheet && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-2 py-0 h-5 bg-white/5 text-white/40 border-white/10"
            >
              {cheatSheet.components.length} components
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDebugExpanded(!debugExpanded)}
            className="h-7 text-xs text-white/40 hover:text-white"
          >
            <Bug className="h-3 w-3 mr-1" />
            Debug
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Prompt Area */}
        <div className="flex-1 p-4">
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the page you want to generate...

Example: Create a hero section with a welcome message and a primary call-to-action button"
            className="min-h-[150px] bg-white/[0.02] border-white/10 text-white placeholder:text-white/30 resize-none"
            disabled={isGenerating}
          />
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-white/[0.02]">
          <div className="text-xs text-white/30">
            Press <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">Cmd</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white/10 text-white/50 font-mono text-[10px]">Enter</kbd> to generate
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={resetDebugState}
              disabled={isGenerating}
              className="h-8 text-xs bg-white/5 border-white/10 text-white/60 hover:bg-white/10"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Reset
            </Button>
            <Button
              size="sm"
              onClick={generate}
              disabled={isGenerating || !cheatSheet}
              className="h-8 text-xs bg-white text-black hover:bg-white/90"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Send className="h-3 w-3 mr-1" />
                  Generate
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Debug Panel */}
      <DebugPanel
        debugState={debugState}
        isExpanded={debugExpanded}
        onToggle={() => setDebugExpanded(!debugExpanded)}
      />
    </div>
  )
}
