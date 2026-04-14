import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import {
  FILE_STRUCTURE,
  getShortTermMemory,
  getFileContext,
  getSmartContext,
  extractDesignSystem,
  type GeneratedFile,
} from "@/lib/ai-memory"
import { getSystemPrompts, getProjectPrompts } from "@/lib/ai-prompts"
import { cacheGeneratedFile, getCachedFiles } from "@/lib/gemini-cache"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

// API Configurations
const GOOGLE_API_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
const DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
const VERCEL_AI_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions"
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

// Map models to their specific endpoints and Env Vars
const MODEL_CONFIGS: Record<string, { url: string, envVar: string, provider: string }> = {
  "gemini-3.1-pro-preview": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  "gemini-3.1-flash-lite-preview": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  "gemini-2.0-flash": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  "gemini-1.5-flash": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  "gemini-1.5-pro": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  "deepseek-v3.2-exp": { url: DEEPSEEK_API_URL, envVar: "DEEPSEEK_API", provider: "DeepSeek" },
  // "test" model: Claude Haiku 4.5 via Vercel AI Gateway (uses Vercel credits)
  "anthropic/claude-haiku-4.5": { url: VERCEL_AI_GATEWAY_URL, envVar: "AI_GATEWAY_API_KEY", provider: "Vercel" },
  // OpenRouter test model: qwen/qwen3-coder:free for code generation
  "openrouter/test": { url: OPENROUTER_API_URL, envVar: "OPENROUTER_API_KEY", provider: "OpenRouter" },
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, instruction, model, generatedPages, projectId } = await request.json()

    // Parse generatedPages from frontend (array of { name, code })
    const frontendFiles: GeneratedFile[] = Array.isArray(generatedPages)
      ? generatedPages.map((p: { name: string; code: string }) => ({
          name: p.name,
          code: p.code,
        }))
      : []

    // Merge with server-side cache so the AI retains context across calls
    // even if the frontend doesn't re-send every previously generated file.
    const cachedFiles = projectId ? getCachedFiles(projectId) : []
    const cachedMap = new Map<string, GeneratedFile>(cachedFiles.map((f) => [f.name, { name: f.name, code: f.code }]))
    frontendFiles.forEach((f) => cachedMap.set(f.name, f)) // frontend data takes precedence
    const previousFiles: GeneratedFile[] = Array.from(cachedMap.values())

    // Default to gemini-3.1-pro-preview
    const modelId = model || "gemini-3.1-pro-preview"

    // Map "gemini-3-flash" or similar user requests to actual model
    let configKey = modelId
    if (modelId === "gemini-3-flash" || modelId === "gemini-3.0-flash") {
       configKey = "gemini-2.0-flash"
    }
    if (modelId === "gemini-3-pro" || modelId === "gemini-3.0-pro") {
       configKey = "gemini-1.5-pro"
    }

    // Use the resolved config key as the actual model ID for the API call
    // For OpenRouter, map to the actual coder model
    const apiModelId = configKey === "openrouter/test" ? "qwen/qwen3-coder:free" : configKey

    const config = MODEL_CONFIGS[configKey] || MODEL_CONFIGS["gemini-3.1-pro-preview"]

    let apiKey = process.env[config.envVar]
    if (config.provider === "Google" && !apiKey) {
        apiKey = process.env.GOOGLE_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json({ message: `AI service not configured (${config.provider}). Missing env var: ${config.envVar}` }, { status: 500 })
    }

    // 1. Parse Instruction to find next task
    // Improved regex to be more permissive about the format
    // Matches: [1] file.ts, [1] file.ts : [usedfor]..., [1] file.ts - [usedfor]...
    const taskRegex = /\[(\d+)\]\s*([^\s:\]]+)(?:\s*[:\-]?\s*(?:\[usedfor\](.*?)\[usedfor\])?)?/g
    let match
    let currentTask = null

    while ((match = taskRegex.exec(instruction)) !== null) {
        if (match[1] === "0") continue;
        currentTask = {
            fullMatch: match[0],
            number: match[1],
            filename: match[2].trim(),
            usedFor: match[3]?.trim() || "Implementation"
        }
        break;
    }

    if (!currentTask) {
        return NextResponse.json({
            isComplete: true,
            updatedInstruction: instruction
        })
    }

    console.log(`[v0] Generating file: ${currentTask.filename} (Task [${currentTask.number}])`)

    // Determine file type
    const fileExt = currentTask.filename.split('.').pop() || ''
    const isTS = fileExt === 'ts' || fileExt === 'tsx'
    const isHTML = fileExt === 'html'
    const isJSON = fileExt === 'json'

    // Fetch Prompts (Global)
    const { builderCode: promptTemplate } = await getSystemPrompts()
    let projectMemory = "";
    if (projectId) {
       const memory = await getProjectPrompts(projectId);
       if (memory) {
          projectMemory = `\n\n[PROJECT MEMORY]\n${memory}\n`;
       }
    }

    // Fetch Database credentials for this project (if connected)
    let databaseContext = "Not applicable — this project does not use an external database."
    if (projectId) {
      try {
        const mongo = await clientPromise
        const db = mongo.db()
        const user = await db.collection("users").findOne(
          { "projects._id": new ObjectId(projectId) },
          { projection: { "projects.$": 1 } }
        )
        const project = user?.projects?.[0]
        if (project?.databaseConnected && project?.mongoEndpoint && project?.mongoDataSource && project?.mongoDatabase && project?.mongoApiKey) {
          databaseContext = `This project uses MongoDB Atlas Data API as its backend database. The user has connected their MongoDB Atlas account.
MONGODB ENDPOINT: ${project.mongoEndpoint}
DATA SOURCE: ${project.mongoDataSource}
DATABASE: ${project.mongoDatabase}
API KEY: ${project.mongoApiKey}

CRITICAL MONGODB RULES:
1. The project is a Vite SPA. Do NOT use the \`mongodb\` or \`mongoose\` npm packages, as they cannot run in the browser.
2. src/db.ts MUST be generated right after utils.ts. It MUST export a class or set of functions that wrap the standard \`fetch()\` API to make requests to the MongoDB Atlas Data API endpoints (e.g. \`/action/find\`, \`/action/insertOne\`, \`/action/updateOne\`, \`/action/deleteOne\`).
3. The Data API requires these headers on EVERY fetch request:
   - 'Content-Type': 'application/json'
   - 'Access-Control-Request-Headers': '*'
   - 'api-key': '${project.mongoApiKey}'
4. src/db.ts MUST export database and collection string constants (e.g. DATABASE_NAME = '${project.mongoDatabase}', DATA_SOURCE = '${project.mongoDataSource}').
5. Every fetch body MUST include:
   - "dataSource": DATA_SOURCE
   - "database": DATABASE_NAME
   - "collection": "<collection_name>"
6. Components that display or manage data MUST import the fetch wrappers from '../db.ts' (or './db.ts') and use them to fetch real data.
7. Do NOT use mock/hardcoded data. ALL data operations MUST use real MongoDB Data API calls.
8. The user will create the collections in their MongoDB Atlas UI matching the collection names you use in the code.`
        }
      } catch (e) {
        console.warn("[v0] Failed to fetch Database credentials:", e)
      }
    }

    // 2. Prepare System Prompt (Inject Variables)
    // Use Smart Context (RAG) to select most relevant file context
    const fileContext = getSmartContext(previousFiles, currentTask.filename)
    const designSystem = extractDesignSystem(previousFiles)
    // Keep legacy memory as fallback / additional signal
    const shortTermMemory = getShortTermMemory(instruction)
    
    let fileRules = ""
    if (isHTML) fileRules = `- Use <!DOCTYPE html>. Include <script src="https://cdn.tailwindcss.com"></script>. Include <script type="module" src="/src/main.ts"></script>.`
    if (isTS) fileRules = `- Write valid TypeScript. Use 'export' for modules. Import from relative paths (e.g. './utils'). DOM manipulation must be type-safe (use 'as HTMLElement' if needed). ALL functions must have explicit return types. IMPORTANT: Do NOT access DOM elements at the top level. Wrap all DOM access in exported functions (e.g. init() or render()).`
    if (isJSON) fileRules = `- Return valid JSON only.`
    if (fileExt === 'css') fileRules = `- Write valid CSS. Define CSS custom properties in :root for design tokens. Use @tailwind directives if applicable.`

    let systemPrompt = promptTemplate
        .replace("{{FILENAME}}", currentTask.filename)
        .replace("{{USEDFOR}}", currentTask.usedFor)
        .replace("{{FILE_STRUCTURE}}", FILE_STRUCTURE)
        .replace("{{FILE_CONTEXT}}", fileContext)
        .replace("{{DESIGN_SYSTEM}}", designSystem || "No design system established yet. If generating style.css, define CSS custom properties for the project.")
        .replace("{{FILE_EXT}}", fileExt.toUpperCase())
        .replace("{{FILE_RULES}}", fileRules)
        .replace("{{DATABASE_CONTEXT}}", databaseContext)
        // Legacy fallback -- if the prompt still has {{APPWRITE_CONTEXT}}, fill it
        .replace("{{APPWRITE_CONTEXT}}", databaseContext)
        // Legacy fallback -- if the prompt still has {{MEMORY}}, fill it
        .replace("{{MEMORY}}", shortTermMemory) + projectMemory

    // 3. Call AI
    const conversationHistory = messages.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content
    }))

    const payload = {
      model: apiModelId,
      messages: [
          { role: "system", content: systemPrompt },
          ...conversationHistory,
          { role: "user", content: `Generate the full content for ${currentTask.filename}.` }
      ],
      temperature: 0.2
    }

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }

    // OpenRouter requires additional headers
    if (config.provider === "OpenRouter") {
      headers["HTTP-Referer"] = process.env.NEXTAUTH_URL || "https://sycord.com"
      headers["X-Title"] = "Sycord AI Builder"
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      let errorBody = ""
      try { errorBody = await response.text() } catch { /* ignore */ }
      const debugInfo = `${config.provider} API error: HTTP ${response.status} | Model: ${apiModelId} | URL: ${config.url} | Response: ${errorBody.slice(0, 300)}`
      console.error("[v0] " + debugInfo)
      throw new Error(debugInfo)
    }
    const data = await response.json()
    const responseText = data.choices?.[0]?.message?.content || ""

    // 4. Robust Parsing
    let extractedCode = ""
    const codeRegex = /\[code\]([\s\S]*?)(\[\/code\]|\[code\])/i
    const codeMatch = responseText.match(codeRegex)

    if (codeMatch) {
        extractedCode = codeMatch[1].trim()
    } else {
        const mdBlock = responseText.match(/```(?:typescript|ts|html|css|json|javascript|js)?\s*([\s\S]*?)```/)
        if (mdBlock) {
            extractedCode = mdBlock[1].trim()
        } else {
             // Fallback: simple heuristic to find code start
             const content = responseText.trim()
             const firstCodeIndex = content.search(/(?:^import|^export|^<|^\{|^\/\*)/m)
             if (firstCodeIndex !== -1 && firstCodeIndex < 50) { // Only if found near start
                 extractedCode = content.substring(firstCodeIndex)
             } else {
                 extractedCode = content
             }
        }
    }

    extractedCode = extractedCode.replace(/\[file\].*?\[file\]/g, '').replace(/\[usedfor\].*?\[usedfor\]/g, '')

    // Update server-side cache with the newly generated file
    if (projectId && extractedCode) {
      cacheGeneratedFile(projectId, currentTask.filename, extractedCode, currentTask.usedFor)
    }

    // 5. Update Instruction (Mark as Done)
    const updatedInstruction = instruction.replace(`[${currentTask.number}]`, `[Done]`)

    return NextResponse.json({
        content: responseText,
        code: extractedCode,
        pageName: currentTask.filename,
        usedFor: currentTask.usedFor,
        updatedInstruction: updatedInstruction,
        isComplete: false
    })

  } catch (error: any) {
    console.error("[v0] Generation error:", error)
    return NextResponse.json({ message: error.message || "Unknown generation error" }, { status: 500 })
  }
}
