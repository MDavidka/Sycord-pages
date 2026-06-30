import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import {
  deleteProjectChatSession,
  getOwnedProject,
  loadProjectChatSession,
  saveProjectChatSession,
  toChatSessionSummary,
} from "@/lib/project-chat-session"

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

    const chatSession = await loadProjectChatSession(db, session.user.id, id)

    if (summaryOnly) {
      return NextResponse.json({ session: toChatSessionSummary(chatSession) })
    }

    return NextResponse.json({
      session: chatSession ? toChatSessionSummary(chatSession) : null,
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

    const chatSession = await saveProjectChatSession(db, session.user.id, id, {
      messages,
      title,
      model,
    })

    return NextResponse.json({
      success: true,
      session: toChatSessionSummary(chatSession),
      title: chatSession.title,
    })
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
    const project = await getOwnedProject(db, session.user.id, id)

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    await deleteProjectChatSession(db, session.user.id, id)

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error deleting project chat session:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
