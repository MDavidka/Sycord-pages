import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { containsCurseWords } from "@/lib/curse-word-filter"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { subdomain, projectId } = await request.json()

  console.log("[v0] Deployment request received:", { subdomain, projectId, userId: session.user.id })

  if (!subdomain || typeof subdomain !== "string" || subdomain.length < 3) {
    console.log("[v0] Invalid subdomain format:", subdomain)
    return NextResponse.json({ message: "Invalid subdomain. Must be at least 3 characters." }, { status: 400 })
  }

  if (containsCurseWords(subdomain)) {
    console.log("[v0] Subdomain contains curse words:", subdomain)
    return NextResponse.json(
      { message: "Subdomain contains inappropriate content. Please choose a different subdomain." },
      { status: 400 },
    )
  }

  const sanitizedSubdomain = subdomain
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")

  console.log("[v0] Subdomain sanitization:", { original: subdomain, sanitized: sanitizedSubdomain })

  if (sanitizedSubdomain.length < 3) {
    console.log("[v0] Subdomain too short after sanitization:", sanitizedSubdomain)
    return NextResponse.json({ message: "Subdomain too short after sanitization" }, { status: 400 })
  }

  if (containsCurseWords(sanitizedSubdomain)) {
    console.log("[v0] Sanitized subdomain contains curse words:", sanitizedSubdomain)
    return NextResponse.json(
      { message: "Subdomain contains inappropriate content. Please choose a different subdomain." },
      { status: 400 },
    )
  }

  try {
    const client = await clientPromise
    const db = client.db()

    if (!ObjectId.isValid(projectId)) {
      console.log("[v0] Invalid project ID:", projectId)
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      console.log("[v0] Project not found:", { projectId, userId: session.user.id })
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    console.log("[v0] Project found:", { projectId, businessName: project.businessName })

    const existingDeployment = await db.collection("deployments").findOne({
      subdomain: sanitizedSubdomain,
    })

    if (existingDeployment) {
      console.log("[v0] Subdomain already in use:", sanitizedSubdomain)
      return NextResponse.json({ message: "Subdomain already in use" }, { status: 409 })
    }

    const deployment = {
      projectId: new ObjectId(projectId),
      userId: session.user.id,
      subdomain: sanitizedSubdomain,
      domain: `${sanitizedSubdomain}.ltpd.xyz`,
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      deploymentData: {
        businessName: project.businessName,
        businessDescription: project.businessDescription,
      },
    }

    console.log("[v0] Creating deployment record:", deployment)

    const result = await db.collection("deployments").insertOne(deployment)

    console.log("[v0] Deployment record created:", { deploymentId: result.insertedId })

    const updateResult = await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          deploymentId: result.insertedId,
          subdomain: sanitizedSubdomain,
          domain: `${sanitizedSubdomain}.ltpd.xyz`,
          deployedAt: new Date(),
        },
      },
    )

    console.log("[v0] Project updated:", {
      projectId,
      matchedCount: updateResult.matchedCount,
      modifiedCount: updateResult.modifiedCount,
    })

    if (updateResult.modifiedCount === 0) {
      console.warn("[v0] Warning: Project was not updated (might already have deployment info)")
    }

    return NextResponse.json({
      success: true,
      deployment: {
        _id: result.insertedId,
        subdomain: sanitizedSubdomain,
        domain: `${sanitizedSubdomain}.ltpd.xyz`,
        status: "active",
        createdAt: deployment.createdAt,
      },
    })
  } catch (error: any) {
    console.error("[v0] Error creating deployment:", {
      message: error.message,
      code: error.code,
      stack: error.stack,
    })

    return NextResponse.json(
      {
        message: "Failed to create deployment",
        error: error.message || "Unknown error",
      },
      { status: 500 },
    )
  }
}

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    const deployments = await db.collection("deployments").find({ userId: session.user.id }).toArray()

    console.log("[v0] Fetched deployments:", { count: deployments.length, userId: session.user.id })

    return NextResponse.json({ deployments })
  } catch (error: any) {
    console.error("[v0] Error fetching deployments:", error)

    return NextResponse.json({ message: "Failed to fetch deployments" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const url = new URL(request.url)
  const deploymentId = url.searchParams.get("id")

  if (!deploymentId || !ObjectId.isValid(deploymentId)) {
    return NextResponse.json({ message: "Invalid deployment ID" }, { status: 400 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    const deployment = await db.collection("deployments").findOne({
      _id: new ObjectId(deploymentId),
      userId: session.user.id,
    })

    if (!deployment) {
      return NextResponse.json({ message: "Deployment not found" }, { status: 404 })
    }

    await db.collection("deployments").deleteOne({
      _id: new ObjectId(deploymentId),
    })

    await db.collection("projects").updateOne(
      { _id: deployment.projectId },
      {
        $unset: {
          deploymentId: 1,
          subdomain: 1,
          domain: 1,
          deployedAt: 1,
        },
      },
    )

    console.log("[v0] Deployment deleted:", { deploymentId, projectId: deployment.projectId })

    return NextResponse.json({
      success: true,
      message: "Deployment deleted successfully",
    })
  } catch (error: any) {
    console.error("[v0] Error deleting deployment:", error)
    return NextResponse.json({ message: "Failed to delete deployment" }, { status: 500 })
  }
}
