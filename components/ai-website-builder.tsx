"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Code2, AlertCircle, CheckCircle } from "lucide-react"

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
  const [selectedModel, setSelectedModel] = useState("gemini-2.0-flash")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  console.log("[v0] AIWebsiteBuilder initialized with projectId:", projectId)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([])
    }
  }, [])

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
      console.log("[v0] Sending message to AI API with model:", selectedModel)
      const response = await fetch("/api/ai/generate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: [...messages, userMessage],
          model: selectedModel,
          systemPrompt: SYSTEM_PROMPT,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to generate response")
      }

      const data = await response.json()
      console.log("[v0] AI response received. Has code:", !!data.code)

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        code: data.code,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (err: any) {
      setError(err.message || "An error occurred")
      console.error("[v0] AI error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeployCode = async (code: string) => {
    if (!code || isLoading) return

    if (!projectId) {
      setError("Project ID is missing. Please refresh the page.")
      console.error("[v0] Deploy: projectId is missing")
      return
    }

    setIsLoading(true)
    setError(null)
    setDeploySuccess(false)

    try {
      console.log("[v0] Deploying code for project:", projectId, "Code length:", code.length)

      if (!code.toLowerCase().includes("<!doctype") && !code.toLowerCase().includes("<html")) {
        throw new Error("Invalid code: must contain valid HTML structure")
      }

      const deployUrl = `/api/projects/${encodeURIComponent(projectId)}/deploy-code`
      console.log("[v0] Deploy URL:", deployUrl)

      const response = await fetch(deployUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      })

      const responseData = await response.json()

      if (!response.ok) {
        console.error("[v0] Deploy failed:", response.status, responseData)
        throw new Error(responseData.message || `Deploy failed with status ${response.status}`)
      }

      console.log("[v0] Deploy response:", responseData)
      setDeployedCode(code)
      setDeploySuccess(true)

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content:
            "✅ Code deployed successfully! Your website is now live with the new design. Visit your site to see the changes.",
        },
      ])

      // Auto-hide success state after 3 seconds
      setTimeout(() => setDeploySuccess(false), 3000)
    } catch (err: any) {
      setError(err.message || "Failed to deploy code")
      console.error("[v0] Deploy error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] sm:max-w-[75%] rounded-lg p-3 text-sm ${
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <p className="whitespace-pre-wrap text-xs sm:text-sm leading-relaxed">{message.content}</p>

              {message.code && (
                <div className="mt-3 pt-3 border-t border-current/20">
                  <div className="flex items-center gap-2 mb-3">
                    <Code2 className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wide opacity-70">Generated Code</span>
                  </div>
                  <pre className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 overflow-x-auto text-xs max-h-48 overflow-y-auto font-mono border border-slate-700">
                    <code className="text-slate-200">{message.code.substring(0, 300)}...</code>
                  </pre>
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-xs h-9 bg-transparent"
                      onClick={() => navigator.clipboard.writeText(message.code!)}
                    >
                      Copy Code
                    </Button>
                    <Button
                      size="sm"
                      className="text-xs h-9 flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg"
                      onClick={() => handleDeployCode(message.code!)}
                      disabled={isLoading || deployedCode === message.code}
                    >
                      {deployedCode === message.code ? (
                        <>
                          <CheckCircle className="h-4 w-4 mr-2" />
                          Live
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" />
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
            <div className="bg-muted rounded-lg p-2 sm:p-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                <span className="text-xs sm:text-sm text-muted-foreground">Generating...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-destructive/10 border border-destructive rounded-lg p-2 sm:p-3 text-destructive text-xs sm:text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          </div>
        )}

        {deploySuccess && (
          <div className="flex justify-start">
            <div className="bg-green-500/10 border border-green-500 rounded-lg p-2 sm:p-3 text-green-700 dark:text-green-400 text-xs sm:text-sm flex items-start gap-2">
              <CheckCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>Website updated! Check your site to see the changes.</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-3 bg-background sticky bottom-0 shadow-lg">
        <div className="mb-3 flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Model:</label>
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            disabled={isLoading}
            className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-background text-foreground focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
          </select>
        </div>
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
            className="flex-1 h-12 text-base rounded-lg border-2 border-slate-200 dark:border-slate-700 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 px-4 transition-all"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="lg"
            className="h-12 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold shadow-lg rounded-lg transition-all"
          >
            {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
