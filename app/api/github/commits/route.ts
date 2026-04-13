import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * GitHub Commits API
 * GET — fetch recent commits from a project's GitHub repo (main branch)
 */

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const projectId = url.searchParams.get("projectId")

  if (!projectId) {
    return NextResponse.json({ message: "Missing projectId" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne(
      { id: session.user.id, "projects._id": new ObjectId(projectId) },
      { projection: { "projects.$": 1, github_tokens: 1 } }
    )

    const project = user?.projects?.[0]
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    const repoId = project.githubRepoId
    if (!repoId) {
      return NextResponse.json({ commits: [], message: "No GitHub repo linked" })
    }

    // Get GitHub token
    const ghToken = user?.github_tokens?.access_token || process.env.GITHUB_TOKEN
    if (!ghToken) {
      return NextResponse.json({ message: "GitHub not connected" }, { status: 400 })
    }

    // Fetch commits from the main branch
    const repoRes = await fetch(`https://api.github.com/repos/${repoId}/commits?sha=main&per_page=20`, {
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    })

    if (!repoRes.ok) {
      // May not have main branch yet
      return NextResponse.json({ commits: [] })
    }

    const commits = await repoRes.json()

    // Find current deployed commit (stored in project)
    const deployedCommitSha = project.deployedCommitSha || null

    const formattedCommits = commits.map((c: any) => ({
      sha: c.sha,
      shortSha: c.sha.substring(0, 7),
      message: c.commit?.message || "No message",
      date: c.commit?.author?.date || c.commit?.committer?.date,
      author: c.commit?.author?.name || "Unknown",
      isDeployed: c.sha === deployedCommitSha,
    }))

    return NextResponse.json({
      commits: formattedCommits,
      deployedCommitSha,
    })
  } catch (error: any) {
    console.error("[GitHub Commits] error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
