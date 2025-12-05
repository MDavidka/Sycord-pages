import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { getClientIP } from "@/lib/get-client-ip"
import { containsCurseWords } from "@/lib/curse-word-filter"
import { generateWebpageId } from "@/lib/generate-webpage-id"
import { getValidVercelToken } from "@/lib/vercel"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  console.log("==========================================");
  console.log(`[Vercel Project Creation] Start for User: ${session.user.email}`);

  let vercelToken: string
  try {
    vercelToken = await getValidVercelToken(session.user.id)
    console.log(`[Vercel Project Creation] Token obtained (ending in ...${vercelToken.slice(-5)})`);
  } catch (error: any) {
    console.error("[Vercel Project Creation] Token validation failed:", error);
    return NextResponse.json({ message: error.message || "Vercel authentication failed" }, { status: 403 })
  }

  // Fetch user to get Team ID (Token is already validated)
  const user = await db.collection("users").findOne({ id: session.user.id })
  const vercelTeamId = user?.vercelTeamId
  console.log(`[Vercel Project Creation] Vercel Team ID: ${vercelTeamId || "None (Personal Account)"}`);

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

  // Sanitize project name for Vercel
  const vercelProjectName = (body.subdomain || body.businessName || "project")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .substring(0, 90) + "-" + Math.random().toString(36).substring(2, 7)

  // Vercel Integration
  let vercelProjectId = null
  try {
    console.log(`[Vercel Project Creation] Creating project: ${vercelProjectName}`);

    // 1. Create Project
    // Append teamId query parameter if user is part of a team installation
    const projectsEndpoint = vercelTeamId
        ? `https://api.vercel.com/v10/projects?teamId=${vercelTeamId}`
        : "https://api.vercel.com/v10/projects";

    console.log(`[Vercel Project Creation] Endpoint: ${projectsEndpoint}`);

    const createProjectRes = await fetch(projectsEndpoint, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${vercelToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: vercelProjectName,
        // framework: null // Removed framework: null to rely on default behavior
      }),
    })

    if (!createProjectRes.ok) {
      const errorText = await createProjectRes.text();
      let errorData;
      try {
          errorData = JSON.parse(errorText);
      } catch (e) {
          errorData = { message: errorText };
      }

      console.error("[Vercel Project Creation] API Error Response Status:", createProjectRes.status);
      console.error("[Vercel Project Creation] API Error Response Body:", JSON.stringify(errorData, null, 2));

      // Check for invalid token error (401 or invalid_token code) to prompt reconnect
      // We only force logout on 401. 403 means valid token but insufficient permissions.
      if (createProjectRes.status === 401 || errorData.error?.code === 'invalid_token') {
          console.warn("[Vercel Project Creation] Token invalid/unauthorized (401). Unsetting user tokens.");
          // Remove invalid tokens from DB to force reconnect
          await db.collection("users").updateOne(
              { id: session.user.id },
              {
                  $unset: {
                      vercelAccessToken: "",
                      vercelRefreshToken: "",
                      vercelExpiresAt: ""
                  }
              }
          )
          // Return specific error structure for frontend to handle
          return NextResponse.json({
              message: "Your Vercel connection has expired. Please disconnect and reconnect your Vercel account in the settings.",
              code: "VERCEL_TOKEN_EXPIRED"
          }, { status: 401 })
      }

      if (createProjectRes.status === 403) {
          console.error("[Vercel Project Creation] 403 Forbidden. The token is valid but lacks permission. Check Integration Scopes.");
          return NextResponse.json({
              message: "Permission denied by Vercel. This means the Vercel Integration does not have 'Projects' scope enabled with 'Read & Write' access. Please go to your Vercel Integration Console > Scopes, enable 'Projects' as 'Read & Write', and reinstall the integration.",
              code: "VERCEL_PERMISSION_DENIED"
          }, { status: 403 })
      }

      throw new Error(`Failed to create Vercel project: ${errorData.message || createProjectRes.statusText}`)
    }

    const projectData = await createProjectRes.json()
    vercelProjectId = projectData.id
    console.log(`[Vercel Project Creation] Project created successfully. ID: ${vercelProjectId}`);

    // 2. Initial Deployment
    const starterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${body.businessName}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #f0f0f0; }
        .container { text-align: center; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        h1 { color: #333; margin-bottom: 0.5rem; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to ${body.businessName}</h1>
        <p>Your site is successfully deployed!</p>
    </div>
</body>
</html>`

    console.log("[v0] Creating initial deployment for:", vercelProjectId)

    const deploymentsEndpoint = vercelTeamId
        ? `https://api.vercel.com/v13/deployments?teamId=${vercelTeamId}`
        : "https://api.vercel.com/v13/deployments";

    const deployRes = await fetch(deploymentsEndpoint, {
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
        // We log but continue, effectively creating the project but failing the first deploy.
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
