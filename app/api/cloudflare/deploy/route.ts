import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import crypto from "crypto"

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
      console.log(`[Cloudflare] DEBUG: API call attempt ${i + 1}/${retries}`)
      const response = await fetch(url, { ...options, headers })

      console.log(`[Cloudflare] DEBUG: Response status: ${response.status} ${response.statusText}`)
      
      // Don't retry on auth errors
      if (response.status === 401 || response.status === 403) {
        console.error(`[Cloudflare] Auth error: ${response.status}`)
        return response
      }

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

  if (checkResponse.status === 401 || checkResponse.status === 403) {
    const err = await checkResponse.json().catch(() => ({}))
    const msg = err.errors?.[0]?.message || "Check your API Token permissions"
    throw new Error(`Cloudflare Access Denied (${checkResponse.status}): ${msg}`)
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
        build_config: {
          build_command: "",
          destination_dir: "dist",
          root_dir: ""
        },
        deployment_configs: {
          production: {
            compatibility_flags: [],
            compatibility_date: "2024-01-01"
          }
        }
      }),
    },
    apiToken
  )

  if (!createResponse.ok) {
    const errorData = await createResponse.json()
    throw new Error(`Failed to create project: ${JSON.stringify(errorData)}`)
  }

  console.log("[Cloudflare] ✅ Project created")

  // Wait for propagation
  // Increased wait time to 5 seconds to ensure project is available for deployment
  await new Promise(resolve => setTimeout(resolve, 5000))
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

  // Calculate file hashes (SHA-256)
  const fileHashes: Record<string, string> = {}
  const fileContents: Record<string, string> = {}

  for (const file of files) {
    const hash = crypto.createHash('sha256').update(file.content).digest('hex')
    // Normalize path: must start with / for manifest, but Cloudflare sometimes wants it without leading slash?
    // Docs say: keys are paths.
    let cleanPath = file.path
    if (!cleanPath.startsWith('/')) cleanPath = '/' + cleanPath

    fileHashes[cleanPath] = hash
    fileContents[hash] = file.content
  }

  // Create deployment
  console.log("[Cloudflare] Creating deployment...")
  console.log(`[Cloudflare] DEBUG: Creating deployment for project: ${projectName}`)
  console.log(`[Cloudflare] DEBUG: Branch: main, Stage: production`)
  
  // We MUST send the manifest here to get the list of missing files
  const deployResponse = await cloudflareApiCall(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        branch: "main",
        stage: "production", // Required: "production" or "preview"
        manifest: fileHashes // Map of path -> sha256
      }),
    },
    apiToken
  )

  if (!deployResponse.ok) {
    const errorData = await deployResponse.json()
    throw new Error(`Failed to create deployment: ${JSON.stringify(errorData)}`)
  }

  const deployData = await deployResponse.json()
  console.log(`[Cloudflare] DEBUG: Deploy response status: ${deployResponse.status}, has upload_url: ${!!deployData.result?.upload_url}`)
  
  const uploadUrl = deployData.result?.upload_url
  const deploymentId = deployData.result?.id
  const stage = deployData.result?.stage

  if (!uploadUrl) {
    console.error("[Cloudflare] ERROR: No upload URL in response. Success:", deployData.success)
    throw new Error("No upload URL received from Cloudflare. Check API permissions and project settings.")
  }

  console.log(`[Cloudflare] ✅ Deployment created (ID: ${deploymentId}, Stage: ${stage})`)
  console.log("[Cloudflare] Uploading files...")

  // Upload manifest
  // Use FormData to upload files directly
  // Keys must be the SHA-256 HASHES, values are the content
  const formData = new FormData()

  // We should ideally only upload files that Cloudflare says are missing,
  // but for simplicity/robustness with small sites, we can try to upload everything
  // or check if 'deployData.result.files' exists (v2 often returns hashes needed).
  // However, overwriting is generally safe/ignored if exists.

  for (const [hash, content] of Object.entries(fileContents)) {
    const blob = new Blob([content], { type: 'text/html' }) // Content-Type guess
    formData.append(hash, blob)
  }

  // We don't send Authorization header to the upload_url as it's a JWT url
  // The uploadUrl already contains the necessary authentication

  const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      // FormData sets the Content-Type header automatically with boundary
      body: formData,
      headers: {
        // Authorization header is NOT needed for the upload_url (it is a signed JWT URL)
        // But we DO need User-Agent usually
         "User-Agent": "Cloudflare-Pages-Deployer/1.0"
      }
  })

  if (!uploadResponse.ok) {
    const statusText = uploadResponse.statusText || 'Upload failed'
    console.error(`[Cloudflare] ERROR: Failed to upload files. Status: ${uploadResponse.status} ${statusText}`)
    throw new Error(`Failed to upload files: HTTP ${uploadResponse.status} - ${statusText}`)
  }

  const uploadData = await uploadResponse.json()
  console.log(`[Cloudflare] DEBUG: Upload successful, received confirmation`)
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
    // Projects are owned by user.id, not email
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      console.error(`[Cloudflare] Project not found in DB: ${projectId} for user ${session.user.id}`)
      return NextResponse.json({ error: "Local project not found. Please ensure you are logged in and own this project." }, { status: 404 })
    }

    // Determine project name
    let cfProjectName = cloudflareProjectName || project.cloudflareProjectName

    if (!cfProjectName) {
      // Generate a project name from the project title or fallback
      const baseName = project.name || project.businessName || `project-${projectId}`

      cfProjectName = baseName
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

    // Convert pages to files
    const files: Array<{ path: string; content: string }> = []

    if (pages.length === 0) {
      // Create a default starter page if no pages exist
      console.log("[Cloudflare] No pages found, deploying default starter page")
      const title = project.businessName || project.name || "My Website"
      const defaultContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background-color: #f3f4f6; color: #1f2937; }
        .card { background: white; padding: 3rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1); text-align: center; max-width: 28rem; width: 90%; }
        h1 { margin-bottom: 1rem; font-size: 2rem; font-weight: 700; color: #111827; }
        p { color: #6b7280; line-height: 1.6; margin-bottom: 1.5rem; }
        .badge { display: inline-block; padding: 0.25rem 0.75rem; background-color: #e5e7eb; color: #374151; border-radius: 9999px; font-size: 0.875rem; font-weight: 500; }
    </style>
</head>
<body>
    <div class="card">
        <h1>${title}</h1>
        <p>This website is currently under construction. Check back soon for updates!</p>
        <div class="badge">Deployed via Cloudflare Pages</div>
    </div>
</body>
</html>`

      files.push({
        path: "/index.html",
        content: defaultContent,
      })
    } else {
      for (const page of pages) {
        const fileName = page.name === "index" ? "index.html" : `${page.name}.html`
        files.push({
          path: `/${fileName}`,
          content: page.content || "",
        })
      }
    }

    // Deploy to Cloudflare
    console.log(`[Cloudflare] Deploying ${files.length} files...`)
    console.log(`[Cloudflare] DEBUG: Account ID: configured`)
    console.log(`[Cloudflare] DEBUG: Project name: ${cfProjectName}`)
    console.log(`[Cloudflare] DEBUG: Total file size: ${files.reduce((sum, f) => sum + f.content.length, 0)} bytes`)

    const { url, deploymentId } = await deployToCloudflare(
      tokenDoc.accountId,
      cfProjectName,
      files,
      tokenDoc.apiToken
    )

    console.log(`[Cloudflare] DEBUG: Deployment successful - ID: ${deploymentId}`)

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
