
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

export const DEFAULT_BUILDER_PLAN = `Website planning is disabled.`

export const DEFAULT_BUILDER_CHEATSHEET = `[]`

export const DEFAULT_BUILDER_FUNCTION = `{}`

export const DEFAULT_BUILDER_CODE = `
Generation code prompting is disabled.
Keep Syra UI only.
`

export const DEFAULT_AUTOFIX_DIAGNOSIS = `Auto-fix is disabled.`

export const DEFAULT_AUTOFIX_RESOLUTION = `Auto-fix is disabled.`

export const DEFAULT_INLINE_FIX_DIAGNOSIS = `Inline fix is disabled.`

export const DEFAULT_INLINE_FIX_RESOLUTION = `Inline fix is disabled.`

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
