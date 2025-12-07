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

  // Merge headers, but be careful with FormData which sets its own Content-Type
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

      // If 404/409/429, we might want to handle differently
      // 429 is rate limit -> retry
      // 5xx -> retry
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
 * Ensure the project exists in Cloudflare Pages
 */
async function ensureProject(
  accountId: string,
  projectName: string,
  apiToken: string
): Promise<void> {
  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`;
  const checkResponse = await cloudflareApiCall(url, { method: "GET" }, apiToken, 1);

  if (checkResponse.ok) {
    return;
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
          // Default config usually works
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
    return;
  }

  const err = await checkResponse.text();
  throw new Error(`Failed to check project existence: ${checkResponse.status} ${err}`);
}

/**
 * Generates the Manifest and ZIP package for Cloudflare Direct Upload
 */
async function generateDeploymentPackage(files: DeployFile[]) {
  const manifest: Record<string, { size: number; sha1: string }> = {};
  const archive = archiver("zip", { zlib: { level: 9 } });

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

      // Compute SHA1 (Required by Cloudflare)
      const sha1 = crypto.createHash("sha1").update(contentBuffer).digest("hex");

      // Add to manifest
      manifest[cleanPath] = {
        size: contentBuffer.length,
        sha1: sha1,
      };

      // Add to ZIP (remove leading slash for zip internal structure, usually cleaner)
      // But Cloudflare might expect paths in zip to match manifest.
      // Usually zip entries are relative. "index.html".
      // Manifest says "/index.html".
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
  const form = new FormData();

  // 1. Append Manifest (must be named "manifest", Content-Type: application/json)
  form.append("manifest", JSON.stringify(manifest), {
    contentType: "application/json",
  });

  // 2. Append ZIP file (must be named "file", Content-Type: application/zip)
  form.append("file", zipBuffer, {
    filename: "site.zip",
    contentType: "application/zip",
  });

  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments`;
  
  // Use node-fetch compatible call with headers from form-data
  const response = await cloudflareApiCall(
    url,
    {
      method: "POST",
      body: form as any, // Cast to any because FormData type mismatch with fetch body
      // form-data getHeaders() returns the multipart content-type with boundary
      headers: form.getHeaders(),
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
        // Fallback: Default "Coming Soon" page
        const title = project.businessName || project.name || "My Website";
        files.push({
            path: "/index.html",
            content: `<!DOCTYPE html><html><head><title>${title}</title></head><body><h1>${title}</h1><p>Coming Soon!</p></body></html>`
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

    // 5. Ensure Project Exists
    await ensureProject(tokenDoc.accountId, cfProjectName, tokenDoc.apiToken);

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
    const url = result.result?.url; // or construct from alias
    const deploymentUrl = `https://${cfProjectName}.pages.dev`; // Primary alias usually

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
