"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Loader2,
  Send,
  Bot,
  User,
  Check,
  ChevronDown,
  Terminal,
  Cpu,
  Sparkles,
  FileCode,
  ArrowRight,
  Rocket,
  File,
  Layers,
  ListTodo
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

// Locked to single model as requested
const LOCKED_MODEL = { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" }

const SYSTEM_PROMPT = `You are an expert web developer creating beautiful, production-ready HTML websites.

CRITICAL: You MUST generate valid, complete HTML code that can be rendered directly in a browser.

MARKER INSTRUCTIONS:
When providing code, wrap it EXACTLY like this with NO backticks:
[1]
<!DOCTYPE html>
<html>
...your complete HTML code...
</html>
[1<page_name>]

Replace <page_name> with the specific name of the file you are generating (e.g., index.html, style.css).

IMAGES:
Use REAL photos from LoremFlickr for high-quality placeholders.
Format: https://loremflickr.com/{width}/{height}/{keyword}
Example: https://loremflickr.com/800/600/fashion,clothing

ESSENTIAL REQUIREMENTS:
1. Write ALL code in pure HTML/CSS/JS - NO REACT, NO JSX.
2. Use Tailwind CSS classes for styling (include CDN).
3. Make it fully responsive (mobile-first).
4. DESIGN STYLE: Use HeroUI (NextUI) aesthetics. Clean, modern, rounded-2xl, subtle shadows.
5. NO backticks inside markers.
`

type Step = "idle" | "planning" | "coding" | "done"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  code?: string
  plan?: string
  pageName?: string
  isIntermediate?: boolean
}

export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
}

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
}

const AIWebsiteBuilder = ({ projectId, generatedPages, setGeneratedPages }: AIWebsiteBuilderProps) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [step, setStep] = useState<Step>("idle")
  const [currentPlan, setCurrentPlan] = useState("") // Displayed text
  const [deployedCode, setDeployedCode] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Task List State
  const [plannedFiles, setPlannedFiles] = useState<string[]>([])
  const [currentFileIndex, setCurrentFileIndex] = useState(0)
  const [isBuilding, setIsBuilding] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, currentPlan, step])

  // Main Orchestration Function
  const startGeneration = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages(prev => [...prev, userMessage])
    setInput("")
    setError(null)
    setStep("planning")
    setCurrentPlan("Brainstorming site structure...")

    try {
      // Step 1: Brainstorm / Plan Files
      const planResponse = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      })

      if (!planResponse.ok) throw new Error("Failed to generate plan")

      const planData = await planResponse.json()
      let files = []
      try {
        files = JSON.parse(planData.plan)
        if (!Array.isArray(files)) throw new Error("Invalid plan format")
      } catch (e) {
        console.warn("Plan parsing failed, defaulting to index.html")
        files = ["index.html"]
      }

      setPlannedFiles(files)
      setCurrentFileIndex(0)
      setIsBuilding(true)

      // Start the loop
      processNextFile(files, 0, [...messages, userMessage])

    } catch (err: any) {
      setError(err.message || "An error occurred during planning")
      setStep("idle")
    }
  }

  // Recursive function to process files one by one
  const processNextFile = async (files: string[], index: number, currentHistory: Message[]) => {
    if (index >= files.length) {
      setIsBuilding(false)
      setStep("done")
      setCurrentPlan("All files generated successfully!")
      return
    }

    const filename = files[index]
    setStep("coding")
    setCurrentPlan(`Generating ${filename} (${index + 1}/${files.length})...`)

    try {
      const codeResponse = await fetch("/api/ai/generate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: currentHistory,
          systemPrompt: SYSTEM_PROMPT,
          plan: `You are currently generating the file: '${filename}'. Ensure it is complete and integrates with previous files.`,
          model: LOCKED_MODEL.id,
        }),
      })

      if (!codeResponse.ok) throw new Error(`Failed to generate ${filename}`)

      const codeData = await codeResponse.json()

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: codeData.content,
        code: codeData.code,
        pageName: codeData.pageName || filename,
        isIntermediate: index < files.length - 1 // Only show deploy on last one? Or allow early deploy? User said "dont publish before the last stepp"
      }

      // Update history
      const newHistory = [...currentHistory, assistantMessage]
      setMessages(prev => [...prev, assistantMessage])

      // Update generated pages state
      if (codeData.code) {
        const finalName = codeData.pageName || filename
        setGeneratedPages(prev => {
          const existing = prev.findIndex(p => p.name === finalName)
          if (existing >= 0) {
            const updated = [...prev]
            updated[existing] = { name: finalName, code: codeData.code, timestamp: Date.now() }
            return updated
          }
          return [...prev, { name: finalName, code: codeData.code, timestamp: Date.now() }]
        })
      }

      // Next iteration
      setCurrentFileIndex(index + 1)
      processNextFile(files, index + 1, newHistory)

    } catch (err: any) {
      setError(err.message || `Error generating ${filename}`)
      setIsBuilding(false)
      setStep("idle")
    }
  }

  const handleDeployCode = async () => {
    if (generatedPages.length === 0) return

    try {
      const deployUrl = `/api/projects/${encodeURIComponent(projectId)}/deploy-code`
      const response = await fetch(deployUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: generatedPages.map(p => ({ name: p.name, content: p.code }))
        }),
      })

      if (!response.ok) throw new Error("Deploy failed")

      // Determine which code was "deployed" for the UI feedback
      const latestCode = generatedPages[generatedPages.length - 1]?.code
      setDeployedCode(latestCode)

      setDeploySuccess(true)
      setTimeout(() => setDeploySuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to deploy code")
    }
  }

  return (
    <div className="flex flex-col h-full bg-background text-foreground font-sans">
      {/* Header / Model Selector */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Bot className="h-4 w-4" />
          <span>AI Architect</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Task Progress Indicator */}
          {isBuilding && (
             <div className="flex items-center gap-2 mr-4 px-3 py-1 bg-muted rounded-full text-xs animate-pulse">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{currentFileIndex + 1} / {plannedFiles.length}</span>
             </div>
          )}

          <Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-medium border-border/50 bg-background opacity-80 cursor-not-allowed">
            <Cpu className="h-3.5 w-3.5" />
            {LOCKED_MODEL.name}
            <span className="text-[10px] bg-primary/10 text-primary px-1 rounded">LOCKED</span>
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {messages.length === 0 && step === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-30 space-y-4">
            <div className="h-16 w-16 rounded-full bg-foreground/5 flex items-center justify-center">
              <Sparkles className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">Describe your vision. AI will build the entire site.</p>
          </div>
        )}

        {messages.map((message, idx) => (
          <div key={message.id} className="space-y-6">
            {/* User Message */}
            {message.role === "user" && (
              <div className="flex justify-end">
                <div className="max-w-2xl bg-foreground/5 rounded-2xl px-5 py-3 text-sm">
                  <p>{message.content}</p>
                </div>
              </div>
            )}

            {/* Assistant Message (Completed) */}
            {message.role === "assistant" && message.code && (
              <div className="flex justify-start w-full">
                <div className="w-full max-w-3xl space-y-4">
                  {/* Deploy Card */}
                  <Card className={`border-border/50 shadow-sm bg-card/50 ${message.isIntermediate ? 'opacity-70' : ''}`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <FileCode className="h-4 w-4" />
                          <span>File: {message.pageName || "Unknown"}</span>
                        </div>
                        {message.isIntermediate && (
                           <div className="text-xs text-muted-foreground flex items-center gap-1">
                             <ListTodo className="h-3 w-3" />
                             In Progress
                           </div>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="bg-muted/30 rounded-md p-3 font-mono text-xs text-muted-foreground border border-border/30 max-h-32 overflow-hidden relative">
                        {message.code.substring(0, 300)}...
                        <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/30 to-transparent" />
                      </div>
                    </CardContent>
                    {!message.isIntermediate && (
                      <CardFooter className="pt-0">
                        <Button
                          className="w-full sm:w-auto gap-2 bg-foreground text-background hover:bg-foreground/90"
                          onClick={handleDeployCode}
                          disabled={deployedCode === message.code}
                        >
                          {deployedCode === message.code ? (
                            <>
                              <Check className="h-4 w-4" />
                              Deployed
                            </>
                          ) : (
                            <>
                              <Rocket className="h-4 w-4" />
                              Deploy Site
                            </>
                          )}
                        </Button>
                      </CardFooter>
                    )}
                  </Card>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Live Status Area (While working) */}
        {(step === "planning" || step === "coding") && (
          <div className="flex justify-start w-full max-w-3xl">
            <div className="w-full space-y-6">
              <div className="flex items-center gap-3 text-sm font-medium animate-pulse">
                <div className="h-2 w-2 rounded-full bg-foreground" />
                {currentPlan}
              </div>

              {/* Task List Visualization */}
              {plannedFiles.length > 0 && (
                 <div className="pl-5 border-l border-foreground/10 ml-1 space-y-2">
                    {plannedFiles.map((file, i) => (
                       <div key={file} className={`flex items-center gap-2 text-xs ${
                          i === currentFileIndex ? "text-foreground font-medium" :
                          i < currentFileIndex ? "text-muted-foreground line-through opacity-50" : "text-muted-foreground opacity-30"
                       }`}>
                          {i < currentFileIndex ? <Check className="h-3 w-3" /> :
                           i === currentFileIndex ? <Loader2 className="h-3 w-3 animate-spin" /> :
                           <div className="w-3 h-3 rounded-full border border-current" />}
                          {file}
                       </div>
                    ))}
                 </div>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-500/5 p-3 rounded-lg border border-red-500/10">
            <span className="font-bold">Error:</span> {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-background border-t border-border/50">
        <div className="relative max-w-3xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                startGeneration()
              }
            }}
            placeholder={step === "idle" || step === "done" ? "Describe the website you want to build..." : "AI is working..."}
            disabled={step === "planning" || step === "coding"}
            className="pr-12 h-12 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
          />
          <Button
            size="icon"
            disabled={!input.trim() || step === "planning" || step === "coding"}
            onClick={startGeneration}
            className="absolute right-1.5 top-1.5 h-9 w-9 rounded-lg bg-foreground text-background hover:bg-foreground/90 transition-all"
          >
            {step === "planning" || step === "coding" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
