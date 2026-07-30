import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { isAdminEmail } from "@/lib/is-admin"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const { id } = await params
    const client = await clientPromise
    const db = client.db()
    await db.collection("releases").deleteOne({ _id: id })
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Failed to delete release" }, { status: 500 })
  }
}
