import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import archiver from "archiver";
import FormData from "form-data";

/**
 * Cloudflare API Configuration
 */
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Interface for file objects used in deployment
 */
interface DeployFile {
  path: string;
  content: string | Buffer;
}

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
  };

  // Merge headers
  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers });

      // Don't retry on auth errors (401, 403) or 4xx client errors (unless it's rate limiting)
      if (response.status === 401 || response.status === 403) {
        console.error(`[Cloudflare] Auth error: ${response.status}`);
        return response;
      }

      if (response.ok) {
        return response;
      }

      if (response.status < 500 && response.status !== 429) {
          return response;
      }

      const errorText = await response.text();
      console.error(`[Cloudflare] API call failed (attempt ${i + 1}/${retries}):`, {
        url,
        status: response.status,
        error: errorText,
      });

      lastError = errorText;

      if (i < retries - 1) {
        const waitTime = 1000 * Math.pow(2, i); // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    } catch (error) {
      console.error(`[Cloudflare] Request error (attempt ${i + 1}/${retries}):`, error);
      lastError = error;

      if (i < retries - 1) {
        const waitTime = 1000 * Math.pow(2, i);
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }
  }

  throw new Error(`API call failed after ${retries} retries: ${lastError}`);
}

/**
 * Get or create Cloudflare Pages project and return details
 */
async function getOrCreateProject(
  accountId: string,
  projectName: string,
  apiToken: string
): Promise<{ subdomain: string; name: string }> {
  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`;
  const checkResponse = await cloudflareApiCall(url, { method: "GET" }, apiToken, 1);

  if (checkResponse.ok) {
    const data = await checkResponse.json();
    return data.result;
  }

  if (checkResponse.status === 404) {
    console.log(`[Cloudflare] Project ${projectName} not found. Creating...`);
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
      apiToken
    );

    if (!createResponse.ok) {
      const err = await createResponse.text();
      throw new Error(`Failed to create project: ${err}`);
    }

    // Wait a bit for propagation
    await new Promise((r) => setTimeout(r, 2000));

    const createData = await createResponse.json();
    return createData.result;
  }

  const err = await checkResponse.text();
  throw new Error(`Failed to check project existence: ${checkResponse.status} ${err}`);
}

/**
 * Generates the Manifest and ZIP package for Cloudflare Direct Upload
 */
async function generateDeploymentPackage(files: DeployFile[]) {
  // Use SHA-256 for Cloudflare Pages (Direct Upload v2)
  const manifest: Record<string, string> = {};

  // Create ZIP with level 0 (STORE) to avoid compression issues and speed up build
  const archive = archiver("zip", { zlib: { level: 0 } });

  const chunks: Buffer[] = [];

  return new Promise<{ manifest: string; zipBuffer: Buffer }>((resolve, reject) => {
    archive.on("error", (err) => reject(err));

    // Capture the zip output in memory
    archive.on("data", (chunk) => chunks.push(chunk));

    archive.on("end", () => {
      const zipBuffer = Buffer.concat(chunks);
      resolve({ manifest: JSON.stringify(manifest), zipBuffer });
    });

    // Process each file
    files.forEach((file) => {
      // Normalize path: Ensure it starts with / for manifest
      let manifestPath = file.path.startsWith("/") ? file.path : `/${file.path}`;

      // Convert content to Buffer if it's string
      let contentBuffer = Buffer.isBuffer(file.content)
        ? file.content
        : Buffer.from(file.content);

      // Sanity check: Empty files cause issues
      if (contentBuffer.length === 0) {
        console.warn(`[Cloudflare] Warning: File ${manifestPath} is empty. Injecting placeholder.`);
        contentBuffer = Buffer.from("<!-- Empty Page -->");
      }

      // Compute SHA-256 (Critical for Cloudflare verification)
      const hash = crypto.createHash("sha256").update(contentBuffer).digest("hex");

      // Add to manifest
      manifest[manifestPath] = hash;

      console.log(`[Cloudflare] Pack: ${manifestPath} | Size: ${contentBuffer.length} | Hash: ${hash.substring(0, 8)}...`);

      // Add to ZIP (relative path)
      const zipName = manifestPath.startsWith("/") ? manifestPath.slice(1) : manifestPath;
      archive.append(contentBuffer, { name: zipName });
    });

    archive.finalize();
  });
}

/**
 * Uploads the deployment package to Cloudflare
 */
async function uploadToCloudflare(
  accountId: string,
  projectName: string,
  apiToken: string,
  manifestString: string,
  zipBuffer: Buffer
) {
  // Use 'form-data' package
  const form = new FormData();

  // 1. Append Manifest
  form.append("manifest", manifestString, {
    contentType: "application/json",
  });

  // 2. Append ZIP file
  // Try "files" instead of "file" (some v2 docs/implementations use files)
  form.append("files", zipBuffer, {
    filename: "site.zip",
    contentType: "application/zip",
  });

  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments`;

  const body = form.getBuffer();
  const headers = form.getHeaders();

  console.log(`[Cloudflare] Uploading multipart payload. Manifest len: ${manifestString.length}, Zip len: ${zipBuffer.length}`);

  const response = await cloudflareApiCall(
    url,
    {
      method: "POST",
      body: body as any,
      headers: headers,
    },
    apiToken
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Cloudflare Upload Failed: ${response.status} - ${errorText}`);
  }

  return response.json();
}

/**
 * POST /api/cloudflare/deploy
 */
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId, cloudflareProjectName } = await request.json();

    if (!projectId) {
      return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db();

    // 1. Get Credentials
    const tokenDoc = await db.collection("cloudflare_tokens").findOne({
      projectId: new ObjectId(projectId),
      userId: session.user.email,
    });

    if (!tokenDoc) {
      return NextResponse.json(
        { error: "No Cloudflare credentials found. Please authenticate first." },
        { status: 400 }
      );
    }

    // 2. Get Project
    const project = await db.collection("projects").findOne({
      _id: new ObjectId(projectId),
      userId: session.user.id,
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // 3. Determine Cloudflare Project Name
    let cfProjectName = cloudflareProjectName || project.cloudflareProjectName;
    if (!cfProjectName) {
      const baseName = project.name || project.businessName || `project-${projectId}`;
      cfProjectName = baseName
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/--+/g, "-")
        .replace(/^-|-$/g, "")
        .substring(0, 58);
    }

    // 4. Collect Files
    const pages = await db
      .collection("pages")
      .find({ projectId: new ObjectId(projectId) })
      .toArray();

    const files: DeployFile[] = [];

    // Fallback content with RED background for visibility
    if (pages.length === 0) {
        const title = project.businessName || project.name || "New Site";
        const content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Start Imagining</title>
    <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #ffe4e6; color: #881337; }
        .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
        h1 { margin: 0 0 1rem; color: #be123c; }
    </style>
</head>
<body>
    <div class="card">
        <h1>${title}</h1>
        <p>Your site is ready (Debug: Red Background).</p>
        <p><a href="/debug.html">Check Debug Info</a></p>
    </div>
</body>
</html>`;

        // ONLY Nested folder index.html (per user request: "1 nest system and 1 index file")
        files.push({
            path: "/my-site/index.html",
            content: content
        });

    } else {
        pages.forEach(page => {
            const fileName = page.name === "index" ? "index.html" : `${page.name}.html`;
            const content = (page.content && page.content.trim().length > 0)
                ? page.content
                : `<!DOCTYPE html><html><body><h1>${page.name}</h1><p>Content coming soon.</p></body></html>`;
            files.push({
                path: `/${fileName}`,
                content: content
            });
        });
    }

    // Ensure index.html exists (aliasing)
    // SKIP aliasing if we are in fallback mode (pages.length === 0) to respect "1 index file" request
    if (pages.length > 0) {
        const hasIndex = files.some(f => f.path === "/index.html");
        if (!hasIndex && files.length > 0) {
            const firstFile = files[0];
            console.log(`[Cloudflare] No index.html found. Aliasing ${firstFile.path} to /index.html`);
            files.push({
                path: "/index.html",
                content: firstFile.content
            });
        }
    }

    // Add Debug Page
    files.push({
        path: "/debug.html",
        content: `<!DOCTYPE html><html><body><h1>Debug Info</h1><p>Built at: ${new Date().toISOString()}</p><p>Files: ${files.length}</p></body></html>`
    });

    // Add _headers to force HTML
    files.push({
        path: "/_headers",
        content: "/*\n  Content-Type: text/html; charset=utf-8\n"
    });

    // --- WORKER GENERATION ---
    // Generate _worker.js to guarantee content serving (Advanced Mode)
    let indexContent = "";
    // Find the main content to embed
    const fallbackIndex = files.find(f => f.path === "/my-site/index.html");
    const rootIndex = files.find(f => f.path === "/index.html");

    if (rootIndex) {
        indexContent = rootIndex.content.toString();
    } else if (fallbackIndex) {
        indexContent = fallbackIndex.content.toString();
    } else if (files.length > 0) {
        indexContent = files[0].content.toString();
    }

    if (indexContent) {
        // Escape content for template literal
        const escapedContent = indexContent.replace(/`/g, '\\`').replace(/\$/g, '\\$');

        const workerScript = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. API Handling (Stub)
    if (url.pathname.startsWith('/api/')) {
        return new Response(JSON.stringify({
            message: "API is working",
            time: new Date().toISOString(),
            path: url.pathname
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 2. Explicitly serve index content for root paths (Optimization)
    if (url.pathname === "/" || url.pathname === "/index.html" || url.pathname.startsWith("/my-site")) {
      return new Response(\`${escapedContent}\`, {
        headers: { "content-type": "text/html; charset=utf-8" }
      });
    }

    // 3. Try serving other static assets (e.g. style.css)
    try {
      const asset = await env.ASSETS.fetch(request);
      if (asset.status < 400) {
          return asset;
      }
    } catch (e) {
      // Fall through to SPA fallback
    }

    // 4. SPA Fallback (Serve Embedded Index for unknown routes)
    return new Response(\`${escapedContent}\`, {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
};`;

        files.push({
            path: "/_worker.js",
            content: workerScript
        });
        console.log("[Cloudflare] Generated _worker.js for Advanced Mode (API + SPA)");
    }
    // -------------------------

    // 5. Get Project Details
    const cfProject = await getOrCreateProject(tokenDoc.accountId, cfProjectName, tokenDoc.apiToken);
    console.log(`[Cloudflare] Target: ${cfProject.name} (${cfProject.subdomain})`);

    // 6. Generate Package (Manifest + ZIP)
    const { manifest, zipBuffer } = await generateDeploymentPackage(files);

    // 7. Upload
    const result: any = await uploadToCloudflare(
        tokenDoc.accountId,
        cfProjectName,
        tokenDoc.apiToken,
        manifest,
        zipBuffer
    );

    const deploymentId = result.result?.id;

    // Construct the correct URL based on deployment structure
    let deploymentUrl = `https://${cfProject.subdomain}`;
    if (pages.length === 0) {
        deploymentUrl = `https://${cfProject.subdomain}/my-site/`;
    }

    console.log(`[Cloudflare] Success! URL: ${deploymentUrl}`);

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
      }
    );

    return NextResponse.json({
      success: true,
      url: deploymentUrl,
      deploymentId,
      projectName: cfProjectName,
    });

  } catch (error: any) {
    console.error("[Cloudflare] Deployment Error:", error);
    return NextResponse.json(
      { error: error.message || "Deployment failed" },
      { status: 500 }
    );
  }
}
