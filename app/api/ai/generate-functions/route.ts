import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getSystemPrompts } from "@/lib/ai-prompts"

const MODEL_NAME = "gemini-2.0-flash"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { styleJson } = await request.json()

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    const { builderFunction } = await getSystemPrompts()

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ 
        model: MODEL_NAME,
        generationConfig: {
            responseMimeType: "application/json"
        }
    })

    const fullPrompt = `
SYSTEM PROMPT:
${builderFunction}

STYLE JSON:
${JSON.stringify(styleJson, null, 2)}

Output ONLY the JSON. No other text.
`

    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    let text = response.text()

    try {
      const json = JSON.parse(text)
      return NextResponse.json(json)
    } catch (e) {
      console.error("Failed to parse AI response as JSON:", text)
      return NextResponse.json({ message: "Invalid JSON returned by AI", raw: text }, { status: 500 })
    }
  } catch (error: any) {
    console.error("Error in generate-functions:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
