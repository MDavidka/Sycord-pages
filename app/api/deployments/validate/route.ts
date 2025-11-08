import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { containsCurseWords } from "@/lib/curse-word-filter"

export async function POST(request: Request) {
  try {
    const { subdomain } = await request.json()

    // Check for curse words
    if (containsCurseWords(subdomain)) {
      return NextResponse.json(
        {
          valid: false,
          reason: "Subdomain contains inappropriate content",
        },
        { status: 400 },
      )
    }

    // Check if subdomain is empty or undefined
    if (!subdomain || subdomain.trim().length === 0) {
      return NextResponse.json(
        {
          valid: false,
          reason: "Subdomain cannot be empty",
        },
        { status: 400 },
      )
    }

    const client = await clientPromise
    const db = client.db()

    // Check if subdomain already exists
    const existingDeployment = await db.collection("deployments").findOne({
      subdomain: subdomain.toLowerCase(),
    })

    if (existingDeployment) {
      return NextResponse.json(
        {
          valid: false,
          reason: "Subdomain already in use",
        },
        { status: 409 },
      )
    }

    return NextResponse.json({ valid: true })
  } catch (error: any) {
    console.error("[v0] Validation error:", error)
    return NextResponse.json({ message: "Validation failed" }, { status: 500 })
  }
}
