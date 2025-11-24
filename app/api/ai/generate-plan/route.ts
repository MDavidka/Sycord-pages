import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import { GoogleGenerativeAI } from "@google/generative-ai"

// User requested "gemini-2.5-flash", mapping to "gemini-2.0-flash" as the standard fast model
// or "gemini-1.5-flash" if 2.0 is unavailable. Sticking to 2.0-flash for performance.
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
    const isContinuation = lastUserMessage.content.toLowerCase().includes("continue")

    // Prepare history excluding the last message (which is the new request)
    const historyMessages = messages.slice(0, -1).map((msg: any) => {
      let textContent = msg.content
      if (msg.role === "assistant" && msg.code) {
        textContent += `\n\n[EXISTING CODE CONTEXT]\nPage: ${msg.pageName || 'unknown'}\n${msg.code}\n[END EXISTING CODE]`
      }
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: textContent }],
      }
    })

    const systemContext = `
    You are an expert web designer and architect.
    Your goal is to create a detailed, narrative "thought process" or "design plan" for the requested website.

    CONTEXT:
    ${isContinuation
      ? "**CONTINUATION PHASE**: The user wants to continue building the website. Based on the existing code in history, plan the NEXT specific page or feature that needs to be implemented. Do NOT re-plan what is already built."
      : "**INITIAL PHASE**: The user wants to create a new website. Plan the core structure, starting with 'index.html'."}

    GUIDELINES:
    1.  **Focus**: Describe *what* needs to be built next and *why*.
    2.  **Structure**: If starting, plan 'index.html'. If continuing, plan the next logical page (e.g., 'shop.html', 'about.html').
    3.  **Modern UI/UX**: Include plans for scrollable sections, promotional banners with fade-in animations, and modern, rounded buttons with hover effects.
    4.  **Narrative Style**: Use phrases like "The user requested...", "Next, I will create...", "I should add...".

    EXAMPLE OUTPUT STYLE:
    "The user requested to make a modern website. You will need to create a sticky header to store the logo and make a navigation menu. I will design a Hero section with a fade-in animation. Below that, you will need to create a moving tabs section to introduce the shop categories. Then, a scrollable horizontal list of 10 featured products with modern card styling and hover effects. I should add icons to space product details...."

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
