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
import { assignDokployService } from "@/lib/deploy/assign-service"
import { isValidProjectId, validateNextBuildable } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function generateDockerfile(framework: string, nodeVersion: string, port: string): string {
  const npmInstall = "npm install --no-audit --no-fund --prefer-offline && npm cache clean --force"
  const npmCi = "(npm ci && npm cache clean --force) || (" + npmInstall + ")"
  if (framework === "nextjs" || framework === "next") {
    return "# syntax=docker/dockerfile:1\n" +
"FROM node:" + nodeVersion + "-alpine AS deps\n" +
"WORKDIR /app\n" +
"COPY package*.json ./\n" +
"RUN apk add --no-cache libc6-compat && " + npmCi + "\n" +
"\n" +
"FROM node:" + nodeVersion + "-alpine AS builder\n" +
"WORKDIR /app\n" +
"COPY --from=deps /app/node_modules ./node_modules\n" +
"COPY . .\n" +
"RUN npm run build\n" +
"\n" +
"FROM node:" + nodeVersion + "-alpine AS runner\n" +
"WORKDIR /app\n" +
"RUN addgroup -S appgroup && adduser -S appuser -G appgroup\n" +
"COPY --from=builder /app/public ./public\n" +
"COPY --from=builder /app/.next/standalone ./\n" +
"COPY --from=builder /app/.next/static ./.next/static\n" +
"RUN chown -R appuser:appgroup /app\n" +
"USER appuser\n" +
"EXPOSE " + port + "\n" +
"ENV PORT=" + port + "\n" +
"ENV NODE_ENV=production\n" +
"CMD [\"node\", \"server.js\"]\n"
  }
  return "# syntax=docker/dockerfile:1\n" +
"FROM node:" + nodeVersion + "-alpine\n" +
"WORKDIR /app\n" +
"COPY package*.json ./\n" +
"RUN " + npmCi + "\n" +
"COPY . .\n" +
"RUN npm run build 2>/dev/null; true\n" +
"RUN addgroup -S appgroup && adduser -S appuser -G appgroup\n" +
"RUN chown -R appuser:appgroup /app\n" +
"USER appuser\n" +
"EXPOSE " + port + "\n" +
"ENV PORT=" + port + "\n" +
"ENV NODE_ENV=production\n" +
"CMD [\"node\", \"server.js\"]\n"
}

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

  // Auto-generate Dockerfile if missing from project pages
  const pages = Array.isArray(project.pages) ? project.pages : []
  const hasDockerfile = pages.some((p: any) => p.name === "Dockerfile" || p.name === "/Dockerfile")
  if (!hasDockerfile) {
    const dockerfile = generateDockerfile("nextjs", "22", "3000")
    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $push: {
          "projects.$.pages": {
            name: "Dockerfile",
            content: dockerfile,
            updatedAt: new Date(),
          },
        } as any,
      },
    )
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

  // Make sure the project owns a Dokploy service (its own application id inside
  // the one shared Dokploy project) before deploying. When the service was
  // already assigned at creation time this is a no-op reuse; otherwise we
  // lazily assign it now so deploy() always targets the same stable id.
  let dokployApplicationId = (project.dokployApplicationId as string | undefined) || null
  let dokployProjectId = (project.dokployProjectId as string | undefined) || null
  let dokployEnvironmentId =
    (project.dokployEnvironmentId as string | undefined) || (body?.environmentId as string | undefined) || null

  if (!dokployApplicationId) {
    const assigned = await assignDokployService({
      userId,
      projectId,
      businessName: project.businessName || dokployAppName,
      existingProjectId: dokployProjectId,
      existingEnvironmentId: dokployEnvironmentId,
    })
    if (assigned?.applicationId) {
      dokployApplicationId = assigned.applicationId
      dokployProjectId = assigned.projectId || dokployProjectId
      dokployEnvironmentId = assigned.environmentId || dokployEnvironmentId
    }
  }

  const result = await ensureAndDeployApplication({
    name: project.businessName || dokployAppName,
    appName: dokployAppName,
    projectName: toDokployAppName(project.businessName || dokployAppName, projectId),
    existingApplicationId: dokployApplicationId,
    existingProjectId: dokployProjectId,
    existingEnvironmentId: dokployEnvironmentId,
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
          type: "docker",
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
