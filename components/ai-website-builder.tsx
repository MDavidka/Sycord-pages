"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Code2, AlertCircle, CheckCircle, ChevronDown } from 'lucide-react'

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  code?: string
}

const SYSTEM_PROMPT = `You are an expert web developer creating beautiful, production-ready HTML websites for e-commerce stores.

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
7. NO backticks, NO markdown formatting anywhere
8. ONLY code between [1] markers - NO EXTRA TEXT between markers
9. Explain BEFORE the [1] marker if needed, but markers must be pure code

E-commerce components you can create:
- Product grids and carousels
- Hero sections with CTAs
- Navigation headers
- Image galleries
- Testimonial sections
- Newsletter signups
- Footer sections

EXAMPLE OUTPUT:
Here's a beautiful product grid:

[1]
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Products</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-12">
        <h2 class="text-4xl font-bold mb-8">Featured</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div class="bg-white rounded-lg p-6">Product</div>
        </div>
    </div>
</body>
</html>
[1]`

const MODEL_OPTIONS = [
  { label: "Gemini 2.5 Pro", value: "gemini-2.5-pro" },
  { label: "Gemini 2.0 Pro", value: "gemini-2.0-pro" },
  { label: "Gemini 2.0 Flash", value: "gemini-2.0-flash" },
]

const AIWebsiteBuilder = ({ projectId }: { projectId: string }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deployedCode, setDeployedCode] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-pro")
  const [generationTime, setGenerationTime] = useState(0)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (isLoading) {
      setGenerationTime(0)
      timerRef.current = setInterval(() => {
        setGenerationTime((prev) => prev + 1)
      }, 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isLoading])

  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)
    setError(null)
    setDeploySuccess(false)

    try {
      const response = await fetch("/api/ai/generate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: [...messages, userMessage],
          systemPrompt: SYSTEM_PROMPT,
          selectedModel,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to generate response")
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        code: data.code,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeployCode = async (code: string) => {
    if (!code || isLoading) return

    if (!projectId) {
      setError("Project ID is missing. Please refresh the page.")
      return
    }

    setIsLoading(true)
    setError(null)
    setDeploySuccess(false)

    try {
      if (!code.toLowerCase().includes("<!doctype") && !code.toLowerCase().includes("<html")) {
        throw new Error("Invalid code: must contain valid HTML structure")
      }

      const deployUrl = `/api/projects/${encodeURIComponent(projectId)}/deploy-code`

      const response = await fetch(deployUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        throw new Error(responseData.message || `Deploy failed with status ${response.status}`)
      }

      setDeployedCode(code)
      setDeploySuccess(true)

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content: "✅ Website deployed successfully! Your changes are now live.",
        },
      ])

      setTimeout(() => setDeploySuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to deploy code")
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const progress = Math.min((generationTime / 30) * 100, 100)

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-background to-background/95">
      <div className="backdrop-blur-md bg-background/40 border-b border-white/10 px-4 py-3 sticky top-0 z-10">
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              disabled={isLoading}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-sm font-medium transition-all disabled:opacity-50"
            >
              <span>Model:</span>
              <span className="text-blue-400">{selectedModel.split("-").slice(1).join(" ")}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
            {showModelMenu && !isLoading && (
              <div className="absolute top-full left-0 mt-1 bg-background/95 backdrop-blur border border-white/20 rounded-lg shadow-lg z-20 min-w-48">
                {MODEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setSelectedModel(option.value)
                      setShowModelMenu(false)
                    }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-white/10 border-b border-white/5 last:border-0 transition-colors"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {isLoading && (
            <div className="flex items-center gap-3">
              <div className="text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {formatTime(generationTime)}
                </span>
              </div>
              <div className="w-32 h-1 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-muted-foreground">
              <p className="text-sm font-medium">Start creating your website</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-2xl rounded-2xl px-4 py-3 backdrop-blur-sm ${
                message.role === "user"
                  ? "bg-blue-600/90 text-white shadow-lg"
                  : "bg-white/10 border border-white/20 text-foreground"
              }`}
            >
              <p className="text-sm leading-relaxed">{message.content}</p>

              {message.code && (
                <div className="mt-4 pt-3 border-t border-current/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Code2 className="h-4 w-4" />
                    <span className="text-xs font-semibold opacity-70">Generated Code</span>
                  </div>
                  <pre className="bg-slate-950/90 backdrop-blur rounded-lg p-3 overflow-x-auto max-h-48 overflow-y-auto font-mono text-xs text-slate-300 border border-white/10">
                    <code>{message.code.substring(0, 300)}...</code>
                  </pre>
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-7 px-2.5 hover:bg-white/20"
                      onClick={() => navigator.clipboard.writeText(message.code!)}
                    >
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-7 flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-md"
                      onClick={() => handleDeployCode(message.code!)}
                      disabled={isLoading || deployedCode === message.code}
                    >
                      {deployedCode === message.code ? (
                        <>
                          <CheckCircle className="h-3.5 w-3.5 mr-1.5" />
                          Live
                        </>
                      ) : (
                        <>
                          <Send className="h-3.5 w-3.5 mr-1.5" />
                          Deploy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
              <span className="text-sm text-muted-foreground">Generating...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-red-500/20 backdrop-blur border border-red-500/30 rounded-2xl px-4 py-3 text-red-400 text-sm flex items-start gap-2 max-w-xl">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {deploySuccess && (
          <div className="flex justify-start">
            <div className="bg-green-500/20 backdrop-blur border border-green-500/30 rounded-2xl px-4 py-3 text-green-400 text-sm flex items-start gap-2 max-w-xl">
              <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Changes live on your website!</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <div className="backdrop-blur-md bg-background/40 border-t border-white/10 px-4 py-4 sticky bottom-0">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault()
                handleSendMessage()
              }
            }}
            placeholder="Describe your design..."
            disabled={isLoading}
            className="flex-1 h-11 text-sm rounded-full border border-white/20 bg-white/10 backdrop-blur placeholder:text-muted-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-5 transition-all"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="h-11 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-full transition-all disabled:opacity-50"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
