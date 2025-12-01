import type { NextRequest } from "next/server"
import { cookies } from "next/headers"
import clientPromise from "@/lib/mongodb"

interface TokenData {
  access_token: string
  token_type: string
  id_token: string
  expires_in: number
  scope: string
  refresh_token: string
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")
    const state = url.searchParams.get("state")

    if (!code) {
      throw new Error("Authorization code is required")
    }

    const storedState = request.cookies.get("oauth_state")?.value
    const storedNonce = request.cookies.get("oauth_nonce")?.value
    const codeVerifier = request.cookies.get("oauth_code_verifier")?.value
    const redirectTarget = request.cookies.get("oauth_redirect_to")?.value || "/dashboard"

    if (!validate(state, storedState)) {
      throw new Error("State mismatch")
    }

    const tokenData = await exchangeCodeForToken(code, codeVerifier, request.nextUrl.origin)

    await setAuthCookies(tokenData)

    // --- MongoDB Persistence ---
    const user = await fetchVercelUser(tokenData.access_token)
    await persistUserToDB(user, tokenData.access_token)
    // ---------------------------

    const cookieStore = await cookies()

    // Clear temporary cookies
    cookieStore.set("oauth_state", "", { maxAge: 0 })
    cookieStore.set("oauth_nonce", "", { maxAge: 0 })
    cookieStore.set("oauth_code_verifier", "", { maxAge: 0 })
    cookieStore.set("oauth_redirect_to", "", { maxAge: 0 })

    return Response.redirect(new URL(redirectTarget, request.url))
  } catch (error) {
    console.error("OAuth callback error:", error)
    // Redirect to login with error
    return Response.redirect(new URL("/login?error=OAuthCallbackError", request.url))
  }
}

function validate(value: string | null, storedValue: string | undefined): boolean {
  if (!value || !storedValue) {
    return false
  }
  return value === storedValue
}

async function exchangeCodeForToken(
  code: string,
  code_verifier: string | undefined,
  requestOrigin: string,
): Promise<TokenData> {
  const redirect_uri = `${process.env.NEXTAUTH_URL || "https://ltpd.xyz"}/api/auth/callback`

  const params = new URLSearchParams({
    client_id: process.env.VERCEL_CLIENT_ID as string,
    client_secret: process.env.VERCEL_CLIENT_SECRET as string,
    code: code,
    code_verifier: code_verifier || "",
    redirect_uri: redirect_uri,
  })

  console.log("[v0] Token exchange redirect_uri:", redirect_uri)
  const response = await fetch("https://api.vercel.com/v2/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  })

  if (!response.ok) {
    const errorData = await response.json()
    console.log("[v0] OAuth error response:", errorData)
    throw new Error(`Failed to exchange code for token: ${JSON.stringify(errorData)}`)
  }

  return await response.json()
}

async function fetchVercelUser(token: string) {
  const response = await fetch("https://api.vercel.com/www/user", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  })
  if (!response.ok) throw new Error("Failed to fetch user")
  const data = await response.json()
  return data.user
}

async function persistUserToDB(vercelUser: any, token: string) {
  try {
    const client = await clientPromise
    const db = client.db()

    await db.collection("users").updateOne(
      { id: vercelUser.uid },
      {
        $set: {
          id: vercelUser.uid,
          name: vercelUser.name || vercelUser.username,
          email: vercelUser.email,
          image: `https://vercel.com/api/www/avatar/${vercelUser.uid}`,
          vercelAccessToken: token,
          vercelProvider: true,
          updatedAt: new Date(),
        },
      },
      { upsert: true },
    )
    console.log("[v0-DEBUG] Persisted Vercel User:", vercelUser.uid)
  } catch (e) {
    console.error("[v0-ERROR] DB Persist Failed:", e)
  }
}

async function setAuthCookies(tokenData: TokenData) {
  const cookieStore = await cookies()

  cookieStore.set("access_token", tokenData.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: tokenData.expires_in || 3600, // Default 1 hour if undefined
  })

  if (tokenData.refresh_token) {
    cookieStore.set("refresh_token", tokenData.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    })
  }
}
