import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const isValidHexColor = (color: string): boolean => {
  if (!color || typeof color !== "string") return false
  return /^#[0-9A-F]{6}$/i.test(color)
}

const sanitizeSettings = (body: any) => {
  const sanitized: any = {}

  // Whitelist allowed fields for modular component system
  const allowedFields = [
    "headerComponent",
    "heroComponent",
    "productComponent",
    "extraSegments",
    "currency",
    "layout",
    "productsPerPage",
    "showPrices",
    "primaryColor",
    "secondaryColor",
    "contactEmail",
    "socialLinks",
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

    if (!settings) {
      return NextResponse.json({
        projectId: id,
        headerComponent: "simple",
        heroComponent: "basic",
        productComponent: "grid",
        extraSegments: {
          announcement: { enabled: false, message: "", bgColor: "#ff6b6b" },
          giveaway: { enabled: false, title: "", description: "", buttonText: "" },
          newsletter: { enabled: false, placeholder: "" },
        },
        currency: "USD",
        layout: "grid",
        productsPerPage: 12,
        showPrices: true,
        primaryColor: "#3b82f6",
        secondaryColor: "#8b5cf6",
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

    if (!sanitizedSettings.headerComponent) {
      throw new Error("Header component is required")
    }
    if (!sanitizedSettings.heroComponent) {
      throw new Error("Hero component is required")
    }
    if (!sanitizedSettings.productComponent) {
      throw new Error("Product component is required")
    }

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
