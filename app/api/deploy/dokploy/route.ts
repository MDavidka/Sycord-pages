// Dokploy management route — thin authenticated wrapper around the Dokploy API.
// Supports: deploy lifecycle, project CRUD, environment CRUD, Docker container
// management, and file uploads.
//
// Docs: https://docs.dokploy.com/docs/api

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  application,
  docker,
  project,
  environment,
  domain,
  dokployRequest,
  isDokployConfigured,
  toDokployEnvString,
  type DokployResult,
} from "@/lib/deploy/dokploy-client"
import { getProjectEnvVars, getSycordDomain } from "@/lib/deploy/runner-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DokployBody = {
  action?:
    | "deploy" | "redeploy" | "start" | "stop" | "reload" | "delete"
    | "createProject" | "createEnvironment"
    | "uploadFile" | "restartContainer" | "startContainer"
    | "stopContainer" | "killContainer" | "removeContainer"
    | "generateDomain"
  projectId?: string
  applicationId?: string
  appName?: string
  title?: string
  description?: string
  syncEnv?: boolean

  // Project creation
  projectName?: string
  projectDescription?: string | null

  // Environment creation
  environmentName?: string
  environmentProjectId?: string

  // Container management
  containerId?: string

  // Domain generation
  serverId?: string
}

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
}

function notConfigured() {
  return NextResponse.json(
    { success: false, error: "Dokploy is not configured. Set DOKPLOY_API_KEY (and optionally DOKPLOY_API_URL)." },
    { status: 503 },
  )
}

async function getSession() {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id || null
}

async function findProject(userId: string, projectId: string) {
  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne({ id: userId })
  const project = user?.projects?.find((item: any) => item._id?.toString() === projectId)
  return { db, project }
}

// ---------------------------------------------------------------------------
// GET — listing / status
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const userId = await getSession()
  if (!userId) return unauthorized()
  if (!isDokployConfigured()) return notConfigured()

  const { searchParams } = new URL(request.url)
  const resource = searchParams.get("resource") || "containers"
  const applicationId = searchParams.get("applicationId")
  const appName = searchParams.get("appName")
  const projectId = searchParams.get("projectId")
  const environmentId = searchParams.get("environmentId")
  const containerId = searchParams.get("containerId")

  if (resource === "projects") {
    if (projectId) {
      const result = await project.one(projectId)
      return respond(result, { projectId })
    }
    const result = await project.all()
    return respond(result, { resource: "projects" })
  }

  if (resource === "environments" && projectId) {
    const result = await environment.byProjectId(projectId)
    return respond(result, { projectId, resource: "environments" })
  }

  if (resource === "domains" && applicationId) {
    const result = await domain.byApplicationId(applicationId)
    return respond(result, { applicationId, resource: "domains" })
  }

  if (resource === "config" && containerId) {
    const result = await docker.getConfig(containerId)
    return respond(result, { containerId, resource: "config" })
  }

  if (applicationId) {
    if (resource === "deployments") {
      const result = await dokployRequest({ method: "GET", endpoint: "deployment.all", query: { applicationId } })
      return respond(result, { applicationId, resource: "deployments" })
    }
    const result = await application.one(applicationId)
    return respond(result, { applicationId })
  }

  if (appName) {
    const result = await docker.getContainersByAppNameMatch(appName)
    return respond(result, { appName })
  }

  const result = await docker.getContainers()
  return respond(result, { resource: "containers" })
}

// ---------------------------------------------------------------------------
// POST — all actions
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const userId = await getSession()
  if (!userId) return unauthorized()
  if (!isDokployConfigured()) return notConfigured()

  let body: DokployBody
  try {
    body = (await request.json()) as DokployBody
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const action = body.action || "deploy"

  // --- Container management actions (no project needed) ---
  if (["restartContainer", "startContainer", "stopContainer", "killContainer", "removeContainer"].includes(action)) {
    if (!body.containerId) {
      return NextResponse.json({ success: false, error: "containerId is required" }, { status: 400 })
    }
    let result: DokployResult
    switch (action) {
      case "restartContainer": result = await docker.restartContainer(body.containerId); break
      case "startContainer":   result = await docker.startContainer(body.containerId); break
      case "stopContainer":    result = await docker.stopContainer(body.containerId); break
      case "killContainer":    result = await docker.killContainer(body.containerId); break
      case "removeContainer":  result = await docker.removeContainer(body.containerId); break
      default: return NextResponse.json({ success: false, error: `Unknown action: ${action}` }, { status: 400 })
    }
    return respond(result, { action, containerId: body.containerId })
  }

  // --- Project creation ---
  if (action === "createProject") {
    if (!body.projectName) {
      return NextResponse.json({ success: false, error: "projectName is required" }, { status: 400 })
    }
    const result = await project.create({ name: body.projectName, description: body.projectDescription || null })
    return respond(result, { action, projectName: body.projectName })
  }

  // --- Environment creation ---
  if (action === "createEnvironment") {
    if (!body.environmentName || !body.environmentProjectId) {
      return NextResponse.json({ success: false, error: "environmentName and environmentProjectId are required" }, { status: 400 })
    }
    const result = await environment.create({ name: body.environmentName, projectId: body.environmentProjectId })
    return respond(result, { action, environmentName: body.environmentName })
  }

  // --- Domain generation ---
  if (action === "generateDomain") {
    if (!body.appName) {
      return NextResponse.json({ success: false, error: "appName is required" }, { status: 400 })
    }
    const result = await domain.generateDomain(body.appName, body.serverId)
    return respond(result, { action, appName: body.appName })
  }

  // --- Application lifecycle actions (need applicationId resolved) ---
  let applicationId = body.applicationId
  let appName = body.appName
  let syncedProject: any = null

  if (!applicationId && body.projectId) {
    const found = await findProject(userId, body.projectId)
    syncedProject = found.project
    if (!syncedProject) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }
    applicationId = syncedProject.dokployApplicationId || syncedProject.applicationId
    appName = appName || syncedProject.dokployAppName || syncedProject.appName
  }

  if (!applicationId) {
    return NextResponse.json(
      { success: false, error: "Missing applicationId. Pass it directly or provide a projectId." },
      { status: 400 },
    )
  }

  const steps: Array<{ step: string; result: DokployResult }> = []

  // Optionally sync env vars
  if (body.syncEnv && syncedProject) {
    const envVars = getProjectEnvVars(syncedProject)
    const envResult = await application.saveEnvironment({
      applicationId,
      env: toDokployEnvString(envVars),
      createEnvFile: true,
    })
    steps.push({ step: "saveEnvironment", result: envResult })
    if (!envResult.ok) {
      return NextResponse.json({ success: false, action, applicationId, error: envResult.error, steps }, { status: 502 })
    }
  }

  let actionResult: DokployResult
  switch (action) {
    case "redeploy":
      actionResult = await application.redeploy(applicationId, { title: body.title, description: body.description })
      break
    case "start":
      actionResult = await application.start(applicationId)
      break
    case "stop":
      actionResult = await application.stop(applicationId)
      break
    case "delete":
      actionResult = await application.delete(applicationId)
      break
    case "reload":
      if (!appName) {
        return NextResponse.json({ success: false, error: "reload requires appName" }, { status: 400 })
      }
      actionResult = await application.reload(applicationId, appName)
      break
    case "deploy":
    default:
      actionResult = await application.deploy(applicationId, { title: body.title, description: body.description })
      break
  }
  steps.push({ step: action, result: actionResult })

  const dom = getSycordDomain()
  const url = appName ? `https://${appName}.${dom}` : undefined

  if (!actionResult.ok) {
    return NextResponse.json(
      { success: false, action, applicationId, appName, error: actionResult.error, steps },
      { status: 502 },
    )
  }

  return NextResponse.json({
    success: true,
    action,
    applicationId,
    appName: appName || null,
    url: url || null,
    domain: dom,
    data: actionResult.data,
    steps,
  })
}

function respond(result: DokployResult, meta: Record<string, unknown>) {
  if (!result.ok) {
    return NextResponse.json(
      { success: false, endpoint: result.endpoint, error: result.error, ...meta },
      { status: result.status >= 400 ? result.status : 502 },
    )
  }
  return NextResponse.json({ success: true, endpoint: result.endpoint, data: result.data, ...meta })
}
