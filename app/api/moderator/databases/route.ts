import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import clientPromise from "@/lib/torso"
import { logModerationAction } from "@/lib/moderator-audit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export interface DatabaseRecord {
  id: string
  name: string
  type: "master" | "regional"
  region: string
  regionLabel: string
  provider: string
  status: "operational" | "degraded" | "suspended" | "migrating"
  latencyMs: number
  activeConnections: number
  storageUsedMb: number
  storageLimitMb: number
  replicaCount: number
  assignedUsersCount: number
  isDefault: boolean
  lastCheckedAt: string
}

export const INITIAL_DATABASES: DatabaseRecord[] = [
  {
    id: "db-master-us-east",
    name: "Master Control Store (US East)",
    type: "master",
    region: "us-east-1",
    regionLabel: "North America (N. Virginia)",
    provider: "Turso / LibSQL Master",
    status: "operational",
    latencyMs: 11,
    activeConnections: 18,
    storageUsedMb: 124,
    storageLimitMb: 10000,
    replicaCount: 3,
    assignedUsersCount: 1420,
    isDefault: true,
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: "db-eu-frankfurt",
    name: "Regional Shard (EU Central)",
    type: "regional",
    region: "eu-central-1",
    regionLabel: "Europe (Frankfurt)",
    provider: "Turso / LibSQL Shard",
    status: "operational",
    latencyMs: 14,
    activeConnections: 12,
    storageUsedMb: 142,
    storageLimitMb: 5000,
    replicaCount: 3,
    assignedUsersCount: 840,
    isDefault: false,
    lastCheckedAt: new Date().toISOString(),
  },
  {
    id: "db-ap-singapore",
    name: "Regional Shard (Asia Pacific)",
    type: "regional",
    region: "ap-southeast-1",
    regionLabel: "Asia Pacific (Singapore)",
    provider: "Turso / LibSQL Shard",
    status: "operational",
    latencyMs: 28,
    activeConnections: 8,
    storageUsedMb: 68,
    storageLimitMb: 5000,
    replicaCount: 2,
    assignedUsersCount: 390,
    isDefault: false,
    lastCheckedAt: new Date().toISOString(),
  },
]

export async function GET() {
  try {
    await requireModerator()
    const client = await clientPromise
    const db = client.db()

    const customDbs = await db.collection("system_databases").find({}).toArray()
    const allDbs = customDbs.length > 0 ? customDbs : INITIAL_DATABASES

    // Calculate real user counts if users collection is populated
    const userCount = await db.collection("users").find({}).toArray().then((r) => r.length).catch(() => 0)

    return NextResponse.json({
      ok: true,
      databases: allDbs,
      totalCount: allDbs.length,
      platformUserCount: userCount,
      regions: [
        { id: "us-east-1", label: "North America (US East)", databaseId: "db-master-us-east", status: "active" },
        { id: "eu-central-1", label: "Europe (Frankfurt)", databaseId: "db-eu-frankfurt", status: "active" },
        { id: "ap-southeast-1", label: "Asia Pacific (Singapore)", databaseId: "db-ap-singapore", status: "active" },
      ],
    })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const mod = await requireModerator()
    const body = await request.json()
    const { action, databaseId, reason, newDb } = body

    const client = await clientPromise
    const db = client.db()

    if (action === "suspend") {
      if (!databaseId) {
        return NextResponse.json({ ok: false, error: "databaseId is required" }, { status: 400 })
      }
      await db.collection("system_databases").updateOne(
        { id: databaseId },
        { $set: { status: "suspended", suspendedAt: new Date().toISOString(), suspendReason: reason || "Moderator suspension" } },
        { upsert: true }
      )

      await logModerationAction({
        moderatorEmail: mod.email,
        action: "report_resolve" as any,
        targetType: "system",
        targetId: databaseId,
        reason: reason || "Database suspended from active region routing",
        details: { action: "database_suspend", databaseId },
      })

      return NextResponse.json({ ok: true, message: `Database ${databaseId} suspended successfully.` })
    }

    if (action === "activate") {
      if (!databaseId) {
        return NextResponse.json({ ok: false, error: "databaseId is required" }, { status: 400 })
      }
      await db.collection("system_databases").updateOne(
        { id: databaseId },
        { $set: { status: "operational", activatedAt: new Date().toISOString() } },
        { upsert: true }
      )

      await logModerationAction({
        moderatorEmail: mod.email,
        action: "report_resolve" as any,
        targetType: "system",
        targetId: databaseId,
        reason: reason || "Database activated for active region routing",
        details: { action: "database_activate", databaseId },
      })

      return NextResponse.json({ ok: true, message: `Database ${databaseId} activated.` })
    }

    if (action === "create" && newDb) {
      const entry: DatabaseRecord = {
        id: `db-${Date.now()}`,
        name: newDb.name || "Custom Shard",
        type: newDb.type || "regional",
        region: newDb.region || "us-east-1",
        regionLabel: newDb.regionLabel || newDb.region || "Custom Region",
        provider: newDb.provider || "Turso / LibSQL",
        status: "operational",
        latencyMs: 15,
        activeConnections: 0,
        storageUsedMb: 0,
        storageLimitMb: newDb.storageLimitMb || 5000,
        replicaCount: 1,
        assignedUsersCount: 0,
        isDefault: false,
        lastCheckedAt: new Date().toISOString(),
      }

      await db.collection("system_databases").insertOne(entry)
      return NextResponse.json({ ok: true, database: entry })
    }

    return NextResponse.json({ ok: false, error: "Invalid action" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Failed to update database" }, { status: 500 })
  }
}
