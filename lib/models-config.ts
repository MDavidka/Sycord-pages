import clientPromise from "@/lib/torso"

export interface ModelConfigRecord {
  modelId: string
  displayName?: string
  enabledInLibrary?: boolean
  updatedAt?: string
}

const COLLECTION_NAME = "models_config"

/**
 * Get all model configurations (display names and enabled states)
 */
export async function getAllModelConfigs(): Promise<Record<string, { displayName?: string; enabledInLibrary?: boolean }>> {
  try {
    const client = await clientPromise
    const db = client.db()
    const records = await db.collection(COLLECTION_NAME).find({}).toArray()
    const map: Record<string, { displayName?: string; enabledInLibrary?: boolean }> = {}
    for (const r of records) {
      if (r.modelId) {
        map[r.modelId] = {
          displayName: r.displayName || undefined,
          enabledInLibrary: typeof r.enabledInLibrary === "boolean" ? r.enabledInLibrary : true,
        }
      }
    }
    return map
  } catch (err) {
    console.error("[models-config] Error reading model configs:", err)
    return {}
  }
}

/**
 * Upsert model settings (displayName and/or enabledInLibrary)
 */
export async function upsertModelConfig(
  modelId: string,
  updates: { displayName?: string; enabledInLibrary?: boolean }
): Promise<boolean> {
  if (!modelId) return false
  try {
    const client = await clientPromise
    const db = client.db()
    const now = new Date().toISOString()

    const $set: Record<string, any> = {
      modelId,
      updatedAt: now,
    }
    if (typeof updates.displayName === "string") {
      $set.displayName = updates.displayName.trim()
    }
    if (typeof updates.enabledInLibrary === "boolean") {
      $set.enabledInLibrary = updates.enabledInLibrary
    }

    await db.collection(COLLECTION_NAME).updateOne(
      { modelId },
      { $set },
      { upsert: true }
    )
    return true
  } catch (err) {
    console.error("[models-config] Error updating model config:", err)
    return false
  }
}

/**
 * Strips provider prefixes and cleans raw IDs into human-readable model display names.
 * Example:
 * - "google/gemma-4-26b-a4b-it" -> "Gemma 4 26B"
 * - "arcee-ai/trinity-large" -> "Trinity Large"
 * - "anthropic/claude-3.5-sonnet" -> "Claude 3.5 Sonnet"
 */
export function cleanModelDisplayName(rawModelOrId: string): string {
  if (!rawModelOrId) return ""
  // If user already specified a human-friendly display name (without slash)
  let name = rawModelOrId.includes("/")
    ? rawModelOrId.split("/").slice(1).join("/")
    : rawModelOrId

  // Clean trailing -it, -instruct, -preview if present for cleaner display
  // But preserve recognizable numbers like 3.5, 4, 26B, etc.
  name = name
    .replace(/-a\d+b-it$/i, "")
    .replace(/-it$/i, "")
    .replace(/-instruct$/i, "")
    .replace(/-preview$/i, "")

  // Format into capitalized words (e.g. gemma-4-26b -> Gemma 4 26B)
  const parts = name.split(/[-_]+/).map((part) => {
    // If it's a version or size like 26b, 70b, uppercase the b
    if (/^\d+[bB]$/.test(part)) return part.toUpperCase()
    // Capitalize first letter
    return part.charAt(0).toUpperCase() + part.slice(1)
  })

  return parts.join(" ")
}
