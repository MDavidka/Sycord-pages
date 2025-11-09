"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Send, Code2 } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  code?: string
}

const SYSTEM_PROMPT = `You are an expert web developer creating beautiful, production-ready HTML websites for e-commerce stores.

CRITICAL: You MUST generate valid, complete HTML code that can be rendered directly in a browser.

MARKER INSTRUCTIONS:
When providing code, wrap it EXACTLY like this:
[1]
<!DOCTYPE html>
<html>
...your complete HTML code...
</html>
[1]

ESSENTIAL REQUIREMENTS:
1. Start with <!DOCTYPE html> and <html> tag
2. Include <head> with meta tags and <title>
3. Include <script src="https://cdn.tailwindcss.com"></script> for styling
4. Write ALL code in pure HTML - NO REACT, NO JSX, NO TYPESCRIPT
5. Use Tailwind CSS classes for styling
6. Make it fully responsive (mobile-first)
7. NO backticks (\`\`\`), NO markdown formatting
8. ONLY the code should be between [1] markers
9. You can explain BEFORE the markers, but markers must contain ONLY HTML

E-commerce components you can create:
- Product grids and carousels
- Hero sections with CTAs
- Navigation headers
- Image galleries
- Testimonial sections
- Newsletter signups
- Product detail pages
- Footer sections

Example output format:
"Here's a beautiful product grid component:

[1]
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Product Grid</title>
    <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-gray-50">
    <div class="max-w-7xl mx-auto px-4 py-12">
        <h2 class="text-4xl font-bold mb-8">Featured Products</h2>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
            <!-- Product cards here -->
        </div>
    </div>
</body>
</html>
[1]"`

const AIWebsiteBuilder = ({ projectId }: { projectId: string }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deployedCode, setDeployedCode] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "0",
          role: "assistant",
          content: `Welcome to AI Website Builder! 🚀\n\nI'm your AI design assistant for creating production-ready e-commerce websites. I generate valid HTML code that you can deploy instantly.\n\nI can help you:\n\n1. **Design Sections** - Headers, heroes, product showcases, testimonials\n2. **Build Components** - Reusable HTML components with Tailwind CSS\n3. **Create Pages** - Full e-commerce pages ready to deploy\n4. **Customize Styles** - Colors, fonts, animations, responsive design\n\nJust describe what you want to create!\n\nExample prompts:\n- "Create a modern hero section with a call-to-action button"\n- "Build a product grid showing 4 items with prices"\n- "Design a testimonials section with star ratings"\n- "Make a header with navigation menu and logo"`,
        },
      ])
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
        throw new Error("Failed to generate response")
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.content,
        code: data.code,
      }

      setMessages((prev) => [...prev, assistantMessage])
      console.log("[AIWebsiteBuilder] Generated code:", data.code)
    } catch (err: any) {
      setError(err.message || "An error occurred")
      console.error("[v0] AI error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeployCode = async (code: string) => {
    if (!code || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/deploy-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to deploy code")
      }

      const data = await response.json()
      setDeployedCode(code)

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 2).toString(),
          role: "assistant",
          content:
            "✅ Code deployed successfully! Your website is now live with the new design. You can view it in the preview above.",
        },
      ])
      console.log("[AIWebsiteBuilder] Deployed code:", code)
    } catch (err: any) {
      setError(err.message || "Failed to deploy code")
      console.error("[v0] Deploy error:", err)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-background rounded-lg border">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-lg p-4 ${
                message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>

              {message.code && (
                <div className="mt-3 pt-3 border-t border-current/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Code2 className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase opacity-70">HTML Code</span>
                  </div>
                  <pre className="bg-black/10 dark:bg-black/50 rounded p-3 overflow-x-auto text-xs max-h-64 overflow-y-auto">
                    <code className="font-mono text-xs">{message.code}</code>
                  </pre>
                  <div className="flex gap-2 mt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 text-xs bg-transparent"
                      onClick={() => {
                        navigator.clipboard.writeText(message.code!)
                      }}
                    >
                      Copy Code
                    </Button>
                    <Button
                      size="sm"
                      className="flex-1 text-xs bg-green-600 hover:bg-green-700"
                      onClick={() => handleDeployCode(message.code!)}
                      disabled={isLoading || deployedCode === message.code}
                    >
                      {deployedCode === message.code ? "Deployed ✓" : "Deploy to Website"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg p-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm text-muted-foreground">Generating your design...</span>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex justify-start">
            <div className="bg-destructive/10 border border-destructive rounded-lg p-4 text-destructive text-sm">
              Error: {error}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t p-4 space-y-3">
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
            placeholder="Describe your website section..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={handleSendMessage} disabled={isLoading || !input.trim()} size="icon">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          💡 Be specific: "Create a product grid with 4 columns, blue buttons, and hover effects"
        </p>
      </div>
    </div>
  )
}

export default AIWebsiteBuilder
