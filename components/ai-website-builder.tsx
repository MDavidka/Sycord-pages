"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Code2, AlertCircle, CheckCircle } from 'lucide-react'

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

const AIWebsiteBuilder = ({ projectId }: { projectId: string }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deployedCode, setDeployedCode] = useState<string | null>(null)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

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

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages Area - Cleaner and more spacious */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full text-center">
            <div className="text-muted-foreground">
              <p className="text-sm font-medium">Start creating your website</p>
              <p className="text-xs mt-1 opacity-70">Describe what you want and I'll generate the code</p>
            </div>
          </div>
        )}

        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-sm rounded-lg p-2.5 text-sm ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap text-xs leading-relaxed">{message.content}</p>

              {message.code && (
                <div className="mt-2.5 pt-2.5 border-t border-current/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Code2 className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium opacity-70">Code</span>
                  </div>
                  <pre className="bg-slate-900 rounded p-2 overflow-x-auto text-xs max-h-40 overflow-y-auto font-mono text-slate-200 border border-slate-700">
                    <code>{message.code.substring(0, 250)}...</code>
                  </pre>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs h-8 px-2"
                      onClick={() => navigator.clipboard.writeText(message.code!)}
                    >
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-8 flex-1 bg-blue-600 hover:bg-blue-700 text-white font-medium"
                      onClick={() => handleDeployCode(message.code!)}
                      disabled={isLoading || deployedCode === message.code}
                    >
                      {deployedCode === message.code ? (
                        <>
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Live
                        </>
                      ) : (
                        <>
                          <Send className="h-3 w-3 mr-1" />
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
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-2">
              <div className="flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span className="text-xs text-muted-foreground">Generating...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-red-500/10 rounded-lg p-2 text-red-600 dark:text-red-400 text-xs flex items-start gap-1.5 max-w-xs border border-red-200 dark:border-red-900/50">
              <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {deploySuccess && (
          <div className="flex justify-start">
            <div className="bg-green-500/10 rounded-lg p-2 text-green-700 dark:text-green-400 text-xs flex items-start gap-1.5 max-w-xs border border-green-200 dark:border-green-900/50">
              <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
              <span>Changes live on your website!</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area - Clean and minimal */}
      <div className="border-t bg-background px-4 py-3 shadow-sm">
        <div className="flex gap-2">
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
            className="flex-1 h-9 text-sm rounded-lg border border-slate-300 dark:border-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-3 transition-colors"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="sm"
            className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
