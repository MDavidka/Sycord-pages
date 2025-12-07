import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * Validate Cloudflare API token by making a test API call
 */
async function validateCloudflareToken(apiToken: string, accountId: string): Promise<boolean> {
  try {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
      {
        headers: {
          Authorization: `Bearer ${apiToken}`,
        },
      }
    )
    
    return response.ok
  } catch (error) {
    console.error("[Cloudflare] Token validation error:", error)
    return false
  }
}

/**
 * POST /api/cloudflare/auth
 * Store Cloudflare API credentials for a project
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, apiToken, accountId } = await request.json()

    if (!projectId || !apiToken || !accountId) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, apiToken, accountId" },
        { status: 400 }
      )
    }

    const client = await clientPromise
    const db = client.db()

    // Verify project ownership
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      return NextResponse.json(
        { error: "Project not found or you do not have permission to modify it" },
        { status: 403 }
      )
    }

    // Validate the token
    console.log("[Cloudflare] Validating API token...")
    const isValid = await validateCloudflareToken(apiToken, accountId)

    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid Cloudflare API token or account ID" },
        { status: 400 }
      )
    }

    // Store or update the token
    await db.collection("cloudflare_tokens").updateOne(
      {
        projectId: new ObjectId(projectId),
        userId: session.user.email,
      },
      {
        $set: {
          apiToken,
          accountId,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          createdAt: new Date(),
        },
      },
      { upsert: true }
    )

    console.log("[Cloudflare] API credentials stored successfully")

    return NextResponse.json({
      success: true,
      message: "Cloudflare API credentials validated and stored",
    })
  } catch (error: any) {
    console.error("[Cloudflare] Auth error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to store credentials" },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/cloudflare/auth
 * Remove Cloudflare API credentials for a project
 */
export async function DELETE(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    await db.collection("cloudflare_tokens").deleteOne({
      projectId: new ObjectId(projectId),
      userId: session.user.email,
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Cloudflare] Delete auth error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to delete credentials" },
      { status: 500 }
    )
  }
}
