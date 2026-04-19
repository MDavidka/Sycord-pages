import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { getSystemPrompts } from "@/lib/ai-prompts"

const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const BUILD_MODEL = "gemini-3.1-flash-lite-preview"

interface BuildFile {
  name: string
  usedFor?: string
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { instruction, generatedPages } = await request.json()
    const planText = typeof instruction === "string" ? instruction : ""
    const files: BuildFile[] = Array.isArray(generatedPages) ? generatedPages : []

    const filesSummary = files.length
      ? files
          .map((file) => `- ${file.name}${file.usedFor ? ` (${file.usedFor})` : ""}`)
          .join("\n")
      : "- No generated files available."

    const { builderBuild } = await getSystemPrompts()
    const finalPrompt = builderBuild
      .replace("{{INSTRUCTION}}", planText)
      .replace("{{FILES_SUMMARY}}", filesSummary)

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured (Gemini)" }, { status: 500 })
    }

    const response = await fetch(GOOGLE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: BUILD_MODEL,
        messages: [{ role: "user", content: finalPrompt }],
        temperature: 0.2,
      }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Build review model error ${response.status}: ${errText}`)
    }

    const data = await response.json()
    const review = data.choices?.[0]?.message?.content || "Build review: READY"

    return NextResponse.json({ review })
  } catch (error: any) {
    console.error("[v0] Build review generation error:", error)
    return NextResponse.json({ message: error.message || "Failed to generate build review" }, { status: 500 })
  }
}
