import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { getClientIP } from "@/lib/get-client-ip"
import { containsCurseWords } from "@/lib/curse-word-filter"
import { generateWebpageId } from "@/lib/generate-webpage-id"
import { deployToVercel } from "@/lib/vercel"
import { activateLocalDeployment } from "@/lib/local-deploy"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()
  const body = await request.json()

  const userProjects = await db.collection("projects").find({ userId: session.user.id }).toArray()

  const isPremium = session.user.isPremium || false
  const MAX_FREE_WEBSITES = 3

  if (!isPremium && userProjects.length >= MAX_FREE_WEBSITES) {
    return NextResponse.json(
      {
        message: `Free users can only create up to ${MAX_FREE_WEBSITES} websites. Upgrade to premium for unlimited websites.`,
      },
      { status: 403 },
    )
  }

  const userIP = getClientIP(request)

  const webpageId = generateWebpageId()

  // Store the subdomain in the project but don't activate it yet
  const sanitizedSubdomain = body.subdomain
        ? body.subdomain.toLowerCase().trim().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "")
        : null

  const newProject = {
    ...body,
    webpageId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userIP: userIP,
    isPremium: isPremium,
    status: "pending",
    // Save intended subdomain, but don't set 'domain' or 'deploymentId' yet
    subdomain: sanitizedSubdomain,
    createdAt: new Date(),
  }

  try {
    const projectResult = await db.collection("projects").insertOne(newProject)
    const projectId = projectResult.insertedId.toString()

    // Check for Vercel Auth and Trigger Deployment if possible
    const user = await db.collection("users").findOne({ _id: session.user.id })
    let vercelAuthRequired = false

    if (user && user.vercelToken) {
      try {
        const fullProject = { ...newProject, _id: projectResult.insertedId }
        // 1. Deploy to Vercel
        await deployToVercel(user.vercelToken, fullProject, db)
        // 2. Activate Local Deployment (My Domain)
        await activateLocalDeployment(fullProject, db)
      } catch (err) {
          console.error("Auto-deployment failed:", err)
      }
    } else {
      vercelAuthRequired = true
    }

    const updatedProject = await db.collection("projects").findOne({ _id: projectResult.insertedId })
    return NextResponse.json({ ...updatedProject, vercelAuthRequired }, { status: 201 })
  } catch (error: any) {
    console.error("[v0] Error creating project:", error)
    return NextResponse.json(
      {
        message: "Failed to create project",
        error: error.message,
      },
      { status: 500 },
    )
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  const projects = await db.collection("projects").find({ userId: session.user.id }).toArray()

  return NextResponse.json(projects)
}
