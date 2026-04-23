import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || session.user?.email !== "dmarton336@gmail.com") {
      return new NextResponse("Unauthorized", { status: 401 })
    }

    const { id, icon, iconType } = await req.json()
    if (!id || !icon) {
      return new NextResponse("Missing id or icon", { status: 400 })
    }

    // Validate PNG data URL if iconType is 'custom'
    if (iconType === 'custom' && !icon.startsWith('data:image/')) {
      return new NextResponse("Invalid custom icon format", { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    await db.collection("monitors").updateOne(
      { id },
      { $set: { icon, iconType: iconType || 'preset', updatedAt: new Date() } },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving monitor icon:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
