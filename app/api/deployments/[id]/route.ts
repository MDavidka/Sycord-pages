import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ message: "Invalid deployment ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const deployment = await db.collection("deployments").findOne({
      _id: new ObjectId(params.id),
      userId: session.user.id,
    })

    if (!deployment) {
      return NextResponse.json({ message: "Deployment not found" }, { status: 404 })
    }

    return NextResponse.json({ deployment })
  } catch (error: any) {
    console.error("[v0] Error fetching deployment:", error)
    return NextResponse.json({ message: "Failed to fetch deployment" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ message: "Invalid deployment ID" }, { status: 400 })
    }

    const { status } = await request.json()

    if (!["active", "inactive"].includes(status)) {
      return NextResponse.json({ message: "Invalid status. Must be 'active' or 'inactive'." }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const result = await db.collection("deployments").updateOne(
      {
        _id: new ObjectId(params.id),
        userId: session.user.id,
      },
      {
        $set: {
          status,
          updatedAt: new Date(),
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Deployment not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, status })
  } catch (error: any) {
    console.error("[v0] Error updating deployment:", error)
    return NextResponse.json({ message: "Failed to update deployment" }, { status: 500 })
  }
}
