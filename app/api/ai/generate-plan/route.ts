import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getSystemPrompts } from "@/lib/ai-prompts"

const PLAN_MODEL = "gemini-3.1-pro-preview"
const VERCEL_AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions"
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"
const OPENROUTER_THINKER_MODEL = "nvidia/nemotron-3-super-120b-a12b:free"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, model: requestedModel, questionsRemaining } = await request.json()

    const isVercelGatewayModel = requestedModel === "anthropic/claude-haiku-4.5"
    const isOpenRouterModel = requestedModel === "openrouter/test"

    // Fetch Global Prompt
    const { builderPlan: systemContextTemplate } = await getSystemPrompts()

    const lastUserMessage = messages[messages.length - 1]

    // Combine history for context
    const historyText = messages.map((m: any) => `${m.role.toUpperCase()}: ${m.content}`).join("\n\n")

    // Build the question-limit directive based on how many questions remain
    const qRemaining = typeof questionsRemaining === "number" ? questionsRemaining : 0
    let questionDirective = ""
    if (qRemaining <= 0) {
      questionDirective = "\n\nIMPORTANT: You have already asked the maximum number of clarification questions. Do NOT ask any more questions. You MUST proceed and generate the full architectural plan NOW using your best judgment for any missing details.\n"
    } else {
      questionDirective = `\n\nIMPORTANT: You may ask at most ${qRemaining} more clarification question(s). If you have enough information, skip questions and generate the plan directly. Only ask a question if truly critical information is missing.\n`
    }

    const finalPrompt = systemContextTemplate
        .replace("{{HISTORY}}", historyText)
        .replace("{{REQUEST}}", lastUserMessage.content) + questionDirective

    // Route "test" model through OpenRouter (thinker: nvidia/nemotron-3-super-120b-a12b:free)
    if (isOpenRouterModel) {
      const openRouterKey = process.env.OPENROUTER_API_KEY
      if (!openRouterKey) {
        console.error("[v0] OPENROUTER_API_KEY not configured for test model plan generation")
        return NextResponse.json({ message: "AI service not configured (OpenRouter). Set OPENROUTER_API_KEY env var." }, { status: 500 })
      }

      console.log(`[v0] Generating plan with thinker model via OpenRouter: ${OPENROUTER_THINKER_MODEL}`)

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXTAUTH_URL || "https://sycord.com",
          "X-Title": "Sycord AI Builder",
        },
        body: JSON.stringify({
          model: OPENROUTER_THINKER_MODEL,
          messages: [
            { role: "system", content: finalPrompt },
            { role: "user", content: lastUserMessage.content },
          ],
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        let errorBody = ""
        try { errorBody = await response.text() } catch { /* ignore */ }
        const debugInfo = `OpenRouter API error: HTTP ${response.status} | Model: ${OPENROUTER_THINKER_MODEL} | Response: ${errorBody.slice(0, 300)}`
        console.error("[v0] " + debugInfo)
        return NextResponse.json({ message: debugInfo }, { status: 500 })
      }

      const data = await response.json()
      const responseText = data.choices?.[0]?.message?.content || ""

      return NextResponse.json({ instruction: responseText })
    }

    // Route test model through Vercel AI Gateway (uses Vercel credits)
    if (isVercelGatewayModel) {
      const gatewayKey = process.env.AI_GATEWAY_API_KEY
      if (!gatewayKey) {
        console.error("[v0] AI_GATEWAY_API_KEY not configured for test model plan generation")
        return NextResponse.json({ message: "AI service not configured (Vercel AI Gateway). Set AI_GATEWAY_API_KEY env var." }, { status: 500 })
      }

      console.log(`[v0] Generating plan with test model via Vercel AI Gateway: ${requestedModel}`)

      const response = await fetch(VERCEL_AI_GATEWAY_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${gatewayKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: requestedModel,
          messages: [
            { role: "system", content: finalPrompt },
            { role: "user", content: lastUserMessage.content },
          ],
          temperature: 0.2,
        }),
      })

      if (!response.ok) {
        let errorBody = ""
        try { errorBody = await response.text() } catch { /* ignore */ }
        const debugInfo = `Vercel AI Gateway error: HTTP ${response.status} | Model: ${requestedModel} | Response: ${errorBody.slice(0, 300)}`
        console.error("[v0] " + debugInfo)
        return NextResponse.json({ message: debugInfo }, { status: 500 })
      }

      const data = await response.json()
      const responseText = data.choices?.[0]?.message?.content || ""

      return NextResponse.json({ instruction: responseText })
    }

    // Default: Google Generative AI path
    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      console.error("[v0] GOOGLE_AI_API (or GOOGLE_API_KEY) not configured")
      return NextResponse.json({ message: "AI service not configured (Google)" }, { status: 500 })
    }

    const genAI = new GoogleGenerativeAI(apiKey)
    const genModel = genAI.getGenerativeModel({
        model: PLAN_MODEL,
    })

    console.log(`[v0] Generating plan with Google model: ${PLAN_MODEL}`)

    const result = await genModel.generateContent(finalPrompt)
    const response = await result.response
    const responseText = response.text()

    // Return the raw instruction text
    return NextResponse.json({
      instruction: responseText,
    })
  } catch (error: any) {
    console.error("[v0] Plan generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate plan" }, { status: 500 })
  }
}
