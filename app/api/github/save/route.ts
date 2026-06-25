import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"


const GITHUB_API_BASE = "https://api.github.com"

// Time to wait after creating a repository before uploading files (GitHub needs time to initialize)
const REPO_CREATION_DELAY_MS = 2000

/**
 * Get GitHub credentials from environment variables
 */
function getEnvGitHubCredentials(): { token: string; owner: string } | null {
  const token = process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER || process.env.GITHUB_USERNAME
  
  if (token && owner) {
    return { token, owner }
  }
  return null
}

interface GitHubFile {
  path: string
  content: string
}

/**
 * Make a GitHub API request with proper headers
 */
async function githubRequest(
  endpoint: string,
  token: string,
  options: RequestInit = {}
): Promise<{ data: any; status: number }> {
  const url = endpoint.startsWith("http") ? endpoint : `${GITHUB_API_BASE}${endpoint}`
  
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...options.headers,
    },
  })

  const data = await response.json().catch(() => ({}))
  
  if (!response.ok) {
    const errorMsg = data.message || `HTTP ${response.status}`
    console.error(`[GitHub] API error:`, data)
    const error = new Error(`GitHub API error: ${errorMsg}`) as Error & { status: number }
    error.status = response.status
    throw error
  }

  return { data, status: response.status }
}

/**
 * Check if a repository exists
 */
async function checkRepoExists(owner: string, repo: string, token: string): Promise<boolean> {
  try {
    await githubRequest(`/repos/${owner}/${repo}`, token)
    return true
  } catch (error: any) {
    if (error.status === 404) {
      return false
    }
    throw error
  }
}

/**
 * Create a new repository
 */
async function createRepo(owner: string, repo: string, token: string, isOrg: boolean = false): Promise<void> {
  console.log(`[GitHub] Creating repository: ${owner}/${repo}`)
  
  const endpoint = isOrg ? `/orgs/${owner}/repos` : "/user/repos"
  
  await githubRequest(endpoint, token, {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      description: "Website deployed from Sycord Pages",
      auto_init: true,
      private: false,
    }),
  })
  
  console.log(`[GitHub] Repository created: ${owner}/${repo}`)
}

/**
 * Get the SHA of a file if it exists (needed for updates)
 */
async function getFileSha(owner: string, repo: string, path: string, token: string): Promise<string | null> {
  try {
    const { data } = await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, token)
    return data.sha || null
  } catch (error: any) {
    if (error.status === 404) {
      return null
    }
    throw error
  }
}

/**
 * Create or update a file in the repository
 */
async function createOrUpdateFile(
  owner: string,
  repo: string,
  path: string,
  content: string,
  token: string,
  message: string = "Update from Sycord Pages"
): Promise<void> {
  const sha = await getFileSha(owner, repo, path, token)
  
  const body: any = {
    message,
    content: Buffer.from(content).toString("base64"),
  }
  
  if (sha) {
    body.sha = sha
  }

  await githubRequest(`/repos/${owner}/${repo}/contents/${path}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  })
}

/**
 * POST /api/github/save
 * Save project files to a GitHub repository
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { projectId, repoName } = await request.json()

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 })
    }

    if (!projectId || !projectId.trim()) {
      return NextResponse.json({ error: "Invalid projectId format" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db()

    // Get GitHub credentials - first try environment variables, then database (users collection)
    let token: string
    let owner: string
    
    const envCredentials = getEnvGitHubCredentials()
    if (envCredentials) {
      token = envCredentials.token
      owner = envCredentials.owner
      console.log("[GitHub] Using environment credentials")
    } else {
      // Find user to get embedded token
      const user = await db.collection("users").findOne({ id: session.user.id });
      const tokenData = user?.github_tokens?.[projectId];

      if (!tokenData?.token) {
        return NextResponse.json(
          { error: "GitHub credentials not found. Please configure GITHUB_API_TOKEN and GITHUB_OWNER environment variables." },
          { status: 400 }
        )
      }
      token = tokenData.token
      owner = tokenData.owner || tokenData.username
    }

    // Get project (embedded in user)
    const userDoc = await db.collection("users").findOne({ id: session.user.id });
    if (!userDoc || !userDoc.projects) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }
    const project = userDoc.projects.find((p: any) => p._id.toString() === projectId);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    // Determine repository name - use provided name, existing repo, or generate from project
    let repo = repoName || (project.githubRepo as string | undefined)
    if (!repo) {
      const baseName = project.name || project.businessName || `sycord-project-${projectId}`
      repo = baseName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 100)
    }

    console.log(`[GitHub] Saving to repository: ${owner}/${repo}`)

    // Check if repo exists, create if not
    const repoExists = await checkRepoExists(owner, repo, token)
    if (!repoExists) {
      await createRepo(owner, repo, token)
      // Wait for GitHub to initialize the repository before uploading files
      await new Promise(resolve => setTimeout(resolve, REPO_CREATION_DELAY_MS))
    }

    // Fetch repo details to get ID
    const { data: repoData } = await githubRequest(`/repos/${owner}/${repo}`, token)
    const repoId = repoData.id

    // Fetch pages from project object (embedded)
    const pages = project.pages || [];

    const files: GitHubFile[] = []
    let hasIndexHtml = false

    if (pages.length > 0) {
      console.log(`[GitHub] Found ${pages.length} pages in project`)
      
      for (const page of pages) {
        let path = page.name
        if (/^\.env(?:\.|$)/.test(path) || /\/\.env(?:\.|$)/.test(path)) {
          return NextResponse.json({ error: `Env files must not be pushed to GitHub: ${path}` }, { status: 400 })
        }
        // Ensure path doesn't start with /
        if (path.startsWith('/')) {
          path = path.substring(1)
        }

        // Force .html extension for TypeScript/JavaScript files
        if (path.endsWith('.ts') || path.endsWith('.tsx')) {
          path = path.replace(/\.(ts|tsx)$/, '.html')
        } else if (path.endsWith('.js') || path.endsWith('.jsx')) {
          path = path.replace(/\.(js|jsx)$/, '.html')
        }

        // Ensure .html extension for pages
        const hasExtension = path.includes('.') && path.lastIndexOf('.') > path.lastIndexOf('/')
        if (!hasExtension && !path.endsWith('/')) {
          path = path + '.html'
        }

        // Track if we have an index.html
        if (path === 'index.html' || path.toLowerCase() === 'index.html') {
          hasIndexHtml = true
        }

        files.push({ path, content: page.content })
        console.log(`[GitHub] Prepared file: ${page.name} -> ${path}`)
      }
    } else if (project.aiGeneratedCode) {
      // Fallback to project.aiGeneratedCode
      console.log(`[GitHub] Using legacy aiGeneratedCode as index.html`)
      files.push({ path: "index.html", content: project.aiGeneratedCode })
      hasIndexHtml = true
    }

    // If we have files but no index.html, create one from the first page
    if (files.length > 0 && !hasIndexHtml) {
      console.log(`[GitHub] No index.html found, creating from first page`)
      files.push({ path: "index.html", content: files[0].content })
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No files to save. Please generate or create pages first." },
        { status: 400 }
      )
    }

    // Upload files to GitHub
    console.log(`[GitHub] Uploading ${files.length} files...`)
    
    for (const file of files) {
      console.log(`[GitHub] Uploading: ${file.path}`)
      await createOrUpdateFile(
        owner,
        repo,
        file.path,
        file.content,
        token,
        `Update ${file.path} from Sycord Pages`
      )
    }

    // Update project with GitHub info (embedded in user)
    await db.collection("users").updateOne(
      {
        id: session.user.id,
        "projects._id": projectId
      },
      {
        $set: {
          "projects.$.githubOwner": owner,
          "projects.$.githubRepo": repo,
          "projects.$.githubRepoId": repoId,
          "projects.$.githubUrl": `https://github.com/${owner}/${repo}`,
          "projects.$.githubSavedAt": new Date(),
        },
      }
    )

    console.log(`[GitHub] Successfully saved ${files.length} files to ${owner}/${repo} (ID: ${repoId})`)

    return NextResponse.json({
      success: true,
      owner,
      repo,
      repoId,
      url: `https://github.com/${owner}/${repo}`,
      filesCount: files.length,
    })
  } catch (error: any) {
    console.error("[GitHub] Save error:", error)
    return NextResponse.json(
      { error: error.message || "Failed to save to GitHub" },
      { status: 500 }
    )
  }
}
