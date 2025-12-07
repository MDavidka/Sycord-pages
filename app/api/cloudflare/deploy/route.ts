import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

/**
 * Helper to make Cloudflare API calls with retry logic
 */
async function cloudflareApiCall(
  url: string,
  options: RequestInit,
  apiToken: string,
  retries = 3
): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
  }

  if (options.headers) {
    Object.assign(headers, options.headers)
  }

  let lastError: any
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`[Cloudflare] DEBUG: API call attempt ${i + 1}/${retries} to ${url}`)
      const response = await fetch(url, { ...options, headers })

      console.log(`[Cloudflare] DEBUG: Response status: ${response.status} ${response.statusText}`)
      
      if (response.ok || response.status === 404 || response.status === 409) {
        return response
      }

      const errorData = await response.json().catch(() => ({
        error: response.statusText,
        status: response.status,
      }))

      console.error(`[Cloudflare] API call failed (attempt ${i + 1}/${retries}):`, {
        url,
        status: response.status,
        error: errorData,
      })

      lastError = errorData

      if (i < retries - 1) {
        const waitTime = 1000 * (i + 1)
        console.log(`[Cloudflare] DEBUG: Retrying in ${waitTime}ms...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    } catch (error) {
      console.error(`[Cloudflare] Request error (attempt ${i + 1}/${retries}):`, error)
      lastError = error

      if (i < retries - 1) {
        const waitTime = 1000 * (i + 1)
        console.log(`[Cloudflare] DEBUG: Retrying in ${waitTime}ms...`)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  throw new Error(`API call failed after ${retries} retries: ${JSON.stringify(lastError)}`)
}

/**
 * Create or get Cloudflare Pages project
 */
async function ensureProject(
  accountId: string,
  projectName: string,
  apiToken: string
): Promise<void> {
  console.log(`[Cloudflare] Checking if project exists: ${projectName}`)

  const checkResponse = await cloudflareApiCall(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}`,
    { method: "GET" },
    apiToken,
    1
  )

  if (checkResponse.ok) {
    console.log("[Cloudflare] ✅ Project exists")
    return
  }

  // Project doesn't exist, create it
  console.log("[Cloudflare] Creating new Pages project...")

  const createResponse = await cloudflareApiCall(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: projectName,
        production_branch: "main",
      }),
    },
    apiToken
  )

  if (!createResponse.ok) {
    const errorData = await createResponse.json()
    throw new Error(`Failed to create project: ${JSON.stringify(errorData)}`)
  }

  console.log("[Cloudflare] ✅ Project created")
}

/**
 * Deploy to Cloudflare Pages using Direct Upload
 */
async function deployToCloudflare(
  accountId: string,
  projectName: string,
  files: Array<{ path: string; content: string }>,
  apiToken: string
): Promise<{ url: string; deploymentId: string }> {
  console.log(`[Cloudflare] Starting deployment to ${projectName}`)

  // Ensure project exists
  await ensureProject(accountId, projectName, apiToken)

  // Create deployment
  console.log("[Cloudflare] Creating deployment...")
  console.log(`[Cloudflare] DEBUG: Creating deployment for project: ${projectName}`)
  console.log(`[Cloudflare] DEBUG: Branch: main, Stage: production`)
  
  const deployResponse = await cloudflareApiCall(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch: "main",
        stage: "production", // Required: "production" or "preview"
      }),
    },
    apiToken
  )

  if (!deployResponse.ok) {
    const errorData = await deployResponse.json()
    throw new Error(`Failed to create deployment: ${JSON.stringify(errorData)}`)
  }

  const deployData = await deployResponse.json()
  console.log(`[Cloudflare] DEBUG: Deploy response:`, JSON.stringify(deployData, null, 2))
  
  const uploadUrl = deployData.result?.upload_url
  const deploymentId = deployData.result?.id
  const stage = deployData.result?.stage

  if (!uploadUrl) {
    console.error("[Cloudflare] ERROR: No upload URL in response:", deployData)
    throw new Error("No upload URL received from Cloudflare. Response: " + JSON.stringify(deployData))
  }

  console.log(`[Cloudflare] ✅ Deployment created (ID: ${deploymentId}, Stage: ${stage})`)
  console.log(`[Cloudflare] DEBUG: Upload URL: ${uploadUrl.substring(0, 50)}...`)
  console.log("[Cloudflare] Uploading files...")

  // Upload files as a zip/tarball or using the manifest
  // For simplicity, we'll upload files one by one or create a manifest
  // Cloudflare Pages expects files in a specific format
  
  // Create file manifest
  const manifest: Record<string, string> = {}
  for (const file of files) {
    // Convert content to base64
    const base64Content = Buffer.from(file.content, "utf-8").toString("base64")
    manifest[file.path] = base64Content
    console.log(`[Cloudflare] DEBUG: Adding file: ${file.path} (${file.content.length} bytes, ${base64Content.length} base64 chars)`)
  }

  console.log(`[Cloudflare] DEBUG: Total files in manifest: ${Object.keys(manifest).length}`)

  // Upload manifest
  const uploadResponse = await cloudflareApiCall(
    uploadUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manifest }),
    },
    apiToken
  )

  if (!uploadResponse.ok) {
    const errorData = await uploadResponse.json().catch(() => ({ error: "Unknown error" }))
    console.error("[Cloudflare] ERROR: Failed to upload files:", errorData)
    throw new Error(`Failed to upload files: ${JSON.stringify(errorData)}`)
  }

  const uploadData = await uploadResponse.json()
  console.log(`[Cloudflare] DEBUG: Upload response:`, JSON.stringify(uploadData, null, 2))
  console.log("[Cloudflare] ✅ Files uploaded successfully")

  // Construct the deployment URL
  const deploymentUrl = `https://${projectName}.pages.dev`

  return {
    url: deploymentUrl,
    deploymentId: deploymentId || "unknown",
  }
}

/**
 * POST /api/cloudflare/deploy
 * Deploy a project to Cloudflare Pages
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, cloudflareProjectName } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Get Cloudflare credentials
    const tokenDoc = await db.collection("cloudflare_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId: session.user.email,
    })

    if (!tokenDoc) {
      return NextResponse.json(
        { error: "No Cloudflare credentials found. Please authenticate first." },
        { status: 400 }
      )
    }

    // Get project data
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.email,
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Determine project name
    let cfProjectName = cloudflareProjectName || project.cloudflareProjectName

    if (!cfProjectName) {
      // Generate a project name from the project title
      cfProjectName = project.name
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 58) // Cloudflare has length limits
    }

    // Get pages to deploy
    const pages = await db
      .collection("pages")
      .find({ projectId: new ObjectId(projectId) })
      .toArray()

    if (pages.length === 0) {
      return NextResponse.json(
        { error: "No pages found in project" },
        { status: 400 }
      )
    }

    // Convert pages to files
    const files: Array<{ path: string; content: string }> = []

    for (const page of pages) {
      const fileName = page.name === "index" ? "index.html" : `${page.name}.html`
      files.push({
        path: `/${fileName}`,
        content: page.content || "",
      })
    }

    // Deploy to Cloudflare
    console.log(`[Cloudflare] Deploying ${files.length} files...`)
    console.log(`[Cloudflare] DEBUG: Account ID: ${tokenDoc.accountId.substring(0, 8)}...`)
    console.log(`[Cloudflare] DEBUG: Project name: ${cfProjectName}`)
    console.log(`[Cloudflare] DEBUG: Files to deploy:`, files.map(f => ({ path: f.path, size: f.content.length })))

    const { url, deploymentId } = await deployToCloudflare(
      tokenDoc.accountId,
      cfProjectName,
      files,
      tokenDoc.apiToken
    )

    console.log(`[Cloudflare] DEBUG: Deployment result - URL: ${url}, ID: ${deploymentId}`)

    // Update project with deployment info
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          cloudflareProjectName: cfProjectName,
          cloudflareUrl: url,
          cloudflareDeployedAt: new Date(),
          cloudflareDeploymentId: deploymentId,
        },
      }
    )

    console.log(`[Cloudflare] 🎉 Deployment successful: ${url}`)

    return NextResponse.json({
      success: true,
      url,
      deploymentId,
      projectName: cfProjectName,
    })
  } catch (error: any) {
    console.error("[Cloudflare] Deployment error:", error)
    return NextResponse.json(
      { error: error.message || "Deployment failed" },
      { status: 500 }
    )
  }
}
