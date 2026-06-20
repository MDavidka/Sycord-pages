// Deploy + manage apps through the Dokploy ("version" container) platform at
// sycord.site. This route is a thin, authenticated wrapper around the Dokploy
// Docker + Application API that always responds with clean, predictable JSON.
//
// Docs: https://docs.dokploy.com/docs/api/docker
//       https://docs.dokploy.com/docs/api/application

import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import {
  application,
  docker,
  isDokployConfigured,
  toDokployEnvString,
  type DokployResult,
} from "@/lib/deploy/dokploy-client"
import { getProjectEnvVars, getSycordDomain } from "@/lib/deploy/runner-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type DeployBody = {
  projectId?: string
  applicationId?: string
  appName?: string
  /** "deploy" (default), "redeploy", "start", "stop", "reload" */
  action?: "deploy" | "redeploy" | "start" | "stop" | "reload"
  title?: string
  description?: string
  /** When true, persist the project's env vars to Dokploy before deploying. */
  syncEnv?: boolean
}

function unauthorized() {
  return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
}

function notConfigured() {
  return NextResponse.json(
    {
      success: false,
      error: "Dokploy is not configured. Set DOKPLOY_API_KEY (and optionally DOKPLOY_API_URL).",
    },
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
// GET — status / container listing
//   /api/deploy/dokploy                      -> list containers + config state
//   /api/deploy/dokploy?applicationId=abc    -> single application detail
//   /api/deploy/dokploy?appName=my-app       -> containers matching app name
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  const userId = await getSession()
  if (!userId) return unauthorized()
  if (!isDokployConfigured()) return notConfigured()

  const { searchParams } = new URL(request.url)
  const applicationId = searchParams.get("applicationId")
  const appName = searchParams.get("appName")

  if (applicationId) {
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
// POST — deploy / lifecycle actions
// ---------------------------------------------------------------------------
export async function POST(request: Request) {
  const userId = await getSession()
  if (!userId) return unauthorized()
  if (!isDokployConfigured()) return notConfigured()

  let body: DeployBody
  try {
    body = (await request.json()) as DeployBody
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const action = body.action || "deploy"

  // Resolve the Dokploy applicationId either directly or from the project doc.
  let applicationId = body.applicationId
  let appName = body.appName
  let project: any = null

  if (!applicationId && body.projectId) {
    const found = await findProject(userId, body.projectId)
    project = found.project
    if (!project) {
      return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
    }
    applicationId = project.dokployApplicationId || project.applicationId
    appName = appName || project.dokployAppName || project.appName
  }

  if (!applicationId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Missing applicationId. Pass `applicationId` directly, or a `projectId` whose project has a saved `dokployApplicationId`.",
      },
      { status: 400 },
    )
  }

  const steps: Array<{ step: string; result: DokployResult }> = []

  // Optionally sync the project's env vars into Dokploy before deploying.
  if (body.syncEnv && project) {
    const envVars = getProjectEnvVars(project)
    const envResult = await application.saveEnvironment({
      applicationId,
      env: toDokployEnvString(envVars),
      createEnvFile: true,
    })
    steps.push({ step: "saveEnvironment", result: envResult })
    if (!envResult.ok) {
      return NextResponse.json(
        { success: false, action, applicationId, error: envResult.error, steps },
        { status: 502 },
      )
    }
  }

  // Run the requested lifecycle action.
  let actionResult: DokployResult
  switch (action) {
    case "redeploy":
      actionResult = await application.redeploy(applicationId, {
        title: body.title,
        description: body.description,
      })
      break
    case "start":
      actionResult = await application.start(applicationId)
      break
    case "stop":
      actionResult = await application.stop(applicationId)
      break
    case "reload":
      if (!appName) {
        return NextResponse.json(
          { success: false, error: "`reload` requires an appName (pass `appName` or set project.dokployAppName)." },
          { status: 400 },
        )
      }
      actionResult = await application.reload(applicationId, appName)
      break
    case "deploy":
    default:
      actionResult = await application.deploy(applicationId, {
        title: body.title,
        description: body.description,
      })
      break
  }
  steps.push({ step: action, result: actionResult })

  const domain = getSycordDomain()
  const url = appName ? `https://${appName}.${domain}` : undefined

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
    domain,
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
  return NextResponse.json({
    success: true,
    endpoint: result.endpoint,
    data: result.data,
    ...meta,
  })
}
