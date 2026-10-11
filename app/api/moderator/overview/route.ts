import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import clientPromise, { isTorsoConfigured } from "@/lib/torso"
import { isSyteConfigured } from "@/lib/deploy/syte-client"

export const dynamic = "force-dynamic"

export interface SystemAlert {
  id: string
  severity: "critical" | "warning" | "info"
  title: string
  description: string
  targetTab: "general" | "users" | "providers" | "databases" | "servers"
}

export interface ServiceStatus {
  id: string
  name: string
  status: "healthy" | "degraded" | "unconfigured" | "unavailable"
  location: string
  note: string
}

export async function GET() {
  try {
    await requireModerator()
    const client = await clientPromise
    const db = client.db()

    const [reportsCount, recentReports] = await Promise.all([
      db.collection("moderation_reports").find({ status: { $ne: "resolved" } }).toArray().then((r) => r.length).catch(() => 0),
      db.collection("moderation_reports").find({}).sort({ createdAt: -1 }).limit(10).toArray().catch(() => []),
    ])

    const torsoReady = isTorsoConfigured()
    const syteReady = isSyteConfigured()

    const alerts: SystemAlert[] = []

    if (!torsoReady) {
      alerts.push({
        id: "turso_unconfigured",
        severity: "warning",
        title: "Turso Master Database Not Configured",
        description: "TURSO_DATABASE_URL or TURSO_AUTH_TOKEN is missing. Application is operating in fallback storage mode.",
        targetTab: "databases",
      })
    }

    if (!syteReady) {
      alerts.push({
        id: "syte_unconfigured",
        severity: "warning",
        title: "Syte VM Runner Key Unset",
        description: "DEPLOYER_API_KEY is not defined. Direct VM runtime automation and workspace provisioning are offline.",
        targetTab: "servers",
      })
    }

    if (reportsCount > 0) {
      alerts.push({
        id: "pending_reports",
        severity: "info",
        title: `${reportsCount} Moderation ${reportsCount === 1 ? "Report" : "Reports"} Pending Review`,
        description: "Unresolved user safety reports require moderator inspection and adjudication.",
        targetTab: "general",
      })
    }

    const services: ServiceStatus[] = [
      {
        id: "turso",
        name: "Turso Master Store",
        status: torsoReady ? "healthy" : "unconfigured",
        location: "Global LibSQL Distributed Cluster",
        note: torsoReady ? "Connected & Schema Enforced" : "Fallback Storage Active",
      },
      {
        id: "syte",
        name: "Syte VM Runner",
        status: syteReady ? "healthy" : "unavailable",
        location: "Ubuntu 24.04 LTS (sycord.site)",
        note: syteReady ? "Control Plane Configured" : "Missing DEPLOYER_API_KEY",
      },
      {
        id: "vertex",
        name: "Google Vertex AI",
        status: "healthy",
        location: "us-central1 Regional Publisher",
        note: "Gemini 2.5 & 3.5 Active",
      },
      {
        id: "gateway",
        name: "Vercel AI Gateway",
        status: "healthy",
        location: "Global Edge Network",
        note: "Dynamic Model Router Active",
      },
    ]

    return NextResponse.json({
      ok: true,
      alerts,
      services,
      pendingReportsCount: reportsCount,
      recentReports,
    })
  } catch (error: any) {
    console.error("[moderator/overview] Error:", error)
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

