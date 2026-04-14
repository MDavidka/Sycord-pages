import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { getSystemPrompts } from "@/lib/ai-prompts"

const FIX_MODEL = "gemini-2.0-flash"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { userPrompt, fileStructure, fileContent, lastAction, history, fixedFiles } = await request.json()

    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    const { inlineFixDiagnosis, inlineFixResolution } = await getSystemPrompts()

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: FIX_MODEL })

    let memorySection = ""
    if (fixedFiles && fixedFiles.length > 0) {
      memorySection += `
      **ALREADY FIXED FILES:**
      ${fixedFiles.join(', ')}
      WARNING: If these files still have issues, try a different approach.
      `
    }

    if (history && Array.isArray(history) && history.length > 0) {
      memorySection += `
      **SESSION HISTORY:**
      ${history.map((h: any) => `- ${h.action.toUpperCase()}: ${h.target} -> ${h.summary || h.result}`).join('\n')}
      `
    }

    let systemPrompt = ""

    // If we have file content, we are in resolution/fix phase
    if (lastAction === 'take a look' && fileContent) {
      systemPrompt = inlineFixResolution
        .replace("{{USER_PROMPT}}", userPrompt || "Fix any issues in the codebase")
        .replace("{{FILE_STRUCTURE}}", fileStructure)
        .replace("{{MEMORY_SECTION}}", memorySection)
        .replace("{{FILENAME}}", fileContent.filename)
        .replace("{{FILE_CONTENT}}", fileContent.code)
    } else {
      // Diagnosis / investigation phase
      systemPrompt = inlineFixDiagnosis
        .replace("{{USER_PROMPT}}", userPrompt || "Fix any issues in the codebase")
        .replace("{{FILE_STRUCTURE}}", fileStructure)
        .replace("{{MEMORY_SECTION}}", memorySection)
    }

    const result = await model.generateContent(systemPrompt)
    const response = await result.response
    const responseText = response.text()

    // Parse the response (same format as auto-fix)
    let action = null
    let targetFile = null
    let newPath = null
    let code = null
    let explanation = ""

    const lines = responseText.split('\n')
    for (const line of lines) {
      if (line.trim().startsWith('[take a look]')) {
        action = 'read'
        targetFile = line.replace('[take a look]', '').trim()
      } else if (line.trim().startsWith('[move]')) {
        action = 'move'
        const parts = line.replace('[move]', '').trim().split(/\s+/)
        targetFile = parts[0]
        newPath = parts[1]
      } else if (line.trim().startsWith('[delete]')) {
        action = 'delete'
        targetFile = line.replace('[delete]', '').trim()
      } else if (line.trim().startsWith('[fix]')) {
        action = 'write'
        targetFile = line.replace('[fix]', '').trim()
      } else if (line.trim().startsWith('[done]')) {
        action = 'done'
      } else if (!action && line.trim().length > 0) {
        explanation += line + " "
      }
    }

    if (action === 'write') {
      const codeMatch = responseText.match(/\[code\]([\s\S]*?)\[\/code\]/)
      if (codeMatch) {
        code = codeMatch[1].trim()
      }
    }

    return NextResponse.json({
      action,
      targetFile,
      newPath,
      code,
      explanation: explanation.trim(),
      raw: responseText
    })

  } catch (error: any) {
    console.error("[v0] Inline auto-fix error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
