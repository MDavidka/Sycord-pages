import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "../../../auth/[...nextauth]/route"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Verify user owns the project
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(params.id),
      userId: session.user.id,
    })

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Get deployment for this project
    const deployment = await db.collection("deployments").findOne({
      projectId: new ObjectId(params.id),
    })

    return NextResponse.json({ deployment: deployment || null })
  } catch (error: any) {
    console.error("[v0] Error fetching project deployment:", error)
    return NextResponse.json({ message: "Failed to fetch deployment" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({ message: "Invalid project ID" }, { status: 400 })
    }

    const { subdomain } = await request.json()

    if (!subdomain || typeof subdomain !== "string") {
      return NextResponse.json({ message: "Subdomain is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Verify user owns the project
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(params.id),
      userId: session.user.id,
    })

    if (!project) {
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Sanitize subdomain
    const sanitizedSubdomain = subdomain
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, "-")
      .replace(/^-+|-+$/g, "")

    if (sanitizedSubdomain.length < 3) {
      return NextResponse.json({ message: "Subdomain too short" }, { status: 400 })
    }

    // Check if subdomain already exists for another project
    const existingDeployment = await db.collection("deployments").findOne({
      subdomain: sanitizedSubdomain,
      projectId: { $ne: new ObjectId(params.id) },
    })

    if (existingDeployment) {
      return NextResponse.json({ message: "Subdomain already in use" }, { status: 409 })
    }

    // Check if project already has a deployment
    const existingProjectDeployment = await db.collection("deployments").findOne({
      projectId: new ObjectId(params.id),
    })

    let result

    if (existingProjectDeployment) {
      // Update existing deployment
      result = await db.collection("deployments").updateOne(
        { projectId: new ObjectId(params.id) },
        {
          $set: {
            subdomain: sanitizedSubdomain,
            domain: `${sanitizedSubdomain}.ltpd.xyz`,
            updatedAt: new Date(),
          },
        },
      )

      // Update project
      await db.collection("projects").updateOne(
        { _id: new ObjectId(params.id) },
        {
          $set: {
            subdomain: sanitizedSubdomain,
            domain: `${sanitizedSubdomain}.ltpd.xyz`,
            updatedAt: new Date(),
          },
        },
      )

      return NextResponse.json({
        success: true,
        message: "Deployment updated",
      })
    } else {
      // Create new deployment
      const newDeployment = {
        projectId: new ObjectId(params.id),
        userId: session.user.id,
        subdomain: sanitizedSubdomain,
        domain: `${sanitizedSubdomain}.ltpd.xyz`,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      result = await db.collection("deployments").insertOne(newDeployment)

      // Update project
      await db.collection("projects").updateOne(
        { _id: new ObjectId(params.id) },
        {
          $set: {
            deploymentId: result.insertedId,
            subdomain: sanitizedSubdomain,
            domain: `${sanitizedSubdomain}.ltpd.xyz`,
            deployedAt: new Date(),
          },
        },
      )

      return NextResponse.json({
        success: true,
        deployment: { _id: result.insertedId, subdomain: sanitizedSubdomain, domain: `${sanitizedSubdomain}.ltpd.xyz` },
      })
    }
  } catch (error: any) {
    console.error("[v0] Error creating/updating deployment:", error)
    return NextResponse.json({ message: "Failed to create/update deployment" }, { status: 500 })
  }
}
