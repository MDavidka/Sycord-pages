import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getClientIP } from "@/lib/get-client-ip"
import { containsCurseWords } from "@/lib/curse-word-filter"
import { generateWebpageId } from "@/lib/generate-webpage-id"
import { loadProjectChatSummariesForUser } from "@/lib/project-chat-session"

import { ensureContainer, bootstrapContainer } from "@/lib/deploy/ssh-deploy"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  console.log("==========================================");
  console.log(`[Project Creation] Start for User: ${session.user.email}`);

  let body;
  try {
      body = await request.json();
  } catch (e) {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  // Validate businessName
  if (!body.businessName || typeof body.businessName !== 'string' || body.businessName.trim().length === 0) {
      return NextResponse.json({ message: "Business name is required" }, { status: 400 });
  }
  if (body.businessName.length > 100) {
      return NextResponse.json({ message: "Business name is too long (max 100 chars)" }, { status: 400 });
  }

  // Validate description if present
  if (body.businessDescription && (typeof body.businessDescription !== 'string' || body.businessDescription.length > 1000)) {
       return NextResponse.json({ message: "Business description is invalid or too long" }, { status: 400 });
  }

  // Validate profileImage if present (data URL or http(s) URL). Cap size to protect DB docs.
  let safeProfileImage = "";
  if (body.profileImage !== undefined && body.profileImage !== null && body.profileImage !== "") {
      if (typeof body.profileImage !== 'string') {
          return NextResponse.json({ message: "profileImage must be a string" }, { status: 400 });
      }
      // A 2MB image encoded as base64 data URL is ~2.8MB; allow some headroom.
      if (body.profileImage.length > 3_500_000) {
          return NextResponse.json({ message: "profileImage is too large (max 2MB image)" }, { status: 400 });
      }
      const isDataUrl = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(body.profileImage);
      const isHttpUrl = /^https?:\/\//i.test(body.profileImage);
      if (!isDataUrl && !isHttpUrl) {
          return NextResponse.json({ message: "profileImage must be an image data URL or http(s) URL" }, { status: 400 });
      }
      safeProfileImage = body.profileImage;
  }

  // Fetch user doc to check limits and existing projects
  const userDoc = await db.collection("users").findOne<{ projects?: any[] }>({ id: session.user.id })
  const userProjects = userDoc?.projects || []

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

  const webpageId = generateWebpageId()

  // sanitize body fields to prevent injection of unexpected fields
  const safeBody = {
      businessName: body.businessName.trim(),
      businessDescription: (body.businessDescription || "").trim(),
      subdomain: body.subdomain,
      style: body.style,
      profileImage: safeProfileImage,
      // explicitly exclude fields that shouldn't be user-settable if any
  };

  const IDLE_PAGE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Website in Progress</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }
        html, body {
            min-height: 100dvh;
            width: 100%;
            margin: 0;
            padding: 0;
            background-color: #141414;
        }
        body {
            font-family: 'Inter', sans-serif;
            color: #ffffff;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
        }
        .logo-container {
            position: absolute;
            top: 20%;
            left: 15%;
        }
        .logo {
            width: 48px;
            height: 24px;
            background-color: rgba(255, 255, 255, 0.6);
            border-radius: 4px;
            clip-path: polygon(0 0, 100% 0, 100% 100%, 50% 50%, 0 100%);
        }
        .content {
            text-align: left;
            max-width: 600px;
            width: 100%;
            padding: 2rem;
            margin-left: -15%;
        }
        @media (max-width: 768px) {
            .logo-container {
                top: 20%;
                left: 10%;
            }
            .content {
                margin-left: 0;
                padding-left: 10%;
            }
        }
        h1 {
            font-size: 2.5rem;
            font-weight: 600;
            margin-bottom: 0.5rem;
            letter-spacing: -0.025em;
        }
        p {
            font-size: 1.125rem;
            color: #a1a1aa;
            margin-bottom: 3.5rem;
        }
        .return-btn {
            background-color: rgba(255, 255, 255, 0.4);
            color: #ffffff;
            border: none;
            border-radius: 9999px;
            padding: 0.75rem 2.5rem;
            font-size: 1.25rem;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s;
        }
        .return-btn:hover {
            background-color: rgba(255, 255, 255, 0.5);
        }
        .footer {
            position: absolute;
            bottom: 5%;
            text-align: center;
            width: 100%;
            color: #a1a1aa;
            font-size: 0.875rem;
        }
    </style>
</head>
<body>
    <div class="logo-container">
        <div class="logo"></div>
    </div>
    <div class="content">
        <h1>Here is your site</h1>
        <p>set up your website stile on the dasboard</p>
        <button class="return-btn" onclick="window.parent !== window ? window.parent.postMessage('returnToDashboard', '*') : window.location.href='/'">return</button>
    </div>
    <div class="footer">
        privacy and policy &bull; terms of condition
    </div>
</body>
</html>`;

  let sanitizedSubdomain: string | null = null
  let deploymentData: any = null

  if (body.subdomain) {
    if (typeof body.subdomain === 'string') {
        const cleaned = body.subdomain
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9-]/g, "-")
          .replace(/^-+|-+$/g, "")

        if (cleaned.length >= 3 && !containsCurseWords(cleaned)) {
            sanitizedSubdomain = cleaned
            deploymentData = {
              subdomain: cleaned,
              domain: `${cleaned}.pages.dev`,
              status: "active",
              createdAt: new Date(),
              updatedAt: new Date(),
              deploymentData: {
                businessName: safeBody.businessName,
                businessDescription: safeBody.businessDescription,
              },
            }
        }
    }
  }

  const projectId = crypto.randomUUID()

  const newProject = {
    _id: projectId,
    ...safeBody,
    subdomain: sanitizedSubdomain, // Ensure subdomain is updated with sanitized version
    webpageId,
    userId: session.user.id, // Keep userId for reference, though embedded
    isPremium: isPremium,
    status: "active",
    createdAt: new Date(),
    pages: [
        {
            name: "index.html",
            content: IDLE_PAGE_HTML,
            usedFor: "Idle deployment placeholder",
            createdAt: new Date(),
            updatedAt: new Date()
        }
    ], // Initialize with idle page
    deployment: deploymentData, // Embed deployment info
    // Legacy fields for compatibility if needed, but we try to move away
    deploymentId: deploymentData ? crypto.randomUUID() : null,
  }

  try {
    const result = await db.collection("users").updateOne(
      { id: session.user.id },
      {
        $push: {
          projects: newProject
        } as any
      }
    )

    if (!result.upsertedCount && !result.modifiedCount) {
      // If user doc doesn't exist, create it first with the project
      const userResult = await db.collection("users").updateOne(
        { id: session.user.id },
        {
          $setOnInsert: {
            id: session.user.id,
            email: session.user.email,
            name: session.user.name,
            image: session.user.image,
            projects: [newProject],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }
        },
        { upsert: true }
      )
      if (!userResult.upsertedCount && !userResult.modifiedCount) {
        throw new Error("Failed to create project: could not update user document")
      }
    }

    console.log("[Project Creation] Project created successfully embedded in user:", projectId.toString())

    // Trigger container setup in background (don't block response)
    const projectIdStr = projectId.toString()
    ensureContainer(newProject, projectIdStr)
      .then((container) => bootstrapContainer(container))
      .catch((err) => console.error("[Project Creation] Container setup failed:", err?.message))

    // Return the new project. We cast _id to string for JSON serialization compatibility if needed,
    // but Next.js usually handles ObjectId in JSON response or we should stringify it.
    // However, existing frontend likely expects _id to be present.
    return NextResponse.json(newProject, { status: 201 })
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

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !session.user || !session.user.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const client = await clientPromise
  const db = client.db()

  try {
    // Use projection so we don't pull the full user document (which may include
    // sessions, settings, preferences, and other unrelated fields). Also only
    // project the fields the dashboard actually needs per project so we avoid
    // shipping large blobs (pages, history, AI logs) to the client.
    const userDoc = await db.collection("users").findOne(
      { id: session.user.id },
      {
        projection: {
          projects: 1,
          _id: 0,
        },
      },
    )

    const rawProjects = (userDoc?.projects as any[]) || []
    const chatSummaries = await loadProjectChatSummariesForUser(db, session.user.id)

    // Sort newest-first (most recent project on top of dashboard) — fast in-memory sort.
    rawProjects.sort((a, b) => {
      const ta = new Date(a?.createdAt || 0).getTime()
      const tb = new Date(b?.createdAt || 0).getTime()
      return tb - ta
    })

    // Trim each project to the dashboard-friendly shape. Avoid returning large
    // nested fields like `pages`, `buildLogs`, etc.
    const projects = rawProjects.map((project: any) => {
      const deployedUrl =
        project.cloudflareUrl ||
        project.deploymentRuntime?.url ||
        project.deployment?.domain ||
        null
      const chatSession =
        chatSummaries.get(project._id) ||
        (project.chatSession
          ? {
              id: project.chatSession.id,
              title: project.chatSession.title || "Syra Chat",
              messageCount: Array.isArray(project.chatSession.messages)
                ? project.chatSession.messages.length
                : project.chatSession.messageCount ?? 0,
              updatedAt: project.chatSession.updatedAt,
              createdAt: project.chatSession.createdAt,
            }
          : null)
      return {
        _id: project._id,
        id: project.id,
        businessName: project.businessName,
        businessDescription: project.businessDescription,
        subdomain: project.subdomain,
        domain: project.domain || deployedUrl || null,
        cloudflareUrl: deployedUrl || project.cloudflareUrl || null,
        style: project.style,
        status: project.status,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        applicationId: project.applicationId,
        projectId: project.projectId,
        previewImage: project.previewImage,
        profileImage: project.profileImage,
        chatSession,
        deploymentRuntime: project.deploymentRuntime
          ? {
              status: project.deploymentRuntime.status,
              url: project.deploymentRuntime.url,
              lastDeployedAt: project.deploymentRuntime.lastDeployedAt,
            }
          : undefined,
        deployment: project.deployment
          ? { domain: project.deployment.domain }
          : undefined,
      }
    })

    // Allow short-lived browser caching + CDN caching. The dashboard will
    // refetch after mutations anyway, so a 30s window keeps load fast on
    // back/forward navigation without making data feel stale.
    return NextResponse.json(projects, {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    })
  } catch (error: any) {
    console.error("Error fetching projects:", error)
    return NextResponse.json({ message: "Failed to fetch projects" }, { status: 500 })
  }
}
