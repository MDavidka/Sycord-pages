// Save Dokploy settings onto a project document (Option B).
//
// Lets you store a per-project `dokployEnvironmentId` (and optionally an
// existing `dokployApplicationId` / `dokployAppName`) in MongoDB so the AI
// deploy() tool can auto-create + deploy the container without relying on the
// global DOKPLOY_ENVIRONMENT_ID env var.
//
//   POST /api/deploy/dokploy/config
//   { "projectId": "665f...", "environmentId": "env_abc", "applicationId": "app_x" }

import { NextResponse } from "next/server"

import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject, ownedProjectMutationFilter } from "@/lib/project-id"
import { application, environment } from "@/lib/deploy/dokploy-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ConfigBody = {
  projectId?: string
  environmentId?: string
  applicationId?: string
  appName?: string
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  let body: ConfigBody
  try {
    body = (await request.json()) as ConfigBody
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { projectId, environmentId, applicationId, appName } = body
  if (!projectId || !projectId.trim()) {
    return NextResponse.json({ success: false, error: "Valid projectId is required" }, { status: 400 })
  }
  if (!environmentId && !applicationId && !appName) {
    return NextResponse.json(
      { success: false, error: "Provide at least one of: environmentId, applicationId, appName" },
      { status: 400 },
    )
  }

  const client = await clientPromise
  const db = client.db()

  const project = await getOwnedProject(db, userId, projectId)
  if (!project) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
  }

  // Collaborators must not rebind Dokploy resources on the owner's project.
  if (project.isCollaborator) {
    return NextResponse.json(
      { success: false, error: "Only the project owner can update Dokploy config" },
      { status: 403 },
    )
  }

  // Validate Dokploy resource IDs exist and are not already bound to another tenant.
  if (environmentId) {
    const envResult = await environment.one(String(environmentId))
    if (!envResult.ok) {
      return NextResponse.json(
        { success: false, error: `Invalid Dokploy environmentId: ${envResult.error || "not found"}` },
        { status: 400 },
      )
    }
  }

  if (applicationId) {
    const appResult = await application.one(String(applicationId))
    if (!appResult.ok) {
      return NextResponse.json(
        { success: false, error: `Invalid Dokploy applicationId: ${appResult.error || "not found"}` },
        { status: 400 },
      )
    }

    // Prevent hijacking another tenant's already-bound application.
    const claimedByOther = await db.collection("users").findOne(
      {
        id: { $ne: userId },
        "projects.dokployApplicationId": String(applicationId),
      },
      { projection: { id: 1 } },
    )
    if (claimedByOther) {
      return NextResponse.json(
        { success: false, error: "Dokploy applicationId is already bound to another project" },
        { status: 403 },
      )
    }
  }

  const set: Record<string, unknown> = {}
  if (environmentId) set["projects.$.dokployEnvironmentId"] = environmentId
  if (applicationId) set["projects.$.dokployApplicationId"] = applicationId
  if (appName) set["projects.$.dokployAppName"] = appName

  const result = await db
    .collection("users")
    .updateOne(ownedProjectMutationFilter(userId, project), { $set: set })

  if (result.matchedCount === 0) {
    return NextResponse.json({ success: false, error: "Project not found" }, { status: 404 })
  }

  return NextResponse.json({
    success: true,
    projectId,
    updated: {
      ...(environmentId ? { dokployEnvironmentId: environmentId } : {}),
      ...(applicationId ? { dokployApplicationId: applicationId } : {}),
      ...(appName ? { dokployAppName: appName } : {}),
    },
  })
}
