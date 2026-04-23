import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const subdomain = searchParams.get("subdomain")

  if (!subdomain || typeof subdomain !== "string" || subdomain.trim().length < 3) {
    return NextResponse.json({ available: false, message: "Subdomain must be at least 3 characters" }, { status: 400 })
  }

  const sanitized = subdomain
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")

  if (sanitized.length < 3) {
    return NextResponse.json({ available: false, message: "Subdomain must be at least 3 characters" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    const existing = await db.collection("users").findOne(
      { "projects.subdomain": sanitized },
      { projection: { _id: 1 } }
    )

    return NextResponse.json({ available: !existing, subdomain: sanitized })
  } catch (error) {
    console.error("Error checking subdomain:", error)
    return NextResponse.json({ available: false, message: "Failed to check subdomain" }, { status: 500 })
  }
}
