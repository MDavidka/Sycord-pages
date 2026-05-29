import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { validatePath, isUnsafePath, normalizePath } from "@/lib/ai/path-safety"

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  try {
    const { id } = await params
    const body = await request.json()

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    // ─── Bulk save mode ───
    if (body.mode === "merge" || body.mode === "replace" && Array.isArray(body.pages)) {
      const pagesToSave = body.pages as Array<{ name: string; content: string; usedFor?: string }>
      const client = await clientPromise
      const db = client.db()
      const now = new Date()

      // Validate all paths first
      for (const page of pagesToSave) {
        const pathResult = validatePath(page.name)
        if (!pathResult.valid) {
          return NextResponse.json({ message: `Invalid path: ${page.name} - ${pathResult.reason}` }, { status: 400 })
        }
        if (isUnsafePath(page.name)) {
          return NextResponse.json({ message: `Unsafe path: ${page.name}` }, { status: 400 })
        }
        if (!page.content || page.content.length < 3) {
          return NextResponse.json({ message: `Empty content for: ${page.name}` }, { status: 400 })
        }
      }

      // If replace mode, clear all existing pages first
      if (body.mode === "replace") {
        await db.collection("users").updateOne(
          { id: userId, "projects._id": new ObjectId(id) },
          { $set: { "projects.$.pages": [] } }
        )
      }

      // Upsert each page
      for (const page of pagesToSave) {
        const normalizedName = normalizePath(page.name)
        const updateResult = await db.collection("users").updateOne(
          {
            id: userId,
            projects: { $elemMatch: { _id: new ObjectId(id), "pages.name": normalizedName } },
          },
          {
            $set: {
              "projects.$[proj].pages.$[pg].content": page.content,
              "projects.$[proj].pages.$[pg].usedFor": page.usedFor || "",
              "projects.$[proj].pages.$[pg].updatedAt": now,
            },
          },
          {
            arrayFilters: [
              { "proj._id": new ObjectId(id) },
              { "pg.name": normalizedName },
            ],
          }
        )

        if (updateResult.matchedCount === 0) {
          await db.collection("users").updateOne(
            { id: userId, "projects._id": new ObjectId(id) },
            {
              $push: {
                "projects.$.pages": {
                  name: normalizedName,
                  content: page.content,
                  usedFor: page.usedFor || "",
                  createdAt: now,
                  updatedAt: now,
                },
              } as any,
            }
          )
        }
      }

      return NextResponse.json({ success: true, savedCount: pagesToSave.length })
    }

    // ─── Single page save (backwards compatible) ───
    const { name, content, usedFor } = body

    if (!name || !content) {
      return NextResponse.json({ message: "Name and content required" }, { status: 400 })
    }

    const pathResult = validatePath(name)
    if (!pathResult.valid) {
      return NextResponse.json({ message: `Invalid path: ${pathResult.reason}` }, { status: 400 })
    }

    if (isUnsafePath(name)) {
      return NextResponse.json({ message: "Env files must not be saved" }, { status: 400 })
    }

    const normalizedName = normalizePath(pathResult.normalized ?? name)
    const client = await clientPromise
    const db = client.db()

    const updateResult = await db.collection("users").updateOne(
      {
        id: userId,
        projects: { $elemMatch: { _id: new ObjectId(id), "pages.name": normalizedName } },
      },
      {
        $set: {
          "projects.$[proj].pages.$[page].content": content,
          "projects.$[proj].pages.$[page].usedFor": usedFor || "",
          "projects.$[proj].pages.$[page].updatedAt": new Date(),
        },
      },
      {
        arrayFilters: [
          { "proj._id": new ObjectId(id) },
          { "page.name": normalizedName },
        ],
      }
    )

    if (updateResult.matchedCount === 0) {
      const projectCheck = await db.collection("users").findOne({
        id: userId,
        "projects._id": new ObjectId(id),
      })

      if (!projectCheck) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
      }

      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(id) },
        {
          $push: {
            "projects.$.pages": {
              name: normalizedName,
              content,
              usedFor: usedFor || "",
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          } as any,
        }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error saving page:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    )
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }
  const userId = (session.user as any).id as string

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const pageName = searchParams.get("name")
    const deleteAll = searchParams.get("all") === "true"

    if (!ObjectId.isValid(id)) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    if (deleteAll) {
      const result = await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(id) },
        { $set: { "projects.$.pages": [] } }
      )

      if (result.matchedCount === 0) {
        return NextResponse.json({ message: "Project not found" }, { status: 404 })
      }

      return NextResponse.json({ success: true, message: "All pages deleted" })
    }

    if (!pageName) {
      return NextResponse.json({ message: "Page name required" }, { status: 400 })
    }

    const result = await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(id) },
      { $pull: { "projects.$.pages": { name: pageName } } as any }
    )

    if (result.matchedCount === 0) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({ message: "Page not found" }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error("Error deleting page:", error)
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Server error" },
      { status: 500 },
    )
  }
}
