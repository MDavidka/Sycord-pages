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
      // console.log(`[Cloudflare] DEBUG: API call attempt ${i + 1}/${retries} to ${url}`);
      
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
          // Client error, usually don't retry unless we know it's transient
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
  const manifest: Record<string, { size: number; sha1: string }> = {};
  // Use STORE (no compression) to verify integrity and debugging
  const archive = archiver("zip", { zlib: { level: 0 } });

  const chunks: Buffer[] = [];

  return new Promise<{ manifest: any; zipBuffer: Buffer }>((resolve, reject) => {
    archive.on("error", (err) => reject(err));

    // Capture the zip output in memory
    archive.on("data", (chunk) => chunks.push(chunk));

    archive.on("end", () => {
      const zipBuffer = Buffer.concat(chunks);
      resolve({ manifest, zipBuffer });
    });

    // Process each file
    files.forEach((file) => {
      // Normalize path: Ensure it starts with /
      let cleanPath = file.path.startsWith("/") ? file.path : `/${file.path}`;

      // Convert content to Buffer if it's string
      const contentBuffer = Buffer.isBuffer(file.content)
        ? file.content
        : Buffer.from(file.content);

      console.log(`[Cloudflare] Adding file: ${cleanPath} (${contentBuffer.length} bytes)`);

      // Compute SHA1 (Required by Cloudflare)
      const sha1 = crypto.createHash("sha1").update(contentBuffer).digest("hex");

      // Add to manifest
      manifest[cleanPath] = {
        size: contentBuffer.length,
        sha1: sha1,
      };

      // Add to ZIP (relative path)
      const zipPath = cleanPath.startsWith("/") ? cleanPath.slice(1) : cleanPath;
      archive.append(contentBuffer, { name: zipPath });
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
  manifest: any,
  zipBuffer: Buffer
) {
  // Use 'form-data' package to create a stream/buffer with correct headers
  const form = new FormData();

  // 1. Append Manifest
  // Cloudflare requires the part named "manifest" to have Content-Type: application/json
  form.append("manifest", JSON.stringify(manifest), {
    contentType: "application/json",
  });

  // 2. Append ZIP file
  // Cloudflare requires the part named "file" to have Content-Type: application/zip
  form.append("file", zipBuffer, {
    filename: "site.zip",
    contentType: "application/zip",
  });

  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments`;
  
  // Convert form to buffer to avoid stream issues with fetch in some environments
  const body = form.getBuffer();
  const headers = form.getHeaders(); // Get multipart headers with boundary

  const response = await cloudflareApiCall(
    url,
    {
      method: "POST",
      body: body as any, // Cast to any to satisfy RequestInit type (Buffer is valid)
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

    if (pages.length === 0) {
        // Fallback: Default "Start Imagining" page
        const title = project.businessName || project.name || "New Site";
        files.push({
            path: "/index.html",
            content: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Start Imagining</title>
    <meta name="description" content="Your new site is ready to be built.">
    <style>
        :root {
            --bg-color: #f9fafb;
            --text-color: #111827;
            --accent-color: #3b82f6;
            --secondary-text: #6b7280;
        }
        @media (prefers-color-scheme: dark) {
            :root {
                --bg-color: #0f172a;
                --text-color: #f3f4f6;
                --accent-color: #60a5fa;
                --secondary-text: #9ca3af;
            }
        }
        body {
            font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            background-color: var(--bg-color);
            color: var(--text-color);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
            padding: 1rem;
            text-align: center;
        }
        main {
            max-width: 600px;
            width: 100%;
            animation: fadeIn 1s ease-out;
            padding: 2rem;
        }
        h1 {
            font-size: 2.5rem;
            margin-bottom: 1rem;
            font-weight: 800;
            letter-spacing: -0.025em;
            background: linear-gradient(135deg, var(--text-color) 0%, var(--accent-color) 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }
        p {
            font-size: 1.25rem;
            color: var(--secondary-text);
            margin-bottom: 2rem;
            line-height: 1.6;
        }
        .icon-container {
            margin-bottom: 2rem;
            display: inline-flex;
            padding: 1rem;
            border-radius: 1rem;
            background-color: rgba(59, 130, 246, 0.1);
            animation: float 3s ease-in-out infinite;
        }
        svg {
            width: 48px;
            height: 48px;
            color: var(--accent-color);
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
            0% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
            100% { transform: translateY(0px); }
        }
    </style>
</head>
<body>
    <main>
        <div class="icon-container">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
        </div>
        <h1>Start Imagining Your Site</h1>
        <p>This is a preview of your future project. Use the AI Builder to generate content and watch this space transform.</p>
    </main>
</body>
</html>`
        });
    } else {
        pages.forEach(page => {
            const fileName = page.name === "index" ? "index.html" : `${page.name}.html`;
            files.push({
                path: `/${fileName}`,
                content: page.content || ""
            });
        });
    }

    // Explicitly add _headers file to ensure proper mime types
    files.push({
        path: "/_headers",
        content: `/index.html\n  Content-Type: text/html; charset=utf-8\n`
    });

    // 5. Ensure Project Exists & Get Details
    // We now fetch the canonical subdomain from Cloudflare
    const cfProject = await getOrCreateProject(tokenDoc.accountId, cfProjectName, tokenDoc.apiToken);

    const liveSubdomain = cfProject.subdomain;
    console.log(`[Cloudflare] Project Subdomain: ${liveSubdomain}`);

    // 6. Generate Package (Manifest + ZIP)
    console.log(`[Cloudflare] Generating package for ${cfProjectName}...`);
    const { manifest, zipBuffer } = await generateDeploymentPackage(files);
    console.log(`[Cloudflare] ZIP size: ${zipBuffer.length} bytes`);

    // 7. Upload
    console.log(`[Cloudflare] Uploading to Cloudflare...`);
    const result: any = await uploadToCloudflare(
        tokenDoc.accountId,
        cfProjectName,
        tokenDoc.apiToken,
        manifest,
        zipBuffer
    );

    const deploymentId = result.result?.id;
    // Use the canonical subdomain provided by Cloudflare
    const deploymentUrl = `https://${liveSubdomain}`;

    console.log(`[Cloudflare] Deployment Success: ${deploymentUrl}`);

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
