"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  ChevronDown, 
  ChevronUp, 
  Check, 
  Loader2, 
  AlertCircle,
  Clock,
  Code,
  FileJson,
  Layers,
  Copy
} from "lucide-react"
import type { DebugState, BlankFunction } from "@/lib/generator/types"
import { toast } from "sonner"

interface DebugPanelProps {
  debugState: DebugState
  isExpanded: boolean
  onToggle: () => void
}

export function DebugPanel({ debugState, isExpanded, onToggle }: DebugPanelProps) {
  const [activeTab, setActiveTab] = useState<"style" | "functions" | "output">("style")

  const getStepStatus = (step: "style" | "functions" | "orchestrate") => {
    const stepData = debugState.steps.find(s => s.step === step)
    return stepData?.status || "pending"
  }

  const getStepDuration = (step: "style" | "functions" | "orchestrate") => {
    const stepData = debugState.steps.find(s => s.step === step)
    if (stepData?.startTime && stepData?.endTime) {
      return `${((stepData.endTime - stepData.startTime) / 1000).toFixed(2)}s`
    }
    return null
  }

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast.success(`${label} copied to clipboard`)
  }

  const StatusIcon = ({ status }: { status: string }) => {
    switch (status) {
      case "running":
        return <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
      case "complete":
        return <Check className="h-3 w-3 text-green-400" />
      case "error":
        return <AlertCircle className="h-3 w-3 text-red-400" />
      default:
        return <Clock className="h-3 w-3 text-white/30" />
    }
  }

  const isAnyStepRunning = debugState.steps.some(s => s.status === "running")

  return (
    <div className="border-t border-white/[0.06] bg-[#0a0a0a]">
      {/* Toggle Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Badge 
            variant="outline" 
            className={`text-[10px] px-2 py-0 h-5 border-white/10 font-mono ${
              isAnyStepRunning ? "bg-blue-500/10 text-blue-400" : "bg-white/5 text-white/50"
            }`}
          >
            DEBUG
          </Badge>
          <div className="flex items-center gap-2">
            {/* Step indicators */}
            <div className="flex items-center gap-1">
              <StatusIcon status={getStepStatus("style")} />
              <span className="text-xs text-white/40">Style</span>
            </div>
            <span className="text-white/20">→</span>
            <div className="flex items-center gap-1">
              <StatusIcon status={getStepStatus("functions")} />
              <span className="text-xs text-white/40">Functions</span>
            </div>
            <span className="text-white/20">→</span>
            <div className="flex items-center gap-1">
              <StatusIcon status={getStepStatus("orchestrate")} />
              <span className="text-xs text-white/40">Output</span>
            </div>
          </div>
        </div>
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-white/40" />
        ) : (
          <ChevronUp className="h-4 w-4 text-white/40" />
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-white/[0.06]">
          {/* Tab Bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.06] bg-white/[0.02]">
            <button
              onClick={() => setActiveTab("style")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === "style"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              <Layers className="h-3 w-3" />
              Style JSON
              {debugState.styleJSON && (
                <Badge className="text-[9px] px-1 h-4 bg-green-500/20 text-green-400 border-0">
                  {debugState.styleJSON.layout.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("functions")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === "functions"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              <FileJson className="h-3 w-3" />
              Function JSON
              {debugState.blankFunctions.length > 0 && (
                <Badge className="text-[9px] px-1 h-4 bg-yellow-500/20 text-yellow-400 border-0">
                  {debugState.blankFunctions.filter(f => f.filled).length}/{debugState.blankFunctions.length}
                </Badge>
              )}
            </button>
            <button
              onClick={() => setActiveTab("output")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeTab === "output"
                  ? "bg-white/10 text-white"
                  : "text-white/40 hover:text-white/60 hover:bg-white/5"
              }`}
            >
              <Code className="h-3 w-3" />
              Output TSX
              {debugState.outputTSX && (
                <Badge className="text-[9px] px-1 h-4 bg-blue-500/20 text-blue-400 border-0">
                  Ready
                </Badge>
              )}
            </button>
          </div>

          {/* Tab Content */}
          <div className="max-h-[400px] overflow-auto">
            {activeTab === "style" && (
              <div className="p-4 space-y-4">
                {/* Blank Functions Summary */}
                {debugState.blankFunctions.length > 0 && (
                  <div className="rounded-lg bg-yellow-500/5 border border-yellow-500/20 p-3">
                    <h4 className="text-xs font-medium text-yellow-400 mb-2">
                      Blank Function IDs ({debugState.blankFunctions.length})
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {debugState.blankFunctions.map((fn: BlankFunction) => (
                        <Badge
                          key={fn.id}
                          variant="outline"
                          className={`text-[10px] font-mono ${
                            fn.filled
                              ? "bg-green-500/10 text-green-400 border-green-500/20"
                              : "bg-white/5 text-white/50 border-white/10"
                          }`}
                        >
                          {fn.id}
                          <span className="text-white/30 ml-1">({fn.event})</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Style JSON */}
                {debugState.styleJSON ? (
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-2 top-2 h-7 text-xs text-white/40 hover:text-white"
                      onClick={() => copyToClipboard(JSON.stringify(debugState.styleJSON, null, 2), "Style JSON")}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <pre className="text-xs font-mono text-white/70 bg-white/[0.02] rounded-lg p-4 overflow-auto max-h-[300px]">
                      {JSON.stringify(debugState.styleJSON, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30 text-sm">
                    {getStepStatus("style") === "running" ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating style JSON...
                      </div>
                    ) : (
                      "No style JSON generated yet"
                    )}
                  </div>
                )}

                {getStepDuration("style") && (
                  <p className="text-[10px] text-white/30 text-right">
                    Generated in {getStepDuration("style")}
                  </p>
                )}
              </div>
            )}

            {activeTab === "functions" && (
              <div className="p-4 space-y-4">
                {debugState.functionJSON ? (
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-2 top-2 h-7 text-xs text-white/40 hover:text-white"
                      onClick={() => copyToClipboard(JSON.stringify(debugState.functionJSON, null, 2), "Function JSON")}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <pre className="text-xs font-mono text-white/70 bg-white/[0.02] rounded-lg p-4 overflow-auto max-h-[300px]">
                      {JSON.stringify(debugState.functionJSON, null, 2)}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30 text-sm">
                    {getStepStatus("functions") === "running" ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Generating function implementations...
                      </div>
                    ) : (
                      "No function JSON generated yet"
                    )}
                  </div>
                )}

                {getStepDuration("functions") && (
                  <p className="text-[10px] text-white/30 text-right">
                    Generated in {getStepDuration("functions")}
                  </p>
                )}
              </div>
            )}

            {activeTab === "output" && (
              <div className="p-4 space-y-4">
                {debugState.outputTSX ? (
                  <div className="relative">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-2 top-2 h-7 text-xs text-white/40 hover:text-white"
                      onClick={() => copyToClipboard(debugState.outputTSX || "", "Output TSX")}
                    >
                      <Copy className="h-3 w-3 mr-1" />
                      Copy
                    </Button>
                    <pre className="text-xs font-mono text-white/70 bg-white/[0.02] rounded-lg p-4 overflow-auto max-h-[300px]">
                      {debugState.outputTSX}
                    </pre>
                  </div>
                ) : (
                  <div className="text-center py-8 text-white/30 text-sm">
                    {getStepStatus("orchestrate") === "running" ? (
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Orchestrating final output...
                      </div>
                    ) : (
                      "No output generated yet"
                    )}
                  </div>
                )}

                {getStepDuration("orchestrate") && (
                  <p className="text-[10px] text-white/30 text-right">
                    Orchestrated in {getStepDuration("orchestrate")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
