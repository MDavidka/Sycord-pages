// Save the project's raw source files to a GitHub repository so Dokploy can
// build + deploy them. Unlike /api/github/save (which rewrites pages to .html
// for static hosting), this preserves the original file paths/extensions — a
// real Next.js project that Dokploy can build from source.
//
//   POST /api/workspace/github-save?projectId=...

import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import {
  getEnvGitHubCredentials,
  ensureRepo,
  deployViaGitTree,
} from "@/lib/deploy/github"
import { prepareProjectDeployFiles, validateApiDeployFiles } from "@/lib/deploy/runner-client"
import { isValidProjectId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function slugifyRepoName(project: any, projectId: string): string {
  const base = project?.githubRepo || project?.businessName || project?.name || `sycord-project-${projectId}`
  return String(base)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100) || `sycord-project-${projectId}`
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 })
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    /* empty body is fine */
  }

  const projectId = (new URL(req.url).searchParams.get("projectId") || body?.projectId || "").toString()
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ status: "error", message: "Invalid project ID" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne({ id: userId })
  const project = user?.projects?.find((p: any) => p._id.toString() === projectId)
  if (!project) {
    return NextResponse.json({ status: "error", message: "Project not found" }, { status: 404 })
  }

  // Resolve GitHub credentials: env first, then per-project stored token.
  let token: string | undefined
  let owner: string | undefined
  const envCreds = getEnvGitHubCredentials()
  if (envCreds) {
    token = envCreds.token
    owner = envCreds.owner
  } else {
    const tokenData = user?.github_tokens?.[projectId]
    if (tokenData?.token) {
      token = tokenData.token
      owner = tokenData.owner || tokenData.username
    }
  }

  if (!token || !owner) {
    return NextResponse.json(
      {
        status: "error",
        message:
          "GitHub credentials not found. Set GITHUB_API_TOKEN + GITHUB_OWNER, or connect GitHub for this project.",
      },
      { status: 400 },
    )
  }

  // Prepare RAW source files (no .html rewriting).
  const files = prepareProjectDeployFiles(project)
  const validationErrors = validateApiDeployFiles(files)
  if (validationErrors.length > 0) {
    return NextResponse.json({ status: "error", message: validationErrors.join("; ") }, { status: 400 })
  }

  const repo = slugifyRepoName(project, projectId)
  const branch = "main"

  try {
    const { repoId, gitUrl } = await ensureRepo(owner, repo, token)
    await deployViaGitTree(owner, repo, files, token)

    await db.collection("users").updateOne(
      { id: userId, "projects._id": projectId },
      {
        $set: {
          "projects.$.githubOwner": owner,
          "projects.$.githubRepo": repo,
          "projects.$.githubRepoId": repoId,
          "projects.$.githubBranch": branch,
          "projects.$.githubUrl": gitUrl,
          "projects.$.githubSavedAt": new Date(),
        },
      },
    )

    return NextResponse.json({
      status: "success",
      owner,
      repo,
      branch,
      repoId,
      url: gitUrl,
      filesCount: files.length,
    })
  } catch (err: any) {
    return NextResponse.json(
      { status: "error", message: err?.message || "Failed to save to GitHub" },
      { status: 500 },
    )
  }
}
