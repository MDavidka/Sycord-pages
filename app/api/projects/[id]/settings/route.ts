import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const isValidHexColor = (color: string): boolean => {
  if (!color || typeof color !== "string") return false
  return /^#[0-9A-F]{6}$/i.test(color)
}

const sanitizeSettings = (body: any) => {
  const sanitized: any = {}

  // Whitelist allowed fields
  const allowedFields = [
    "theme",
    "currency",
    "layout",
    "productsPerPage",
    "showPrices",
    "primaryColor",
    "secondaryColor",
    "headerStyle",
    "footerText",
    "contactEmail",
    "socialLinks",
    "backgroundColor",
    "logoUrl",
  ]

  for (const field of allowedFields) {
    if (field in body) {
      sanitized[field] = body[field]
    }
  }

  // Validate hex color fields
  if (sanitized.primaryColor && !isValidHexColor(sanitized.primaryColor)) {
    throw new Error("Invalid primary color format. Use hex color (e.g., #3b82f6)")
  }
  if (sanitized.secondaryColor && !isValidHexColor(sanitized.secondaryColor)) {
    throw new Error("Invalid secondary color format. Use hex color (e.g., #8b5cf6)")
  }
  if (sanitized.backgroundColor && !isValidHexColor(sanitized.backgroundColor)) {
    throw new Error("Invalid background color format. Use hex color (e.g., #ffffff)")
  }

  return sanitized
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const client = await clientPromise
  const db = client.db()

  if (!ObjectId.isValid(id)) {
    console.error("[v0] Invalid ID format:", id)
    return NextResponse.json({ message: "Invalid ID format" }, { status: 400 })
  }

  try {
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
  } catch (error: any) {
    console.error("[v0] GET settings error:", error)
    return NextResponse.json({ message: "Failed to fetch settings" }, { status: 500 })
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const client = await clientPromise
  const db = client.db()

  if (!ObjectId.isValid(id)) {
    console.error("[v0] Invalid ID format:", id)
    return NextResponse.json({ message: "Invalid ID format" }, { status: 400 })
  }

  try {
    // Verify project ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(id),
      userId: session.user.id,
    })

    if (!project) {
      console.error("[v0] Project not found for ID:", id)
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const body = await request.json()
    console.log("[v0] Received settings update body:", body)

    const sanitizedSettings = sanitizeSettings(body)
    console.log("[v0] Sanitized settings:", sanitizedSettings)

    const result = await db.collection("webshop_settings").updateOne(
      { projectId: id },
      {
        $set: {
          ...sanitizedSettings,
          projectId: id,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )

    console.log("[v0] Database update result:", result)

    const savedSettings = await db.collection("webshop_settings").findOne({ projectId: id })
    return NextResponse.json({ success: true, settings: savedSettings, result })
  } catch (error: any) {
    console.error("[v0] Settings update error:", error)
    return NextResponse.json({ message: error.message || "Failed to update settings" }, { status: 400 })
  }
}
