import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ message: "Project ID is required" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const historyDoc = await db.collection("chatHistory").findOne({ projectId, userId: session.user.id })

    const messages = historyDoc?.messages || []
    return NextResponse.json(messages)
  } catch (error: any) {
    console.error("[v0] Fetch history error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { projectId, message } = await request.json()

    if (!projectId || !message) {
      return NextResponse.json({ message: "Project ID and message are required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Add message and keep only the latest 50
    await db.collection("chatHistory").updateOne(
      { projectId, userId: session.user.id },
      {
        $push: {
          messages: {
            $each: [message],
            $slice: -50
          }
        }
      },
      { upsert: true }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[v0] Save history error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
