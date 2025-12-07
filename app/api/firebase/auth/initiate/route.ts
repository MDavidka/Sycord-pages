import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

/**
 * Initiates Firebase OAuth flow
 * Redirects user to Google OAuth with necessary scopes for Firebase deployment
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log("[Firebase] OAuth initiate: Unauthorized - no session")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")
    
    if (!projectId) {
      return NextResponse.json({ message: "Project ID required" }, { status: 400 })
    }

    // Build OAuth URL with necessary Firebase scopes
    const clientId = process.env.GOOGLE_CLIENT_ID
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/firebase/auth/callback`
    
    const scopes = [
      "openid",
      "profile",
      "email",
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
      "https://www.googleapis.com/auth/firebase.hosting",
    ].join(" ")

    const oauthUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth")
    oauthUrl.searchParams.set("client_id", clientId || "")
    oauthUrl.searchParams.set("redirect_uri", redirectUri)
    oauthUrl.searchParams.set("response_type", "code")
    oauthUrl.searchParams.set("scope", scopes)
    oauthUrl.searchParams.set("access_type", "offline")
    oauthUrl.searchParams.set("prompt", "consent")
    oauthUrl.searchParams.set("state", JSON.stringify({ projectId, userId: session.user.id }))

    console.log("[Firebase] OAuth URL generated for project:", projectId)
    
    return NextResponse.redirect(oauthUrl.toString())
  } catch (error: any) {
    console.error("[Firebase] OAuth initiate error:", error)
    return NextResponse.json({ message: error.message || "Failed to initiate OAuth" }, { status: 500 })
  }
}
