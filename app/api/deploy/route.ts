import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

const GITHUB_API_BASE = "https://api.github.com"
const SYCORD_DEPLOY_API_BASE = process.env.VPS_SERVER_URL || "https://server.sycord.site"

// Initial delay after creating a repository before attempting file upload
const INITIAL_REPO_DELAY_MS = 1000
const MAX_REPO_INIT_RETRIES = 5

function getEnvGitHubCredentials() {
  const token = process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER || process.env.GITHUB_USERNAME
  
  if (token && owner) {
    return { token, owner }
  }
  return null
}

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
    console.error(`[Deploy] GitHub API error (${url}):`, errorMsg)
    const error = new Error(`GitHub API error: ${errorMsg}`) as Error & { status: number }
    error.status = response.status
    throw error
  }

  return { data, status: response.status }
}

async function checkRepoExists(owner: string, repo: string, token: string): Promise<boolean> {
  try {
    await githubRequest(`/repos/${owner}/${repo}`, token)
    return true
  } catch (error: any) {
    if (error.status === 404) return false
    throw error
  }
}

async function createRepo(owner: string, repo: string, token: string): Promise<any> {
  console.log(`[Deploy] Creating repository: ${owner}/${repo}`)
  const { data } = await githubRequest("/user/repos", token, {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      description: "Website deployed from Sycord AI Builder",
      auto_init: true, // Important: Initialize so we have a main branch
      private: false,
    }),
  })
  return data
}

async function waitForRepoInitialization(owner: string, repo: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_REPO_INIT_RETRIES; attempt++) {
    const delay = INITIAL_REPO_DELAY_MS * Math.pow(1.5, attempt)
    await new Promise(resolve => setTimeout(resolve, delay))
    
    try {
      await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/main`, token)
      console.log(`[Deploy] Repository initialized (attempt ${attempt + 1})`)
      return
    } catch (error: any) {
      if (attempt === MAX_REPO_INIT_RETRIES - 1) {
        console.warn(`[Deploy] Repo init timeout. Proceeding anyway.`)
        return
      }
    }
  }
}

/**
 * Deploy using Git Data API (Tree -> Commit -> Ref)
 * This is "atomic" and efficiently handles "clearing" old state by simply not including old files in the new tree.
 */
async function deployViaGitTree(
    owner: string,
    repo: string,
    files: { path: string, content: string }[],
    token: string
) {
    console.log(`[Deploy] Starting atomic deployment via Git Tree API...`)

    // 1. Get latest commit SHA (base_tree)
    let latestCommitSha = null
    try {
        const { data: refData } = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/main`, token)
        latestCommitSha = refData.object.sha
    } catch (e) {
        console.log(`[Deploy] No main branch found, assuming empty repo or first commit.`)
    }

    // 2. Create Blobs for files (to be safe with content encoding)
    // We construct the tree array. For text files we can put content directly, but blobs are safer for size.
    // Actually, passing 'content' directly in tree creation is limited.
    // Let's create blobs for all files to be robust.
    const treeItems = []

    for (const file of files) {
        const { data: blobData } = await githubRequest(`/repos/${owner}/${repo}/git/blobs`, token, {
            method: "POST",
            body: JSON.stringify({
                content: file.content,
                encoding: "utf-8"
            })
        })

        treeItems.push({
            path: file.path,
            mode: "100644", // standard file
            type: "blob",
            sha: blobData.sha
        })
    }

    // 3. Create Tree
    // We DO NOT include base_tree if we want to "clear" the repo (delete missing files).
    // If we wanted to keep existing files, we would pass 'base_tree': latestCommitSha.
    // The requirement is "clear all current state", so we omit base_tree.
    // This creates a snapshot containing ONLY our new files.
    const { data: treeData } = await githubRequest(`/repos/${owner}/${repo}/git/trees`, token, {
        method: "POST",
        body: JSON.stringify({
            tree: treeItems
        })
    })

    // 4. Create Commit
    const commitPayload: any = {
        message: "Deploy from Sycord AI Builder (Clean Re-deploy)",
        tree: treeData.sha,
    }
    if (latestCommitSha) {
        commitPayload.parents = [latestCommitSha] // Link to history, but the state is purely the new tree
    }

    const { data: commitData } = await githubRequest(`/repos/${owner}/${repo}/git/commits`, token, {
        method: "POST",
        body: JSON.stringify(commitPayload)
    })

    // 5. Update Reference (Force push effectively)
    await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/main`, token, {
        method: "PATCH", // Update existing ref
        body: JSON.stringify({
            sha: commitData.sha,
            force: true
        })
    })

    console.log(`[Deploy] Atomic deployment complete. New commit: ${commitData.sha}`)
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    const userId = (session?.user as { id?: string } | undefined)?.id
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { projectId } = await request.json()
    if (!projectId) return NextResponse.json({ error: "Missing projectId" }, { status: 400 })

    const client = await clientPromise
    const db = client.db()

    // 1. Credentials
    const envCredentials = getEnvGitHubCredentials()
    if (!envCredentials) {
      return NextResponse.json({ error: "GitHub credentials not configured." }, { status: 400 })
    }
    const { token, owner } = envCredentials

    // 2. Project Data
    const userDoc = await db.collection("users").findOne({ id: userId })
    const project = userDoc?.projects?.find((p: any) => p._id.toString() === projectId)
    if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

    // 3. Repo Name
    let repo = project.githubRepo || project.businessName?.toLowerCase().replace(/[^a-z0-9-]/g, "-") || `project-${projectId}`

    // 4. Ensure Repo Exists
    let repoId: number
    const repoExists = await checkRepoExists(owner, repo, token)
    if (!repoExists) {
      const repoData = await createRepo(owner, repo, token)
      repoId = repoData.id
      await waitForRepoInitialization(owner, repo, token)
    } else {
      const { data } = await githubRequest(`/repos/${owner}/${repo}`, token)
      repoId = data.id
    }

    // 5. Prepare Files
    const pages = project.pages || []
    const files = []

    if (pages.length > 0) {
        for (const page of pages) {
            let path = page.name
            if (path.startsWith('/')) path = path.substring(1)
            files.push({ path, content: page.content })
        }
    } else if (project.aiGeneratedCode) {
        files.push({ path: "index.html", content: project.aiGeneratedCode })
    }

    if (files.length === 0) return NextResponse.json({ error: "No files to deploy." }, { status: 400 })

    // 6. Deploy using Git Tree Strategy (Atomic & Cleaner)
    await deployViaGitTree(owner, repo, files, token)

    // 7. Save Meta
    const gitUrl = `https://github.com/${owner}/${repo}`

    // Update User/Project DB
    await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        {
            $set: {
                "projects.$.githubOwner": owner,
                "projects.$.githubRepo": repo,
                "projects.$.githubRepoId": repoId,
                "projects.$.githubUrl": gitUrl,
                "projects.$.deployedAt": new Date()
            }
        }
    )

    // Collect env vars for this project to pass to the deployer
    const envVars: Record<string, string> = {}
    if (Array.isArray(project.envVars)) {
      for (const ev of project.envVars) {
        if (typeof ev?.key === "string" && ev.key.trim()) {
          envVars[ev.key.trim()] = typeof ev?.value === "string" ? ev.value : ""
        }
      }
    }

    // Save Git Connection for Sycord Deployer
    await db.collection("users").updateOne({ id: userId }, {
        $set: { [`git_connection.${repoId}`]: {
            username: owner,
            repo_id: repoId.toString(),
            git_url: gitUrl,
            git_token: token,
            repo_name: repo,
            project_id: projectId,
            deployed_at: new Date(),
            env_vars: envVars,
        }}
    })

    // 8. Trigger Sycord VPS Deploy
    let vpsUrl = null
    let deployMessage = "Deployed to GitHub"

    try {
        // Trigger — include files and env vars in the deploy payload
        console.log(`[Deploy] Triggering downstream VPS deploy for project ${projectId} with ${files.length} files...`)
        const deployBody: any = {
          files,
          subdomain: repo,
        }
        if (Object.keys(envVars).length > 0) {
          deployBody.env_vars = envVars
        }
        const triggerRes = await fetch(`${SYCORD_DEPLOY_API_BASE}/api/deploy/${projectId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deployBody),
        })
        const triggerData = await triggerRes.json().catch(() => ({}))
        console.log(`[Deploy] Trigger status: ${triggerRes.status}`, triggerData)
        
        if (!triggerRes.ok) {
          console.error(`[Deploy] Downstream VPS deploy failed:`, triggerData)
        } else if (triggerData.domain) {
          vpsUrl = triggerData.domain.startsWith('http') ? triggerData.domain : `https://${triggerData.domain}`
        }
        
        if (!vpsUrl) {
            // Wait briefly for initial provisioning
            await new Promise(r => setTimeout(r, 2000))

            // Check Domain via API
            const domainRes = await fetch(`${SYCORD_DEPLOY_API_BASE}/api/projects/${projectId}`)
            const domainData = await domainRes.json()
            console.log(`[Deploy] Project info check:`, domainData)

            if (domainData.success && domainData.domain) {
                vpsUrl = domainData.domain.startsWith('http') ? domainData.domain : `https://${domainData.domain}`
            }
        }

        if (vpsUrl) {
            deployMessage = "Deployed to Sycord VPS!"
            await db.collection("users").updateOne(
                { id: userId, "projects._id": new ObjectId(projectId) },
                { $set: { "projects.$.cloudflareUrl": vpsUrl } } // Using cloudflareUrl for backward compatibility in DB schema
            )
        }
    } catch (e) {
        console.error("Sycord Deploy Error:", e)
    }

    return NextResponse.json({
        success: true,
        url: vpsUrl || gitUrl,
        githubUrl: gitUrl,
        cloudflareUrl: vpsUrl,
        filesCount: files.length,
        message: deployMessage,
        repoId: repoId.toString()
    })

  } catch (error: any) {
    console.error("[Deploy] Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
