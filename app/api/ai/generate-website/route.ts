import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

// API Configurations
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"
const MISTRAL_API_URL = "https://api.mistral.ai/v1/chat/completions"

// Map models to their specific endpoints and Env Vars
// Cloudflare URL is dynamic, so we use a placeholder here
const MODEL_CONFIGS: Record<string, { url: string, envVar: string, provider: string }> = {
  "qwen/qwen3-32b": { url: GROQ_API_URL, envVar: "QROG_API", provider: "Groq" },
  "codestral-2501": { url: MISTRAL_API_URL, envVar: "MISTRAL_API", provider: "Mistral" },
  "@cf/qwen/qwen3-30b-a3b-fp8": { url: "CLOUDFLARE_DYNAMIC", envVar: "CLOUDFLARE_API", provider: "Cloudflare" }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, systemPrompt, plan, model } = await request.json()

    // Default to Codestral if not specified
    const modelId = model || "codestral-2501"
    const config = MODEL_CONFIGS[modelId] || MODEL_CONFIGS["codestral-2501"]

    // Retrieve the correct API key
    let apiKey = process.env[config.envVar]

    // Fallback for Qwen/Groq specific weirdness from previous steps
    if (config.provider === "Groq" && !apiKey) {
        apiKey = process.env.GROQ_API
    }

    if (!apiKey) {
      console.error(`[v0] AI Service Not Configured: ${config.envVar} missing`)
      return NextResponse.json({ message: `AI service not configured (${config.provider})` }, { status: 500 })
    }

    // Determine URL
    let apiUrl = config.url
    if (config.provider === "Cloudflare") {
        const accountId = process.env.CLOUDFLARE_ACCOUNT_ID
        if (!accountId) {
             console.error("[v0] CLOUDFLARE_ACCOUNT_ID missing")
             return NextResponse.json({ message: "Cloudflare Account ID not configured" }, { status: 500 })
        }
        // Use OpenAI-compatible endpoint
        apiUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`
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
      5.  **Output Format**: You MUST wrap the code in [1] and [1<filename>] markers.
      `
    }

    // Map messages to OpenAI format (Mistral/Groq/Cloudflare are compatible)
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
      model: modelId,
      messages: [
        { role: "system", content: effectiveSystemPrompt },
        ...conversationHistory
      ],
      temperature: 0.7,
      stream: false
    }

    console.log(`[v0] Generating code with ${config.provider} model: ${modelId}`)

    const response = await fetch(apiUrl, {
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
          // Cloudflare specific error structure
          if (errorData.errors && Array.isArray(errorData.errors) && errorData.errors.length > 0) {
             errorMsg = errorData.errors[0].message
          }
      } catch (e) {
          console.error(`[v0] ${config.provider} API returned non-JSON error:`, response.status, response.statusText)
          const text = await response.text()
          console.error(`[v0] ${config.provider} Error Body:`, text.substring(0, 500))
      }
      throw new Error(errorMsg)
    }

    const data = await response.json()
    // Cloudflare response structure might slightly differ, but OpenAI compatible endpoint usually follows choice[0].message
    const responseText = data.choices?.[0]?.message?.content || data.result?.response || ""

    if (!responseText) {
        throw new Error("Empty response from AI provider")
    }

    console.log(`[v0] Success with ${modelId}, response length:`, responseText.length)

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
        // Fallback 3: Raw HTML (look for <html or <!DOCTYPE)
        const htmlRegex = /<!DOCTYPE html>[\s\S]*<\/html>|<html[\s\S]*<\/html>/i
        const htmlMatch = responseText.match(htmlRegex)
        if (htmlMatch) {
          extractedCode = htmlMatch[0].trim()
          extractedPageName = "index.html"
          console.log("[v0] Code extracted from HTML fallback")
        }
      }
    }

    if (!extractedCode) {
       // Last ditch effort: if the response is somewhat long and contains HTML tags, treat it as code
       if (responseText.length > 50 && (responseText.includes("<html") || responseText.includes("<div"))) {
           console.log("[v0] Code extracted from raw text fallback")
           extractedCode = responseText
           extractedPageName = "index.html"
       }
    }

    if (extractedCode && !extractedCode.toLowerCase().includes("<!doctype")) {
      console.warn("[v0] Code missing DOCTYPE, adding it")
      extractedCode = "<!DOCTYPE html>\n" + extractedCode
    }

    const shouldContinue = responseText.includes("[continue]")

    return NextResponse.json({
      content: responseText,
      code: extractedCode || null, // Ensure explicit null if failed
      pageName: extractedPageName || null,
      shouldContinue: shouldContinue,
      modelUsed: modelId,
    })
  } catch (error: any) {
    console.error("[v0] AI generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate content" }, { status: 500 })
  }
}
