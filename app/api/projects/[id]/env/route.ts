import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"


/**
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

    // Return env vars with masked values
    const envVars = (project.envVars || []).map((v: any) => ({
      key: v.key,
      value: v.value ? `${v.value.substring(0, 4)}${"*".repeat(Math.max(0, v.value.length - 4))}` : "",
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

    const client = await clientPromise
    const db = client.db()

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
    const project = projectDoc?.projects?.[0]
    const currentRequiredEnvKeys = Array.isArray(project?.requiredEnvKeys)
      ? project.requiredEnvKeys.filter((envKey: unknown) => typeof envKey === "string")
      : []
    const currentRequiredIntegrationIds = Array.isArray(project?.requiredIntegrationIds)
      ? project.requiredIntegrationIds.filter((integrationId: unknown) => typeof integrationId === "string")
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
