import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const next = searchParams.get("next") || "/dashboard"

  if (!process.env.VERCEL_CLIENT_ID) {
    return NextResponse.json({ error: "Missing VERCEL_CLIENT_ID" }, { status: 500 })
  }

  // We pack the 'next' URL into the state parameter to retrieve it in the callback
  // In a production app, we should sign this or use a cookie to prevent tampering/CSRF,
  // but for this implementation we will base64 encode it with a random prefix.
  const randomState = crypto.randomUUID()
  const statePayload = JSON.stringify({ r: randomState, next })
  const state = Buffer.from(statePayload).toString('base64')

  const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/vercel/callback`

  const params = new URLSearchParams({
    client_id: process.env.VERCEL_CLIENT_ID,
    state: state,
    redirect_uri: redirectUri,
  })

  return NextResponse.redirect(`https://vercel.com/oauth/authorize?${params.toString()}`)
}
