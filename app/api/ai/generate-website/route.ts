import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { GoogleGenerativeAI } from "@google/generative-ai"

const MODEL_FALLBACK = [
  "gemini-2.5-pro",      // Highest quality
  "gemini-2.0-pro",      // Second tier
  "gemini-2.0-flash",    // Fastest fallback
  "gemini-1.5-pro",      // Legacy fallback
]

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, systemPrompt, projectId } = await request.json()

    if (!process.env.GOOGLE_API_TOKEN) {
      console.error("[v0] GOOGLE_API_TOKEN not configured")
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    const client = new GoogleGenerativeAI(process.env.GOOGLE_API_TOKEN)

    let responseText = null
    let lastError = null
    let usedModel = null

    for (const modelName of MODEL_FALLBACK) {
      try {
        console.log(`[v0] Attempting with model: ${modelName}`)
        const model = client.getGenerativeModel({ model: modelName })

        const conversationHistory = messages.map((msg: any) => ({
          role: msg.role === "user" ? "user" : "model",
          parts: [{ text: msg.content }],
        }))

        const response = await model.generateContent({
          contents: [
            {
              role: "user",
              parts: [{ text: systemPrompt }],
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
      console.log("[v0] Code preview:", extractedCode.substring(0, 150))
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
      modelUsed: usedModel, // Include which model was successful
    })
  } catch (error: any) {
    console.error("[v0] AI generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate content" }, { status: 500 })
  }
}
