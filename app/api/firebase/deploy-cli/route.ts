import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { exec } from "child_process"
import { promisify } from "util"
import * as fs from "fs/promises"
import * as path from "path"
import * as os from "os"

const execAsync = promisify(exec)

/**
 * Helper to get valid access token (refreshes if needed)
 */
async function getValidAccessToken(projectId: string, userId: string) {
  const client = await clientPromise
  const db = client.db()

  const tokenDoc = await db.collection("firebase_tokens").findOne({
    projectId: new ObjectId(projectId),
    userId,
  })

  if (!tokenDoc) {
    throw new Error("No Firebase authentication found. Please authenticate first.")
  }

  // Check if token needs refresh
  const tokenAge = Date.now() - new Date(tokenDoc.updatedAt).getTime()
  const expiresInMs = (tokenDoc.expiresIn || 3600) * 1000

  if (tokenAge >= expiresInMs - 60000) {
    console.log("[Firebase] Access token expired, refreshing...")

    const refreshResponse = await fetch(`${process.env.NEXTAUTH_URL}/api/firebase/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, userId }),
    })

    if (!refreshResponse.ok) {
      throw new Error("Failed to refresh access token")
    }

    const refreshData = await refreshResponse.json()
    return refreshData.accessToken
  }

  return tokenDoc.accessToken
}

/**
 * Deploy using Firebase CLI with OAuth token
 * POST /api/firebase/deploy-cli
 */
export async function POST(request: Request) {
  let tempDir: string | null = null

  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log("[Firebase] Deploy: Unauthorized - no session")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { projectId, firebaseProjectId } = await request.json()

    if (!projectId) {
      return NextResponse.json({ message: "Project ID required" }, { status: 400 })
    }

    console.log("[Firebase CLI] Starting deployment for project:", projectId)

    // Get project data
    const client = await clientPromise
    const db = client.db()

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      console.log("[Firebase CLI] Project not found or unauthorized")
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(projectId, session.user.id)
    console.log("[Firebase CLI] Access token obtained")

    // Determine Firebase project ID
    let fbProjectId = firebaseProjectId || project.firebaseProjectId
    if (!fbProjectId) {
      const sanitizedName = (project.businessName || "my-site")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 30)

      fbProjectId = `${sanitizedName}-${Date.now().toString(36)}`
      console.log("[Firebase CLI] Generated project ID:", fbProjectId)
    }

    // Create temporary directory for deployment
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "firebase-deploy-"))
    console.log("[Firebase CLI] Created temp directory:", tempDir)

    // Create public directory and write files
    const publicDir = path.join(tempDir, "public")
    await fs.mkdir(publicDir, { recursive: true })

    // Write all pages to disk
    if (project.pages && project.pages.length > 0) {
      for (const page of project.pages) {
        let filePath = page.name
        if (!filePath.startsWith("/")) {
          filePath = "/" + filePath
        }

        // Remove leading slash for filesystem
        const diskPath = path.join(publicDir, filePath.substring(1))

        // Create parent directories if needed
        const dirPath = path.dirname(diskPath)
        await fs.mkdir(dirPath, { recursive: true })

        // Write file
        await fs.writeFile(diskPath, page.content, "utf-8")
        console.log("[Firebase CLI] Written file:", filePath)
      }
    } else {
      const placeholderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.businessName || "My Website"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .container { text-align: center; color: white; max-width: 600px; padding: 20px; }
    h1 { font-size: 3em; margin-bottom: 20px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
    p { font-size: 1.2em; margin-bottom: 30px; opacity: 0.9; }
    .status { background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px; backdrop-filter: blur(10px); }
  </style>
</head>
<body>
  <div class="container">
    <h1>🚀 ${project.businessName || "Welcome"}</h1>
    <div class="status">
      <p>Your website is live!</p>
      <p>Start building by adding pages in the editor.</p>
    </div>
  </div>
</body>
</html>`

      await fs.writeFile(path.join(publicDir, "index.html"), placeholderHtml, "utf-8")
      console.log("[Firebase CLI] Generated placeholder index.html")
    }

    // Create firebase.json configuration
    const firebaseJson = {
      hosting: [
        {
          public: "public",
          site: fbProjectId,
          ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
          headers: [
            {
              source: "**",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=3600",
                },
              ],
            },
          ],
        },
      ],
    }

    await fs.writeFile(path.join(tempDir, "firebase.json"), JSON.stringify(firebaseJson, null, 2), "utf-8")
    console.log("[Firebase CLI] Created firebase.json")

    // Set Firebase token via environment variable
    process.env.FIREBASE_TOKEN = accessToken
    console.log("[Firebase CLI] Firebase token set")

    // Deploy using Firebase CLI
    console.log("[Firebase CLI] Starting deployment to:", fbProjectId)

    const deployCmd = `cd "${tempDir}" && firebase deploy --project "${fbProjectId}" --only hosting --token "$FIREBASE_TOKEN"`

    const { stdout, stderr } = await execAsync(deployCmd, {
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer
      timeout: 300000, // 5 minutes timeout
      env: {
        ...process.env,
        FIREBASE_TOKEN: accessToken,
      },
    })

    console.log("[Firebase CLI] Deployment output:", stdout)
    if (stderr) {
      console.log("[Firebase CLI] Deployment warnings:", stderr)
    }

    // Extract hosting URL from output
    const urlMatch = stdout.match(/Hosting URL:\s+(https:\/\/[^\s]+)/)
    const hostedUrl = urlMatch ? urlMatch[1] : `https://${fbProjectId}.web.app`

    // Update project with deployment info
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          firebaseProjectId: fbProjectId,
          firebaseDeployedAt: new Date(),
          firebaseUrl: hostedUrl,
          updatedAt: new Date(),
        },
      },
    )

    console.log("[Firebase CLI] Deployment successful! URL:", hostedUrl)

    return NextResponse.json({
      success: true,
      message: "Deployment successful",
      url: hostedUrl,
      projectId: fbProjectId,
    })
  } catch (error: any) {
    console.error("[Firebase CLI] Deployment error:", error.message)

    // Check if error is about missing Firebase project
    if (error.message.includes("does not exist") || error.message.includes("PERMISSION_DENIED")) {
      return NextResponse.json(
        {
          message: "Firebase project does not exist or you don't have access to it",
          details:
            "Please ensure the Firebase project exists in your Google account and you have permissions to deploy to it",
          helpUrl: "https://console.firebase.google.com",
          error: error.message,
        },
        { status: 403 },
      )
    }

    return NextResponse.json(
      {
        message: error.message || "Deployment failed",
        error: error.toString(),
      },
      { status: 500 },
    )
  } finally {
    // Clean up temporary directory
    if (tempDir) {
      try {
        await execAsync(`rm -rf "${tempDir}"`)
        console.log("[Firebase CLI] Cleaned up temp directory")
      } catch (cleanupError) {
        console.error("[Firebase CLI] Failed to clean up temp directory:", cleanupError)
      }
    }
  }
}
