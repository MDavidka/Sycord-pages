import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { logModerationAction } from "@/lib/moderator-audit"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    await requireModerator()
    const client = await clientPromise
    const db = client.db()

    const tickets = await db
      .collection("support_tickets")
      .find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray()
      .catch(() => [])

    return NextResponse.json({ ok: true, tickets })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}

export async function POST(request: Request) {
  try {
    const mod = await requireModerator()
    const body = await request.json()
    const { ticketId, action, replyMessage, status } = body

    if (!ticketId) {
      return NextResponse.json({ error: "Missing ticketId" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const updateOps: any = {
      $set: {
        updatedAt: new Date().toISOString(),
        assignedModerator: mod.email,
      },
    }

    if (status) {
      updateOps.$set.status = status
    }

    if (replyMessage) {
      const replyEntry = {
        id: `reply_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        senderEmail: mod.email,
        senderName: mod.name || "Moderator",
        isModerator: true,
        content: replyMessage.trim(),
        createdAt: new Date().toISOString(),
      }
      updateOps.$push = { replies: replyEntry }
    }

    await db.collection("support_tickets").updateOne({ id: ticketId }, updateOps)

    await logModerationAction({
      moderatorEmail: mod.email,
      action: status === "resolved" ? "ticket_resolve" : status === "closed" ? "ticket_close" : "ticket_reply",
      targetType: "ticket",
      targetId: ticketId,
      reason: replyMessage || "",
      details: { status, hasReply: !!replyMessage },
    })

    return NextResponse.json({ ok: true, message: "Ticket updated successfully" })
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Unauthorized" }, { status: 401 })
  }
}
