import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"

function productProjectIds(requestedId: string, project: any): string[] {
  const ids = new Set<string>()
  if (requestedId) ids.add(String(requestedId))
  if (project?._id != null) ids.add(String(project._id))
  if (project?.originalProjectId != null) ids.add(String(project.originalProjectId))
  if (project?.accessProjectId != null) ids.add(String(project.accessProjectId))
  return Array.from(ids)
}

async function requireOwnedProductsProject(projectId: string, userId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  return { db, project }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const { db, project } = await requireOwnedProductsProject(id, session.user.id)
  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const projectIds = productProjectIds(id, project)

  // Projection drops internal fields and large blobs that don't need to ship
  // to the edit screen. The dashboard mostly renders name, price, image, stock.
  const products = await db
    .collection("products")
    .find(
      { projectId: { $in: projectIds } },
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
  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const { db, project } = await requireOwnedProductsProject(id, session.user.id)
  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }
  const canonicalProjectId = String(project._id ?? id)
  const newProduct = {
    ...body,
    projectId: canonicalProjectId,
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

  const { id } = await params
  if (!id) {
    return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const productId = searchParams.get("productId")

  if (!productId || !productId.trim()) {
    return NextResponse.json({ message: "Invalid product ID" }, { status: 400 })
  }

  const { db, project } = await requireOwnedProductsProject(id, session.user.id)
  if (!project) {
    return NextResponse.json({ message: "Project not found" }, { status: 404 })
  }

  const projectIds = productProjectIds(id, project)

  const result = await db.collection("products").deleteOne({
    _id: productId,
    projectId: { $in: projectIds },
  })

  if (result.deletedCount === 0) {
    return NextResponse.json({ message: "Product not found" }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
