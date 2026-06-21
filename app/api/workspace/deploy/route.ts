import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  prepareProjectDeployFiles,
  validateApiDeployFiles,
  getProjectEnvVars,
  getSycordDomain,
} from "@/lib/deploy/runner-client"
import {
  ensureAndDeployApplication,
  isDokployConfigured,
  toDokployAppName,
} from "@/lib/deploy/dokploy-client"
import { isValidProjectId, validateNextBuildable } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function slugifyContainerName(project: any, projectId: string): string {
  return (
    project?.containerName ||
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
    return Response.json({ status: "error", message: "Invalid project ID" }, { status: 400 })
  }

  if (!isDokployConfigured()) {
    return Response.json(
      { status: "error", message: "Dokploy is not configured. Set DOKPLOY_API_KEY and DOKPLOY_API_URL." },
      { status: 503 },
    )
  }

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne({ id: userId })
  const project = user?.projects?.find((p: any) => p._id.toString() === projectId)

  if (!project) {
    return Response.json({ status: "error", message: "Project not found" }, { status: 404 })
  }

  const files = prepareProjectDeployFiles(project)
  const validationErrors = validateApiDeployFiles(files)
  if (validationErrors.length > 0) {
    return Response.json({ status: "error", message: validationErrors.join("; ") }, { status: 400 })
  }

  const buildProblems = validateNextBuildable(
    files.map((f) => ({ name: f.path, content: f.content })),
  )
  if (buildProblems.length > 0) {
    return Response.json({ status: "error", message: buildProblems.join("; ") }, { status: 400 })
  }

  const containerName = slugifyContainerName(project, projectId)
  const domain = getSycordDomain()

  const dokployAppName = toDokployAppName(
    project.businessName || project.name || containerName,
    projectId,
  )

  const ghOwner = project.githubOwner as string | undefined
  const ghRepo = project.githubRepo as string | undefined
  if (!ghOwner || !ghRepo) {
    return Response.json(
      {
        status: "error",
        message:
          "No GitHub source found for this project. Run save() first to push the project to GitHub, then deploy.",
      },
      { status: 409 },
    )
  }

  const source = {
    owner: ghOwner,
    repository: ghRepo,
    branch: (project.githubBranch as string | undefined) || "main",
    buildPath: "/",
    githubId: (project.dokployGithubId as string | undefined) || null,
    gitUrl: (project.githubUrl ? `${project.githubUrl}.git` : undefined) as string | undefined,
  }

  const result = await ensureAndDeployApplication({
    name: project.businessName || dokployAppName,
    appName: dokployAppName,
    projectName: toDokployAppName(project.businessName || dokployAppName, projectId),
    existingApplicationId: project.dokployApplicationId || null,
    existingProjectId: project.dokployProjectId || null,
    existingEnvironmentId: project.dokployEnvironmentId || body?.environmentId || null,
    buildType: (body?.buildType as any) || "dockerfile",
    dockerfile: (body?.dockerfile as string) || "Dockerfile",
    dockerContextPath: (body?.dockerContextPath as string) || "/",
    env: getProjectEnvVars(project),
    source,
    title: "Sycord AI deploy",
    description: `Deployment for ${dokployAppName}`,
  })

  const finalUrl = `https://${dokployAppName}.${domain}`

  if (!result.success) {
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.deploymentMode": "dokploy",
          "projects.$.deploymentRuntime.status": "failed",
          "projects.$.deploymentRuntime.lastDeployError": result.error,
          ...(result.projectId ? { "projects.$.dokployProjectId": result.projectId } : {}),
          ...(result.environmentId ? { "projects.$.dokployEnvironmentId": result.environmentId } : {}),
          ...(result.applicationId ? { "projects.$.dokployApplicationId": result.applicationId } : {}),
        },
      },
    )
    return Response.json(
      { status: "error", message: result.error || "Dokploy deployment failed", steps: result.steps },
      { status: 502 },
    )
  }

  await db.collection("users").updateOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    {
      $set: {
        "projects.$.deploymentMode": "dokploy",
        "projects.$.containerName": dokployAppName,
        "projects.$.dokployProjectId": result.projectId,
        "projects.$.dokployEnvironmentId": result.environmentId,
        "projects.$.dokployApplicationId": result.applicationId,
        "projects.$.dokployAppName": dokployAppName,
        "projects.$.deploymentRuntime": {
          mode: "dokploy",
          domain: dokployAppName,
          url: finalUrl,
          projectId: result.projectId,
          environmentId: result.environmentId,
          applicationId: result.applicationId,
          status: "deployed",
          health: "healthy",
          lastHealthCheckAt: new Date(),
          lastDeployAt: new Date(),
          lastDeployError: null,
        },
        "projects.$.deployedAt": new Date(),
      },
    },
  )

  return Response.json({
    status: "success",
    url: finalUrl,
    containerName: dokployAppName,
    projectId: result.projectId,
    environmentId: result.environmentId,
    applicationId: result.applicationId,
    created: result.created,
    createdProject: result.createdProject,
    createdEnvironment: result.createdEnvironment,
    steps: result.steps,
  })
}
