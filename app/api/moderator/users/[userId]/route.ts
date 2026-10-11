import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { logModerationAction } from "@/lib/moderator-audit"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const mod = await requireModerator()
    const { userId } = await params
    const body = await request.json()
    const { region, shardId, reason } = body

    if (!userId || (!region && !shardId)) {
      return NextResponse.json({ ok: false, error: "userId and region/shardId are required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const user = await db.collection("users").findOne<any>({
      $or: [{ id: userId }, { _tid: userId }, { userId: userId }]
    })

    const targetEmail = user?.email || "Unknown"
    const prevRegion = user?.region || "us-east-1"
    const newRegion = region || "us-east-1"
    const newShardId = shardId || `db-${newRegion}`

    await db.collection("users").updateOne(
      { $or: [{ id: userId }, { _tid: userId }, { userId: userId }] },
      {
        $set: {
          region: newRegion,
          shardId: newShardId,
          regionUpdatedAt: new Date().toISOString(),
        }
      },
      { upsert: false }
    )

    await logModerationAction({
      moderatorEmail: mod.email,
      action: "report_resolve" as any,
      targetType: "user",
      targetId: userId,
      targetIdentifier: targetEmail,
      reason: reason || `Assigned to regional shard: ${newRegion}`,
      details: {
        previousRegion: prevRegion,
        newRegion,
        shardId: newShardId,
      },
    })

    return NextResponse.json({
      ok: true,
      userId,
      region: newRegion,
      shardId: newShardId,
      message: `User assigned to shard ${newRegion}`
    })
  } catch (error: any) {
    console.error("[moderator] Shard assignment error:", error)
    return NextResponse.json({ ok: false, error: error?.message || "Failed to assign shard" }, { status: 500 })
  }
}
