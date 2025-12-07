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
  retries = 3
): Promise<Response> {
  const headers = {
    ...options.headers,
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  }

  let lastError: any
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers })
      
      if (response.ok || response.status === 404 || response.status === 409) {
        return response
      }

      const errorData = await response.json().catch(() => ({}))
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
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)))
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
      return NextResponse.json({ message: "Project not found" }, { status: 404 })
    }

    if (!project.pages || project.pages.length === 0) {
      return NextResponse.json({ 
        message: "No pages to deploy. Please generate your website first." 
      }, { status: 400 })
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
    
    const projectCheckUrl = `https://firebase.googleapis.com/v1beta1/projects/${fbProjectId}`
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
      
      const createProjectUrl = "https://firebase.googleapis.com/v1beta1/projects"
      const createResponse = await firebaseApiCall(
        createProjectUrl,
        {
          method: "POST",
          body: JSON.stringify({
            projectId: fbProjectId,
            displayName: project.businessName || "My Site",
          }),
        },
        accessToken
      )

      if (!createResponse.ok) {
        const errorData = await createResponse.json()
        console.error("[Firebase] Failed to create project:", errorData)
        return NextResponse.json({ 
          message: "Failed to create Firebase project",
          error: errorData,
        }, { status: 500 })
      }

      console.log("[Firebase] Project created successfully")
      
      // Wait for project to be ready
      await new Promise(resolve => setTimeout(resolve, 3000))
    }

    // Step 2: Create a new hosting version
    console.log("[Firebase] Creating hosting version")
    
    const versionUrl = `https://firebasehosting.googleapis.com/v1beta1/sites/${fbProjectId}/versions`
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
      accessToken
    )

    if (!versionResponse.ok) {
      const errorData = await versionResponse.json()
      console.error("[Firebase] Failed to create version:", errorData)
      return NextResponse.json({ 
        message: "Failed to create hosting version",
        error: errorData,
      }, { status: 500 })
    }

    const versionData = await versionResponse.json()
    const versionName = versionData.name
    console.log("[Firebase] Version created:", versionName)

    // Step 3: Upload files one by one
    console.log("[Firebase] Uploading files...")
    
    const uploadPromises = project.pages.map(async (page: any, index: number) => {
      const filePath = `/${page.name}`
      const fileContent = page.content

      console.log(`[Firebase] Uploading file ${index + 1}/${project.pages.length}:`, filePath)

      const uploadUrl = `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`
      const uploadResponse = await firebaseApiCall(
        uploadUrl,
        {
          method: "POST",
          body: JSON.stringify({
            files: {
              [filePath]: Buffer.from(fileContent).toString("base64"),
            },
          }),
        },
        accessToken
      )

      if (!uploadResponse.ok) {
        const errorData = await uploadResponse.json()
        console.error(`[Firebase] Failed to upload ${filePath}:`, errorData)
        throw new Error(`Failed to upload ${filePath}`)
      }

      console.log(`[Firebase] File uploaded successfully:`, filePath)
    })

    await Promise.all(uploadPromises)
    console.log("[Firebase] All files uploaded")

    // Step 4: Finalize the version
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
      accessToken
    )

    if (!finalizeResponse.ok) {
      const errorData = await finalizeResponse.json()
      console.error("[Firebase] Failed to finalize version:", errorData)
      return NextResponse.json({ 
        message: "Failed to finalize deployment",
        error: errorData,
      }, { status: 500 })
    }

    console.log("[Firebase] Version finalized")

    // Step 5: Create release to deploy the version
    console.log("[Firebase] Creating release")
    
    const releaseUrl = `https://firebasehosting.googleapis.com/v1beta1/sites/${fbProjectId}/releases?versionName=${versionName}`
    const releaseResponse = await firebaseApiCall(
      releaseUrl,
      {
        method: "POST",
        body: JSON.stringify({
          message: `Deployed via Sycord Pages at ${new Date().toISOString()}`,
        }),
      },
      accessToken
    )

    if (!releaseResponse.ok) {
      const errorData = await releaseResponse.json()
      console.error("[Firebase] Failed to create release:", errorData)
      return NextResponse.json({ 
        message: "Failed to create release",
        error: errorData,
      }, { status: 500 })
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
          firebaseUrl: `https://${fbProjectId}.web.app`,
          updatedAt: new Date(),
        },
      }
    )

    console.log("[Firebase] Deployment successful!")

    return NextResponse.json({
      success: true,
      message: "Deployment successful",
      url: `https://${fbProjectId}.web.app`,
      projectId: fbProjectId,
      versionName,
      releaseName: releaseData.name,
    })
  } catch (error: any) {
    console.error("[Firebase] Deployment error:", error)
    return NextResponse.json({ 
      message: error.message || "Deployment failed",
      error: error.toString(),
    }, { status: 500 })
  }
}
