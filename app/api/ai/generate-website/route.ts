import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

// Groq Configuration
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const CODE_MODEL = "qwen/qwen3-32b"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, systemPrompt, plan } = await request.json()

    const apiKey = process.env.QROG_API
    if (!apiKey) {
      console.error("[v0] QROG_API not configured")
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    // Enhance system prompt with plan
    let effectiveSystemPrompt = systemPrompt
    if (plan) {
      effectiveSystemPrompt += `\n\nIMPORTANT: You must strictly follow this implementation plan:\n${plan}\n\n`
      effectiveSystemPrompt += `REQUIREMENTS:
      1.  **Production Ready**: Include working JavaScript for all interactive elements. Use <script> tags.
      2.  **Interconnectivity**: Ensure all <a> links point to the correct .html files as planned.
      3.  **Context**: You are building ONE cohesive website.
      4.  **Modern Styling**: Use Tailwind CSS utility classes.
      `
    }

    // Map messages to OpenAI format (Groq is compatible)
    const conversationHistory = messages.map((msg: any) => {
      let textContent = msg.content
      if (msg.role === "assistant" && msg.code) {
        textContent += `\n\n[PREVIOUS GENERATED CODE START]\nPage: ${msg.pageName || 'unknown'}\n${msg.code}\n[PREVIOUS GENERATED CODE END]`
      }
      return {
        role: msg.role === "user" ? "user" : "assistant",
        content: textContent,
      }
    })

    const payload = {
      model: CODE_MODEL,
      messages: [
        { role: "system", content: effectiveSystemPrompt },
        ...conversationHistory
      ],
      temperature: 0.7, // Standard for code
    }

    console.log(`[v0] Generating code with Groq model: ${CODE_MODEL}`)

    const response = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json()
      console.error("[v0] Groq API Error:", errorData)
      throw new Error(errorData.error?.message || `Groq API error: ${response.status}`)
    }

    const data = await response.json()
    const responseText = data.choices[0]?.message?.content || ""

    console.log(`[v0] Success with ${CODE_MODEL}, response length:`, responseText.length)

    // Regex to capture code and page name
    // Format: [1]...code...[1<page_name>]
    // Also support [1<page_name>]...[1<page_name>] just in case
    let codeMarkerRegex = /\[1\]([\s\S]*?)\[1<(.+?)>\]/
    let codeMarkerMatch = responseText.match(codeMarkerRegex)

    let extractedCode = null
    let extractedPageName = null

    if (!codeMarkerMatch) {
        // Try alternative format: start tag has name too
        codeMarkerRegex = /\[1<(.+?)>\]([\s\S]*?)\[1<\1>\]/
        const match = responseText.match(codeMarkerRegex)
        if (match) {
            extractedPageName = match[1].trim()
            extractedCode = match[2].trim()
            codeMarkerMatch = match
        }
    } else {
        extractedCode = codeMarkerMatch[1].trim()
        extractedPageName = codeMarkerMatch[2].trim()
    }

    if (extractedCode) {
      console.log("[v0] Code extracted with page name:", extractedPageName)
    } else {
      console.warn("[v0] No code markers found, checking for HTML/Markdown in response")

      // Fallback 2: Markdown code blocks
      const markdownRegex = /```(?:html)?([\s\S]*?)```/i
      const markdownMatch = responseText.match(markdownRegex)

      if (markdownMatch) {
        extractedCode = markdownMatch[1].trim()
        extractedPageName = "index.html"
        console.log("[v0] Code extracted from Markdown fallback")
      } else {
        // Fallback 3: Raw HTML
        const htmlRegex = /<html[\s\S]*<\/html>/i
        const htmlMatch = responseText.match(htmlRegex)
        if (htmlMatch) {
          extractedCode = htmlMatch[0].trim()
          extractedPageName = "index.html"
          console.log("[v0] Code extracted from HTML fallback")
        }
      }
    }

    if (extractedCode && !extractedCode.toLowerCase().includes("<!doctype")) {
      console.warn("[v0] Code missing DOCTYPE, adding it")
      extractedCode = "<!DOCTYPE html>\n" + extractedCode
    }

    const shouldContinue = responseText.includes("[continue]")

    return NextResponse.json({
      content: responseText,
      code: extractedCode || null,
      pageName: extractedPageName || null,
      shouldContinue: shouldContinue,
      modelUsed: CODE_MODEL,
    })
  } catch (error: any) {
    console.error("[v0] AI generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate content" }, { status: 500 })
  }
}
