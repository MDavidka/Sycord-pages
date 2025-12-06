import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { getClientIP } from "@/lib/get-client-ip"
import { containsCurseWords } from "@/lib/curse-word-filter"
import { generateWebpageId } from "@/lib/generate-webpage-id"
import { getValidVercelToken } from "@/lib/vercel"
import { getVercelProjectCreationUrl, getVercelDeploymentUrl } from "@/lib/vercel-api-utils"

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

    // 1. Explicit Project Creation (POST /v11/projects)
    // We use explicit project creation as requested to ensure proper team scoping and permissions.
    // If teamId is present, it must be passed in the URL.

    const projectsEndpoint = getVercelProjectCreationUrl(vercelTeamId);

    console.log(`[Vercel Project Creation] Creating project via: ${projectsEndpoint}`);

    const projectRes = await fetch(projectsEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: vercelProjectName,
          framework: "other", // Use 'other' for static sites or specify if needed
        }),
    });

    if (!projectRes.ok) {
        const errorText = await projectRes.text();
        let projectError;
        try {
            projectError = JSON.parse(errorText);
        } catch (e) {
            projectError = { message: errorText };
        }

        console.error("[Vercel Project Creation] Project Creation Error:", projectRes.status, projectError);

        if (projectRes.status === 403) {
             return NextResponse.json({
                message: "Permission denied by Vercel. Please ensure the Vercel Integration has 'Projects' scope enabled (Read & Write) and access to All Projects. For Team accounts, ensure you have the correct role.",
                code: "VERCEL_PERMISSION_DENIED",
                details: `Project creation failed with status 403. Error: ${projectError.message || projectError.error?.message || "Permission denied"}`
            }, { status: 403 })
        }

        // If project already exists, we can proceed to deployment
        if (projectRes.status !== 409) { // 409 Conflict means project exists
            throw new Error(`Failed to create project on Vercel: ${projectError.message || projectRes.statusText}`)
        }
        console.log("[Vercel Project Creation] Project might already exist (409), proceeding to deployment.");
    } else {
        const projectData = await projectRes.json();
        vercelProjectId = projectData.id;
        console.log(`[Vercel Project Creation] Project created successfully: ${vercelProjectId}`);
    }

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

    console.log(`[Vercel Project Creation] triggering initial deployment for project: ${vercelProjectName}`)

    const deploymentsEndpoint = getVercelDeploymentUrl(vercelTeamId);

    const deployBody: any = {
        name: vercelProjectName,
        files: [
          {
            file: "index.html",
            data: starterHtml
          }
        ],
        target: "production"
    };

    // If we have a project ID from the explicit creation step, use it
    if (vercelProjectId) {
        deployBody.project = vercelProjectId;
    }

    const deployRes = await fetch(deploymentsEndpoint, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${vercelToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(deployBody),
    })

    if (!deployRes.ok) {
        const errorText = await deployRes.text();
        let deployError;
        try {
            deployError = JSON.parse(errorText);
        } catch (e) {
            deployError = { message: errorText };
        }

        console.error("[Vercel Project Creation] Deployment Error Status:", deployRes.status)
        console.error("[Vercel Project Creation] Deployment Error Body:", JSON.stringify(deployError, null, 2))

        // Check for invalid token error (401 or invalid_token code) to prompt reconnect
        if (deployRes.status === 401 || deployError.error?.code === 'invalid_token') {
            console.warn("[Vercel Project Creation] Token invalid/unauthorized (401). Unsetting user tokens.");
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
            return NextResponse.json({
                message: "Your Vercel connection has expired. Please disconnect and reconnect your Vercel account in the settings.",
                code: "VERCEL_TOKEN_EXPIRED",
                details: `Authentication failed with status 401. Error: ${deployError.message || deployError.error?.message || "Token expired or invalid"}`
            }, { status: 401 })
        }

        if (deployRes.status === 403) {
             return NextResponse.json({
                message: "Permission denied by Vercel. Please ensure the Vercel Integration has 'Projects' scope enabled (Read & Write) and access to All Projects.",
                code: "VERCEL_PERMISSION_DENIED",
                details: `Deployment failed with status 403. Error: ${deployError.message || deployError.error?.message || "Permission denied"}`
            }, { status: 403 })
        }

        throw new Error(`Failed to deploy to Vercel: ${deployError.message || deployRes.statusText}`)
    }

    const deploymentData = await deployRes.json()
    console.log("[Vercel Project Creation] Initial deployment successful:", deploymentData.id)

    // Extract projectId from the deployment response
    vercelProjectId = deploymentData.projectId
    const deploymentId = deploymentData.id

  } catch (vercelError: any) {
    console.error("[v0] Vercel Integration Failed:", vercelError)
    
    // Provide detailed error information - only safe properties
    const errorResponse: any = {
      message: vercelError.message || "Vercel integration failed",
      error: vercelError.message || "An error occurred during Vercel integration"
    }
    
    // Add specific error codes if available
    if (vercelError.message?.includes("Permission denied")) {
      errorResponse.code = "VERCEL_PERMISSION_DENIED"
    } else if (vercelError.message?.includes("expired") || vercelError.message?.includes("authentication")) {
      errorResponse.code = "VERCEL_AUTH_FAILED"
    } else if (vercelError.message?.includes("quota") || vercelError.message?.includes("limit")) {
      errorResponse.code = "VERCEL_QUOTA_EXCEEDED"
    } else if (vercelError.message?.includes("network") || vercelError.message?.includes("fetch")) {
      errorResponse.code = "NETWORK_ERROR"
    }
    
    return NextResponse.json(errorResponse, { status: 500 })
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
