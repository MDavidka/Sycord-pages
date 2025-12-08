import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import archiver from "archiver";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

// Promisify fs functions if not using fs.promises directly (Node 14+ usually has fs/promises but explicit is safe)
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const rm = promisify(fs.rm);

/**
 * Cloudflare API Configuration
 */
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

/**
 * Helper to get MIME type based on extension
 */
function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".css": "text/css",
    ".js": "application/javascript",
    ".json": "application/json",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".txt": "text/plain",
    ".xml": "application/xml",
  };
  return mimeTypes[ext] || "application/octet-stream";
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
 * Generates the ZIP package from a directory on disk.
 * Also performs rigorous validation and logging as requested.
 */
async function generatePackageFromDisk(dirPath: string) {
  const manifest: Record<string, string> = {};
  const debugFiles: Record<string, any> = {};

  // Create ZIP with level 0 (STORE)
  const archive = archiver("zip", { zlib: { level: 0 } });
  const chunks: Buffer[] = [];

  // Recursive directory scanner
  async function scan(currentDir: string, relativeRoot: string = "") {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      const relativePath = path.join(relativeRoot, entry.name).replace(/\\/g, "/"); // Ensure forward slashes

      if (entry.isDirectory()) {
        await scan(fullPath, relativePath);
      } else if (entry.isFile()) {
        const content = await readFile(fullPath);
        const stats = await stat(fullPath);

        // --- VALIDATION & LOGGING START ---

        // 1. Check for empty files
        if (content.length === 0) {
          console.error(`[Cloudflare] CRITICAL: File ${relativePath} is 0 bytes! This causes blank pages.`);
          throw new Error(`File ${relativePath} is empty. Deployment aborted.`);
        }

        // 2. Compute Hashes
        // Cloudflare Pages Direct Upload v2 uses SHA-256
        const sha256 = crypto.createHash("sha256").update(content).digest("hex");
        const md5 = crypto.createHash("md5").update(content).digest("hex");

        // 3. Prepare Manifest Key (Must be absolute path /foo.html)
        const manifestKey = `/${relativePath}`;
        manifest[manifestKey] = sha256;

        // 4. Debug Object Construction (User requested { manifest, files })
        const base64Preview = content.toString("base64").substring(0, 50) + "...";
        debugFiles[relativePath] = {
          size: stats.size,
          sha256: sha256,
          md5: md5, // Included for user verification
          mime: getMimeType(entry.name),
          preview_base64: base64Preview,
          preview_text: content.length < 100 ? content.toString("utf8") : content.toString("utf8").substring(0, 100) + "..."
        };

        // Add to ZIP
        archive.append(content, { name: relativePath });

        // --- VALIDATION & LOGGING END ---
      }
    }
  }

  // Execute Scan
  await scan(dirPath);

  // LOGGING: Detailed Payload Inspection
  const payloadDebug = {
    manifest: manifest,
    files: debugFiles
  };
  console.log("[Cloudflare] --- DEPLOYMENT PAYLOAD DEBUG ---");
  console.log(JSON.stringify(payloadDebug, null, 2));
  console.log("[Cloudflare] -------------------------------");

  // Validate Index
  if (!manifest["/index.html"]) {
    console.error("[Cloudflare] CRITICAL: index.html is missing from manifest!");
    throw new Error("Missing index.html in deployment package.");
  }

  return new Promise<{ manifest: string; zipBuffer: Buffer }>((resolve, reject) => {
    archive.on("error", (err) => reject(err));
    archive.on("data", (chunk) => chunks.push(chunk));
    archive.on("end", () => {
      const zipBuffer = Buffer.concat(chunks);
      resolve({ manifest: JSON.stringify(manifest), zipBuffer });
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
  const form = new FormData();

  // 1. Append Manifest
  form.append("manifest", manifestString, {
    contentType: "application/json",
  });

  // 2. Append ZIP file
  form.append("file", zipBuffer, {
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
  let tempDir = "";

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

    // 4. PREPARE TEMPORARY DIRECTORY (Disk-based workflow)
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "cf-deploy-"));
    console.log(`[Cloudflare] Created temp dir: ${tempDir}`);

    // 5. Fetch Pages from DB and Write to Disk
    const pages = await db
      .collection("pages")
      .find({ projectId: new ObjectId(projectId) })
      .toArray();

    if (pages.length === 0) {
        // Create default index.html on disk
        const title = project.businessName || project.name || "New Site";
        const content = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Start Imagining</title>
    <style>
        body { font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f9ff; color: #0f172a; }
        .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 400px; }
        h1 { margin: 0 0 1rem; color: #3b82f6; }
    </style>
</head>
<body>
    <div class="card">
        <h1>${title}</h1>
        <p>Your site is ready. Use the AI Builder to add content.</p>
    </div>
</body>
</html>`;
        await writeFile(path.join(tempDir, "index.html"), content, "utf8");
    } else {
        for (const page of pages) {
            const fileName = page.name === "index" ? "index.html" : `${page.name}.html`;
            const filePath = path.join(tempDir, fileName);

            // Validate DB Content before writing
            let content = page.content;
            if (!content || content.trim().length === 0) {
                 console.warn(`[Cloudflare] DB content empty for ${fileName}. Using placeholder.`);
                 content = `<!DOCTYPE html><html><body><h1>${page.name}</h1><p>Content coming soon.</p></body></html>`;
            }

            // Ensure directory exists if filename contains paths (though currently pages are flat)
            // But just in case user has "blog/index" as name
            await mkdir(path.dirname(filePath), { recursive: true });

            await writeFile(filePath, content, "utf8");
        }
    }

    // Ensure index.html exists in temp dir (aliasing check)
    try {
        await stat(path.join(tempDir, "index.html"));
    } catch (e) {
        // If index.html missing, look for *any* html file and copy it
        const files = await readdir(tempDir);
        const firstHtml = files.find(f => f.endsWith(".html"));
        if (firstHtml) {
            console.log(`[Cloudflare] No index.html found. Copying ${firstHtml} to index.html`);
            const content = await readFile(path.join(tempDir, firstHtml));
            await writeFile(path.join(tempDir, "index.html"), content);
        } else {
            // Write a fallback
            await writeFile(path.join(tempDir, "index.html"), "<h1>Site Under Construction</h1>", "utf8");
        }
    }

    // 6. Get Project Details from Cloudflare
    const cfProject = await getOrCreateProject(tokenDoc.accountId, cfProjectName, tokenDoc.apiToken);
    console.log(`[Cloudflare] Target: ${cfProject.name} (${cfProject.subdomain})`);

    // 7. Generate Package from Disk (includes validation)
    const { manifest, zipBuffer } = await generatePackageFromDisk(tempDir);

    // 8. Upload
    const result: any = await uploadToCloudflare(
        tokenDoc.accountId,
        cfProjectName,
        tokenDoc.apiToken,
        manifest,
        zipBuffer
    );

    const deploymentId = result.result?.id;
    const deploymentUrl = `https://${cfProject.subdomain}`;

    console.log(`[Cloudflare] Success! URL: ${deploymentUrl}`);

    // 9. Update DB
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
  } finally {
      // Clean up temp dir
      if (tempDir) {
          try {
              await rm(tempDir, { recursive: true, force: true });
              console.log(`[Cloudflare] Cleaned up temp dir: ${tempDir}`);
          } catch (e) {
              console.error(`[Cloudflare] Failed to clean temp dir: ${e}`);
          }
      }
  }
}
