import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")

  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 })
  }

  let nextUrl = "/dashboard"
  if (state) {
    try {
      const decodedState = JSON.parse(Buffer.from(state, 'base64').toString())
      if (decodedState.next) {
        nextUrl = decodedState.next
      }
    } catch (e) {
      console.warn("Failed to decode state:", e)
    }
  }

  try {
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/vercel/callback`

    // Exchange code for token
    const tokenResponse = await fetch("https://api.vercel.com/v2/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: process.env.VERCEL_CLIENT_ID!,
        client_secret: process.env.VERCEL_CLIENT_SECRET!,
        code: code,
        redirect_uri: redirectUri,
      }),
    })

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      console.error("Vercel Token Error:", tokenData)
      return NextResponse.json({ error: "Failed to get access token from Vercel", details: tokenData }, { status: 500 })
    }

    const accessToken = tokenData.access_token
    const teamId = tokenData.team_id

    // Save token to DB
    const client = await clientPromise
    const db = client.db()

    // Determine the user ID format.
    // session.user.id typically comes from the provider's 'sub'.
    // In NextAuth with JWT strategy (no adapter), it's a string.
    // If we used a database adapter, it would be an ObjectId.
    // However, existing code in app/api/projects/route.ts uses `session.user.id` to filter projects.
    // Projects are stored with `userId` as the string ID from session.
    // The previous feedback noted potential issues with ObjectId vs String.
    // Since `lib/auth.ts` uses JWT strategy and no adapter, `session.user.id` is a string (Google ID).
    // Therefore, we should store it as a string in the `users` collection to match.
    // If the `users` collection is shared with other logic that uses ObjectIds, we might have a conflict.
    // But since there is no other visible `users` logic in the provided files, we will use the string ID.

    await db.collection("users").updateOne(
      { _id: session.user.id as any }, // Use 'as any' to bypass TS check if _id is typed strictly as ObjectId
      {
        $set: {
          vercelToken: accessToken,
          vercelTeamId: teamId || null,
          vercelUserId: tokenData.user_id,
          updatedAt: new Date()
        },
        $setOnInsert: {
            email: session.user.email,
            name: session.user.name,
            createdAt: new Date()
        }
      },
      { upsert: true }
    )

    // Redirect back to next URL (e.g., the project page)
    const finalRedirectUrl = `${process.env.NEXTAUTH_URL}${nextUrl}${nextUrl.includes('?') ? '&' : '?'}vercel_connected=true`
    return NextResponse.redirect(finalRedirectUrl)

  } catch (error) {
    console.error("Vercel Callback Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
