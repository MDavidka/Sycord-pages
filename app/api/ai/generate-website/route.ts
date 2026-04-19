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
const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions"

// Map models to their specific endpoints and Env Vars
const MODEL_CONFIGS: Record<string, { url: string, envVar: string, provider: string }> = {
  "gemini-3.1-pro-preview": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  "gemini-3.1-flash": { url: GOOGLE_API_URL, envVar: "GOOGLE_AI_API", provider: "Google" },
  // OpenRouter thinker/backup model for heavy reasoning
  "openai/gpt-oss-120b:free": { url: OPENROUTER_API_URL, envVar: "OPENROUTER_API_KEY", provider: "OpenRouter" },
}

const MODEL_ALIASES: Record<string, string> = {
  "gemini-3.1-flash-lite-preview": "gemini-3.1-flash",
  "gemini-2.0-flash": "gemini-3.1-flash",
  "gemini-1.5-pro": "gemini-3.1-pro-preview",
  "gemini-1.5-flash": "gemini-3.1-flash",
  "qwen/qwen3-coder:free": "gemini-3.1-pro-preview",
  "gemini-3-flash": "gemini-3.1-flash",
  "gemini-3.0-flash": "gemini-3.1-flash",
  "gemini-3-pro": "gemini-3.1-pro-preview",
  "gemini-3.0-pro": "gemini-3.1-pro-preview",
}

const DEFAULT_MODEL_ID = "gemini-3.1-pro-preview"

const HERO_UI_GUARDRAILS = `
ABSOLUTE UI GUARDRAILS:
- The entire UI must use @heroui/react primitives (Button, Card, Input, Navbar, Modal, Table, Tabs, Select, Chip, etc.).
- Prefer HeroUI variants/props over raw HTML. Use Tailwind utilities only to complement layout and spacing.
- Keep components composable, typed, and data-driven. Avoid hardcoded DOM nodes when a HeroUI component exists.
`

const HERO_UI_TSX_RULE = `- This React file MUST use Hero UI components from '@heroui/react' as primary UI primitives. Include at least one import from '@heroui/react'. Do NOT build forms/tables/actions with raw HTML controls like <button>, <input>, <select>, <textarea>, or <table> when Hero UI equivalents exist (Button, Input, Select, Textarea, Table, etc.).`

function formatMemoryDigest(files: GeneratedFile[]): string {
  if (!files.length) return "No cached files are available yet.";
  const recent = [...files]
    .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    .slice(0, 6)
    .map((f) => {
      const parts = [f.name];
      if (f.usedFor) parts.push(`for ${f.usedFor}`);
      if (f.timestamp) parts.push(`updated ${new Date(f.timestamp).toISOString()}`);
      return `- ${parts.join(" • ")}`;
    })
    .join("\n");
  return `Recent file memory:\n${recent}`;
}

function summarizeInstructionProgress(instruction: string): string {
  const text = instruction || "";
  const done = (text.match(/\[Done\]/gi) || []).length;
  const total = (text.match(/\[\d+\]/g) || []).length + done;
  const pending = Math.max(total - done, 0);
  return `Plan progress: ${done}/${total || "?"} steps complete${pending ? `, ${pending} remaining` : ""}.`;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { messages, instruction, model, generatedPages, projectId, implementation } = await request.json()
    const normalizedInstruction = typeof instruction === "string" ? instruction : ""

    // Parse generatedPages from frontend (array of { name, code })
    const frontendFiles: GeneratedFile[] = Array.isArray(generatedPages)
      ? generatedPages.map((p: { name: string; code: string; usedFor?: string; timestamp?: number }) => ({
          name: p.name,
          code: p.code,
          usedFor: p.usedFor,
          timestamp: typeof p.timestamp === "number" ? p.timestamp : undefined,
        }))
      : []

    // Merge with server-side cache so the AI retains context across calls
    // even if the frontend doesn't re-send every previously generated file.
    const FIRST_TASK_PATTERN = /^\s*\[1\]\s+[^\n]+/m
    const COMPLETED_TASK_PATTERN = /^\s*\[Done\]\s+[^\n]+/m
    const hasAnyCompletedTask = COMPLETED_TASK_PATTERN.test(normalizedInstruction)
    const isFirstTask = FIRST_TASK_PATTERN.test(normalizedInstruction) && !hasAnyCompletedTask
    if (isFirstTask && projectId) {
      const { clearProjectCache } = require("@/lib/gemini-cache")
      clearProjectCache(projectId)
    }

    const cachedFiles = projectId ? getCachedFiles(projectId) : []
    const mergedMap = new Map<string, GeneratedFile>()
    const orderedCandidates = [...cachedFiles, ...frontendFiles].sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
    for (const f of orderedCandidates) {
      mergedMap.set(f.name, { name: f.name, code: f.code, usedFor: f.usedFor, timestamp: f.timestamp })
    }
    const previousFiles: GeneratedFile[] = Array.from(mergedMap.values())

    // Default to Gemini 3.1 Pro (best) unless explicitly overridden
    const modelId = model || DEFAULT_MODEL_ID
    const canonicalModelId = MODEL_ALIASES[modelId] || modelId
    const configKey = MODEL_CONFIGS[canonicalModelId] ? canonicalModelId : DEFAULT_MODEL_ID
    const apiModelId = configKey
    const config = MODEL_CONFIGS[configKey] || MODEL_CONFIGS[DEFAULT_MODEL_ID]
    const isOpenRouterModel = config.provider === "OpenRouter" || configKey.startsWith("openai/")

    let apiKey = process.env[config.envVar]
    if (config.provider === "Google" && !apiKey) {
        apiKey = process.env.GOOGLE_API_KEY
    }

    if (!apiKey) {
      return NextResponse.json({ message: `AI service not configured (${config.provider})` }, { status: 500 })
    }

    // 1. Parse Instruction to find next task
    // Improved regex to be more permissive about the format
    // Matches: [1] file.ts, [1] file.ts : [usedfor]..., [1] file.ts - [usedfor]...
    const taskRegex = /\[(\d+)\]\s*([^\s:\]]+)(?:\s*[:\-]?\s*(?:\[usedfor\](.*?)\[usedfor\])?)?/g
    let match
    let currentTask = null

    while ((match = taskRegex.exec(normalizedInstruction)) !== null) {
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
        // Double check if there are REALLY no tasks left
        const anyTaskLeft = /\[\d+\]/.test(instruction)
        if (!anyTaskLeft) {
            return NextResponse.json({
                isComplete: true,
                updatedInstruction: instruction
            })
        }
        return NextResponse.json({
            isComplete: true,
            updatedInstruction: normalizedInstruction
        })
    }

    console.log(`[v0] Generating file: ${currentTask.filename} (Task [${currentTask.number}])`)

    // Determine file type
    const fileExt = currentTask.filename.split('.').pop() || ''
    const isTS = fileExt === 'ts' || fileExt === 'tsx'
    const isTSX = fileExt === 'tsx'
    const isHTML = fileExt === 'html'
    const isJSON = fileExt === 'json'
    const isComponentTSX = isTSX && currentTask.filename.startsWith("src/components/")
    const isMainEntryTSX = currentTask.filename === "src/main.tsx"

    // Fetch Prompts (Global)
    const { builderCode: promptTemplate } = await getSystemPrompts()
    let projectMemory = "";
    if (projectId) {
       const memory = await getProjectPrompts(projectId);
       if (memory) {
          projectMemory = `\n\n[PROJECT MEMORY]\n${memory}\n`;
       }
    }

    const memoryDigest = formatMemoryDigest(previousFiles)
    const planProgress = summarizeInstructionProgress(normalizedInstruction)
    const implementationBlock = implementation
      ? `\n\n[IMPLEMENTATION JSON]\n${typeof implementation === "string" ? implementation : JSON.stringify(implementation, null, 2)}\n`
      : ""

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
        const hasDbConnection = project?.databaseConnected && project?.mongoEndpoint && project?.mongoDataSource && project?.mongoDatabase && project?.mongoApiKey

        if (hasDbConnection) {
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
        } else {
          databaseContext = `No database or third-party integration is connected (Integrations tab not configured).

HARD REQUIREMENTS WHEN NO INTEGRATION IS CONNECTED:
- DO NOT generate any database code, MongoDB Data API calls, fetch/CRUD helpers, or db.ts.
- If the feature would normally need data, render a HeroUI modal or inline banner prompting the user to connect a database/integration from the Integrations tab. Include a clear CTA button like "Connect database to enable data".
- Use static UI copy only for placeholders; never hardcode secrets or fake API keys.
- Keep code structured so that once a connection exists, data wiring can be added cleanly (no dead-end mocks).`
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
    const shortTermMemory = getShortTermMemory(normalizedInstruction)
    
    let fileRules = ""
    if (isHTML) fileRules = `- Use <!DOCTYPE html>. Include <script src="https://cdn.tailwindcss.com"></script>. Include <script type="module" src="/src/main.tsx"></script>.`
    if (isTS) fileRules = `- Write valid TypeScript. Use 'export' for modules. Import from relative paths (e.g. './utils'). DOM manipulation must be type-safe (use 'as HTMLElement' if needed). ALL functions must have explicit return types. IMPORTANT: Do NOT access DOM elements at the top level. Wrap all DOM access in exported functions (e.g. init() or render()).`
    if (isComponentTSX || isMainEntryTSX) {
      fileRules += ` ${HERO_UI_TSX_RULE}`
    }
    if (isJSON) fileRules = `- Return valid JSON only.`
    if (fileExt === 'css') fileRules = `- Write valid CSS. Define CSS custom properties in :root for design tokens. Use @tailwind directives if applicable.`

    const basePrompt = promptTemplate
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

    const systemPrompt = `
${HERO_UI_GUARDRAILS}
${planProgress}
${memoryDigest}
${implementationBlock}

${basePrompt}
`

    // 3. Call AI
    const conversationHistory = messages.map((msg: any) => ({
        role: msg.role === "user" ? "user" : "assistant",
        content: msg.content
    }))

    // For OpenRouter (qwen3-coder): use prompt caching on the system prompt
    // by marking it with cache_control so repeated calls share the KV cache.
    const systemMessage = isOpenRouterModel
      ? { role: "system", content: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }] }
      : { role: "system", content: systemPrompt }

    const payload: Record<string, any> = {
      model: apiModelId,
      messages: [
          systemMessage,
          ...conversationHistory,
          { role: "user", content: `Generate the full content for ${currentTask.filename}.` }
      ],
      temperature: 0.2,
    }

    // OpenRouter-specific: request prompt caching and pass referer
    const fetchHeaders: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    }
    if (isOpenRouterModel) {
      fetchHeaders["HTTP-Referer"] = process.env.NEXTAUTH_URL || "https://sycord.pages.dev"
      fetchHeaders["X-Title"] = "Sycord AI Builder"
    }

    const response = await fetch(config.url, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(payload),
    })

    if (!response.ok) throw new Error(`${config.provider} API error: ${response.status}`)
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
    const updatedInstruction = normalizedInstruction.replace(`[${currentTask.number}]`, `[Done]`)

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
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
