import { NextResponse } from "next/server"
import clientPromise from "@/lib/torso"
import { isAdmin } from "@/lib/is-admin"

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const { id } = await params
    if (!id || !id.trim()) {
      return new NextResponse("Invalid ID", { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    await db.collection("monitors").deleteOne({ _id: id })

    return new NextResponse(null, { status: 204 })
  } catch (error) {
    console.error("Error deleting monitor:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
