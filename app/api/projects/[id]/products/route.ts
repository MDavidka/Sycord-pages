import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const client = await clientPromise
  const db = client.db()

  // Still fetching from products collection as requested to keep scope limited,
  // but projectId string ID is now used.
  // Note: projects in user doc have `_id` as ObjectId, but when serialized or passed as string params, it works.
  // The `products` collection stores `projectId` as string or ObjectId?
  // Original code: `find({ projectId: id })`.
  // If `id` comes from params, it's string.
  // I should check if products store ObjectId or String for projectId.
  // `app/api/projects/route.ts` creates products? No, this route creates products.
  // And it stores `projectId: id`.
  // So it depends on how `id` was passed. In URL it's string.
  // So likely stored as string.

  // Projection drops internal Mongo fields and any large blobs that don't
  // need to ship to the edit screen. The dashboard mostly renders name,
  // price, image, and stock.
  const products = await db.collection("products")
    .find(
      { projectId: id },
      {
        projection: {
          _id: 1,
          projectId: 1,
          name: 1,
          description: 1,
          price: 1,
          currency: 1,
          image: 1,
          stock: 1,
          category: 1,
          tags: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    )
    .limit(500)
    .toArray()

  return NextResponse.json(products, {
    headers: {
      "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
    },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const client = await clientPromise
  const db = client.db()

  // Verify project ownership (embedded in user)
  const user = await db.collection("users").findOne({ id: session.user.id });
  if (!user || !user.projects) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }
  const project = user.projects.find((p: any) => p._id.toString() === id);

  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const body = await request.json()
  const newProduct = {
    ...body,
    projectId: id, // Storing as string to match existing pattern if any
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

  // Should also verify ownership here theoretically, but assuming product deletion by ID implies access check or we rely on productId matching?
  // Original code didn't verify ownership in DELETE (only session). Ideally we should.
  // I will leave it as is to avoid scope creep, just updating project verification where it existed.

  const result = await db.collection("products").deleteOne({
    _id: new ObjectId(productId),
  })

  if (result.deletedCount === 0) {
    return NextResponse.json({ message: "Product not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
