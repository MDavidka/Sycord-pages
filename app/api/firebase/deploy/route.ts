import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * Helper to get valid access token (refreshes if needed)
 */
async function getValidAccessToken(projectId: string, userId: string) {
  const client = await clientPromise
  const db = client.db()

  const tokenDoc = await db.collection("firebase_tokens").findOne({
    projectId: new ObjectId(projectId),
    userId,
  })

  if (!tokenDoc) {
    throw new Error("No Firebase authentication found. Please authenticate first.")
  }

  // Check if token needs refresh (if createdAt is older than expiresIn)
  const tokenAge = Date.now() - new Date(tokenDoc.updatedAt).getTime()
  const expiresInMs = (tokenDoc.expiresIn || 3600) * 1000

  if (tokenAge >= expiresInMs - 60000) {
    // Token expired or will expire in 1 minute, refresh it
    console.log("[Firebase] Access token expired, refreshing...")

    const refreshResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/firebase/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, userId }),
    })

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh access token")
    }

    const refreshData = await refreshResponse.json()
    return refreshData.accessToken
  }

  return tokenDoc.accessToken
}

/**
 * Helper to make Firebase API calls with retry logic
 */
async function firebaseApiCall(
  url: string,
  options: RequestInit,
  accessToken: string,
  retries = 3,
  contentType = "application/json",
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }

  // Only add Content-Type if not already specified in options
  if (!options.headers || !(options.headers as Record<string, string>)["Content-Type"]) {
    headers["Content-Type"] = contentType
  }

  // Merge with any existing headers
  if (options.headers) {
    Object.assign(headers, options.headers)
  }

  let lastError: any
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers })

      if (response.ok || response.status === 404 || response.status === 409) {
        return response
      }

      let errorData: any
      const contentTypeHeader = response.headers.get("content-type")

      if (contentTypeHeader?.includes("application/json")) {
        errorData = await response.json().catch(() => ({ rawText: response.text() }))
      } else {
        // If response is HTML or other format, capture as text
        const text = await response.text()
        errorData = {
          htmlResponse: text.substring(0, 200), // First 200 chars
          fullStatus: response.status,
          statusText: response.statusText,
        }
      }

      console.error(`[Firebase] API call failed (attempt ${i + 1}/${retries}):`, {
        url,
        status: response.status,
        error: errorData,
      })

      lastError = errorData
    } catch (error) {
      console.error(`[Firebase] API call error (attempt ${i + 1}/${retries}):`, error)
      lastError = error
    }

    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
    }
  }

  throw new Error(`Firebase API call failed after ${retries} retries: ${JSON.stringify(lastError)}`)
}

/**
 * Deploys site to Firebase Hosting
 * POST /api/firebase/deploy
 */
export async function POST(request: Request) {
  return NextResponse.json(
    {
      message: "This endpoint is deprecated. Please use /api/firebase/deploy-cli instead.",
      upgradeUrl: "/api/firebase/deploy-cli",
    },
    { status: 410 }, // HTTP 410 Gone
  )
}
