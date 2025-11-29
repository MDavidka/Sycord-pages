import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { getClientIP } from "@/lib/get-client-ip"
import { containsCurseWords } from "@/lib/curse-word-filter"
import { generateWebpageId } from "@/lib/generate-webpage-id"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  // @ts-ignore
  const vercelToken = session.user.vercelAccessToken
  if (!vercelToken) {
    return NextResponse.json({ message: "Vercel account not connected" }, { status: 403 })
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

  // Sanitize project name for Vercel (must be max 100 chars, lowercase alphanumeric + hyphens)
  const vercelProjectName = (body.subdomain || body.businessName || "project")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .substring(0, 90) + "-" + Math.random().toString(36).substring(2, 7)

  // Vercel Integration: Create Project
  let vercelProjectId = null
  try {
    console.log("[v0] Creating Vercel project:", vercelProjectName)
    const createProjectRes = await fetch("https://api.vercel.com/v9/projects", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: vercelProjectName,
        framework: null // Static site
      }),
    })

    if (!createProjectRes.ok) {
      const errorData = await createProjectRes.json()
      console.error("[v0] Vercel Create Project Error:", errorData)
      throw new Error(`Failed to create Vercel project: ${errorData.message || createProjectRes.statusText}`)
    }

    const projectData = await createProjectRes.json()
    vercelProjectId = projectData.id

    // Vercel Integration: Initial Deployment (Starter HTML)
    const starterHtml = `<!DOCTYPE html><html><head><title>${body.businessName}</title></head><body><h1>Welcome to ${body.businessName}</h1><p>Your site is being built!</p></body></html>`

    console.log("[v0] Creating initial deployment for:", vercelProjectId)
    const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: vercelProjectName,
          project: vercelProjectId,
          files: [
            {
              file: "index.html",
              data: starterHtml
            }
          ],
          target: "production"
        }),
    })

    if (!deployRes.ok) {
        const deployError = await deployRes.json()
        console.error("[v0] Vercel Initial Deploy Error:", deployError)
        // Don't fail the whole creation if deployment fails, but log it
    } else {
        console.log("[v0] Initial Vercel deployment triggered")
    }

  } catch (vercelError: any) {
    console.error("[v0] Vercel Integration Failed:", vercelError)
    return NextResponse.json({ message: "Vercel integration failed: " + vercelError.message }, { status: 500 })
  }

  const newProject = {
    ...body,
    webpageId,
    userId: session.user.id,
    userEmail: session.user.email,
    userName: session.user.name,
    userIP: userIP,
    isPremium: isPremium,
    status: "pending",
    createdAt: new Date(),
    vercelProjectId: vercelProjectId,
    vercelProjectName: vercelProjectName
  }

  try {
    const projectResult = await db.collection("projects").insertOne(newProject)
    const projectId = projectResult.insertedId.toString()

    if (body.subdomain) {
      const sanitizedSubdomain = body.subdomain
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")

      if (sanitizedSubdomain.length >= 3 && !containsCurseWords(sanitizedSubdomain)) {
        try {
          const deployment = {
            projectId: projectResult.insertedId,
            userId: session.user.id,
            subdomain: sanitizedSubdomain,
            domain: `${sanitizedSubdomain}.ltpd.xyz`,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
            deploymentData: {
              businessName: body.businessName,
              businessDescription: body.businessDescription || "",
            },
          }

          const deploymentResult = await db.collection("deployments").insertOne(deployment)

          await db.collection("projects").updateOne(
            { _id: projectResult.insertedId },
            {
              $set: {
                deploymentId: deploymentResult.insertedId,
                subdomain: sanitizedSubdomain,
                domain: `${sanitizedSubdomain}.ltpd.xyz`,
                deployedAt: new Date(),
              },
            },
          )
        } catch (deploymentError: any) {
          console.error("[v0] Error creating deployment record:", deploymentError.message)
        }
      }
    }

    const updatedProject = await db.collection("projects").findOne({ _id: projectResult.insertedId })
    return NextResponse.json(updatedProject, { status: 201 })
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
