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

    // Prepare history excluding the last message
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

    CRITICAL: The user wants a COMPLETE, FUNCTIONAL website consisting of connected pages.

    GUIDELINES:
    1.  **Unified Structure**: Plan for an 'index.html' as the main entry point. All other pages (e.g., 'shop.html', 'contact.html') must be linked from the index.
    2.  **JavaScript**: You MUST explicitly plan for JavaScript to handle interactivity (e.g., mobile menu toggling, cart state, image sliders). The site should be production-ready.
    3.  **Narrative Style**: Describe the user experience flow. E.g., "The user lands on index.html... clicking 'Shop' navigates to shop.html...".
    4.  **Consistency**: Emphasize that all pages must share the same styling (Tailwind/HeroUI) and header/footer layout.

    EXAMPLE OUTPUT STYLE:
    "The user requested a modern e-commerce site. I will start by creating the 'index.html'. This page will feature a sticky header with a logo and a navigation menu linking to 'shop.html' and 'about.html'. I will add a JavaScript script to handle the mobile menu toggle. Below the hero section, I'll display featured products. Then, I will plan the 'shop.html' page which will display a full grid of products..."

    Do NOT generate actual HTML code yet. Just the narrative plan.
    `

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemContext }] },
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
