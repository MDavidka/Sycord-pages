import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"

export interface ProjectChatSession {
  id: string
  title: string
  messages: unknown[]
  model?: string
  createdAt: Date | string
  updatedAt: Date | string
}

function buildChatSessionId(projectId: string) {
  return `project_${projectId}`
}

function toSummary(session: ProjectChatSession | null | undefined) {
  if (!session) return null
  return {
    id: session.id,
    title: session.title || "Syra Chat",
    messageCount: Array.isArray(session.messages) ? session.messages.length : 0,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    model: session.model,
  }
}

async function getOwnedProject(db: any, userId: string, projectId: string) {
  const user = await db.collection("users").findOne(
    { id: userId, "projects._id": projectId },
    { projection: { "projects.$": 1 } },
  )
  return user?.projects?.[0] ?? null
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const summaryOnly = searchParams.get("summary") === "true"

    const client = await clientPromise
    const db = client.db()
    const project = await getOwnedProject(db, session.user.id, id)

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const chatSession = project.chatSession as ProjectChatSession | undefined

    if (summaryOnly) {
      return NextResponse.json({ session: toSummary(chatSession) })
    }

    return NextResponse.json({
      session: chatSession ?? null,
      messages: chatSession?.messages ?? [],
      title: chatSession?.title ?? "Syra Chat",
      updatedAt: chatSession?.updatedAt ?? null,
      createdAt: chatSession?.createdAt ?? null,
    })
  } catch (error: any) {
    console.error("Error fetching project chat session:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const body = await request.json()
    const { messages, title, model } = body ?? {}

    if (messages !== undefined && !Array.isArray(messages)) {
      return NextResponse.json({ message: "messages must be an array" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const project = await getOwnedProject(db, session.user.id, id)

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const existing = (project.chatSession as ProjectChatSession | undefined) ?? null
    const now = new Date()
    const chatSession: ProjectChatSession = {
      id: existing?.id ?? buildChatSessionId(id),
      title:
        typeof title === "string" && title.trim()
          ? title.trim()
          : existing?.title ?? "Syra Chat",
      messages: messages !== undefined ? messages : (existing?.messages ?? []),
      model: typeof model === "string" ? model : existing?.model,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    const result = await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": id },
      {
        $set: {
          "projects.$.chatSession": chatSession,
          "projects.$.updatedAt": now,
        },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true, session: toSummary(chatSession), title: chatSession.title })
  } catch (error: any) {
    console.error("Error saving project chat session:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    if (!id) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()
    const now = new Date()

    const result = await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": id },
      {
        $unset: { "projects.$.chatSession": "" },
        $set: { "projects.$.updatedAt": now },
      },
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting project chat session:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
