// ---------------------------------------------------------------------------
// Auto-assign a Dokploy service to a freshly-created Sycord website.
//
// Every website gets its own Dokploy application (a "service") inside the one
// shared Dokploy project, plus a stable service id (applicationId) recorded on
// the project document. The service is pre-marked as a Docker build type so the
// AI deploy() tool can reuse the same id later for a valid deployer connection.
//
// This runs fire-and-forget from the project-creation route so a slow or
// unavailable Dokploy instance never blocks website creation.
// ---------------------------------------------------------------------------

import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import {
  ensureDokployService,
  isDokployConfigured,
  toDokployAppName,
} from "@/lib/deploy/dokploy-client"
import { getSycordDomain } from "@/lib/deploy/runner-client"

/**
 * Provisions (or reuses) the Dokploy service for a project and persists the
 * resulting ids onto the embedded project document. Safe to call repeatedly —
 * it reuses an already-assigned service id when present.
 *
 * @returns the assigned service ids, or null when Dokploy is not configured /
 *          the assignment failed (the error is logged, never thrown).
 */
export async function assignDokployService(params: {
  userId: string
  projectId: string
  businessName?: string | null
  existingApplicationId?: string | null
  existingProjectId?: string | null
  existingEnvironmentId?: string | null
}): Promise<{
  projectId: string | null
  environmentId: string | null
  applicationId: string | null
  appName: string | null
} | null> {
  if (!isDokployConfigured()) {
    console.warn("[assignDokployService] Skipped — Dokploy is not configured.")
    return null
  }

  const { userId, projectId } = params
  if (!ObjectId.isValid(projectId)) {
    console.warn(`[assignDokployService] Invalid projectId: ${projectId}`)
    return null
  }

  const displayName = (params.businessName || "").trim() || `project-${projectId}`
  const appName = toDokployAppName(displayName, projectId)

  try {
    const result = await ensureDokployService({
      name: displayName,
      appName,
      existingApplicationId: params.existingApplicationId || null,
      existingProjectId: params.existingProjectId || null,
      existingEnvironmentId: params.existingEnvironmentId || null,
    })

    const client = await clientPromise
    const db = client.db()

    if (!result.success || !result.applicationId) {
      // Record the failure so the settings page can show why no service id is
      // available, without clobbering any previously-assigned ids.
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        {
          $set: {
            "projects.$.deploymentRuntime.mode": "dokploy",
            "projects.$.deploymentRuntime.serviceAssignmentError": result.error || "Dokploy service assignment failed",
            ...(result.projectId ? { "projects.$.dokployProjectId": result.projectId } : {}),
            ...(result.environmentId ? { "projects.$.dokployEnvironmentId": result.environmentId } : {}),
          },
        },
      )
      console.error(`[assignDokployService] Failed for ${projectId}: ${result.error}`)
      return null
    }

    const domain = getSycordDomain()
    const url = `https://${result.appName || appName}.${domain}`

    await db.collection("users").updateOne(
      { id: userId, "projects._id": new ObjectId(projectId) },
      {
        $set: {
          "projects.$.deploymentMode": "dokploy",
          "projects.$.dokployProjectId": result.projectId,
          "projects.$.dokployEnvironmentId": result.environmentId,
          "projects.$.dokployApplicationId": result.applicationId,
          "projects.$.dokployAppName": result.appName || appName,
          "projects.$.deploymentRuntime": {
            mode: "dokploy",
            type: "docker",
            domain: result.appName || appName,
            url,
            projectId: result.projectId,
            environmentId: result.environmentId,
            applicationId: result.applicationId,
            // The service exists and is configured, but nothing has been
            // deployed to it yet.
            status: "provisioned",
            health: "unknown",
            serviceAssignmentError: null,
            assignedAt: new Date(),
          },
        },
      },
    )

    console.log(
      `[assignDokployService] Assigned service ${result.applicationId} (app ${result.appName || appName}) to project ${projectId}`,
    )
    return {
      projectId: result.projectId,
      environmentId: result.environmentId,
      applicationId: result.applicationId,
      appName: result.appName || appName,
    }
  } catch (err: any) {
    console.error(`[assignDokployService] Unexpected error for ${projectId}:`, err?.message || err)
    return null
  }
}
