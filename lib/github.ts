import { Buffer } from "buffer";

const GITHUB_API_BASE = "https://api.github.com";

interface GithubFile {
    path: string;
    content: string;
}

export async function githubRequest(endpoint: string, method: string = "GET", body: any = null, token: string) {
    const headers: Record<string, string> = {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Jules-Agent"
    };

    const options: RequestInit = {
        method,
        headers,
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    console.log(`[GitHub] ${method} ${endpoint}`);
    const res = await fetch(`${GITHUB_API_BASE}${endpoint}`, options);

    if (!res.ok) {
        const errorText = await res.text();
        let errorMsg = errorText;
        try {
            const json = JSON.parse(errorText);
            errorMsg = json.message || errorText;
        } catch {}

        console.error(`[GitHub] Error ${res.status}: ${errorMsg}`);
        const error = new Error(`GitHub API Error ${res.status}: ${errorMsg}`) as any;
        error.status = res.status;
        throw error;
    }

    return res.json();
}

export async function ensureRepo(token: string, owner: string, repoName: string, description?: string) {
    try {
        console.log(`[GitHub] Checking repo ${owner}/${repoName}`);
        return await githubRequest(`/repos/${owner}/${repoName}`, "GET", null, token);
    } catch (e: any) {
        if (e.status === 404) {
            console.log(`[GitHub] Repo not found, creating...`);
            // Check if owner is the authenticated user
            const user = await githubRequest("/user", "GET", null, token);
            let endpoint = "/user/repos";
            if (user.login.toLowerCase() !== owner.toLowerCase()) {
                endpoint = `/orgs/${owner}/repos`;
            }

            const repo = await githubRequest(endpoint, "POST", {
                name: repoName,
                description,
                private: true,
                auto_init: true // Initialize with README to make sure we have a main branch
            }, token);

            // Wait a bit for the repo to be initialized
            await new Promise(resolve => setTimeout(resolve, 2000));
            return repo;
        }
        throw e;
    }
}

export async function pushFiles(token: string, owner: string, repo: string, branch: string, files: GithubFile[], message: string) {
    console.log(`[GitHub] Pushing ${files.length} files to ${owner}/${repo} on branch ${branch}`);

    // 1. Get ref
    let refData;
    let baseTreeSha;

    try {
        refData = await githubRequest(`/repos/${owner}/${repo}/git/ref/heads/${branch}`, "GET", null, token);
        const latestCommitSha = refData.object.sha;
        const latestCommit = await githubRequest(`/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, "GET", null, token);
        baseTreeSha = latestCommit.tree.sha;
    } catch (e: any) {
         throw new Error(`Branch ${branch} not found or repo empty: ${e.message}`);
    }

    const latestCommitSha = refData.object.sha;

    // 2. Create blobs
    const treeItems = [];
    for (const file of files) {
        const blobData = await githubRequest(`/repos/${owner}/${repo}/git/blobs`, "POST", {
            content: file.content,
            encoding: "utf-8"
        }, token);

        treeItems.push({
            path: file.path.startsWith("/") ? file.path.slice(1) : file.path,
            mode: "100644",
            type: "blob",
            sha: blobData.sha
        });
    }

    // 3. Create tree
    const treeData = await githubRequest(`/repos/${owner}/${repo}/git/trees`, "POST", {
        base_tree: baseTreeSha,
        tree: treeItems
    }, token);

    // 4. Create commit
    const commitData = await githubRequest(`/repos/${owner}/${repo}/git/commits`, "POST", {
        message,
        tree: treeData.sha,
        parents: [latestCommitSha]
    }, token);

    // 5. Update ref
    await githubRequest(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, "PATCH", {
        sha: commitData.sha
    }, token);

    console.log(`[GitHub] Pushed commit ${commitData.sha}`);
    return commitData;
}
