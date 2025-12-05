import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies()

    // Extract tokens from temporary cookies
    const accessToken = cookieStore.get("vercel_auth_token")?.value
    const refreshToken = cookieStore.get("vercel_refresh_token")?.value
    const userId = cookieStore.get("vercel_user_id")?.value
    const userEmail = cookieStore.get("vercel_user_email")?.value
    const userName = cookieStore.get("vercel_user_name")?.value
    const expiresAt = cookieStore.get("vercel_expires_at")?.value

    if (!accessToken || !userId || !userEmail) {
      throw new Error("Missing required authentication data")
    }

    // Create NextAuth session via the credentials provider
    const response = await fetch(`${request.nextUrl.origin}/api/auth/callback/credentials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        user_id: userId,
        user_email: userEmail,
        user_name: userName,
        expires_at: expiresAt,
      }),
    })

    // Clear temporary cookies
    cookieStore.set("vercel_auth_token", "", { maxAge: 0 })
    cookieStore.set("vercel_refresh_token", "", { maxAge: 0 })
    cookieStore.set("vercel_user_id", "", { maxAge: 0 })
    cookieStore.set("vercel_user_email", "", { maxAge: 0 })
    cookieStore.set("vercel_user_name", "", { maxAge: 0 })
    cookieStore.set("vercel_expires_at", "", { maxAge: 0 })

    console.log("[CALLBACK-HANDLER] Session created, redirecting to dashboard")
    return NextResponse.redirect(new URL("/dashboard", request.url))
  } catch (error) {
    console.error("[CALLBACK-HANDLER] Error:", error)
    return NextResponse.redirect(new URL("/login?error=SessionCreationError", request.url))
  }
}
