import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * Handles OAuth callback from Google
 * Exchanges code for tokens and stores them securely
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get("code")
    const stateParam = searchParams.get("state")
    const error = searchParams.get("error")

    if (error) {
      console.error("[Firebase] OAuth callback error:", error)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=oauth_failed`)
    }

    if (!code || !stateParam) {
      console.error("[Firebase] OAuth callback: Missing code or state")
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=missing_params`)
    }

    const state = JSON.parse(stateParam)
    const { projectId, userId } = state

    const session = await getServerSession(authOptions)
    if (!session?.user?.id || session.user.id !== userId) {
      console.error("[Firebase] OAuth callback: Session mismatch - unauthorized user")
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=unauthorized`)
    }

    console.log("[Firebase] Processing OAuth callback for project:", projectId)

    const client = await clientPromise
    const db = client.db()

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      console.error("[Firebase] OAuth callback: Project not found or unauthorized")
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=project_not_found`)
    }

    // Exchange code for tokens
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/firebase/auth/callback`,
        grant_type: "authorization_code",
      }),
    })

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json()
      console.error("[Firebase] Token exchange failed:", errorData)
      return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=token_exchange_failed`)
    }

    const tokens = await tokenResponse.json()
    console.log("[Firebase] Tokens received:", {
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
    })

    // Store tokens in database
    await db.collection("firebase_tokens").updateOne(
      { projectId: new ObjectId(projectId), userId: session.user.id },
      {
        $set: {
          projectId: new ObjectId(projectId),
          userId: session.user.id,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          expiresIn: tokens.expires_in,
          tokenType: tokens.token_type,
          scope: tokens.scope,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )

    console.log("[Firebase] Tokens stored successfully for project:", projectId)

    // Redirect back to project page
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard/sites/${projectId}?firebase_auth=success`)
  } catch (error: any) {
    console.error("[Firebase] OAuth callback error:", error)
    return NextResponse.redirect(`${process.env.NEXTAUTH_URL}/dashboard?error=oauth_callback_failed`)
  }
}
