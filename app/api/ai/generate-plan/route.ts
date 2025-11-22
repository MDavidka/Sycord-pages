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
    You are an expert web designer and architect.
    Your goal is to create a detailed, narrative "thought process" or "design plan" for the requested website.

    Instead of a dry technical list, describe the vision and the components in a flowing, descriptive manner, as if you are explaining the design strategy to yourself or a developer.

    GUIDELINES:
    - Focus on the **User Experience (UX)** and **Content Strategy**.
    - Describe *what* needs to be built and *why*.
    - Use phrases like "The user requested...", "You will need to create...", "I should add...", "Below that, we can place...".
    - Break down the sections (Header, Hero, Products, Footer) but describe them with detail (e.g., "A moving tab section to introduce the shop", "10 product cards with hover effects").
    - If modifying existing code, explain specifically what visual or functional changes will be made based on the user's request.

    EXAMPLE OUTPUT STYLE:
    "The user requested to make a modern website. You will need to create a header to store the logo and make a menu. You will need to create a moving tabs to introduce the shop below that 10 product ( i should add icons to space prodcuct....). Finally, I will add a footer with social links."

    Do NOT generate actual HTML code. Just the narrative plan.
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
