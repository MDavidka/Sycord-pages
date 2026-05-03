const GITHUB_API_BASE = "https://api.github.com"

const INITIAL_REPO_DELAY_MS = 1000
const MAX_REPO_INIT_RETRIES = 5

export function getEnvGitHubCredentials() {
  const token = process.env.GITHUB_API_TOKEN || process.env.GITHUB_TOKEN
  const owner = process.env.GITHUB_OWNER || process.env.GITHUB_USERNAME
  if (token && owner) {
    return { token, owner }
  }
  return null
}

export async function githubRequest(
  endpoint: string,
  token: string,
  options: RequestInit = {},
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
    const error = new Error(data.message || `GitHub API error: HTTP ${response.status}`) as Error & { status?: number }
    error.status = response.status
    throw error
  }

  return { data, status: response.status }
}

export async function checkRepoExists(owner: string, repo: string, token: string): Promise<boolean> {
  try {
    await githubRequest(`/repos/${owner}/${repo}`, token)
    return true
  } catch (error: any) {
    if (error?.status === 404) return false
    throw error
  }
}

export async function createRepo(owner: string, repo: string, token: string): Promise<any> {
  const { data } = await githubRequest("/user/repos", token, {
    method: "POST",
    body: JSON.stringify({
      name: repo,
      description: "Website deployed from Sycord AI Builder",
      auto_init: true,
      private: false,
    }),
  })
  return data
}

export async function waitForRepoInitialization(owner: string, repo: string, token: string): Promise<void> {
  for (let attempt = 0; attempt < MAX_REPO_INIT_RETRIES; attempt += 1) {
    const delay = INITIAL_REPO_DELAY_MS * Math.pow(1.5, attempt)
    await new Promise((resolve) => setTimeout(resolve, delay))
    try {
      await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/main`, token)
      return
    } catch {
      if (attempt === MAX_REPO_INIT_RETRIES - 1) return
    }
  }
}

export async function ensureRepo(owner: string, repo: string, token: string): Promise<{ repoId: number; gitUrl: string }> {
  const exists = await checkRepoExists(owner, repo, token)
  let repoId: number

  if (!exists) {
    const repoData = await createRepo(owner, repo, token)
    repoId = repoData.id
    await waitForRepoInitialization(owner, repo, token)
  } else {
    const { data } = await githubRequest(`/repos/${owner}/${repo}`, token)
    repoId = data.id
  }

  return {
    repoId,
    gitUrl: `https://github.com/${owner}/${repo}`,
  }
}

export async function deployViaGitTree(
  owner: string,
  repo: string,
  files: { path: string; content: string }[],
  token: string,
) {
  let latestCommitSha: string | null = null
  try {
    const { data } = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/main`, token)
    latestCommitSha = data.object.sha
  } catch {}

  const tree = []
  for (const file of files) {
    const { data: blob } = await githubRequest(`/repos/${owner}/${repo}/git/blobs`, token, {
      method: "POST",
      body: JSON.stringify({
        content: file.content,
        encoding: "utf-8",
      }),
    })
    tree.push({
      path: file.path,
      mode: "100644",
      type: "blob",
      sha: blob.sha,
    })
  }

  const { data: treeData } = await githubRequest(`/repos/${owner}/${repo}/git/trees`, token, {
    method: "POST",
    body: JSON.stringify({ tree }),
  })

  const commitPayload: any = {
    message: "Deploy from Sycord AI Builder",
    tree: treeData.sha,
  }
  if (latestCommitSha) {
    commitPayload.parents = [latestCommitSha]
  }

  const { data: commitData } = await githubRequest(`/repos/${owner}/${repo}/git/commits`, token, {
    method: "POST",
    body: JSON.stringify(commitPayload),
  })

  await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/main`, token, {
    method: "PATCH",
    body: JSON.stringify({ sha: commitData.sha, force: true }),
  })
}
