import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { GoogleGenerativeAI } from "@google/generative-ai"

const PLAN_MODEL = "gemini-2.0-flash"

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

    // Prepare history excluding the last message (which is the new request)
    const historyMessages = messages.slice(0, -1).map((msg: any) => {
      let textContent = msg.content
      if (msg.role === "assistant" && msg.code) {
        textContent += `\n\n[EXISTING CODE CONTEXT]\n${msg.code}\n[END EXISTING CODE]`
      }
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: textContent }],
      }
    })

    const systemContext = `
    You are an expert technical architect.
    Create a comprehensive, step-by-step implementation plan for the user's request.

    CONTEXT:
    - If existing code is present in the history, the plan should focus on MODIFYING that code to fulfill the request.
    - If no code exists, plan a new website from scratch.

    REQUIREMENTS:
    1. **Structure**: HTML5 semantic structure.
    2.  **Components**: Key sections.
    3.  **Styling**: Tailwind CSS classes.
    4.  **Interactivity**: Script requirements.

    Format as a concise numbered list. Do NOT generate code.
    `

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemContext }] }, // System context as first message
        ...historyMessages,
        { role: "user", parts: [{ text: `Request: ${lastUserMessage.content}` }] }
      ]
    })

    const planText = result.response.text()

    return NextResponse.json({
      plan: planText,
    })
  } catch (error: any) {
    console.error("[v0] Plan generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate plan" }, { status: 500 })
  }
}
