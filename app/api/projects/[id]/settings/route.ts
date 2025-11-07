import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const client = await clientPromise
  const db = client.db()

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 })
  }

  const settings = await db.collection("webshop_settings").findOne({
    projectId: id,
  })

  // Return default settings if none exist
  if (!settings) {
    return NextResponse.json({
      projectId: id,
      theme: "modern",
      currency: "USD",
      layout: "grid",
      productsPerPage: 12,
      showPrices: true,
      primaryColor: "#3b82f6",
      secondaryColor: "#8b5cf6",
      headerStyle: "simple",
      footerText: "All rights reserved.",
      contactEmail: "",
      socialLinks: {},
    })
  }

  return NextResponse.json(settings)
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const client = await clientPromise
  const db = client.db()
  const body = await request.json()

  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ message: "Invalid ID" }, { status: 400 })
  }

  // Verify project ownership
  const project = await db.collection("projects").findOne({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const result = await db
    .collection("webshop_settings")
    .updateOne({ projectId: id }, { $set: { ...body, projectId: id, updatedAt: new Date() } }, { upsert: true })

  return NextResponse.json({ success: true, result })
}
