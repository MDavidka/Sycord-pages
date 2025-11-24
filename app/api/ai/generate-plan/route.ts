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

    const prompt = `
    You are a Senior Technical Architect planning a production-grade website.
    Your task is to list ALL the files needed to build the user's requested website.

    REQUIREMENTS:
    1.  **Scale**: Plan for a complete, robust website. You must list at least 10-15 files.
    2.  **Core Files**: Always include 'index.html', 'styles.css', 'script.js'.
    3.  **Pages**: Include standard pages (e.g., 'about.html', 'contact.html', 'faq.html', 'terms.html', 'privacy.html') and feature-specific pages (e.g., 'shop.html', 'product.html', 'cart.html', 'checkout.html', 'login.html', 'register.html') relevant to the request.
    4.  **Output Format**: Return ONLY a valid JSON array of strings. No markdown formatting, no explanations.

    Example Output:
    ["index.html", "styles.css", "script.js", "about.html", "contact.html", "shop.html", "product.html", "cart.html", "checkout.html", "terms.html"]

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
