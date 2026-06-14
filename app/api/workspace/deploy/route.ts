// POST /api/workspace/deploy  — deploy (CDN Push API)
//
// Single command that bundles the project's client-side SPA (its saved pages)
// and deploys the static files to sycord.site edge hosting. Reuses the existing
// GitHub + Companion Server deploy pipeline used by /api/deploy/stream, but
// returns a single clean JSON payload instead of an SSE stream.
//
// Response: { "status": "success", "url": "https://project-id.sycord.site" }

import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { deployViaGitTree, ensureRepo, getEnvGitHubCredentials } from "@/lib/deploy/github"
import {
  callCompanionDeploy,
  callCompanionHealth,
  prepareProjectDeployFiles,
  validateApiDeployFiles,
} from "@/lib/deploy/runner-client"
import { isValidProjectId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function slugifyRepoName(project: any, projectId: string): string {
  return (
    project?.githubRepo ||
    project?.businessName?.toLowerCase().replace(/[^a-z0-9-]/g, "-") ||
    `project-${projectId}`
  )
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return Response.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }

  const projectId = (new URL(req.url).searchParams.get("projectId") || body?.projectId || "").toString()
  if (!isValidProjectId(projectId)) {
    return Response.json({ status: "error", message: "Invalid projectId" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne({ id: userId })
  const project = user?.projects?.find((p: any) => p?._id?.toString() === projectId)
  if (!project) {
    return Response.json({ status: "error", message: "Project not found" }, { status: 404 })
  }

  // Bundle the project's saved pages into deployable static files.
  const files = prepareProjectDeployFiles(project)
  const validationErrors = validateApiDeployFiles(files)
  if (validationErrors.length > 0) {
    return Response.json({ status: "error", message: validationErrors.join("; ") }, { status: 400 })
  }

  const github = getEnvGitHubCredentials()
  if (!github) {
    return Response.json(
      { status: "error", message: "Deployment backend is not configured (missing GitHub credentials)." },
      { status: 503 },
    )
  }

  try {
    const repo = slugifyRepoName(project, projectId)
    const { repoId, gitUrl } = await ensureRepo(github.owner, repo, github.token)

    // Push the bundled files to the project's repository.
    await deployViaGitTree(github.owner, repo, files, github.token)

    // Trigger the Companion Server (sycord.site) CDN deployment.
    await callCompanionHealth()
    const companion = await callCompanionDeploy(repoId)
    const url = companion.url || `https://${repo}.sycord.site`

    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.githubOwner": github.owner,
          "projects.$.githubRepo": repo,
          "projects.$.githubRepoId": repoId,
          "projects.$.githubUrl": gitUrl,
          "projects.$.cloudflareUrl": url,
          "projects.$.deploymentMode": "api",
          "projects.$.deployedAt": new Date(),
        },
      },
    )

    return Response.json({ status: "success", url })
  } catch (err: any) {
    return Response.json(
      { status: "error", message: err?.message || "Deployment failed" },
      { status: 500 },
    )
  }
}
