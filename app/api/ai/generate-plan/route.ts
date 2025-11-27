import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"

const PLAN_MODEL = "gemini-1.5-flash"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages } = await request.json()

    const apiKey = process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured (Google)" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({
        model: PLAN_MODEL,
        generationConfig: {
            responseMimeType: "application/json"
        }
    })

    const lastUserMessage = messages[messages.length - 1]

    // Construct prompt
    // Gemini handles history differently, but for a plan we mainly need the latest context + system prompt
    // Ideally we pass full history, but simplicity suggests passing the conversation as text or just the prompt

    const systemContext = `
    You are a Senior Technical Architect planning a massive, production-grade website.
    Your goal is to create a detailed architectural plan and file structure.

    OUTPUT FORMAT:
    Return a single JSON object with exactly these two keys:
    1.  "thoughtProcess": A detailed narrative explaining the user flow, core functionality, and data strategy.
    2.  "files": A JSON array of strings listing the files.

    REQUIREMENTS:
    1.  **Scale**: Plan for a COMPLETE experience.
    2.  **File Count**: Aim for **5 to 15 files**.
    3.  **Production Ready**: Ensure functional logic.

    Example Output:
    {
      "thoughtProcess": "...",
      "files": ["index.html", "styles.css", "script.js", "shop.html"]
    }
    `

    // Combine history for context
    const historyText = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")
    const finalPrompt = `${systemContext}\n\nCONVERSATION HISTORY:\n${historyText}\n\nRequest: ${lastUserMessage.content}`

    console.log(`[v0] Generating plan with Google model: ${PLAN_MODEL}`)

    const result = await model.generateContent(finalPrompt)
    const response = await result.response
    const responseText = response.text()

    // Clean JSON if needed (SDK usually handles this with responseMimeType, but safety check)
    let cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim()

    const jsonStart = cleanJson.indexOf('{')
    const jsonEnd = cleanJson.lastIndexOf('}')
    if (jsonStart !== -1 && jsonEnd !== -1) {
        cleanJson = cleanJson.substring(jsonStart, jsonEnd + 1)
    }

    return NextResponse.json({
      plan: cleanJson,
    })
  } catch (error: any) {
    console.error("[v0] Plan generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate plan" }, { status: 500 })
  }
}
