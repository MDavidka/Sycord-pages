import { getServerSession } from "next-auth/next"

import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import {
  prepareProjectDeployFiles,
  validateApiDeployFiles,
  getProjectEnvVars,
  getSycordDomain,
} from "@/lib/deploy/runner-client"
import {
  buildCoolifyAutofixMessage,
  waitForCoolifyDeployment,
} from "@/lib/deploy/wait-for-coolify-deployment"
import {
  ensureAndDeployCoolifyApplication,
  isCoolifyConfigured,
  toDeployAppName,
} from "@/lib/deploy/coolify-client"
import {
  syteGetLogs,
  syteIssueDeploy,
  syteSetEnv,
  syteSyncProjectFiles,
  syteWorkspaceGet,
  useSyteWorkspace,
} from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { getOwnedProject, getStoredProjectId, ownedProjectMutationFilter } from "@/lib/project-id"
import { isValidProjectId, projectFiles, validateNextBuildable } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

function generateDockerfile(framework: string, nodeVersion: string, port: string): string {
  const npmInstall = "npm install --no-audit --no-fund --prefer-offline && npm cache clean --force"
  const npmCi = "(npm ci && npm cache clean --force) || (" + npmInstall + ")"
  if (framework === "vite" || framework === "react" || framework === "spa") {
    // Vite SPA — build static assets and serve them.
    return "# syntax=docker/dockerfile:1\n" +
"FROM node:" + nodeVersion + "-alpine AS build\n" +
"WORKDIR /app\n" +
"COPY package*.json ./\n" +
"RUN " + npmCi + "\n" +
"COPY . .\n" +
"RUN npm run build\n" +
"\n" +
"FROM node:" + nodeVersion + "-alpine AS run\n" +
"WORKDIR /app\n" +
"RUN npm install -g serve\n" +
"COPY --from=build /app/dist ./dist\n" +
"EXPOSE " + port + "\n" +
"ENV PORT=" + port + "\n" +
"CMD [\"sh\", \"-c\", \"serve -s dist -l ${PORT:-" + port + "}\"]\n"
  }
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

  const { searchParams } = new URL(req.url)
  const waitForBuild = searchParams.get("wait") !== "false"
  const projectId = (searchParams.get("projectId") || body?.projectId || "").toString()
  if (!isValidProjectId(projectId)) {
    return Response.json({ status: "error", message: "Invalid project ID" }, { status: 400 })
  }

  if (!isCoolifyConfigured() && !useSyteWorkspace()) {
    return Response.json(
      {
        status: "error",
        message:
          "Deployer is not configured. Set DEPLOYER_API_KEY and DEPLOYER_API_URL (https://sycord.site for Syte workspace).",
      },
      { status: 503 },
    )
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)

  if (!project) {
    return Response.json({ status: "error", message: "Project not found" }, { status: 404 })
  }

  const storedProjectId = getStoredProjectId(project)

  const envVars = Array.isArray(project.envVars) ? project.envVars : []
  const presentEnvKeys = new Set(
    envVars
      .filter((envVar: any) => typeof envVar?.key === "string" && String(envVar?.value || "").trim())
      .map((envVar: any) => envVar.key as string)
  )
  const presentIntegrationIds = new Set(
    envVars
      .filter((envVar: any) => typeof envVar?.integration === "string" && String(envVar?.value || "").trim())
      .map((envVar: any) => envVar.integration as string)
  )
  const missingRequiredEnvKeys = (Array.isArray(project.requiredEnvKeys) ? project.requiredEnvKeys : [])
    .filter((envKey: unknown): envKey is string => typeof envKey === "string" && !presentEnvKeys.has(envKey))
  const missingRequiredIntegrationIds = (Array.isArray(project.requiredIntegrationIds) ? project.requiredIntegrationIds : [])
    .filter((integrationId: unknown): integrationId is string => typeof integrationId === "string" && !presentIntegrationIds.has(integrationId))

  if (missingRequiredEnvKeys.length > 0 || missingRequiredIntegrationIds.length > 0) {
    return Response.json(
      {
        status: "error",
        message: "Required integrations or environment variables are still missing.",
        missingRequiredEnvKeys,
        missingRequiredIntegrationIds,
      },
      { status: 409 }
    )
  }

  const pages = Array.isArray(project.pages) ? project.pages : []
  const hasDockerfile = pages.some((p: any) => p.name === "Dockerfile" || p.name === "/Dockerfile")
  if (!hasDockerfile) {
    const dockerfile = generateDockerfile("vite", "20", "3000")
    await db.collection("users").updateOne(
      ownedProjectMutationFilter(userId, project),
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
    project.pages = [...(Array.isArray(project.pages) ? project.pages : []), { name: "Dockerfile", content: dockerfile }]
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

  // ── Syte workspace deploy (sycord.site/api) ─────────────────────────────
  if (useSyteWorkspace()) {
    const resolved = await requireSyteWorkspaceUuid(project, projectId)
    if ("error" in resolved) {
      return Response.json(
        {
          status: "error",
          message: resolved.error,
          needsCreate: true,
        },
        { status: 409 },
      )
    }
    const workspaceUuid = resolved.uuid

    const sync = await syteSyncProjectFiles(workspaceUuid, projectFiles(project))
    if (sync.errors.length > 0) {
      return Response.json(
        {
          status: "error",
          message: `Failed to sync files to workspace: ${sync.errors.slice(0, 3).join("; ")}`,
        },
        { status: 502 },
      )
    }

    const env = getProjectEnvVars(project)
    if (Object.keys(env).length > 0) {
      await syteSetEnv(workspaceUuid, env, true)
    }

    const deployResult = await syteIssueDeploy(workspaceUuid)
    if (!deployResult.ok) {
      const logs = await syteGetLogs(workspaceUuid, 300)
      const logsTail =
        typeof logs.data === "string"
          ? logs.data.slice(-4000)
          : JSON.stringify(logs.data || {}).slice(-4000)
      return Response.json(
        {
          status: "error",
          message: deployResult.error || "Syte deploy failed",
          logsTail,
          autofix:
            `[SYSTEM] ❌ Deploy failed on Syte workspace.\n\n` +
            `Build/runtime logs (tail):\n${logsTail}\n\n` +
            `AUTO-FIX: read logs, fix source files, typeCheck(), lintCheck(), deploy() again.`,
        },
        { status: 502 },
      )
    }

    const ws = await syteWorkspaceGet(workspaceUuid)
    const domain = getSycordDomain()
    const deployAppName = toDeployAppName(
      project.businessName || project.name || slugifyContainerName(project, projectId),
      projectId,
    )
    const finalUrl =
      (ws.data as any)?.url ||
      (ws.data as any)?.domain ||
      `https://${deployAppName}.${domain}`

    await db.collection("users").updateOne(
      ownedProjectMutationFilter(userId, project),
      {
        $set: {
          "projects.$.deploymentMode": "syte",
          "projects.$.syteWorkspaceUuid": workspaceUuid,
          "projects.$.deploymentRuntime.status": "active",
          "projects.$.deploymentRuntime.url": finalUrl,
          "projects.$.deploymentRuntime.lastDeployedAt": new Date().toISOString(),
          "projects.$.updatedAt": new Date(),
        },
      },
    )

    return Response.json({
      status: "success",
      url: typeof finalUrl === "string" && finalUrl.startsWith("http") ? finalUrl : `https://${finalUrl}`,
      projectId: workspaceUuid,
      applicationId: workspaceUuid,
      deploymentId: workspaceUuid,
      buildComplete: "✅ Syte issue_deploy issued (git pull + rebuild + restart).",
      syncedFiles: sync.synced,
      platform: "syte",
      uuid: workspaceUuid,
    })
  }

  const containerName = slugifyContainerName(project, projectId)
  const domain = getSycordDomain()

  const deployAppName = toDeployAppName(
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
    gitUrl: (project.githubUrl ? `${project.githubUrl}.git` : undefined) as string | undefined,
    githubAppUuid: (project.coolifyGithubAppUuid as string | undefined) || null,
  }

  const result = await ensureAndDeployCoolifyApplication({
    name: project.businessName || deployAppName,
    appName: deployAppName,
    existingApplicationUuid:
      project.coolifyApplicationUuid || project.dokployApplicationId || null,
    existingProjectUuid: project.coolifyProjectUuid || project.dokployProjectId || null,
    serverUuid: project.coolifyServerUuid || null,
    buildPack: "dockerfile",
    env: getProjectEnvVars(project),
    source,
    description: `Deployment for ${deployAppName}`,
    domain: {
      host: `${deployAppName}.${domain}`,
      port: 3000,
      https: true,
    },
  })

  const finalUrl = `https://${deployAppName}.${domain}`

  if (!result.success || !result.applicationUuid) {
    await db.collection("users").updateOne(
      { id: userId, "projects._id": projectId },
      {
        $set: {
          "projects.$.deploymentMode": "coolify",
          "projects.$.deploymentRuntime.status": "failed",
          "projects.$.deploymentRuntime.lastDeployError": result.error,
          ...(result.projectUuid ? { "projects.$.coolifyProjectUuid": result.projectUuid } : {}),
          ...(result.applicationUuid ? { "projects.$.coolifyApplicationUuid": result.applicationUuid } : {}),
        },
      },
    )
    return Response.json(
      { status: "error", message: result.error || "Coolify deployment failed", steps: result.steps },
      { status: 502 },
    )
  }

  await db.collection("users").updateOne(
    { id: userId, "projects._id": projectId },
    {
      $set: {
        "projects.$.deploymentMode": "coolify",
        "projects.$.coolifyProjectUuid": result.projectUuid,
        "projects.$.coolifyServerUuid": result.serverUuid,
        "projects.$.coolifyApplicationUuid": result.applicationUuid,
        "projects.$.deployAppName": deployAppName,
        "projects.$.deploymentRuntime": {
          mode: "coolify",
          domain: deployAppName,
          url: finalUrl,
          projectUuid: result.projectUuid,
          serverUuid: result.serverUuid,
          applicationUuid: result.applicationUuid,
          status: "building",
          health: "pending",
          lastDeployAt: new Date(),
          lastDeployError: null,
        },
      },
    },
  )

  let buildWait = null as Awaited<ReturnType<typeof waitForCoolifyDeployment>> | null
  if (waitForBuild && result.applicationUuid) {
    buildWait = await waitForCoolifyDeployment({
      applicationUuid: result.applicationUuid,
      deploymentUuid: result.deploymentUuid,
      timeoutMs: 8 * 60_000,
    })

    if (buildWait.status !== "success") {
      const errMsg = buildWait.error || buildWait.progressMessage || "Build did not complete successfully"
      await db.collection("users").updateOne(
        { id: userId, "projects._id": projectId },
        {
          $set: {
            "projects.$.deploymentRuntime.status": "failed",
            "projects.$.deploymentRuntime.lastDeployError": errMsg,
          },
        },
      )
      return Response.json(
        {
          status: "error",
          message: errMsg,
          applicationUuid: result.applicationUuid,
          deploymentUuid: buildWait.deploymentUuid,
          buildStatus: buildWait.status,
          logsTail: buildWait.logs.split("\n").slice(-40).join("\n"),
          autofix: buildCoolifyAutofixMessage(buildWait.logs, errMsg),
          steps: result.steps,
        },
        { status: 502 },
      )
    }
  }

  await db.collection("users").updateOne(
    { id: userId, "projects._id": projectId },
    {
      $set: {
        "projects.$.containerName": deployAppName,
        "projects.$.deploymentRuntime": {
          mode: "coolify",
          domain: deployAppName,
          url: finalUrl,
          projectUuid: result.projectUuid,
          serverUuid: result.serverUuid,
          applicationUuid: result.applicationUuid,
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
    containerName: deployAppName,
    projectUuid: result.projectUuid,
    serverUuid: result.serverUuid,
    applicationUuid: result.applicationUuid,
    applicationId: result.applicationUuid,
    deploymentUuid: buildWait?.deploymentUuid ?? result.deploymentUuid,
    deploymentId: buildWait?.deploymentUuid ?? result.deploymentUuid,
    buildComplete: buildWait?.matchedLine ?? null,
    created: result.createdApplication,
    createdProject: result.createdProject,
    steps: result.steps,
  })
}
