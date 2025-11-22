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
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

const MODELS = [
  { id: "gemini-3-pro-preview", name: "Gemini 3 Pro Preview" },
  { id: "gemini-2.0-pro-exp-02-05", name: "Gemini 2.0 Pro (Latest)" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro (Stable)" },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash (Fast)" },
]

const SYSTEM_PROMPT = `You are an expert web developer creating beautiful, production-ready HTML websites.

CRITICAL: You MUST generate valid, complete HTML code that can be rendered directly in a browser.

MARKER INSTRUCTIONS:
When providing code, wrap it EXACTLY like this with NO backticks:
[1]
<!DOCTYPE html>
<html>
...your complete HTML code...
</html>
[1]

ESSENTIAL REQUIREMENTS:
1. Start with <!DOCTYPE html> and complete <html> tag
2. Include <head> with meta tags and <title>
3. Include <script src="https://cdn.tailwindcss.com"><\/script> for styling
4. Write ALL code in pure HTML - NO REACT, NO JSX, NO TYPESCRIPT
5. Use Tailwind CSS classes for styling
6. Make it fully responsive (mobile-first)
7. DESIGN STYLE: Use HeroUI (NextUI) aesthetics. Use clean, modern design with ample whitespace, rounded-2xl border radius, subtle shadows, and primary colors like standard blue/purple/black. Use Tailwind classes to mimic HeroUI components (e.g. buttons with slight shadow and rounded corners, inputs with clean borders, cards with soft shadows).
8. NO backticks, NO markdown formatting anywhere
9. ONLY code between [1] markers`

type Step = "idle" | "planning" | "coding" | "done"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  code?: string
  plan?: string
}

const AIWebsiteBuilder = ({ projectId }: { projectId: string }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [selectedModel, setSelectedModel] = useState(MODELS[0])
  const [step, setStep] = useState<Step>("idle")
  const [currentPlan, setCurrentPlan] = useState("")
  const [displayedPlan, setDisplayedPlan] = useState("")
  const [deployedCode, setDeployedCode] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, displayedPlan, step])

  // Typewriter effect for the plan
  useEffect(() => {
    if (currentPlan && displayedPlan.length < currentPlan.length) {
      const timeout = setTimeout(() => {
        setDisplayedPlan(currentPlan.slice(0, displayedPlan.length + 5)) // Reveal chunks for speed
      }, 10)
      return () => clearTimeout(timeout)
    }
  }, [currentPlan, displayedPlan])

  const handleSendMessage = async () => {
    if (!input.trim() || step === "planning" || step === "coding") return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setStep("planning")
    setError(null)
    setCurrentPlan("")
    setDisplayedPlan("")

    try {
      // Step 1: Generate Plan (Small Model)
      const planResponse = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage],
        }),
      })

      if (!planResponse.ok) throw new Error("Failed to generate plan")

      const planData = await planResponse.json()
      const planText = planData.plan
      setCurrentPlan(planText)

      // Step 2: Generate Code (Big Model)
      setStep("coding")

      const codeResponse = await fetch("/api/ai/generate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: [...messages, userMessage],
          systemPrompt: SYSTEM_PROMPT,
          plan: planText,
          model: selectedModel.id,
        }),
      })

      if (!codeResponse.ok) throw new Error("Failed to generate code")

      const codeData = await codeResponse.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: codeData.content,
        code: codeData.code,
        plan: planText,
      }

      setMessages((prev) => [...prev, assistantMessage])
      setStep("done")
    } catch (err: any) {
      setError(err.message || "An error occurred")
      setStep("idle")
    }
  }

  const handleDeployCode = async (code: string) => {
    if (!code) return

    try {
      const deployUrl = `/api/projects/${encodeURIComponent(projectId)}/deploy-code`
      const response = await fetch(deployUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) throw new Error("Deploy failed")

      setDeployedCode(code)
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
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-2 text-xs font-medium border-border/50 bg-background">
              <Cpu className="h-3.5 w-3.5" />
              {selectedModel.name}
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {MODELS.map((model) => (
              <DropdownMenuItem
                key={model.id}
                onClick={() => setSelectedModel(model)}
                className="text-xs cursor-pointer"
              >
                {selectedModel.id === model.id && <Check className="h-3 w-3 mr-2" />}
                {selectedModel.id !== model.id && <div className="w-5" />}
                {model.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {messages.length === 0 && step === "idle" && (
          <div className="flex flex-col items-center justify-center h-full text-center opacity-30 space-y-4">
            <div className="h-16 w-16 rounded-full bg-foreground/5 flex items-center justify-center">
              <Sparkles className="h-8 w-8" />
            </div>
            <p className="text-sm font-medium">Describe your vision. AI will build it.</p>
          </div>
        )}

        {messages.map((message) => (
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
                  {/* Plan Summary Card (Collapsed/Minimal) */}
                  <div className="pl-4 border-l-2 border-border/50">
                    <h3 className="text-xs font-medium uppercase tracking-wider opacity-50 mb-2 flex items-center gap-2">
                      <Terminal className="h-3 w-3" />
                      Execution Plan
                    </h3>
                    <div className="text-xs text-muted-foreground line-clamp-3 hover:line-clamp-none transition-all cursor-pointer">
                      {message.plan}
                    </div>
                  </div>

                  {/* Deploy Card */}
                  <Card className="border-border/50 shadow-sm bg-card/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileCode className="h-4 w-4" />
                        Website Ready to Deploy
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="bg-muted/30 rounded-md p-3 font-mono text-xs text-muted-foreground border border-border/30">
                        {message.code.substring(0, 150)}...
                      </div>
                    </CardContent>
                    <CardFooter className="pt-0">
                      <Button
                        className="w-full sm:w-auto gap-2 bg-foreground text-background hover:bg-foreground/90"
                        onClick={() => handleDeployCode(message.code!)}
                        disabled={deployedCode === message.code}
                      >
                        {deployedCode === message.code ? (
                          <>
                            <Check className="h-4 w-4" />
                            Deployed Successfully
                          </>
                        ) : (
                          <>
                            <Rocket className="h-4 w-4" />
                            Deploy Website
                          </>
                        )}
                      </Button>
                    </CardFooter>
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

              {/* Status Indicator */}
              <div className="flex items-center gap-3 text-sm font-medium animate-pulse">
                <div className="h-2 w-2 rounded-full bg-foreground" />
                {step === "planning" ? "AI is drafting a blueprint..." : "AI is generating code..."}
              </div>

              {/* Streaming Plan */}
              {(currentPlan || step === "coding") && (
                <div className="pl-5 border-l border-foreground/20 ml-1">
                   <h3 className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2">
                      <Terminal className="h-3 w-3" />
                      Architectural Plan
                    </h3>
                  <div className="font-mono text-xs leading-relaxed opacity-80 whitespace-pre-wrap">
                    {displayedPlan}
                    {displayedPlan.length < currentPlan.length && <span className="inline-block w-1.5 h-3 bg-foreground ml-1 animate-pulse" />}
                  </div>
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
                handleSendMessage()
              }
            }}
            placeholder={step === "idle" || step === "done" ? "Describe the website you want to build..." : "AI is working..."}
            disabled={step === "planning" || step === "coding"}
            className="pr-12 h-12 rounded-xl bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-foreground/20"
          />
          <Button
            size="icon"
            disabled={!input.trim() || step === "planning" || step === "coding"}
            onClick={handleSendMessage}
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
