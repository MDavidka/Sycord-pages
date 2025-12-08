import crypto from "crypto"

interface FileWithContent {
  name: string
  content: string
}

interface ManifestEntry {
  [filepath: string]: {
    sha1: string
  }
}

/**
 * Generate MD5 hash for a file's content
 */
function generateSHA1(content: string): string {
  return crypto.createHash("sha1").update(content, "utf-8").digest("hex")
}

/**
 * Encode content to base64
 */
function encodeBase64(content: string): string {
  return Buffer.from(content, "utf-8").toString("base64")
}

/**
 * Build the manifest for Cloudflare Pages Direct Upload
 */
function buildManifest(files: FileWithContent[]): ManifestEntry {
  const manifest: ManifestEntry = {}

  for (const file of files) {
    const sha1 = generateSHA1(file.content)
    manifest[file.name] = { sha1 }
  }

  return manifest
}

/**
 * Build the files object for Cloudflare Pages Direct Upload
 */
function buildFilesObject(files: FileWithContent[]): Record<string, string> {
  const filesObj: Record<string, string> = {}

  for (const file of files) {
    filesObj[file.name] = encodeBase64(file.content)
  }

  return filesObj
}

/**
 * Upload files to Cloudflare Pages using Direct Upload API
 */
export async function uploadToCloudflarePages(
  files: FileWithContent[],
  accountId: string,
  projectName: string,
  apiToken: string,
): Promise<{ success: boolean; deploymentId?: string; error?: string }> {
  console.log("[v0] Cloudflare: Starting Direct Upload process")

  if (!files || files.length === 0) {
    console.error("[v0] Cloudflare: Files array is empty - cannot deploy")
    return { success: false, error: "No files to deploy" }
  }

  const hasIndexFile = files.some((f) => f.name === "index.html" || f.name === "index")
  if (!hasIndexFile && files.length > 0) {
    console.warn("[v0] Cloudflare: Warning - no index.html found, using first file as entry")
  }

  for (const file of files) {
    if (!file.content || file.content.length === 0) {
      console.error(`[v0] Cloudflare: File "${file.name}" has empty content`)
      return { success: false, error: `File "${file.name}" is empty` }
    }
    if (!file.name) {
      console.error("[v0] Cloudflare: File has no name")
      return { success: false, error: "File must have a name" }
    }
  }

  try {
    // Build manifest with SHA1 hashes
    console.log("[v0] Cloudflare: Building manifest...")
    const manifest = buildManifest(files)
    console.log("[v0] Cloudflare: Manifest keys:", Object.keys(manifest))

    if (Object.keys(manifest).length === 0) {
      console.error("[v0] Cloudflare: Manifest is empty")
      return { success: false, error: "Manifest generation failed" }
    }

    // Build files object with base64-encoded content
    console.log("[v0] Cloudflare: Encoding files...")
    const filesObj = buildFilesObject(files)

    if (Object.keys(filesObj).length === 0) {
      console.error("[v0] Cloudflare: Files object is empty")
      return { success: false, error: "Files encoding failed" }
    }

    // Log file count and sizes
    console.log("[v0] Cloudflare: File count:", files.length)
    for (const file of files) {
      const base64 = filesObj[file.name]
      const first60 = base64.substring(0, 60)
      console.log(
        `[v0] Cloudflare: File "${file.name}" - Original size: ${file.content.length}, Base64 size: ${base64.length}, First 60 chars: ${first60}`,
      )
    }

    // Build the complete request body
    const requestBody = {
      manifest,
      files: filesObj,
    }

    console.log("[v0] Cloudflare: Complete request body structure:")
    console.log("[v0] Cloudflare: Request body keys:", Object.keys(requestBody))
    console.log("[v0] Cloudflare: Manifest type:", typeof requestBody.manifest)
    console.log("[v0] Cloudflare: Files type:", typeof requestBody.files)

    // Convert to JSON string
    const jsonPayload = JSON.stringify(requestBody)
    console.log(
      `[v0] Cloudflare: JSON payload size: ${jsonPayload.length} bytes, first 100 chars: ${jsonPayload.substring(0, 100)}...`,
    )

    if (!jsonPayload || jsonPayload.length === 0) {
      console.error("[v0] Cloudflare: JSON payload is empty")
      return { success: false, error: "JSON payload generation failed" }
    }

    // Construct Cloudflare API URL
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/${projectName}/deployments`

    console.log(`[v0] Cloudflare: Sending request to ${url} with Content-Type: application/json`)

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: jsonPayload,
    })

    const responseData = await response.json()

    if (!response.ok) {
      console.error("[v0] Cloudflare: API error response:", responseData)
      const error = responseData.errors?.[0]?.message || "Unknown error"
      return { success: false, error }
    }

    console.log("[v0] Cloudflare: Deployment successful:", responseData)

    return {
      success: true,
      deploymentId: responseData.result?.id,
    }
  } catch (error: any) {
    console.error("[v0] Cloudflare: Upload failed:", error.message)
    return { success: false, error: error.message }
  }
}

/**
 * Example of the complete JSON payload structure that should be sent:
 * {
 *   "manifest": {
 *     "index.html": {
 *       "sha1": "abc123def456..."
 *     },
 *     "about.html": {
 *       "sha1": "def456ghi789..."
 *     },
 *     "style.css": {
 *       "sha1": "ghi789jkl012..."
 *     }
 *   },
 *   "files": {
 *     "index.html": "PGh0bWw+PGhlYWQ+PHRpdGxlPlRlc3Q8L3RpdGxlPjwvaGVhZD48Ym9keT5IZWxsbyBXb3JsZDwvYm9keT48L2h0bWw+",
 *     "about.html": "PGh0bWw+PGhlYWQ+PHRpdGxlPkFib3V0PC90aXRsZT48L2hlYWQ+PGJvZHk+QWJvdXQgVXM8L2JvZHk+PC9odG1sPg==",
 *     "style.css": "Ym9keSB7IGZvbnQtZmFtaWx5OiBBcmlhbDsgfQ=="
 *   }
 * }
 */
