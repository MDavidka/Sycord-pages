import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

// API Configurations
const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"

// Map models to their specific endpoints and Env Vars
const MODEL_CONFIGS: Record<string, { url: string, envVar: string, provider: string }> = {
  "gemini-2.5-flash-lite": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  "deepseek-v3.2-exp": { url: DEEPSEEK_API_URL, envVar: "DEEPSEEK_API", provider: "DeepSeek" }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, systemPrompt, plan, model } = await request.json()

    // Default to Google if not specified
    const modelId = model || "gemini-2.5-flash-lite"
    const config = MODEL_CONFIGS[modelId] || MODEL_CONFIGS["gemini-2.5-flash-lite"]

    // Retrieve the correct API key
    let apiKey = process.env[config.envVar]

    // Fallback for Google if strictly GOOGLE_AI_API is missing but GOOGLE_API_KEY exists (common pattern)
    if (config.provider === "Google" && !apiKey) {
        apiKey = process.env.GOOGLE_API_KEY
    }

    if (!apiKey) {
      console.error(`[v0] AI Service Not Configured: ${config.envVar} missing`)
      return NextResponse.json({ message: `AI service not configured (${config.provider})` }, { status: 500 })
    }

    // Prepare messages array
    // Standardize system prompt
    let effectiveSystemPrompt = systemPrompt
    effectiveSystemPrompt += `\n\nREQUIREMENTS:
      1.  **Production Ready**: Include working JavaScript for all interactive elements. Use <script> tags.
      2.  **Interconnectivity**: Ensure all <a> links point to the correct .html files as planned.
      3.  **Context**: You are building ONE cohesive website.
      4.  **Modern Styling**: Use Tailwind CSS utility classes.
      5.  **Output Format**: You MUST wrap the code in [1] and [1<filename>] markers.
      6.  **Token Efficiency**: Do NOT generate binary files (images, PDFs). Use placeholder URLs (e.g. LoremFlickr) instead. Be concise.
      7.  **File Naming**: Use strictly lowercase filenames with extensions (e.g., index.html, style.css).
      `

    // Map messages to OpenAI format
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

    // Construct raw payload messages
    const rawMessages = [
        { role: "system", content: effectiveSystemPrompt },
        ...conversationHistory
    ]

    // If 'plan' (current task) is provided, append it as a USER message
    if (plan) {
        rawMessages.push({
            role: "user",
            content: `\n\nIMPORTANT: You must strictly follow this implementation plan:\n${plan}\n\n`
        })
    }

    // Sanitize messages to ensure strict alternation (System -> User -> Assistant -> User ...)
    const sanitizedMessages: any[] = []

    if (rawMessages.length > 0 && rawMessages[0].role === "system") {
        sanitizedMessages.push(rawMessages[0])
    }

    for (let i = (rawMessages.length > 0 && rawMessages[0].role === "system" ? 1 : 0); i < rawMessages.length; i++) {
        const msg = rawMessages[i]
        const lastMsg = sanitizedMessages[sanitizedMessages.length - 1]

        if (!lastMsg) {
            // First non-system message MUST be user
            if (msg.role === "user") {
                sanitizedMessages.push(msg)
            } else {
                if (sanitizedMessages.length > 0 && sanitizedMessages[0].role === "system") {
                     sanitizedMessages.push({ role: "user", content: "Continue." })
                     sanitizedMessages.push(msg)
                } else {
                    sanitizedMessages.push(msg)
                }
            }
        } else {
            // Alternation check
            if (lastMsg.role === msg.role) {
                lastMsg.content += `\n\n${msg.content}`
            } else {
                sanitizedMessages.push(msg)
            }
        }
    }

    const payload = {
      model: modelId, // Google OpenAI compat endpoint handles Gemini IDs
      messages: sanitizedMessages,
      temperature: 0.7,
      stream: false
    }

    console.log(`[v0] Generating code with ${config.provider} model: ${modelId}`)

    const response = await fetch(config.url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      let errorMsg = `${config.provider} API error: ${response.status}`
      try {
          const errorData = await response.json()
          console.error(`[v0] ${config.provider} API Error:`, errorData)
          if (errorData.error?.message) {
              errorMsg = errorData.error.message
          }
      } catch (e) {
          console.error(`[v0] ${config.provider} API returned non-JSON error:`, response.status, response.statusText)
          const text = await response.text()
          console.error(`[v0] ${config.provider} Error Body:`, text.substring(0, 500))
      }
      throw new Error(errorMsg)
    }

    const data = await response.json()
    // Standard OpenAI response format
    const responseText = data.choices?.[0]?.message?.content || ""

    if (!responseText) {
        console.error(`[v0] Empty response payload from ${config.provider}. Full response:`, JSON.stringify(data, null, 2))
        throw new Error(`Empty response from AI provider (${config.provider})`)
    }

    console.log(`[v0] Success with ${modelId}, response length:`, responseText.length)

    // Regex to capture code and page name
    let codeMarkerRegex = /\[1\]([\s\S]*?)\[1<(.+?)>\]/
    let codeMarkerMatch = responseText.match(codeMarkerRegex)

    let extractedCode = null
    let extractedPageName = null

    if (!codeMarkerMatch) {
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
      const markdownRegex = /```(?:html)?([\s\S]*?)```/i
      const markdownMatch = responseText.match(markdownRegex)

      if (markdownMatch) {
        extractedCode = markdownMatch[1].trim()
        extractedPageName = "index.html"
      } else {
        const htmlRegex = /<!DOCTYPE html>[\s\S]*<\/html>|<html[\s\S]*<\/html>/i
        const htmlMatch = responseText.match(htmlRegex)
        if (htmlMatch) {
          extractedCode = htmlMatch[0].trim()
          extractedPageName = "index.html"
        }
      }
    }

    if (!extractedCode) {
       if (responseText.length > 50 && (responseText.includes("<html") || responseText.includes("<div"))) {
           extractedCode = responseText
           extractedPageName = "index.html"
       }
    }

    if (extractedCode && !extractedCode.toLowerCase().includes("<!doctype")) {
      extractedCode = "<!DOCTYPE html>\n" + extractedCode
    }

    const shouldContinue = responseText.includes("[continue]")

    return NextResponse.json({
      content: responseText,
      code: extractedCode || null,
      pageName: extractedPageName || null,
      shouldContinue: shouldContinue,
      modelUsed: modelId,
    })
  } catch (error: any) {
    console.error("[v0] AI generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate content" }, { status: 500 })
  }
}
