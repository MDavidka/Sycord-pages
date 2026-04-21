
import { MongoClient, ObjectId } from "mongodb"

const uri = process.env.MONGO_URI || ""
const options = {}

let client: MongoClient
let clientPromise: Promise<MongoClient>

if (!process.env.MONGO_URI) {
  console.warn("MONGO_URI not defined")
} else {
  if (process.env.NODE_ENV === "development") {
    let globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>
    }

    if (!globalWithMongo._mongoClientPromise) {
      client = new MongoClient(uri, options)
      globalWithMongo._mongoClientPromise = client.connect()
    }
    clientPromise = globalWithMongo._mongoClientPromise
  } else {
    client = new MongoClient(uri, options)
    clientPromise = client.connect()
  }
}

// --- PROMPT TEMPLATES ---

export const DEFAULT_BUILDER_PLAN = `
You are an expert UI/UX Designer. Generate a "Style JSON" for a website based on the user's request.
The JSON must follow this structure:
{
  "sections": [
    {
      "id": "string",
      "jsx": "string (React JSX code using Tailwind CSS and Shadcn UI components)",
      "components": ["string (list of Shadcn UI components used)"]
    }
  ],
  "theme": {
    "colors": { "primary": "string", "secondary": "string" },
    "fonts": { "heading": "string", "body": "string" }
  }
}

Use modern, clean aesthetics. Focus on responsive design with Tailwind.
Available components include standard Shadcn UI components like Button, Card, Input, etc.
`

export const DEFAULT_BUILDER_CHEATSHEET = `
Use the following guidelines for high-quality website generation:
- Use Tailwind CSS for all styling.
- Prefer Radix-based Shadcn UI components.
- Ensure dark mode compatibility.
- Use Lucide icons for visual elements.
`

export const DEFAULT_BUILDER_FUNCTION = `
You are an expert Frontend Engineer. Based on the provided "Style JSON", generate a "Function JSON" containing the logic for the website.
The JSON must follow this structure:
{
  "logic": [
    {
      "id": "string (matches section id)",
      "handlers": [
        { "name": "string (function name)", "code": "string (function body)" }
      ]
    }
  ],
  "state": [
    { "name": "string", "init": "any" }
  ]
}
`

export const DEFAULT_BUILDER_CODE = `
Merge the Style JSON and Function JSON into a complete, production-ready React component (.tsx).
Resolve all imports for Shadcn UI components and Lucide icons.
`

export const DEFAULT_AUTOFIX_DIAGNOSIS = `
You are an expert AI DevOps Engineer. Your goal is to diagnose deployment errors in a Vite + TypeScript project.

**CONTEXT:**
The deployment failed. You have access to the build logs and the file structure.
Your job is to IDENTIFY the problem and determine the next step.

**YOUR TOOLKIT (DECISION):**
1.  **[take a look] <filename>**: Use this if the logs point to a specific file (syntax error, type error, missing export).
    *   Example: "Error in src/main.ts" -> [take a look] src/main.ts
2.  **[move] <old> <new>**: Use this if a file is in the wrong place.
    *   Example: "index.html not found" -> [move] public/index.html index.html
3.  **[delete] <filename>**: Use this if a file is causing conflicts.
4.  **[done]**: Use this ONLY if you are certain the issue is fixed (usually after you have applied a fix in the previous step).

**LOGS:**
{{LOGS}}

**FILE STRUCTURE:**
{{FILE_STRUCTURE}}

{{MEMORY_SECTION}}

**OUTPUT FORMAT:**
Start with a one-sentence diagnosis.
Then output the action.

Example:
The build failed because index.html is missing.
[move] public/index.html index.html
`

export const DEFAULT_AUTOFIX_RESOLUTION = `
You are an expert Full Stack Engineer. Your goal is to FIX the code causing deployment errors.

**CONTEXT:**
You requested to see a file to fix it. Now you have the content.
You must provide the CORRECTED code.

**YOUR TOOLKIT (ACTION):**
1.  **[fix] <filename>**: Provide the fully corrected content of the file.
    *   You MUST provide the full file content in a [code] block.
2.  **[done]**: If the file looks correct and no changes are needed, or if you made a mistake asking for it.

**LOGS:**
{{LOGS}}

**FILE CONTENT ({{FILENAME}}):**
\`\`\`
{{FILE_CONTENT}}
\`\`\`

**FILE STRUCTURE:**
{{FILE_STRUCTURE}}

{{MEMORY_SECTION}}

**OUTPUT FORMAT:**
Start with a one-sentence explanation of the fix.
Then output the [fix] action and the code.

Example:
I am fixing the typo in the import statement.
[fix] {{FILENAME}}
[code]
import { x } from './y'
...
[/code]
`

export const DEFAULT_INLINE_FIX_DIAGNOSIS = `
You are an expert AI Code Reviewer and Bug Fixer for Vite + TypeScript SPA projects.

**CONTEXT:**
The user has an existing codebase deployed on Cloudflare Pages. They have asked you to review and fix their code.
Your job is to investigate the file structure and identify issues that need fixing.

**USER REQUEST:**
{{USER_PROMPT}}

**FILE STRUCTURE:**
{{FILE_STRUCTURE}}

{{MEMORY_SECTION}}

**YOUR TOOLKIT (DECISION):**
1.  **[take a look] <filename>**: Use this to read a specific file and check it for issues.
    *   Start with files most likely to have problems based on the user's request.
2.  **[done]**: Use this ONLY when you have finished all fixes. All issues must be resolved before using this.

**OUTPUT FORMAT:**
Start with a one-sentence summary of what you plan to investigate.
Then output the action.

Example:
I'll check the main entry point for potential import issues.
[take a look] src/main.ts
`

export const DEFAULT_INLINE_FIX_RESOLUTION = `
You are an expert Full Stack Engineer. Your goal is to review and fix code in a Vite + TypeScript SPA project.

**CONTEXT:**
The user asked you to review/fix their existing codebase. You are now looking at a specific file.
Analyze the code for bugs, missing imports, broken references, UI issues, and anything that could cause build or runtime errors.

**USER REQUEST:**
{{USER_PROMPT}}

**FILE CONTENT ({{FILENAME}}):**
\`\`\`
{{FILE_CONTENT}}
\`\`\`

**FILE STRUCTURE:**
{{FILE_STRUCTURE}}

{{MEMORY_SECTION}}

**YOUR TOOLKIT (ACTION):**
1.  **[fix] <filename>**: Provide the fully corrected content of the file.
    *   You MUST provide the full file content in a [code] block.
    *   Fix all issues you find: broken imports, missing exports, type errors, UI bugs, etc.
2.  **[take a look] <filename>**: If you need to check another file to understand the dependency chain.
3.  **[done]**: If the file looks correct and no changes are needed.

**OUTPUT FORMAT:**
Start with a one-sentence explanation of what you found.
Then output the action and (if fixing) the full corrected code.

Example:
I found a broken import referencing a non-existent module.
[fix] {{FILENAME}}
[code]
import { x } from './y'
...
[/code]
`

// --- PROMPT FETCHING LOGIC ---

export async function getSystemPrompts() {
  if (!clientPromise) return {
    builderPlan: DEFAULT_BUILDER_PLAN,
    builderCheatSheet: DEFAULT_BUILDER_CHEATSHEET,
    builderFunction: DEFAULT_BUILDER_FUNCTION,
    builderCode: DEFAULT_BUILDER_CODE,
    autoFixDiagnosis: DEFAULT_AUTOFIX_DIAGNOSIS,
    autoFixResolution: DEFAULT_AUTOFIX_RESOLUTION,
    inlineFixDiagnosis: DEFAULT_INLINE_FIX_DIAGNOSIS,
    inlineFixResolution: DEFAULT_INLINE_FIX_RESOLUTION
  }

  try {
    const mongo = await clientPromise
    const db = mongo.db()

    // Fetch global prompts from 'system_prompts' collection (singleton document)
    const data = await db.collection("system_prompts").findOne({ type: "global_prompts" })

    if (data && data.prompts) {
        return {
            builderPlan: data.prompts.builderPlan || DEFAULT_BUILDER_PLAN,
            builderCheatSheet: data.prompts.builderCheatSheet || DEFAULT_BUILDER_CHEATSHEET,
            builderFunction: data.prompts.builderFunction || DEFAULT_BUILDER_FUNCTION,
            builderCode: data.prompts.builderCode || DEFAULT_BUILDER_CODE,
            autoFixDiagnosis: data.prompts.autoFixDiagnosis || DEFAULT_AUTOFIX_DIAGNOSIS,
            autoFixResolution: data.prompts.autoFixResolution || DEFAULT_AUTOFIX_RESOLUTION,
            inlineFixDiagnosis: data.prompts.inlineFixDiagnosis || DEFAULT_INLINE_FIX_DIAGNOSIS,
            inlineFixResolution: data.prompts.inlineFixResolution || DEFAULT_INLINE_FIX_RESOLUTION
        }
    }
  } catch (error) {
    console.error("Error fetching system prompts:", error)
  }

  return {
    builderPlan: DEFAULT_BUILDER_PLAN,
    builderCheatSheet: DEFAULT_BUILDER_CHEATSHEET,
    builderFunction: DEFAULT_BUILDER_FUNCTION,
    builderCode: DEFAULT_BUILDER_CODE,
    autoFixDiagnosis: DEFAULT_AUTOFIX_DIAGNOSIS,
    autoFixResolution: DEFAULT_AUTOFIX_RESOLUTION,
    inlineFixDiagnosis: DEFAULT_INLINE_FIX_DIAGNOSIS,
    inlineFixResolution: DEFAULT_INLINE_FIX_RESOLUTION
  }
}

export async function saveSystemPrompts(prompts: { builderPlan?: string, builderCheatSheet?: string, builderFunction?: string, builderCode?: string, autoFixDiagnosis?: string, autoFixResolution?: string }) {
    if (!clientPromise) throw new Error("Database not connected")

    const mongo = await clientPromise
    const db = mongo.db()

    await db.collection("system_prompts").updateOne(
        { type: "global_prompts" },
        { $set: { prompts } },
        { upsert: true }
    )
}

export async function getProjectPrompts(projectId: string) {
  if (!clientPromise) return null

  try {
    const mongo = await clientPromise
    const db = mongo.db()

    const user = await db.collection("users").findOne(
      { "projects._id": new ObjectId(projectId) },
      { projection: { "projects.$": 1 } }
    )

    if (user && user.projects && user.projects.length > 0) {
       return user.projects[0].aiMemory || null
    }
  } catch (error) {
    console.error("Error fetching project prompts:", error)
  }
  return null
}
