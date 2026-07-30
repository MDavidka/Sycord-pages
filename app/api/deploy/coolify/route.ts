// Authenticated Coolify management API (replaces /api/deploy/dokploy).

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import {
  coolify,
  ensureAndDeployCoolifyApplication,
  isCoolifyConfigured,
  toDeployAppName,
} from "@/lib/deploy/coolify-client"
import { getProjectEnvVars, getSycordDomain } from "@/lib/deploy/runner-client"
import { runCoolifyMcpAction } from "@/lib/deploy/coolify-mcp-actions"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
}

function notConfigured() {
  return NextResponse.json(
    {
      success: false,
      error: "Coolify is not configured. Set DEPLOYER_API_KEY and DEPLOYER_API_URL.",
    },
    { status: 503 },
  )
}

async function getSessionUserId() {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id || null
}

function respond(
  result: { ok: boolean; data: unknown; error: string | null; endpoint: string },
  extra: Record<string, unknown> = {},
) {
  return NextResponse.json(
    {
      success: result.ok,
      data: result.data,
      error: result.error,
      endpoint: result.endpoint,
      ...extra,
    },
    { status: result.ok ? 200 : 502 },
  )
}

export async function GET(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return unauthorized()
  if (!isCoolifyConfigured()) return notConfigured()

  const { searchParams } = new URL(request.url)
  const resource = searchParams.get("resource") || "applications"
  const uuid = searchParams.get("uuid") || searchParams.get("applicationUuid")

  if (resource === "projects") {
    return respond(await coolify.listProjects(), { resource })
  }
  if (resource === "servers") {
    return respond(await coolify.listServers(), { resource })
  }
  if (resource === "deployments") {
    return respond(await coolify.listDeployments(), { resource })
  }
  if (resource === "health") {
    return respond(await coolify.health(), { resource })
  }
  if (uuid && resource === "application") {
    return respond(await coolify.getApplication(uuid), { resource, uuid })
  }
  if (uuid && resource === "deployment") {
    return respond(await coolify.getDeployment(uuid), { resource, uuid })
  }

  return respond(await coolify.listApplications(), { resource: "applications" })
}

type CoolifyBody = {
  action?: "deploy" | "restart" | "start" | "stop" | "execute_command" | "mcp"
  projectId?: string
  applicationUuid?: string
  applicationId?: string
  force?: boolean
  command?: string
  mcpAction?: string
  envs?: Array<{ key: string; value: string }>
}

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (!userId) return unauthorized()
  if (!isCoolifyConfigured()) return notConfigured()

  let body: CoolifyBody = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON" }, { status: 400 })
  }

  const action = body.action || "deploy"
  const applicationUuid = body.applicationUuid || body.applicationId

  if (action === "mcp" && body.mcpAction) {
    const result = await runCoolifyMcpAction({
      action: body.mcpAction as any,
      applicationUuid,
      command: body.command,
      force: body.force,
      envs: body.envs,
    })
    return NextResponse.json({ success: result.ok, ...result })
  }

  if (action === "execute_command") {
    const result = await runCoolifyMcpAction({
      action: "execute_command",
      applicationUuid,
      command: body.command,
    })
    return NextResponse.json({ success: result.ok, ...result })
  }

  if (!applicationUuid && body.projectId) {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne({ id: userId })
    const project = user?.projects?.find((p: any) => p._id?.toString() === body.projectId)
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }

    const domain = getSycordDomain()
    const appName = toDeployAppName(project.businessName || project.name || "app", body.projectId)
    const ghOwner = project.githubOwner
    const ghRepo = project.githubRepo
    if (!ghOwner || !ghRepo) {
      return NextResponse.json({ success: false, error: "GitHub source missing — run save() first" }, { status: 409 })
    }

    const result = await ensureAndDeployCoolifyApplication({
      name: project.businessName || appName,
      appName,
      existingApplicationUuid: project.coolifyApplicationUuid || project.dokployApplicationId || null,
      existingProjectUuid: project.coolifyProjectUuid || project.dokployProjectId || null,
      env: getProjectEnvVars(project),
      source: {
        owner: ghOwner,
        repository: ghRepo,
        branch: project.githubBranch || "main",
        gitUrl: project.githubUrl ? `${project.githubUrl}.git` : undefined,
      },
      domain: { host: `${appName}.${domain}`, port: 3000, https: true },
      buildPack: "dockerfile",
    })

    if (result.success && result.applicationUuid) {
      await db.collection("users").updateOne(
        { id: userId, "projects._id": body.projectId },
        {
          $set: {
            "projects.$.deploymentMode": "coolify",
            "projects.$.coolifyApplicationUuid": result.applicationUuid,
            "projects.$.coolifyProjectUuid": result.projectUuid,
            "projects.$.coolifyServerUuid": result.serverUuid,
            "projects.$.deployAppName": appName,
          },
        },
      )
    }

    return NextResponse.json({ ...result })
  }

  if (!applicationUuid) {
    return NextResponse.json({ success: false, error: "applicationUuid or projectId required" }, { status: 400 })
  }

  if (action === "stop") {
    return respond(await coolify.stopApplication(applicationUuid))
  }
  if (action === "start") {
    return respond(await coolify.startApplication(applicationUuid, { force: body.force }))
  }
  if (action === "restart") {
    return respond(await coolify.restartApplication(applicationUuid, { force: body.force }))
  }

  return respond(await coolify.deploy(applicationUuid, Boolean(body.force)))
}
