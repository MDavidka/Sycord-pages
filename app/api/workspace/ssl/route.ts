/**
 * POST /api/workspace/ssl
 * Auto-issue / renew a TLS certificate for a deployed Syte workspace domain.
 *
 * Body: { projectId: string }
 *
 * Flow:
 *  1. Load the project from DB to get syteWorkspaceUuid + syteDomain.
 *  2. Call the Syte infra API to trigger certificate issuance.
 *  3. Poll until the cert is active (max 2 min), then persist sslActive=true.
 *
 * Called by the client after a successful deploy (fire-and-forget via
 * fetch(...) without await so the deploy UI doesn't block on cert issuance).
 */

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const SYTE_API = process.env.SYTE_API_URL ?? "https://api.syte.run"
const SYTE_TOKEN = process.env.SYTE_API_TOKEN ?? ""

async function sytePost(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${SYTE_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${SYTE_TOKEN}`,
    },
    body: JSON.stringify(body),
  })
  return res
}

async function syteGet(path: string) {
  const res = await fetch(`${SYTE_API}${path}`, {
    headers: { Authorization: `Bearer ${SYTE_TOKEN}` },
  })
  return res
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId } = await request.json()
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const project = await db
      .collection("projects")
      .findOne({ _id: new ObjectId(projectId) })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const uuid: string | null = project.syteWorkspaceUuid ?? null
    const domain: string | null = project.syteDomain ?? null

    if (!uuid || !domain) {
      return NextResponse.json(
        { error: "Workspace not provisioned yet", sslActive: false },
        { status: 422 }
      )
    }

    // 1. Request certificate issuance from Syte
    const issueRes = await sytePost(`/workspaces/${uuid}/ssl/issue`, { domain })
    if (!issueRes.ok) {
      const txt = await issueRes.text().catch(() => "")
      console.error("[SSL] Syte issue error:", issueRes.status, txt)
      // If the cert already exists Syte may return 409 — still counts as active
      if (issueRes.status !== 409) {
        return NextResponse.json(
          { error: `SSL issuance failed (${issueRes.status})` },
          { status: 502 }
        )
      }
    }

    // 2. Poll until cert is active (up to 24 attempts × 5 s = 2 min)
    let sslActive = false
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 5000))
      const statusRes = await syteGet(`/workspaces/${uuid}/ssl/status`)
      if (statusRes.ok) {
        const data = await statusRes.json().catch(() => ({}))
        if (data.active || data.status === "active") {
          sslActive = true
          break
        }
      }
    }

    // 3. Persist result
    await db
      .collection("projects")
      .updateOne(
        { _id: new ObjectId(projectId) },
        { $set: { sslActive, sslCheckedAt: new Date() } }
      )

    return NextResponse.json({ ok: true, sslActive })
  } catch (err: any) {
    console.error("[SSL] Unexpected error:", err)
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 })
  }
}

/**
 * GET /api/workspace/ssl?projectId=xxx
 * Quick status check — returns { sslActive, sslCheckedAt } from the DB.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const project = await db
      .collection("projects")
      .findOne(
        { _id: new ObjectId(projectId) },
        { projection: { sslActive: 1, sslCheckedAt: 1 } }
      )

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({
      sslActive: project.sslActive ?? null,
      sslCheckedAt: project.sslCheckedAt ?? null,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 })
  }
}
