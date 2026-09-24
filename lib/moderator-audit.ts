import clientPromise from "@/lib/torso"
import type { ModerationAuditLog } from "@/lib/moderator-types"

export async function logModerationAction(params: {
  moderatorEmail: string
  action: ModerationAuditLog["action"]
  targetType: ModerationAuditLog["targetType"]
  targetId: string
  targetIdentifier?: string
  details?: Record<string, any>
  reason?: string
}): Promise<void> {
  try {
    const client = await clientPromise
    const db = client.db()
    const entry: ModerationAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      moderatorEmail: params.moderatorEmail,
      action: params.action,
      targetType: params.targetType,
      targetId: params.targetId,
      targetIdentifier: params.targetIdentifier,
      details: params.details || {},
      reason: params.reason || "",
      createdAt: new Date().toISOString(),
    }
    await db.collection("moderation_audit_logs").insertOne(entry)
  } catch (err) {
    console.error("[moderation-audit] Failed to write audit log:", err)
  }
}

export async function getRecentAuditLogs(limit = 50): Promise<ModerationAuditLog[]> {
  try {
    const client = await clientPromise
    const db = client.db()
    const logs = await db
      .collection("moderation_audit_logs")
      .find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray()
    return logs as ModerationAuditLog[]
  } catch (err) {
    console.error("[moderation-audit] Failed to fetch audit logs:", err)
    return []
  }
}
