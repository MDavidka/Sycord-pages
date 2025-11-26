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
        textContent += `\n\n[EXISTING CODE CONTEXT]\nPage: ${msg.pageName || 'unknown'}\n${msg.code}\n[END EXISTING CODE]`
      }
      return {
        role: msg.role === "user" ? "user" : "model",
        parts: [{ text: textContent }],
      }
    })

    const systemContext = `
    You are a Senior Technical Architect planning a production-grade website.
    Your goal is to create a detailed architectural plan and file structure.

    OUTPUT FORMAT:
    Return a single JSON object with exactly these two keys:
    1.  "thoughtProcess": A detailed narrative explaining the user flow, core functionality, and data strategy. Explain *how* features will work (e.g., "I will use localStorage to persist the cart state between index.html and cart.html. The checkout form will validate inputs using JS...").
    2.  "files": A JSON array of strings listing the ESSENTIAL files (min 2, max 5).

    REQUIREMENTS:
    1.  **Deep Thinking**: Analyze the request. If the user wants a shop, explain the cart logic. If a login, explain the auth simulation.
    2.  **File Constraints**: Strictly 2-5 files. Combine logic into 'script.js' and 'styles.css' (if needed) rather than fragmenting.
    3.  **Production Ready**: The plan must ensure the site functions (navigation, state, interaction) without a backend.

    Example Output:
    {
      "thoughtProcess": "The user wants a portfolio. I will create a responsive 'index.html' with a hero section and a project grid. I will use 'script.js' to handle a contact form validation and a dark mode toggle stored in localStorage. A 'projects.html' page will list detailed case studies.",
      "files": ["index.html", "script.js", "projects.html"]
    }
    `

    const result = await model.generateContent({
      contents: [
        { role: "user", parts: [{ text: systemContext }] },
        ...historyMessages,
        { role: "user", parts: [{ text: `Request: ${lastUserMessage.content}` }] }
      ]
    })

    const responseText = result.response.text()

    // Extract JSON
    let cleanJson = responseText.replace(/```json/g, "").replace(/```/g, "").trim()

    // Handle potential extra text if AI chats
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
