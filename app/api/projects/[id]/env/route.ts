import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import {
  MAX_ENV_KEY_LEN,
  MAX_ENV_VALUE_LEN,
  MAX_ENV_VARS,
} from "@/lib/security/payload-limits"
import { syteSetEnv, useSyteWorkspace } from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"
import { isMcpCredentialKey } from "@/lib/mcp-connections"


 * Project Environment Variables API
 * Manages env vars that get passed to the deployer.
 *
 * GET  — list all env vars for the project (values masked)
 * POST — add or update an env var
 * DELETE — remove an env var by key
 */

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const client = await clientPromise
    const db = client.db()
    const user = await db.collection("users").findOne(
      { id: session.user.id, "projects._id": projectId },
      { projection: { "projects.$": 1 } }
    )
    const project = user?.projects?.[0]
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Return env vars with fully masked values (no plaintext prefix leak)
    const envVars = (project.envVars || [])
      .filter((v: any) => !isMcpCredentialKey(String(v?.key || "")))
      .map((v: any) => ({
        key: v.key,
        value: v.value ? "••••••••" : "",
        hasValue: Boolean(v.value),
        integration: v.integration || null,
      }))

    return NextResponse.json({ envVars })
  } catch (error: any) {
    console.error("[Env] GET error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const { key, value, integration } = await request.json()
    if (!key || typeof key !== "string") {
      return NextResponse.json({ message: "Missing env var key" }, { status: 400 })
    }
    if (key.length > MAX_ENV_KEY_LEN || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
      return NextResponse.json({ message: "Invalid env var key" }, { status: 400 })
    }
    if (isMcpCredentialKey(key)) {
      return NextResponse.json(
        { message: "MCP credentials must be created through the MCP connection flow." },
        { status: 409 },
      )
    }
    if (value != null && typeof value !== "string") {
      return NextResponse.json({ message: "Env var value must be a string" }, { status: 400 })
    }
    if (typeof value === "string" && value.length > MAX_ENV_VALUE_LEN) {
      return NextResponse.json(
        { message: `Env var value too large (max ${MAX_ENV_VALUE_LEN} chars)` },
        { status: 400 },
      )
    }

    const client = await clientPromise
    const db = client.db()

    const existing = await db.collection("users").findOne(
      { id: session.user.id, "projects._id": projectId },
      { projection: { "projects.$": 1 } },
    )
    const project = existing?.projects?.[0]
    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }
    const currentEnvVars = Array.isArray(project.envVars) ? project.envVars : []
    const replacing = currentEnvVars.some((v: any) => v?.key === key)
    if (!replacing && currentEnvVars.length >= MAX_ENV_VARS) {
      return NextResponse.json({ message: `Too many env vars (max ${MAX_ENV_VARS})` }, { status: 400 })
    }

    // Remove existing var with same key, then add new one
    await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": projectId },
      { $pull: { "projects.$.envVars": { key } } as any }
    )

    await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": projectId },
      {
        $push: {
          "projects.$.envVars": {
            key,
            value: value || "",
            integration: integration || null,
            addedAt: new Date(),
          },
        } as any,
      }
    )

    const projectDoc = await db.collection("users").findOne(
      { id: session.user.id, "projects._id": projectId },
      { projection: { "projects.$": 1 } }
    )
    const updatedProject = projectDoc?.projects?.[0]
    const currentRequiredEnvKeys = Array.isArray(updatedProject?.requiredEnvKeys)
      ? updatedProject.requiredEnvKeys.filter((envKey: unknown) => typeof envKey === "string")
      : []
    const currentRequiredIntegrationIds = Array.isArray(updatedProject?.requiredIntegrationIds)
      ? updatedProject.requiredIntegrationIds.filter((integrationId: unknown) => typeof integrationId === "string")
      : []

    const nextRequiredEnvKeys = currentRequiredEnvKeys.filter((envKey: string) => envKey !== key)
    const nextRequiredIntegrationIds =
      typeof integration === "string" && integration
        ? currentRequiredIntegrationIds.filter((integrationId: string) => integrationId !== integration)
        : currentRequiredIntegrationIds

    await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": projectId },
      {
        $set: {
          "projects.$.requiredEnvKeys": nextRequiredEnvKeys,
          "projects.$.requiredIntegrationIds": nextRequiredIntegrationIds,
          "projects.$.updatedAt": new Date(),
        },
      }
    )

    // Keep the remote Syte workspace in sync immediately. The agent runtime
    // reads MCP credentials from its workspace environment when an addon is
    // connected; waiting until deploy would make a newly connected MCP appear
    // saved in Pages but unusable to the agent.
    if (useSyteWorkspace()) {
      const workspace = await requireSyteWorkspaceUuid(updatedProject, projectId)
      if (!("error" in workspace)) {
        const synced = await syteSetEnv(workspace.uuid, { [key]: value || "" }, true)
        if (!synced.ok) {
          return NextResponse.json(
            {
              success: false,
              savedLocally: true,
              message: `Saved ${key} locally, but failed to sync it to the Syte workspace.`,
            },
            { status: synced.status || 502 },
          )
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Env] POST error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId } = await params

  try {
    const url = new URL(request.url)
    const key = url.searchParams.get("key")
    if (!key) {
      return NextResponse.json({ message: "Missing key param" }, { status: 400 })
    }
    if (isMcpCredentialKey(key)) {
      return NextResponse.json(
        { message: "MCP credentials are managed by the MCP connection flow." },
        { status: 409 },
      )
    }
    const client = await clientPromise
    const db = client.db()

    await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": projectId },
      { $pull: { "projects.$.envVars": { key } } as any }
    )

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[Env] DELETE error:", error)
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
