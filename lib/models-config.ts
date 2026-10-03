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
