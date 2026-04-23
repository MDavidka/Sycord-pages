import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getSystemPrompts } from "@/lib/ai-prompts";

const FIX_MODEL = "gemini-2.0-flash"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { logs, fileStructure, fileContent, lastAction, history, fixedFiles } = await request.json()

    // Use GOOGLE_AI_API by default, fallback to GOOGLE_API_KEY
    const apiKey = process.env.GOOGLE_AI_API || process.env.GOOGLE_API_KEY
    if (!apiKey) {
      return NextResponse.json({ message: "AI service not configured" }, { status: 500 })
    }

    // Fetch Global Prompts
    const { autoFixDiagnosis, autoFixResolution } = await getSystemPrompts()

    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: FIX_MODEL })

    let memorySection = ""
    if (fixedFiles && fixedFiles.length > 0) {
        memorySection += `
        **CRITICAL MEMORY (ALREADY FIXED FILES):**
        You have already modified the following files in this session:
        ${fixedFiles.join(', ')}
        WARNING: If you see errors persisting in these files, your previous fix was incorrect.
        DO NOT apply the exact same fix again. Try a different approach.
        `
    }

    if (history && Array.isArray(history) && history.length > 0) {
        memorySection += `
        **SESSION HISTORY (ACTIONS TAKEN):**
        The following actions have already been attempted:
        ${history.map((h: any) => `- ${h.action.toUpperCase()}: ${h.target} -> ${h.summary || h.result}`).join('\n')}
        Use this history to avoid loops.
        `
    }

    // Determine Logic State
    let systemPrompt = ""

    // If last action was 'read', we are in RESOLUTION phase (we have file content)
    // Or if last action was 'take a look' (frontend maps this to read)
    // Actually, logic is: if we HAVE fileContent, we are fixing it.
    if (lastAction === 'take a look' && fileContent) {
        systemPrompt = autoFixResolution
            .replace("{{LOGS}}", logs.join('\n'))
            .replace("{{FILE_STRUCTURE}}", fileStructure)
            .replace("{{MEMORY_SECTION}}", memorySection)
            .replace("{{FILENAME}}", fileContent.filename)
            .replace("{{FILE_CONTENT}}", fileContent.code)
    } else {
        // Diagnosis / Decision Phase
        systemPrompt = autoFixDiagnosis
            .replace("{{LOGS}}", logs.join('\n'))
            .replace("{{FILE_STRUCTURE}}", fileStructure)
            .replace("{{MEMORY_SECTION}}", memorySection)
    }

    const result = await model.generateContent(systemPrompt)
    const response = await result.response
    const responseText = response.text()

    // Parse the response
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
    console.error("[v0] Auto-fix error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
