import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { GoogleGenerativeAI } from "@google/generative-ai"

const DEFAULT_MODELS = [
  "gemini-3-pro-preview", // Newest preview
  "gemini-2.0-pro-exp-02-05", // Latest experimental
  "gemini-1.5-pro",      // Stable fallback
  "gemini-2.0-flash",    // Fast fallback
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
      effectiveSystemPrompt += `\n\nIMPORTANT: You must strictly follow this implementation plan:\n${plan}\n\nGenerate the code for the website based on this plan.`
    }

    for (const modelName of modelsToTry) {
      try {
        console.log(`[v0] Attempting with model: ${modelName}`)
        const model = client.getGenerativeModel({ model: modelName })

        const conversationHistory = messages.map((msg: any) => {
          let textContent = msg.content
          if (msg.role === "assistant" && msg.code) {
            textContent += `\n\n[PREVIOUS GENERATED CODE START]\n${msg.code}\n[PREVIOUS GENERATED CODE END]`
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

    const codeMarkerRegex = /\[1\]([\s\S]*?)\[1\]/
    const codeMarkerMatch = responseText.match(codeMarkerRegex)
    let extractedCode = codeMarkerMatch ? codeMarkerMatch[1].trim() : null

    if (extractedCode) {
      console.log("[v0] Code extracted with markers, length:", extractedCode.length)
    } else {
      console.warn("[v0] No code markers found, checking for HTML in response")
      const htmlRegex = /<html[\s\S]*<\/html>/i
      const htmlMatch = responseText.match(htmlRegex)
      if (htmlMatch) {
        extractedCode = htmlMatch[0].trim()
        console.log("[v0] Code extracted from HTML fallback, length:", extractedCode.length)
      }
    }

    if (extractedCode && !extractedCode.toLowerCase().includes("<!doctype")) {
      console.warn("[v0] Code missing DOCTYPE, adding it")
      extractedCode = "<!DOCTYPE html>\n" + extractedCode
    }

    return NextResponse.json({
      content: responseText,
      code: extractedCode || null,
      modelUsed: usedModel,
    })
  } catch (error: any) {
    console.error("[v0] AI generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate content" }, { status: 500 })
  }
}
