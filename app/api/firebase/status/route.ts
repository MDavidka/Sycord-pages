import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * Get Firebase deployment status and debug information
 * GET /api/firebase/status?projectId=xxx
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get("projectId")

    if (!projectId) {
      return NextResponse.json({ message: "Project ID required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Get project
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Get Firebase tokens
    const tokenDoc = await db.collection("firebase_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId: session.user.id,
    })

    const debugInfo = {
      project: {
        id: project._id,
        name: project.businessName,
        hasPages: !!project.pages && project.pages.length > 0,
        pagesCount: project.pages?.length || 0,
        firebaseProjectId: project.firebaseProjectId || null,
        firebaseUrl: project.firebaseUrl || null,
        firebaseDeployedAt: project.firebaseDeployedAt || null,
      },
      authentication: {
        isAuthenticated: !!tokenDoc,
        hasAccessToken: !!tokenDoc?.accessToken,
        hasRefreshToken: !!tokenDoc?.refreshToken,
        tokenCreatedAt: tokenDoc?.createdAt || null,
        tokenUpdatedAt: tokenDoc?.updatedAt || null,
        tokenExpiresIn: tokenDoc?.expiresIn || null,
        scopes: tokenDoc?.scope || null,
      },
      pages: project.pages?.map((page: any) => ({
        name: page.name,
        size: page.content?.length || 0,
      })) || [],
      recommendations: [],
    }

    // Add recommendations
    if (!debugInfo.authentication.isAuthenticated) {
      debugInfo.recommendations.push("⚠️ No Firebase authentication found. Please authenticate with Google first.")
    }
    
    if (!debugInfo.project.hasPages) {
      debugInfo.recommendations.push("⚠️ No pages found. Please generate your website using the AI Builder first.")
    }

    if (debugInfo.authentication.isAuthenticated && debugInfo.project.hasPages) {
      debugInfo.recommendations.push("✅ Ready to deploy! Click the 'Deploy to Firebase' button.")
    }

    return NextResponse.json(debugInfo)
  } catch (error: any) {
    console.error("[Firebase] Status check error:", error)
    return NextResponse.json({ 
      message: error.message || "Failed to get status",
      error: error.toString(),
    }, { status: 500 })
  }
}
