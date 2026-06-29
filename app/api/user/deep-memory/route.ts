import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import type { DeepMemoryProfile, DeepMemoryEntry } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function emptyProfile(): DeepMemoryProfile {
  return {
    summary: "",
    architectureNotes: "",
    recurringIssues: [],
    trustedPatterns: [],
    entries: [],
    lastUpdatedAt: new Date().toISOString(),
  }
}

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id || null
}

export async function GET() {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne<{ deepMemory?: DeepMemoryProfile }>(
      { id: userId },
      { projection: { deepMemory: 1 } },
    )
    return NextResponse.json({ deepMemory: user?.deepMemory || emptyProfile() })
  } catch (error) {
    console.error("[deep-memory] GET error:", error)
    return NextResponse.json({ error: "Failed to load deep memory" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Partial<DeepMemoryProfile> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    const existing = await db.collection("users").findOne<{ deepMemory?: DeepMemoryProfile }>(
      { id: userId },
      { projection: { deepMemory: 1 } },
    )
    const current = existing?.deepMemory || emptyProfile()

    const updated: DeepMemoryProfile = {
      summary: typeof body.summary === "string" ? body.summary : current.summary,
      architectureNotes: typeof body.architectureNotes === "string" ? body.architectureNotes : current.architectureNotes,
      recurringIssues: Array.isArray(body.recurringIssues) ? body.recurringIssues : current.recurringIssues,
      trustedPatterns: Array.isArray(body.trustedPatterns) ? body.trustedPatterns : current.trustedPatterns,
      entries: Array.isArray(body.entries) ? body.entries.map((e) => ({ ...e, id: e.id || generateId() })) : current.entries,
      lastUpdatedAt: new Date().toISOString(),
    }

    await db.collection("users").updateOne(
      { id: userId },
      { $set: { deepMemory: updated, updatedAt: new Date().toISOString() } },
    )

    return NextResponse.json({ deepMemory: updated })
  } catch (error) {
    console.error("[deep-memory] PUT error:", error)
    return NextResponse.json({ error: "Failed to update deep memory" }, { status: 500 })
  }
}
