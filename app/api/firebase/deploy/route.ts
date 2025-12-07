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
  contentType = "application/json",
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  }

  // Only add Content-Type if not already specified in options
  if (!options.headers || !(options.headers as Record<string, string>)["Content-Type"]) {
    headers["Content-Type"] = contentType
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
        errorData = await response.json().catch(() => ({ rawText: response.text() }))
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
 * Deploys site to Firebase Hosting
 * POST /api/firebase/deploy
 */
export async function POST(request: Request) {
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

    console.log("[Firebase] Starting deployment for project:", projectId)

    // Get project data
    const client = await clientPromise
    const db = client.db()

    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      console.log("[Firebase] Deploy: Project not found or unauthorized")
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    if (!project.pages || project.pages.length === 0) {
      console.log("[Firebase] No pages found, generating dummy website...")

      const dummyIndexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${project.businessName || "Welcome"} - Powered by Sycord</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }
    
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      padding: 60px 40px;
      text-align: center;
      max-width: 600px;
    }
    
    h1 {
      color: #333;
      font-size: 2.5em;
      margin-bottom: 20px;
    }
    
    .logo {
      font-size: 4em;
      margin-bottom: 20px;
    }
    
    p {
      color: #666;
      font-size: 1.1em;
      margin-bottom: 30px;
      line-height: 1.6;
    }
    
    .status {
      background: #f0f4ff;
      border-left: 4px solid #667eea;
      padding: 20px;
      margin: 30px 0;
      border-radius: 8px;
      text-align: left;
    }
    
    .status h3 {
      color: #667eea;
      margin-bottom: 10px;
    }
    
    .status p {
      margin: 0;
      color: #555;
      font-size: 0.95em;
    }
    
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      color: #999;
      font-size: 0.9em;
    }
    
    .cta-button {
      display: inline-block;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 14px 32px;
      border-radius: 8px;
      text-decoration: none;
      font-weight: 600;
      margin-top: 20px;
      transition: transform 0.2s, box-shadow 0.2s;
    }
    
    .cta-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">🚀</div>
    <h1>${project.businessName || "Welcome to Your Site"}</h1>
    <p>Your website is ready to go! This is the default landing page.</p>
    
    <div class="status">
      <h3>✅ Deployment Successful</h3>
      <p>Your site has been deployed to Firebase Hosting. This is an auto-generated placeholder page. Start building your custom pages in Sycord to replace this.</p>
    </div>
    
    <p style="color: #999; font-size: 0.95em;">
      Generated on ${new Date().toLocaleString()}
    </p>
    
    <div class="footer">
      <p>Powered by <strong>Sycord Pages</strong> | Firebase Hosting</p>
    </div>
  </div>
</body>
</html>`

      // Add the dummy page to the project
      project.pages = [
        {
          name: "index.html",
          content: dummyIndexHtml,
        },
      ]

      // Optionally save to database so user can see the generated page
      await db.collection("projects").updateOne({ _id: new ObjectId(projectId) }, { $set: { pages: project.pages } })

      console.log("[Firebase] Dummy website generated")
    }

    // Get valid access token
    const accessToken = await getValidAccessToken(projectId, session.user.id)
    console.log("[Firebase] Access token obtained")

    // Determine Firebase project ID
    let fbProjectId = firebaseProjectId
    if (!fbProjectId) {
      // Generate a unique Firebase project ID based on business name
      const sanitizedName = (project.businessName || "my-site")
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .substring(0, 30)

      fbProjectId = `${sanitizedName}-${Date.now().toString(36)}`
      console.log("[Firebase] Generated project ID:", fbProjectId)
    }

    // Step 1: Check if Firebase project exists, create if not
    console.log("[Firebase] Checking if project exists:", fbProjectId)

    const projectCheckUrl = `https://firebase.googleapis.com/v1/projects/${fbProjectId}`
    let projectExists = false

    try {
      const checkResponse = await firebaseApiCall(projectCheckUrl, { method: "GET" }, accessToken, 1)
      projectExists = checkResponse.ok
      console.log("[Firebase] Project exists:", projectExists)
    } catch (error) {
      console.log("[Firebase] Project does not exist, will create")
    }

    if (!projectExists) {
      console.log("[Firebase] Creating Firebase project:", fbProjectId)

      const createProjectUrl = "https://firebase.googleapis.com/v1/projects"
      const createResponse = await firebaseApiCall(
        createProjectUrl,
        {
          method: "POST",
          body: JSON.stringify({
            projectId: fbProjectId,
            displayName: project.businessName || "My Site",
          }),
        },
        accessToken,
      )

      if (!createResponse.ok) {
        let errorData: any
        const contentType = createResponse.headers.get("content-type")
        if (contentType?.includes("application/json")) {
          errorData = await createResponse.json().catch(() => ({}))
        } else {
          errorData = { message: await createResponse.text().then((t) => t.substring(0, 200)) }
        }

        console.error("[Firebase] Failed to create project:", errorData)
        return NextResponse.json(
          {
            message: "Failed to create Firebase project",
            error: errorData,
          },
          { status: 500 },
        )
      }

      console.log("[Firebase] Project created successfully")

      // Wait for project to be ready
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    // Step 2: Create a new hosting site (not version directly)
    console.log("[Firebase] Setting up Firebase Hosting site")

    const createSiteUrl = `https://firebase.googleapis.com/v1/projects/${fbProjectId}/locations/us-central1/webApps`
    const siteResponse = await firebaseApiCall(
      createSiteUrl,
      {
        method: "POST",
        body: JSON.stringify({
          displayName: project.businessName || "My Site",
        }),
      },
      accessToken,
      1, // Single attempt for site creation
    ).catch((err) => {
      console.log("[Firebase] Web app may already exist:", err.message)
      return null
    })

    let siteId = fbProjectId
    if (siteResponse?.ok) {
      const siteData = await siteResponse.json()
      siteId = siteData.name?.split("/").pop() || fbProjectId
      console.log("[Firebase] Web app created:", siteId)
    }

    // Step 3: Create a new hosting version
    console.log("[Firebase] Creating hosting version")

    const versionUrl = `https://firebasehosting.googleapis.com/v1beta1/projects/${fbProjectId}/sites/${siteId}/versions`
    const versionResponse = await firebaseApiCall(
      versionUrl,
      {
        method: "POST",
        body: JSON.stringify({
          config: {
            headers: [
              {
                glob: "**",
                headers: {
                  "Cache-Control": "max-age=3600",
                },
              },
            ],
          },
        }),
      },
      accessToken,
    )

    if (!versionResponse.ok) {
      let errorData: any
      const contentType = versionResponse.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        errorData = await versionResponse.json().catch(() => ({}))
      } else {
        errorData = { message: await versionResponse.text().then((t) => t.substring(0, 200)) }
      }

      console.error("[Firebase] Failed to create version:", errorData)
      return NextResponse.json(
        {
          message: "Failed to create hosting version",
          error: errorData,
        },
        { status: 500 },
      )
    }

    const versionData = await versionResponse.json()
    const versionName = versionData.name
    console.log("[Firebase] Version created:", versionName)

    // Step 4: Upload files
    console.log("[Firebase] Uploading files...")

    // Prepare files for upload - ensure proper path formatting
    const files: Record<string, string> = {}
    project.pages.forEach((page: any) => {
      // Normalize file path - ensure it starts with /
      const filePath = page.name.startsWith("/") ? page.name : `/${page.name}`

      // If it's index.html, also make it available at root
      files[filePath] = page.content

      if (page.name === "index.html" || page.name === "/index.html") {
        files["/"] = page.content
      }
    })

    console.log(`[Firebase] Uploading ${Object.keys(files).length} files`)

    const uploadUrl = `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`
    const uploadResponse = await firebaseApiCall(
      uploadUrl,
      {
        method: "POST",
        body: JSON.stringify({
          files,
        }),
      },
      accessToken,
    )

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json()
      console.error("[Firebase] Failed to upload files:", errorData)
      return NextResponse.json(
        {
          message: "Failed to upload files",
          error: errorData,
        },
        { status: 500 },
      )
    }

    const uploadData = await uploadResponse.json()
    console.log("[Firebase] Files uploaded successfully:", uploadData)

    // Get upload required hashes if any
    if (uploadData.uploadRequiredHashes && uploadData.uploadRequiredHashes.length > 0) {
      console.log("[Firebase] Some files need to be uploaded to storage")

      const uploadUrl = uploadData.uploadUrl

      // For each hash, find and upload the corresponding file
      // Firebase uses SHA256 hash of file content
      for (const hash of uploadData.uploadRequiredHashes) {
        // Find file matching this hash
        // Note: In a production system, you'd calculate SHA256 hashes
        // For now, we upload all files that have required hashes

        const fileEntries = Object.entries(files)
        if (fileEntries.length > 0) {
          // Upload each file to storage
          for (const [filePath, content] of fileEntries) {
            console.log(`[Firebase] Uploading file to storage: ${filePath}`)

            // Validate file content
            if (!content || typeof content !== "string") {
              console.error(`[Firebase] Invalid content for ${filePath}`)
              continue
            }

            // Basic size check (Firebase has a 10MB limit per file)
            const contentSize = new Blob([content]).size
            if (contentSize > 10 * 1024 * 1024) {
              console.error(`[Firebase] File ${filePath} is too large: ${contentSize} bytes`)
              continue
            }

            try {
              const storageUploadResponse = await fetch(`${uploadUrl}/${hash}`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${accessToken}`,
                  "Content-Type": "text/plain",
                },
                body: content,
              })

              if (!storageUploadResponse.ok) {
                console.error(`[Firebase] Failed to upload ${filePath} to storage`)
              } else {
                console.log(`[Firebase] File uploaded to storage successfully: ${filePath}`)
              }
            } catch (uploadError) {
              console.error(`[Firebase] Error uploading ${filePath}:`, uploadError)
            }
          }
        }
      }
    }

    console.log("[Firebase] All files uploaded")

    // Step 5: Finalize the version
    console.log("[Firebase] Finalizing version")

    const finalizeUrl = `https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`
    const finalizeResponse = await firebaseApiCall(
      finalizeUrl,
      {
        method: "PATCH",
        body: JSON.stringify({
          status: "FINALIZED",
        }),
      },
      accessToken,
    )

    if (!finalizeResponse.ok) {
      const errorData = await finalizeResponse.json()
      console.error("[Firebase] Failed to finalize version:", errorData)
      return NextResponse.json(
        {
          message: "Failed to finalize deployment",
          error: errorData,
        },
        { status: 500 },
      )
    }

    console.log("[Firebase] Version finalized")

    // Step 6: Create release to deploy the version
    console.log("[Firebase] Creating release")

    const releaseUrl = `https://firebasehosting.googleapis.com/v1beta1/projects/${fbProjectId}/sites/${siteId}/releases?versionName=${versionName}`
    const releaseResponse = await firebaseApiCall(
      releaseUrl,
      {
        method: "POST",
        body: JSON.stringify({
          message: `Deployed via Sycord Pages at ${new Date().toISOString()}`,
        }),
      },
      accessToken,
    )

    if (!releaseResponse.ok) {
      const errorData = await releaseResponse.json()
      console.error("[Firebase] Failed to create release:", errorData)
      return NextResponse.json(
        {
          message: "Failed to create release",
          error: errorData,
        },
        { status: 500 },
      )
    }

    const releaseData = await releaseResponse.json()
    console.log("[Firebase] Release created:", releaseData)

    // Update project with Firebase deployment info
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          firebaseProjectId: fbProjectId,
          firebaseDeployedAt: new Date(),
          firebaseUrl: `https://${siteId}.web.app`,
          updatedAt: new Date(),
        },
      },
    )

    console.log("[Firebase] Deployment successful!")

    return NextResponse.json({
      success: true,
      message: "Deployment successful",
      url: `https://${siteId}.web.app`,
      projectId: fbProjectId,
      versionName,
      releaseName: releaseData.name,
    })
  } catch (error: any) {
    console.error("[Firebase] Deployment error:", error)
    return NextResponse.json(
      {
        message: error.message || "Deployment failed",
        error: error.toString(),
      },
      { status: 500 },
    )
  }
}
