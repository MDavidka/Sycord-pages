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
    const extractedCode = codeMarkerMatch ? codeMarkerMatch[1].trim() : undefined

    if (extractedCode) {
      console.log("[v0] Code extracted successfully, length:", extractedCode.length)
      console.log("[v0] Code preview:", extractedCode.substring(0, 150))

      // Validate that extracted code is HTML
      if (
        !extractedCode.toLowerCase().includes("<!doctype") &&
        !extractedCode.toLowerCase().includes("<html") &&
        !extractedCode.includes("<div")
      ) {
        console.warn("[v0] Extracted code may not be valid HTML")
      }
    } else {
      console.warn("[v0] No code markers found in response")
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
