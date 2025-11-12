import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { GoogleGenerativeAI } from "@google/generative-ai"

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
    const model = client.getGenerativeModel({ model: "gemini-2.0-flash" })

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

    const responseText = response.response.text()
    console.log("[v0] AI Response received, length:", responseText.length)

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
    })
  } catch (error: any) {
    console.error("[v0] AI generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate content" }, { status: 500 })
  }
}
