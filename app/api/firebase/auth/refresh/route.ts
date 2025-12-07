import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * Refreshes Firebase access token using refresh token
 */
export async function POST(request: Request) {
  try {
    const { projectId, userId } = await request.json()

    if (!projectId || !userId) {
      return NextResponse.json({ message: "Missing required parameters" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Get stored refresh token
    const tokenDoc = await db.collection("firebase_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId,
    })

    if (!tokenDoc || !tokenDoc.refreshToken) {
      console.error("[Firebase] No refresh token found for project:", projectId)
      return NextResponse.json({ message: "No refresh token found" }, { status: 404 })
    }

    console.log("[Firebase] Refreshing access token for project:", projectId)

    // Refresh the token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        refresh_token: tokenDoc.refreshToken,
        grant_type: "refresh_token",
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error("[Firebase] Token refresh failed:", errorData)
      return NextResponse.json({ message: "Token refresh failed" }, { status: 500 })
    }

    const tokens = await tokenResponse.json()

    // Update access token
    await db.collection("firebase_tokens").updateOne(
      { projectId: new ObjectId(projectId), userId },
      {
        $set: {
          accessToken: tokens.access_token,
          expiresIn: tokens.expires_in,
          updatedAt: new Date(),
        },
      }
    )

    console.log("[Firebase] Token refreshed successfully for project:", projectId)

    return NextResponse.json({ 
      accessToken: tokens.access_token,
      success: true 
    })
  } catch (error: any) {
    console.error("[Firebase] Token refresh error:", error)
    return NextResponse.json({ message: error.message || "Failed to refresh token" }, { status: 500 })
  }
}
