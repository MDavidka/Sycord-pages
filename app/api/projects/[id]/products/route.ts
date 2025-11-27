import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await clientPromise
  const db = client.db()

  const products = await db.collection("products").find({ projectId: id }).toArray()
  return NextResponse.json(products)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const client = await clientPromise
  const db = client.db()

  // Verify project ownership
  const project = await db.collection("projects").findOne({
    _id: new ObjectId(id),
    userId: session.user.id,
  })

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const body = await request.json()
  const newProduct = {
    ...body,
    projectId: id,
    createdAt: new Date(),
  }

  const result = await db.collection("products").insertOne(newProduct)
  return NextResponse.json({ ...newProduct, _id: result.insertedId }, { status: 201 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get("productId")

  if (!productId || !ObjectId.isValid(productId)) {
    return NextResponse.json({ message: "Invalid product ID" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()

  const result = await db.collection("products").deleteOne({
    _id: new ObjectId(productId),
  })

  if (result.deletedCount === 0) {
    return NextResponse.json({ message: "Product not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
