import { NextResponse } from "next/server"
import { getAuthenticatedModerator, requireModerator } from "@/lib/moderator-types"
import { logModerationAction } from "@/lib/moderator-audit"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

// Public GET: user dashboard can retrieve active announcements
export async function GET() {
  try {
    const client = await clientPromise
    const db = client.db()

    const announcements = await db
      .collection("server_announcements")
      .find({ active: true })
      .sort({ createdAt: -1 })
      .toArray()
      .catch(() => [])

    return NextResponse.json({ ok: true, announcements })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to fetch announcements" }, { status: 500 })
  }
}

// Protected POST: moderators create/publish announcements
export async function POST(request: Request) {
  try {
    const mod = await requireModerator()
    const body = await request.json()
    const { title, message, type, expiresAt } = body

    if (!title || !message) {
      return NextResponse.json({ error: "Title and message are required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const announcement = {
      id: `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title: title.trim(),
      message: message.trim(),
      type: ["info", "maintenance", "warning", "important"].includes(type) ? type : "info",
      active: true,
      creatorEmail: mod.email,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null,
    }

    await db.collection("server_announcements").insertOne(announcement)

    await logModerationAction({
      moderatorEmail: mod.email,
      action: "announcement_create",
      targetType: "announcement",
      targetId: announcement.id,
      targetIdentifier: announcement.title,
      details: announcement,
    })

    return NextResponse.json({ ok: true, message: "Announcement published successfully", announcement })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

// Protected PATCH/DELETE: toggle active or delete announcement
export async function PATCH(request: Request) {
  try {
    const mod = await requireModerator()
    const body = await request.json()
    const { id, active } = body

    if (!id) {
      return NextResponse.json({ error: "Announcement id is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    await db.collection("server_announcements").updateOne(
      { id },
      {
        $set: {
          active: !!active,
          updatedAt: new Date().toISOString(),
        },
      }
    )

    await logModerationAction({
      moderatorEmail: mod.email,
      action: "announcement_deactivate",
      targetType: "announcement",
      targetId: id,
      details: { active: !!active },
    })

    return NextResponse.json({ ok: true, message: `Announcement ${active ? "activated" : "deactivated"}` })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
