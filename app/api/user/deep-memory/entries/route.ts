import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import type { DeepMemoryEntry, DeepMemoryEntryKind } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

async function getUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id || null
}

function emptyProfile() {
  return {
    summary: "",
    architectureNotes: "",
    recurringIssues: [],
    trustedPatterns: [],
    entries: [] as DeepMemoryEntry[],
    lastUpdatedAt: new Date().toISOString(),
  }
}

export async function POST(request: Request) {
  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: Partial<DeepMemoryEntry> = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const kind: DeepMemoryEntryKind = (body.kind as DeepMemoryEntryKind) || "lesson"
  const title = typeof body.title === "string" ? body.title.trim() : ""
  const content = typeof body.content === "string" ? body.content.trim() : ""

  if (!title || !content) {
    return NextResponse.json({ error: "title and content are required" }, { status: 400 })
  }

  const entry: DeepMemoryEntry = {
    id: body.id || generateId(),
    kind,
    title,
    content,
    projectId: typeof body.projectId === "string" ? body.projectId : undefined,
    projectName: typeof body.projectName === "string" ? body.projectName : undefined,
    tags: Array.isArray(body.tags) ? body.tags.filter((t): t is string => typeof t === "string") : [],
    createdAt: body.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne<{ deepMemory?: ReturnType<typeof emptyProfile> }>(
      { id: userId },
      { projection: { deepMemory: 1 } },
    )
    const current = user?.deepMemory || emptyProfile()

    const entries = [entry, ...current.entries].slice(0, 500)
    const updated = {
      ...current,
      entries,
      lastUpdatedAt: new Date().toISOString(),
    }

    await db.collection("users").updateOne(
      { id: userId },
      { $set: { deepMemory: updated, updatedAt: new Date().toISOString() } },
    )

    return NextResponse.json({ entry, deepMemory: updated })
  } catch (error) {
    console.error("[deep-memory/entries] POST error:", error)
    return NextResponse.json({ error: "Failed to add deep memory entry" }, { status: 500 })
  }
}
