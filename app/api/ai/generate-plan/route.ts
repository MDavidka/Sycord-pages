import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { GoogleGenerativeAI } from "@google/generative-ai"

const PLAN_MODEL = "gemini-2.0-flash-lite-preview-02-05"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages } = await request.json()

    if (!process.env.GOOGLE_API_TOKEN) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    const client = new GoogleGenerativeAI(process.env.GOOGLE_API_TOKEN)
    const model = client.getGenerativeModel({ model: PLAN_MODEL })

    const lastUserMessage = messages[messages.length - 1]

    const prompt = `
    You are a Senior Technical Architect planning a concise, production-grade website.
    Your task is to list the ESSENTIAL files needed to build the user's requested website.

    REQUIREMENTS:
    1.  **Speed & Conciseness**: Plan for a minimalistic but functional structure.
    2.  **File Count**: Strictly limit to **2 to 5 files** maximum.
    3.  **Core Files**: Typically 'index.html', 'script.js', and 'styles.css' (or a specific page like 'shop.html').
    4.  **Essential Functions Only**: Do not create separate files for minor features. Combine logic where possible.
    5.  **Output Format**: Return ONLY a valid JSON array of strings. No markdown formatting, no explanations.

    Example Output:
    ["index.html", "script.js", "styles.css", "shop.html"]

    User Request: "${lastUserMessage.content}"
    `

    const result = await model.generateContent(prompt)
    const responseText = result.response.text()

    // Extract JSON if wrapped in markdown code blocks
    let cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim()

    // Basic validation
    if (!cleanJson.startsWith("[")) {
        console.warn("[v0] Plan response not JSON, attempting to extract list")
        // Fallback logic could go here, but for now relying on strong prompt
    }

    return NextResponse.json({
      plan: cleanJson, // Sending the JSON string for frontend to parse
    })
  } catch (error: any) {
    console.error("[v0] Plan generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate plan" }, { status: 500 })
  }
}
