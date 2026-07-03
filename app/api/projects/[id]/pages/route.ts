import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import {
  getOwnedProject,
  getStoredProjectId,
  ownedProjectUpdateFilter,
} from "@/lib/project-id"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
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

    const pages = project.pages ?? []
    return NextResponse.json({ pages })
  } catch (error: any) {
    console.error("Error fetching pages:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const { name, content, usedFor } = await request.json()

    if (!id) {
        return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    if (!name || !content) {
      return NextResponse.json({ message: "Name and content required" }, { status: 400 })
    }
    if (/^\.env(?:\.|$)/.test(name) || /\/\.env(?:\.|$)/.test(name)) {
      return NextResponse.json({ message: "Env files must not be saved" }, { status: 400 })
    }

    // Validate path - prevent directory traversal and other security issues
    const decodedName = decodeURIComponent(name)
    if (
      decodedName.includes('..') ||           // Directory traversal
      decodedName.startsWith('/') ||          // Absolute path
      decodedName.startsWith('\\') ||         // Windows absolute path
      decodedName.includes('\0') ||           // Null byte injection
      /[<>:"|?*]/.test(decodedName) ||        // Invalid filename characters
      decodedName.length > 255                // Path too long
    ) {
      return NextResponse.json({ message: "Invalid page name" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const project = await getOwnedProject(db, session.user.id, id)
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const storedProjectId = getStoredProjectId(project)

    // We need to upsert the page in the `projects.$.pages` array.
    // However, updating an element in an array of objects based on a sub-field is tricky with native Mongo operators if we want to "add or update".
    // 1. Try to update existing page
    const updateResult = await db.collection("users").updateOne(
        {
            id: session.user.id,
            "projects": {
                $elemMatch: {
                    _id: storedProjectId,
                    "pages.name": name
                }
            }
        },
        {
            $set: {
                "projects.$[proj].pages.$[page].content": content,
                "projects.$[proj].pages.$[page].usedFor": usedFor || '',
                "projects.$[proj].pages.$[page].updatedAt": new Date()
            }
        },
        {
            arrayFilters: [
                { "proj._id": storedProjectId },
                { "page.name": name }
            ]
        }
    )

    if (updateResult.matchedCount === 0) {
        // Page did not exist, push it
        await db.collection("users").updateOne(
            ownedProjectUpdateFilter(session.user.id, storedProjectId),
            {
                $push: {
                    "projects.$.pages": {
                        name: name,
                        content: content,
                        usedFor: usedFor || '',
                        createdAt: new Date(),
                        updatedAt: new Date()
                    }
                } as any
            }
        )
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("Error saving page:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const pageName = searchParams.get("name")
    const deleteAll = searchParams.get("all") === "true"

    if (!id) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    const project = await getOwnedProject(db, session.user.id, id)
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const storedProjectId = getStoredProjectId(project)

    if (deleteAll) {
        // Clear all pages for the project
        const result = await db.collection("users").updateOne(
            ownedProjectUpdateFilter(session.user.id, storedProjectId),
            {
                $set: {
                    "projects.$.pages": []
                }
            }
        )

        if (result.matchedCount === 0) {
             return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true, message: "All pages deleted" })

    } else {
        if (!pageName) {
          return NextResponse.json({ message: "Page name required" }, { status: 400 })
        }

        const result = await db.collection("users").updateOne(
            ownedProjectUpdateFilter(session.user.id, storedProjectId),
            {
                $pull: {
                    "projects.$.pages": { name: pageName }
                } as any
            }
        )

        if (result.matchedCount === 0) {
            // Either project or user not found
            return NextResponse.json({ message: "Project not found" }, { status: 404 })
        }

        // If matchedCount > 0 but modifiedCount == 0, it means page wasn't in the list
        if (result.modifiedCount === 0) {
            return NextResponse.json({ message: "Page not found" }, { status: 404 })
        }

        return NextResponse.json({ success: true })
    }

  } catch (error: any) {
    console.error("Error deleting page:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
