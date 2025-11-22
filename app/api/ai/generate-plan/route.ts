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

    const lastUserMessage = messages[messages.length - 1].content

    const prompt = `
    You are an expert technical architect.
    Create a comprehensive, step-by-step implementation plan for the following website request: "${lastUserMessage}"

    The plan should cover:
    1.  **Structure**: HTML5 semantic structure.
    2.  **Components**: Key sections (Header, Hero, Features, etc.).
    3.  **Styling**: Tailwind CSS classes to be used for a modern, professional look.
    4.  **Interactivity**: Any simple script requirements (e.g. mobile menu).

    Format the output as a clean, numbered list. Keep it concise, technical, and focused on the implementation details.
    Do NOT generate the code yet, just the plan.
    `

    const result = await model.generateContent(prompt)
    const planText = result.response.text()

    return NextResponse.json({
      plan: planText,
    })
  } catch (error: any) {
    console.error("[v0] Plan generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate plan" }, { status: 500 })
  }
}
