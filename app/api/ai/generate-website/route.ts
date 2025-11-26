import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { GoogleGenerativeAI } from "@google/generative-ai"

const DEFAULT_MODELS = [
  "gemini-2.0-flash",
  "gemini-2.0-pro-exp-02-05",
  "gemini-1.5-pro",
  "gemini-1.5-flash",
]

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, systemPrompt, projectId, plan, model: requestedModel } = await request.json()

    if (!process.env.GOOGLE_API_TOKEN) {
      console.error("[v0] GOOGLE_API_TOKEN not configured")
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    const client = new GoogleGenerativeAI(process.env.GOOGLE_API_TOKEN)

    let modelsToTry = [...DEFAULT_MODELS]

    // If a specific model is requested, prioritize it
    if (requestedModel) {
      // Remove it if it exists in the list to avoid duplicates, then add to front
      modelsToTry = modelsToTry.filter(m => m !== requestedModel)
      modelsToTry.unshift(requestedModel)
    }

    let responseText = null
    let lastError = null
    let usedModel = null

    // enhance system prompt with plan if available
    let effectiveSystemPrompt = systemPrompt
    if (plan) {
      effectiveSystemPrompt += `\n\nIMPORTANT: You must strictly follow this implementation plan:\n${plan}\n\n`
      effectiveSystemPrompt += `REQUIREMENTS:
      1.  **Production Ready**: Include working JavaScript for all interactive elements (menus, sliders, modals). Use <script> tags.
      2.  **Interconnectivity**: Ensure all <a> links point to the correct .html files as planned (e.g. href="shop.html"). IMPORTANT: Filenames in links MUST match the generated filenames exactly.
      3.  **Context**: You are building ONE cohesive website. If 'index.html' exists in history, and you are building 'shop.html', ensure 'shop.html' has the same header/footer and links back to 'index.html'.
      4.  **Modern Styling**: Use Tailwind CSS utility classes for animations (e.g., 'transition-all duration-300', 'hover:scale-105', 'animate-fade-in'). Create custom animations in <style> if needed.
      `
    }

    for (const modelName of modelsToTry) {
      try {
        console.log(`[v0] Attempting with model: ${modelName}`)
        const model = client.getGenerativeModel({ model: modelName })

        const conversationHistory = messages.map((msg: any) => {
          let textContent = msg.content
          if (msg.role === "assistant" && msg.code) {
            textContent += `\n\n[PREVIOUS GENERATED CODE START]\nPage: ${msg.pageName || 'unknown'}\n${msg.code}\n[PREVIOUS GENERATED CODE END]`
          }
          return {
            role: msg.role === "user" ? "user" : "model",
            parts: [{ text: textContent }],
          }
        })

        const response = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: effectiveSystemPrompt }],
            },
            ...conversationHistory,
          ],
        })

        responseText = response.response.text()
        usedModel = modelName
        console.log(`[v0] Success with ${modelName}, response length:`, responseText.length)
        break // Success, exit retry loop
      } catch (error: any) {
        console.error(`[v0] Failed with ${modelName}:`, error.message)
        lastError = error
        // Continue to next model in fallback
      }
    }

    if (!responseText) {
      console.error("[v0] All model attempts failed")
      throw lastError || new Error("All AI models failed")
    }

    console.log(`[v0] Final model used: ${usedModel}`)

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
      // Fallback to old format [1]...[1]
      const oldRegex = /\[1\]([\s\S]*?)\[1\]/
      const oldMatch = responseText.match(oldRegex)
      if (oldMatch) {
        extractedCode = oldMatch[1].trim()
        extractedPageName = "index.html" // Default to index.html if not specified
        console.log("[v0] Code extracted with legacy markers")
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
      modelUsed: usedModel,
    })
  } catch (error: any) {
    console.error("[v0] AI generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate content" }, { status: 500 })
  }
}
