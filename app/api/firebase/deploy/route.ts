import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

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

  // Check if token needs refresh (if createdAt is older than expiresIn)
  const tokenAge = Date.now() - new Date(tokenDoc.updatedAt).getTime()
  const expiresInMs = (tokenDoc.expiresIn || 3600) * 1000

  if (tokenAge >= expiresInMs - 60000) {
    // Token expired or will expire in 1 minute, refresh it
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
 * Helper to make Firebase API calls with retry logic
 */
async function firebaseApiCall(
  url: string,
  options: RequestInit,
  accessToken: string,
  retries = 3,
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }

  // Merge with any existing headers
  if (options.headers) {
    Object.assign(headers, options.headers)
  }

  let lastError: any
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers })

      if (response.ok || response.status === 404 || response.status === 409) {
        return response
      }

      let errorData: any
      const contentTypeHeader = response.headers.get("content-type")

      if (contentTypeHeader?.includes("application/json")) {
        errorData = await response.json().catch(() => ({ 
          rawText: "Could not parse JSON",
          status: response.status,
          statusText: response.statusText
        }))
      } else {
        // If response is HTML or other format, capture as text
        const text = await response.text()
        errorData = {
          htmlResponse: text.substring(0, 200), // First 200 chars
          fullStatus: response.status,
          statusText: response.statusText,
        }
      }

      console.error(`[Firebase] API call failed (attempt ${i + 1}/${retries}):`, {
        url,
        status: response.status,
        error: errorData,
      })

      lastError = errorData
    } catch (error) {
      console.error(`[Firebase] API call error (attempt ${i + 1}/${retries}):`, error)
      lastError = error
    }

    if (i < retries - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)))
    }
  }

  throw new Error(`Firebase API call failed after ${retries} retries: ${JSON.stringify(lastError)}`)
}

/**
 * Check if Firebase project exists
 */
async function checkFirebaseProject(projectId: string, accessToken: string): Promise<boolean> {
  console.log("[Firebase] Checking if project exists:", projectId)
  
  try {
    const response = await firebaseApiCall(
      `https://firebase.googleapis.com/v1beta1/projects/${projectId}`,
      { method: "GET" },
      accessToken,
      1, // Only 1 retry for existence check
    )

    return response.ok
  } catch (error) {
    console.log("[Firebase] Project does not exist:", projectId)
    return false
  }
}

/**
 * Check if Firebase Hosting is initialized for a site
 */
async function checkHostingInitialized(
  projectId: string,
  siteId: string,
  accessToken: string,
): Promise<boolean> {
  console.log("[Firebase] Checking if hosting is initialized for site:", siteId)

  try {
    const response = await firebaseApiCall(
      `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}`,
      { method: "GET" },
      accessToken,
      1,
    )

    return response.ok
  } catch (error) {
    console.log("[Firebase] Hosting not initialized for site:", siteId)
    return false
  }
}

/**
 * Create a new Hosting version
 */
async function createHostingVersion(
  projectId: string,
  siteId: string,
  accessToken: string,
): Promise<{ name: string; uploadUrl: string }> {
  console.log("[Firebase] Creating hosting version for site:", siteId)

  const response = await firebaseApiCall(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/versions`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: {
          headers: [
            {
              glob: "**",
              headers: {
                "Cache-Control": "public, max-age=3600",
              },
            },
          ],
        },
      }),
    },
    accessToken,
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to create hosting version: ${JSON.stringify(errorData)}`)
  }

  const versionData = await response.json()
  console.log("[Firebase] Hosting version created:", versionData.name)

  return {
    name: versionData.name,
    uploadUrl: versionData.config?.uploadUrl || "",
  }
}

/**
 * Upload files to Firebase Hosting version
 * Note: This loads all files into memory as base64. For very large deployments
 * (>100MB total), consider implementing batched uploads or using the uploadUrl
 * mechanism for individual file uploads.
 */
async function uploadFiles(
  versionName: string,
  files: Array<{ path: string; content: string }>,
  accessToken: string,
  onProgress?: (uploaded: number, total: number) => void,
): Promise<void> {
  console.log("[Firebase] Uploading", files.length, "files to version:", versionName)

  // Prepare files in base64 format
  // Note: For production use with large files, consider gzip compression
  const fileList: Record<string, string> = {}
  
  for (const file of files) {
    // Convert to base64 (Firebase expects base64-encoded content)
    const base64Content = Buffer.from(file.content, "utf-8").toString("base64")
    fileList[file.path] = base64Content
  }

  const response = await firebaseApiCall(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        files: fileList,
      }),
    },
    accessToken,
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to upload files: ${JSON.stringify(errorData)}`)
  }

  const uploadData = await response.json()
  console.log("[Firebase] Files uploaded successfully")

  // If there are upload URLs, we need to upload via those
  if (uploadData.uploadUrl && uploadData.uploadRequiredHashes) {
    console.log("[Firebase] Additional uploads required for", uploadData.uploadRequiredHashes.length, "files")
    // This would require additional implementation for direct hash uploads
    // For most small files, populateFiles should handle them directly
  }

  if (onProgress) {
    onProgress(files.length, files.length)
  }
}

/**
 * Finalize the hosting version
 */
async function finalizeVersion(versionName: string, accessToken: string): Promise<void> {
  console.log("[Firebase] Finalizing version:", versionName)

  const response = await firebaseApiCall(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "FINALIZED",
      }),
    },
    accessToken,
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to finalize version: ${JSON.stringify(errorData)}`)
  }

  console.log("[Firebase] Version finalized successfully")
}

/**
 * Create a release to deploy the version
 */
async function createRelease(
  projectId: string,
  siteId: string,
  versionName: string,
  accessToken: string,
  channel: string = "live",
): Promise<string> {
  console.log("[Firebase] Creating release for version:", versionName, "on channel:", channel)

  const releaseUrl =
    channel === "live"
      ? `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/releases?versionName=${versionName}`
      : `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/channels/${channel}/releases?versionName=${versionName}`

  const response = await firebaseApiCall(
    releaseUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Deployed from Sycord Pages",
      }),
    },
    accessToken,
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}))
    throw new Error(`Failed to create release: ${JSON.stringify(errorData)}`)
  }

  const releaseData = await response.json()
  console.log("[Firebase] Release created:", releaseData.name)

  return releaseData.name
}

/**
 * Deploys site to Firebase Hosting using REST API
 * POST /api/firebase/deploy
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      console.log("[Firebase] Deploy: Unauthorized - no session")
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const { projectId, firebaseProjectId, channel } = await request.json()

    if (!projectId) {
      return NextResponse.json({ message: "Project ID required" }, { status: 400 })
    }

    console.log("[Firebase REST] Starting deployment for project:", projectId)

    // Get project data
    const client = await clientPromise
    const db = client.db()

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      console.log("[Firebase REST] Project not found or unauthorized")
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(projectId, session.user.id)
    console.log("[Firebase REST] Access token obtained")

    // Determine Firebase project ID and site ID
    let fbProjectId = firebaseProjectId || project.firebaseProjectId
    if (!fbProjectId) {
      const sanitizedName = (project.businessName || "my-site")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-+/g, "-") // Replace multiple hyphens with single
        .substring(0, 30)

      // Ensure at least 6 characters and valid format
      const baseName = sanitizedName.length >= 6 ? sanitizedName : "site-" + sanitizedName
      const timestamp = Date.now().toString(36)
      
      // Combine base name with timestamp, ensuring total length is 6-30 chars
      fbProjectId = `${baseName}-${timestamp}`.substring(0, 30)
      
      // Validate Firebase project ID format
      if (!/^[a-z][a-z0-9-]*[a-z0-9]$/.test(fbProjectId)) {
        fbProjectId = `site-${timestamp}`
      }
      
      console.log("[Firebase REST] Generated project ID:", fbProjectId)
    }

    const siteId = fbProjectId // Site ID is usually the same as project ID

    // Check if Firebase project exists
    const projectExists = await checkFirebaseProject(fbProjectId, accessToken)
    if (!projectExists) {
      return NextResponse.json(
        {
          message: "Firebase project does not exist",
          details: `The Firebase project '${fbProjectId}' does not exist. Please create it manually at https://console.firebase.google.com/ and ensure Firebase Hosting is enabled.`,
          instructions: [
            "1. Go to https://console.firebase.google.com/",
            "2. Click 'Add project' or select an existing project",
            `3. Use project ID: ${fbProjectId}`,
            "4. Navigate to 'Hosting' in the left menu",
            "5. Click 'Get started' to initialize Hosting",
            "6. Return here and try deploying again",
          ],
          helpUrl: "https://console.firebase.google.com/",
        },
        { status: 404 },
      )
    }

    // Check if hosting is initialized
    const hostingInitialized = await checkHostingInitialized(fbProjectId, siteId, accessToken)
    if (!hostingInitialized) {
      return NextResponse.json(
        {
          message: "Firebase Hosting not initialized",
          details: `Hosting is not initialized for site '${siteId}' in project '${fbProjectId}'.`,
          instructions: [
            "1. Go to https://console.firebase.google.com/",
            `2. Select your project: ${fbProjectId}`,
            "3. Navigate to 'Hosting' in the left menu",
            "4. Click 'Get started' if hosting is not set up",
            "5. Return here and try deploying again",
          ],
          helpUrl: `https://console.firebase.google.com/project/${fbProjectId}/hosting`,
        },
        { status: 404 },
      )
    }

    // Prepare files for deployment
    const filesToDeploy: Array<{ path: string; content: string }> = []
    const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file (Firebase limit)
    const MAX_TOTAL_SIZE = 50 * 1024 * 1024 // 50MB total (reasonable limit)
    let totalSize = 0

    if (project.pages && project.pages.length > 0) {
      for (const page of project.pages) {
        let filePath = page.name
        if (!filePath.startsWith("/")) {
          filePath = "/" + filePath
        }

        const fileSize = Buffer.byteLength(page.content, "utf-8")
        
        // Check individual file size
        if (fileSize > MAX_FILE_SIZE) {
          return NextResponse.json(
            {
              message: "File too large",
              details: `File "${filePath}" is ${(fileSize / 1024 / 1024).toFixed(2)}MB, which exceeds the 10MB limit.`,
            },
            { status: 413 },
          )
        }
        
        totalSize += fileSize
        
        // Check total deployment size
        if (totalSize > MAX_TOTAL_SIZE) {
          return NextResponse.json(
            {
              message: "Deployment too large",
              details: `Total deployment size exceeds ${(MAX_TOTAL_SIZE / 1024 / 1024).toFixed(0)}MB. Consider splitting your deployment or reducing file sizes.`,
            },
            { status: 413 },
          )
        }

        filesToDeploy.push({
          path: filePath,
          content: page.content,
        })
      }
    } else {
      // Create a placeholder index.html
      const placeholderHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.businessName || "My Website"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; display: flex; align-items: center; justify-content: center; }
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

      filesToDeploy.push({
        path: "/index.html",
        content: placeholderHtml,
      })
    }

    console.log("[Firebase REST] Prepared", filesToDeploy.length, "files for deployment")

    // Step 1: Create hosting version
    const { name: versionName } = await createHostingVersion(fbProjectId, siteId, accessToken)

    // Step 2: Upload files
    await uploadFiles(versionName, filesToDeploy, accessToken)

    // Step 3: Finalize version
    await finalizeVersion(versionName, accessToken)

    // Step 4: Create release
    const deploymentChannel = channel || "live"
    const releaseName = await createRelease(fbProjectId, siteId, versionName, accessToken, deploymentChannel)

    // Construct the deployment URL
    const deploymentUrl =
      deploymentChannel === "live"
        ? `https://${siteId}.web.app`
        : `https://${siteId}--${deploymentChannel}.web.app`

    // Update project with deployment info
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          firebaseProjectId: fbProjectId,
          firebaseDeployedAt: new Date(),
          firebaseUrl: deploymentUrl,
          updatedAt: new Date(),
        },
      },
    )

    console.log("[Firebase REST] Deployment successful! URL:", deploymentUrl)

    return NextResponse.json({
      success: true,
      message: "Deployment successful",
      url: deploymentUrl,
      projectId: fbProjectId,
      siteId,
      versionName,
      releaseName,
      channel: deploymentChannel,
    })
  } catch (error: any) {
    console.error("[Firebase REST] Deployment error:", error)

    // Handle specific error cases
    if (error.message.includes("No Firebase authentication found")) {
      return NextResponse.json(
        {
          message: "Authentication required",
          details: "Please authenticate with Google to deploy to Firebase.",
          error: error.message,
        },
        { status: 401 },
      )
    }

    if (error.message.includes("Failed to refresh access token")) {
      return NextResponse.json(
        {
          message: "Token refresh failed",
          details: "Your Firebase access token has expired and could not be refreshed. Please re-authenticate.",
          error: error.message,
        },
        { status: 401 },
      )
    }

    if (error.message.includes("PERMISSION_DENIED") || error.message.includes("403")) {
      return NextResponse.json(
        {
          message: "Permission denied",
          details:
            "You don't have permission to deploy to this Firebase project. Please check that you have the necessary permissions in the Firebase console.",
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
  }
}
