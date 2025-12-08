import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * GET /api/cloudflare/status
 * Get Cloudflare deployment status and authentication status
 */
export async function GET(request: Request) {
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

    // Get project
    // Projects are owned by user.id
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Get credentials
    const tokenDoc = await db.collection("cloudflare_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId: session.user.email,
    })

    const projectPages = project.pages && Array.isArray(project.pages) ? project.pages : []
    const pagesCount = projectPages.length

    const pagesList = projectPages.map((p: any) => ({
      name: p.name || "unnamed",
      size: p.content?.length || 0,
    }))

    const debugInfo = {
      project: {
        id: project._id.toString(),
        name: project.name || project.businessName || "Untitled Project",
        hasPages: pagesCount > 0,
        pagesCount,
        cloudflareProjectName: project.cloudflareProjectName || null,
        cloudflareUrl: project.cloudflareUrl || null,
        cloudflareDeployedAt: project.cloudflareDeployedAt || null,
        cloudflareDeploymentId: project.cloudflareDeploymentId || null,
      },
      authentication: {
        isAuthenticated: !!tokenDoc,
        hasApiToken: !!tokenDoc?.apiToken,
        hasAccountId: !!tokenDoc?.accountId,
        tokenCreatedAt: tokenDoc?.createdAt || null,
        tokenUpdatedAt: tokenDoc?.updatedAt || null,
      },
      pages: pagesList,
      recommendations: [] as string[],
    }

    // Add recommendations
    if (!tokenDoc) {
      debugInfo.recommendations.push("Store your Cloudflare API token and Account ID to enable deployment")
    }

    if (pagesCount === 0) {
      debugInfo.recommendations.push("Create at least one page before deploying (use the AI Builder)")
    }

    return NextResponse.json(debugInfo)
  } catch (error: any) {
    console.error("[Cloudflare] Status error:", error)
    return NextResponse.json({ error: error.message || "Failed to get status" }, { status: 500 })
  }
}
