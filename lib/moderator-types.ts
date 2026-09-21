import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminEmail } from "@/lib/is-admin"

export type ModeratorRole = "admin" | "moderator"

export interface ModeratorUser {
  id: string
  email: string
  name: string
  role: ModeratorRole
}

export async function getAuthenticatedModerator(): Promise<ModeratorUser | null> {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  if (!email || !isAdminEmail(email)) {
    return null
  }
  return {
    id: (session.user as any)?.id || email,
    email,
    name: session.user.name || email.split("@")[0],
    role: "moderator",
  }
}

export async function requireModerator(): Promise<ModeratorUser> {
  const mod = await getAuthenticatedModerator()
  if (!mod) {
    throw new Error("Unauthorized: Moderator access required")
  }
  return mod
}

export interface ReportItem {
  id: string
  reporterEmail: string
  reportedUserId: string
  reportedUserEmail: string
  reportedUserName?: string
  reason: string
  category: "spam" | "abuse" | "malware" | "tos_violation" | "impersonation" | "other"
  status: "open" | "reviewing" | "resolved" | "dismissed"
  createdAt: string
  updatedAt?: string
  assignedModerator?: string
  resolutionNotes?: string
}

export interface ModerationWarning {
  id: string
  userId: string
  userEmail: string
  moderatorEmail: string
  reason: string
  createdAt: string
  caseId?: string
}

export interface ModerationAuditLog {
  id: string
  moderatorEmail: string
  action:
    | "user_ban"
    | "user_unban"
    | "user_warn"
    | "credits_add"
    | "credits_remove"
    | "premium_toggle"
    | "report_resolve"
    | "report_dismiss"
    | "announcement_create"
    | "announcement_deactivate"
    | "announcement_delete"
    | "ticket_reply"
    | "ticket_resolve"
    | "ticket_close"
  targetType: "user" | "report" | "ticket" | "announcement" | "system"
  targetId: string
  targetIdentifier?: string
  details?: Record<string, any>
  reason?: string
  createdAt: string
}

export interface ServerAnnouncement {
  id: string
  title: string
  message: string
  type: "info" | "maintenance" | "warning" | "important"
  active: boolean
  creatorEmail: string
  createdAt: string
  updatedAt?: string
  expiresAt?: string | null
}

export interface SupportTicket {
  id: string
  userId: string
  userEmail: string
  userName?: string
  subject: string
  message: string
  status: "open" | "pending" | "resolved" | "closed"
  priority: "low" | "medium" | "high" | "urgent"
  assignedModerator?: string
  createdAt: string
  updatedAt: string
  replies?: Array<{
    id: string
    senderEmail: string
    senderName: string
    isModerator: boolean
    content: string
    createdAt: string
  }>
}

export interface MonitoringNodeItem {
  id: string
  name: string
  type: "frontend" | "backend" | "database" | "worker" | "ai" | "other"
  region: string
  status: "operational" | "degraded" | "offline"
  cpuPercent?: number
  memoryPercent?: number
  latencyMs?: number
  uptimePercent?: number
  lastHeartbeat?: string
}

export interface MonitoringDatabaseItem {
  id: string
  name: string
  region: string
  provider: string
  status: "operational" | "degraded" | "offline"
  latencyMs?: number
  activeConnections?: number
  storageUsedMb?: number
  storageLimitMb?: number
  replicaCount?: number
}

export interface MonitoringAnomalyItem {
  id: string
  nodeId?: string
  severity: "low" | "medium" | "high" | "critical"
  title: string
  description: string
  detectedAt: string
  status: "active" | "investigating" | "resolved"
}
