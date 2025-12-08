import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import crypto from "crypto"
import archiver from "archiver"
import FormData from "form-data"

/**
 * Cloudflare API Configuration
 */
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4"

/**
 * Interface for file objects used in deployment
 */
interface DeployFile {
  path: string
  content: string | Buffer
}

/**
 * Helper to make Cloudflare API calls with retry logic
 */
async function cloudflareApiCall(url: string, options: RequestInit, apiToken: string, retries = 3): Promise<Response> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
  }

  // Merge headers
  if (options.headers) {
    Object.assign(headers, options.headers)
  }

  let lastError: any
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers })

      // Don't retry on auth errors (401, 403) or 4xx client errors (unless it's rate limiting)
      if (response.status === 401 || response.status === 403) {
        console.error(`[Cloudflare] Auth error: ${response.status}`)
        return response
      }

      if (response.ok) {
        return response
      }

      if (response.status < 500 && response.status !== 429) {
        return response
      }

      const errorText = await response.text()
      console.error(`[Cloudflare] API call failed (attempt ${i + 1}/${retries}):`, {
        url,
        status: response.status,
        error: errorText,
      })

      lastError = errorText

      if (i < retries - 1) {
        const waitTime = 1000 * Math.pow(2, i) // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    } catch (error) {
      console.error(`[Cloudflare] Request error (attempt ${i + 1}/${retries}):`, error)
      lastError = error

      if (i < retries - 1) {
        const waitTime = 1000 * Math.pow(2, i)
        await new Promise((resolve) => setTimeout(resolve, waitTime))
      }
    }
  }

  throw new Error(`API call failed after ${retries} retries: ${lastError}`)
}

/**
 * Get or create Cloudflare Pages project and return details
 */
async function getOrCreateProject(
  accountId: string,
  projectName: string,
  apiToken: string,
): Promise<{ subdomain: string; name: string }> {
  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`
  const checkResponse = await cloudflareApiCall(url, { method: "GET" }, apiToken, 1)

  if (checkResponse.ok) {
    const data = await checkResponse.json()
    return data.result
  }

  if (checkResponse.status === 404) {
    console.log(`[Cloudflare] Project ${projectName} not found. Creating...`)
    const createResponse = await cloudflareApiCall(
      `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: projectName,
          production_branch: "main",
        }),
      },
      apiToken,
    )

    if (!createResponse.ok) {
      const err = await createResponse.text()
      throw new Error(`Failed to create project: ${err}`)
    }

    // Wait a bit for propagation
    await new Promise((r) => setTimeout(r, 2000))

    const createData = await createResponse.json()
    return createData.result
  }

  const err = await checkResponse.text()
  throw new Error(`Failed to check project existence: ${checkResponse.status} ${err}`)
}

/**
 * Generates the Manifest and ZIP package for Cloudflare Direct Upload
 */
async function generateDeploymentPackage(files: DeployFile[]) {
  // Use SHA-256 for Cloudflare Pages (Direct Upload v2)
  const manifest: Record<string, string> = {}

  // Create ZIP with level 0 (STORE) to avoid compression issues and speed up build
  const archive = archiver("zip", { zlib: { level: 0 } })

  const chunks: Buffer[] = []

  return new Promise<{ manifest: string; zipBuffer: Buffer }>((resolve, reject) => {
    archive.on("error", (err) => reject(err))

    // Capture the zip output in memory
    archive.on("data", (chunk) => chunks.push(chunk))

    archive.on("end", () => {
      const zipBuffer = Buffer.concat(chunks)
      resolve({ manifest: JSON.stringify(manifest), zipBuffer })
    })

    // Process each file
    files.forEach((file) => {
      // Normalize path: Ensure it starts with / for manifest
      const manifestPath = file.path.startsWith("/") ? file.path : `/${file.path}`

      // Convert content to Buffer if it's string
      let contentBuffer = Buffer.isBuffer(file.content) ? file.content : Buffer.from(file.content)

      // Sanity check: Empty files cause issues
      if (contentBuffer.length === 0) {
        console.warn(`[Cloudflare] Warning: File ${manifestPath} is empty. Injecting placeholder.`)
        contentBuffer = Buffer.from("<!-- Empty Page -->")
      }

      // Compute SHA-256 (Critical for Cloudflare verification)
      const hash = crypto.createHash("sha256").update(contentBuffer).digest("hex")

      // Add to manifest
      manifest[manifestPath] = hash

      console.log(
        `[Cloudflare] Pack: ${manifestPath} | Size: ${contentBuffer.length} | Hash: ${hash.substring(0, 8)}...`,
      )

      // Add to ZIP (relative path)
      const zipName = manifestPath.startsWith("/") ? manifestPath.slice(1) : manifestPath
      archive.append(contentBuffer, { name: zipName })
    })

    archive.finalize()
  })
}

/**
 * Uploads the deployment package to Cloudflare
 */
async function uploadToCloudflare(
  accountId: string,
  projectName: string,
  apiToken: string,
  manifestString: string,
  zipBuffer: Buffer,
) {
  // Use 'form-data' package
  const form = new FormData()

  // 1. Append Manifest
  form.append("manifest", manifestString, {
    contentType: "application/json",
  })

  // 2. Append ZIP file
  // Try "files" instead of "file" (some v2 docs/implementations use files)
  form.append("files", zipBuffer, {
    filename: "site.zip",
    contentType: "application/zip",
  })

  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments`

  const body = form.getBuffer()
  const headers = form.getHeaders()

  console.log(
    `[Cloudflare] Uploading multipart payload. Manifest len: ${manifestString.length}, Zip len: ${zipBuffer.length}`,
  )

  const response = await cloudflareApiCall(
    url,
    {
      method: "POST",
      body: body as any,
      headers: headers,
    },
    apiToken,
  )

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Cloudflare Upload Failed: ${response.status} - ${errorText}`)
  }

  return response.json()
}

/**
 * POST /api/cloudflare/deploy
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

    // 1. Get Credentials
    const tokenDoc = await db.collection("cloudflare_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId: session.user.email,
    })

    if (!tokenDoc) {
      return NextResponse.json(
        { error: "No Cloudflare credentials found. Please authenticate first." },
        { status: 400 },
      )
    }

    // 2. Get Project
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // 3. Determine Cloudflare Project Name
    let cfProjectName = cloudflareProjectName || project.cloudflareProjectName
    if (!cfProjectName) {
      const baseName = project.name || project.businessName || `project-${projectId}`
      cfProjectName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 58)
    }

    // 4. Collect Files - Pages are stored in project.pages array, NOT a separate collection
    const files: DeployFile[] = []
    const title = project.businessName || project.name || "My Site"

    // Check if project has pages in its pages array
    if (project.pages && Array.isArray(project.pages) && project.pages.length > 0) {
      console.log(`[Cloudflare] Found ${project.pages.length} pages in project`)

      for (const page of project.pages) {
        // Normalize page name to filename
        let fileName = page.name || "index"

        // Remove .html extension if present, we'll add it back
        fileName = fileName.replace(/\.html$/i, "")

        // Add .html extension
        const htmlFileName = fileName === "index" ? "index.html" : `${fileName}.html`

        // Get content, use placeholder if empty
        let content = page.content

        if (!content || content.trim().length === 0) {
          content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${fileName} - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center">
    <div class="text-center p-8">
        <h1 class="text-2xl font-bold text-gray-800 mb-4">${fileName}</h1>
        <p class="text-gray-600">Content coming soon.</p>
        <a href="/index.html" class="mt-4 inline-block text-blue-600 hover:underline">Back to Home</a>
    </div>
</body>
</html>`
        }

        files.push({
          path: `/${htmlFileName}`,
          content: content,
        })

        console.log(`[Cloudflare] Added page: ${htmlFileName} (${content.length} bytes)`)
      }
    } else {
      // Fallback: Check for aiGeneratedCode as legacy support
      if (project.aiGeneratedCode) {
        console.log(`[Cloudflare] Using aiGeneratedCode as fallback`)
        files.push({
          path: "/index.html",
          content: project.aiGeneratedCode,
        })
      } else {
        // No pages found - create a placeholder
        console.log(`[Cloudflare] No pages found, creating placeholder`)
        files.push({
          path: "/index.html",
          content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
    <div class="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div class="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
        </div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">${title}</h1>
        <p class="text-xl text-gray-600 mb-6">Your website is deployed and ready! Use the AI Builder to generate your content.</p>
        <div class="text-sm text-gray-400">Deployed with Sycord Pages</div>
    </div>
</body>
</html>`,
        })
      }
    }

    // Ensure index.html exists
    const hasIndex = files.some((f) => f.path === "/index.html")
    if (!hasIndex && files.length > 0) {
      // Copy first file as index
      const firstFile = files[0]
      files.push({
        path: "/index.html",
        content: firstFile.content,
      })
      console.log(`[Cloudflare] Created index.html from ${firstFile.path}`)
    }

    // Add 404 page for better error handling
    files.push({
      path: "/404.html",
      content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Page Not Found - ${title}</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div class="text-center">
        <h1 class="text-6xl font-bold text-gray-300 mb-4">404</h1>
        <p class="text-xl text-gray-600 mb-6">Page not found</p>
        <a href="/" class="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
            Go Home
        </a>
    </div>
</body>
</html>`,
    })

    console.log(`[Cloudflare] Total files to deploy: ${files.length}`)

    // 5. Get Project Details
    const cfProject = await getOrCreateProject(tokenDoc.accountId, cfProjectName, tokenDoc.apiToken)
    console.log(`[Cloudflare] Target: ${cfProject.name} (${cfProject.subdomain})`)

    // 6. Generate Package (Manifest + ZIP)
    const { manifest, zipBuffer } = await generateDeploymentPackage(files)

    // 7. Upload
    const result: any = await uploadToCloudflare(
      tokenDoc.accountId,
      cfProjectName,
      tokenDoc.apiToken,
      manifest,
      zipBuffer,
    )

    const deploymentId = result.result?.id
    const deploymentUrl = `https://${cfProject.subdomain}`

    console.log(`[Cloudflare] Success! URL: ${deploymentUrl}`)

    // 8. Update DB
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          cloudflareProjectName: cfProjectName,
          cloudflareUrl: deploymentUrl,
          cloudflareDeployedAt: new Date(),
          cloudflareDeploymentId: deploymentId,
        },
      },
    )

    return NextResponse.json({
      success: true,
      url: deploymentUrl,
      deploymentId,
      projectName: cfProjectName,
    })
  } catch (error: any) {
    console.error("[Cloudflare] Deployment Error:", error)
    return NextResponse.json({ error: error.message || "Deployment failed" }, { status: 500 })
  }
}
