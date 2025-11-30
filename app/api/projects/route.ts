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

  // @ts-ignore
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

  // Enhanced Starter Template
  // This includes a basic responsive layout, some styling, and a placeholder for content.
  const starterHtml = `
<!DOCTYPE html>
<html lang="hu">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${body.businessName} - Hamarosan</title>
    <style>
        :root {
            --primary: ${body.primaryColor || '#000000'};
            --secondary: ${body.secondaryColor || '#ffffff'};
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            background-color: #f9fafb;
            color: #111827;
            text-align: center;
        }
        .container {
            padding: 2rem;
            max-width: 600px;
            background: white;
            border-radius: 1rem;
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
        }
        h1 {
            font-size: 2.5rem;
            font-weight: 800;
            margin-bottom: 1rem;
            background: linear-gradient(to right, var(--primary), #4b5563);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        p {
            font-size: 1.1rem;
            color: #6b7280;
            margin-bottom: 2rem;
            line-height: 1.6;
        }
        .loader {
            border: 4px solid #f3f3f3;
            border-top: 4px solid var(--primary);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 1.5rem;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 9999px;
            font-size: 0.75rem;
            font-weight: 600;
            background-color: #dbeafe;
            color: #1e40af;
            margin-bottom: 1rem;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="loader"></div>
        <span class="badge">Készülőben</span>
        <h1>${body.businessName}</h1>
        <p>Ez a weboldal jelenleg fejlesztés alatt áll. Kérjük látogasson vissza később!</p>
        <p style="font-size: 0.875rem; opacity: 0.7;">Powered by LTPD.xyz</p>
    </div>
</body>
</html>`;

  // Vercel Integration: Create Project & Deploy
  let vercelProjectId = null
  let deploymentUrl = null

  try {
    console.log("[v0] Creating Vercel project:", vercelProjectName)

    // 1. Create Project
    const createProjectRes = await fetch("https://api.vercel.com/v9/projects", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: vercelProjectName,
        framework: null
      }),
    })

    if (!createProjectRes.ok) {
      const errorData = await createProjectRes.json()
      // If project already exists (409), we might want to append a random string and try again,
      // but for now we throw.
      throw new Error(`Failed to create Vercel project: ${errorData.message || createProjectRes.statusText}`)
    }

    const projectData = await createProjectRes.json()
    vercelProjectId = projectData.id

    // 2. Deploy Starter Files
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
        // Log error but proceed with DB creation so user has a record
    } else {
        const deployData = await deployRes.json()
        deploymentUrl = `https://${deployData.url}` // usually projectname.vercel.app
        console.log("[v0] Initial Vercel deployment triggered:", deploymentUrl)
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
    vercelProjectName: vercelProjectName,
    vercelDeploymentUrl: deploymentUrl
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
          // Store deployment record
          const deployment = {
            projectId: projectResult.insertedId,
            userId: session.user.id,
            subdomain: sanitizedSubdomain,
            domain: `${sanitizedSubdomain}.ltpd.xyz`, // Internal domain tracking
            vercelUrl: deploymentUrl,
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
            deploymentData: {
              businessName: body.businessName,
            },
          }

          const deploymentResult = await db.collection("deployments").insertOne(deployment)

          await db.collection("projects").updateOne(
            { _id: projectResult.insertedId },
            {
              $set: {
                deploymentId: deploymentResult.insertedId,
                subdomain: sanitizedSubdomain,
                deployedAt: new Date(),
              },
            },
          )
        } catch (deploymentError: any) {
          console.error("[v0] Error creating deployment record:", deploymentError.message)
        }
      }
    }

    // Ensure User Collection is linked/updated if not already (redundancy)
    await db.collection("users").updateOne(
        { _id: session.user.id },
        {
            $set: {
                vercelConnected: true,
                lastProjectCreated: new Date()
            }
        }
    )

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
