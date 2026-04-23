"use client";
import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { GeneratedPage } from "@/components/ai-website-builder";
import { cn } from "@/lib/utils";

interface AutoFixModalProps {
  isOpen: boolean
  onClose: () => void
  projectId: string
  logs: string[]
  pages: GeneratedPage[]
  setPages: (pages: GeneratedPage[]) => void
}

type FixStep = {
  status: 'pending' | 'processing' | 'completed' | 'error'
  message: string
  action?: string
  details?: string
}

export function AutoFixModal({ isOpen, onClose, projectId, logs, pages, setPages }: AutoFixModalProps) {
  const [steps, setSteps] = useState<FixStep[]>([])
  const [isFixing, setIsFixing] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [displayLogs, setDisplayLogs] = useState<string[]>(logs)

  // Update display logs when props change
  useEffect(() => {
    setDisplayLogs(logs)
  }, [logs])

  const addStep = (message: string, status: FixStep['status'] = 'pending') => {
    setSteps(prev => [...prev, { message, status }])
  }

  const updateLastStep = (updates: Partial<FixStep>) => {
    setSteps(prev => {
      const newSteps = [...prev]
      if (newSteps.length > 0) {
        newSteps[newSteps.length - 1] = { ...newSteps[newSteps.length - 1], ...updates }
      }
      return newSteps
    })
  }

  const startAutoFix = async () => {
    setIsFixing(true)
    setSteps([])
    addStep("Fetching recent server logs...", "processing")

    try {
      // Fetch latest logs first
      let currentLogs = logs
      try {
        const fetchUrl = `https://micro1.sycord.com/api/logs?project_id=${projectId}&limit=50`
        console.log(`[AutoFix] Fetching logs from: ${fetchUrl}`)

        const logRes = await fetch(fetchUrl)
        console.log(`[AutoFix] Response status: ${logRes.status}`)

        if (logRes.ok) {
          const rawText = await logRes.text()
          console.log(`[AutoFix] Response body:`, rawText)

          try {
            const logData = JSON.parse(rawText)
            if (logData.success && Array.isArray(logData.logs)) {
              currentLogs = logData.logs
              setDisplayLogs(logData.logs)
              addStep("Logs retrieved successfully.", "completed")
            } else {
              console.warn("[AutoFix] Unexpected log data format:", logData)
              addStep("Log format invalid, using cached logs.", "error")
            }
          } catch (jsonErr) {
            console.error("[AutoFix] JSON parse error:", jsonErr)
            addStep("Failed to parse logs, using cached logs.", "error")
          }
        } else {
            console.error(`[AutoFix] Fetch failed with status: ${logRes.status}`)
            addStep(`Fetch failed (${logRes.status}), using cached logs.`, "error")
        }
      } catch (e: any) {
        console.error("Failed to fetch logs during auto-fix", e)
        addStep(`Network error: ${e.message}`, "error")
      }

      addStep("Analyzing deployment logs...", "processing")

      let resolved = false
      let iteration = 0
      const maxIterations = 5
      let lastAction = null
      let fileContentToAnalyze = null

      // Local copy of pages to prevent closure staleness during the async loop
      let currentPages = [...pages]

      while (!resolved && iteration < maxIterations) {
        iteration++

        // Prepare context using local state
        const fileStructure = currentPages.map(p => p.name).join('\n')

        // Call AI
        const response = await fetch('/api/ai/auto-fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logs: currentLogs,
            fileStructure,
            fileContent: fileContentToAnalyze,
            lastAction
          })
        })

        if (!response.ok) throw new Error("Failed to consult AI")

        const result = await response.json()
        updateLastStep({ status: 'completed', details: result.explanation })

        if (result.action === 'done') {
            addStep("Issues resolved!", "completed")
            resolved = true
            break
        }

        // Handle Actions
        if (result.action === 'read') {
            lastAction = 'take a look'
            addStep(`AI wants to check ${result.targetFile}...`, "processing")

            const page = currentPages.find(p => p.name === result.targetFile)
            if (page) {
                fileContentToAnalyze = { filename: page.name, code: page.code }
                updateLastStep({ details: "File found, sending content to AI." })
            } else {
                updateLastStep({ status: 'error', details: "File not found." })
                // Continue loop, AI might try something else
                fileContentToAnalyze = null
            }

        } else if (result.action === 'move') {
            lastAction = 'move'
            addStep(`Moving ${result.targetFile} to ${result.newPath}...`, "processing")

            const pageIndex = currentPages.findIndex(p => p.name === result.targetFile)
            if (pageIndex !== -1) {
                // Update local state
                const updatedPage = { ...currentPages[pageIndex], name: result.newPath }
                const newPages = [...currentPages]
                newPages[pageIndex] = updatedPage
                currentPages = newPages

                // Sync to React state
                setPages(currentPages)
                updateLastStep({ status: 'completed' })

                // Also update local fileContent if we were looking at it
                if (fileContentToAnalyze && fileContentToAnalyze.filename === result.targetFile) {
                    fileContentToAnalyze.filename = result.newPath
                }
            } else {
                updateLastStep({ status: 'error', details: "File to move not found." })
            }
            fileContentToAnalyze = null

        } else if (result.action === 'delete') {
            lastAction = 'delete'
            addStep(`Deleting ${result.targetFile}...`, "processing")

            // Update local state
            currentPages = currentPages.filter(p => p.name !== result.targetFile)

            // Sync to React state
            setPages(currentPages)
            updateLastStep({ status: 'completed' })
            fileContentToAnalyze = null

        } else if (result.action === 'write') {
            lastAction = 'fix'
            addStep(`Applying fix to ${result.targetFile}...`, "processing")

            const pageIndex = currentPages.findIndex(p => p.name === result.targetFile)
            if (pageIndex !== -1) {
                // Update existing file
                const updatedPage = {
                    ...currentPages[pageIndex],
                    code: result.code,
                    timestamp: Date.now()
                }
                const newPages = [...currentPages]
                newPages[pageIndex] = updatedPage
                currentPages = newPages
            } else {
                // Create new file
                const newPage: GeneratedPage = {
                    name: result.targetFile,
                    code: result.code,
                    usedFor: "Auto-fix generated",
                    timestamp: Date.now()
                }
                currentPages = [...currentPages, newPage]
                updateLastStep({ status: 'completed', details: "Created new file." })
            }

            // Sync to React state
            setPages(currentPages)
            updateLastStep({ status: 'completed' })
            fileContentToAnalyze = null
        } else {
            addStep("AI is thinking...", "pending")
        }

        // Small delay for UX
        await new Promise(r => setTimeout(r, 1000))
      }

      if (!resolved) {
        addStep("Auto-fix session ended (max iterations reached).", "completed")
      }

    } catch (error: any) {
        addStep(`Error: ${error.message}`, "error")
    } finally {
        setIsFixing(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !isFixing && onClose()}>
      <DialogContent className="sm:max-w-md bg-[#0F0F10] border-white/10 text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-400" />
            Auto-Fix with AI
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
           {/* Initial State / Start Button */}
           {steps.length === 0 ? (
               <div className="text-center space-y-4">
                   <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-left">
                       <h4 className="flex items-center gap-2 text-red-400 font-medium mb-2">
                           <AlertCircle className="h-4 w-4" />
                           Deployment Failed
                       </h4>
                       <div className="text-xs text-muted-foreground font-mono bg-black/40 p-2 rounded overflow-x-auto whitespace-pre-wrap max-h-48 custom-scrollbar">
                           {displayLogs.slice(-50).map((l, i) => (
                               <div key={i} className="whitespace-nowrap">{l}</div>
                           ))}
                       </div>
                   </div>
                   <p className="text-sm text-muted-foreground">
                       The AI agent will analyze your logs and project structure to automatically find and fix the issue.
                   </p>
                   <Button onClick={startAutoFix} className="w-full bg-blue-600 hover:bg-blue-700">
                       <Sparkles className="h-4 w-4 mr-2" />
                       Start Auto-Fix
                   </Button>
               </div>
           ) : (
               /* Steps Progress */
               <div className="space-y-4">
                   <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                       {steps.map((step, index) => (
                           <motion.div
                               key={index}
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               className="flex items-start gap-3 text-sm"
                           >
                               <div className="mt-0.5">
                                   {step.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin text-blue-400" />}
                                   {step.status === 'completed' && <CheckCircle2 className="h-4 w-4 text-green-400" />}
                                   {step.status === 'error' && <AlertCircle className="h-4 w-4 text-red-400" />}
                                   {step.status === 'pending' && <div className="h-4 w-4 rounded-full border-2 border-muted" />}
                               </div>
                               <div className="flex-1">
                                   <p className={cn("font-medium",
                                       step.status === 'processing' && "text-blue-400",
                                       step.status === 'error' && "text-red-400"
                                   )}>
                                       {step.message}
                                   </p>
                                   {step.details && (
                                       <p className="text-xs text-muted-foreground mt-1 bg-white/5 p-2 rounded">
                                           {step.details}
                                       </p>
                                   )}
                               </div>
                           </motion.div>
                       ))}
                   </div>

                   {!isFixing && (
                       <Button onClick={onClose} className="w-full" variant="secondary">
                           Close
                       </Button>
                   )}
               </div>
           )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
