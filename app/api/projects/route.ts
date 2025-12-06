import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { getClientIP } from "@/lib/get-client-ip"
import { containsCurseWords } from "@/lib/curse-word-filter"
import { generateWebpageId } from "@/lib/generate-webpage-id"
import { deployToFirebase, getFirebaseProjects, createFirebaseProject } from "@/lib/firebase-deploy"
import { getValidFirebaseToken } from "@/lib/google-token-refresh"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  let firebaseAccessToken: string;
  try {
    firebaseAccessToken = await getValidFirebaseToken(session.user.id);
  } catch (error: any) {
    console.error("[Project Creation] Failed to get valid Firebase token:", error);
    return NextResponse.json({ message: "Firebase connection expired or invalid. Please reconnect your account." }, { status: 403 });
  }

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

  // Ensure siteId is max 30 chars.
  // 30 - 5 (suffix) = 25 chars for base name.
  const sanitizedSubdomain = (body.subdomain || body.businessName || "project")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]/g, "-")
    .substring(0, 24)
    .replace(/^-+|-+$/g, "") + "-" + Math.random().toString(36).substring(2, 6);

  // Firebase Deployment Logic
  let deployResult = null;
  let firebaseProjectId = null;
  let siteId = null;

  try {
    // 1. Get List of Projects and pick the first one (Simplification)
    // In a real app, we might ask the user to pick one in the UI.
    const projects = await getFirebaseProjects(firebaseAccessToken);

    if (!projects || projects.length === 0) {
        console.log("[Firebase] No projects found, attempting to create one...");
        try {
            const newProject = await createFirebaseProject(firebaseAccessToken);
            firebaseProjectId = newProject.projectId;
        } catch (createError: any) {
             console.error("[Firebase] Failed to create project:", createError);
             throw new Error("No Firebase Projects found and failed to create one automatically. Please create a project in the Firebase Console (https://console.firebase.google.com) and try again.");
        }
    } else {
        // Use the first project
        const project = projects[0];
        firebaseProjectId = project.projectId;
    }

    console.log(`[Firebase] Using project: ${firebaseProjectId}`);

    // 2. Determine Site ID
    // We try to use the sanitized subdomain as the site ID.
    // Site IDs must be unique globally in Firebase Hosting (web.app).
    siteId = sanitizedSubdomain;

    // 3. Create initial content
    const starterHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${body.businessName}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #FF9966 0%, #FF5E62 100%); }
        .container { text-align: center; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 500px; }
        h1 { color: #333; margin-bottom: 0.5rem; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Welcome to ${body.businessName}</h1>
        <p>Your site is successfully deployed to Firebase Hosting!</p>
        <p style="margin-top: 1rem; font-size: 0.875rem; color: #999;">Powered by Firebase</p>
    </div>
</body>
</html>`;

    // 4. Deploy
    console.log(`[Firebase] Deploying to site: ${siteId}`);
    deployResult = await deployToFirebase(firebaseAccessToken, firebaseProjectId, siteId, starterHtml);

  } catch (error: any) {
    console.error("[Firebase] Deployment failed:", error);

    // Handle invalid token
    if (error.code === 401 || error.message?.includes("401")) {
         await db.collection("users").updateOne(
            { id: session.user.id },
            { $unset: { firebaseAccessToken: "", firebaseRefreshToken: "", firebaseExpiresAt: "" } }
        );
        return NextResponse.json({ message: "Firebase connection expired. Please reconnect." }, { status: 401 });
    }

    return NextResponse.json({ message: "Firebase deployment failed: " + error.message }, { status: 500 });
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
    firebaseProjectId: firebaseProjectId,
    firebaseSiteId: siteId,
  }

  try {
    const projectResult = await db.collection("projects").insertOne(newProject)

    if (deployResult) {
        try {
          const deployment = {
            projectId: projectResult.insertedId,
            userId: session.user.id,
            subdomain: sanitizedSubdomain,
            domain: deployResult.url.replace("https://", ""), // store domain without protocol
            status: "active",
            createdAt: new Date(),
            updatedAt: new Date(),
            deploymentData: {
              businessName: body.businessName,
              businessDescription: body.businessDescription || "",
              firebaseSiteId: siteId,
              firebaseProjectId: firebaseProjectId
            },
          }

          const deploymentResult = await db.collection("deployments").insertOne(deployment)

          await db.collection("projects").updateOne(
            { _id: projectResult.insertedId },
            {
              $set: {
                deploymentId: deploymentResult.insertedId,
                subdomain: sanitizedSubdomain,
                domain: deployment.domain,
                deployedAt: new Date(),
              },
            },
          )
        } catch (deploymentError: any) {
          console.error("[v0] Error creating deployment record:", deploymentError.message)
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
