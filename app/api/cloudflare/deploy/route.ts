import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";
import crypto from "crypto";
import FormData from "form-data";
import fs from "fs";
import path from "path";
import os from "os";
import { promisify } from "util";

// Promisify fs functions
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
 * Get or create Cloudflare Pages project and return details
 */
async function getOrCreateProject(
  accountId: string,
  projectName: string,
  apiToken: string
): Promise<{ subdomain: string; name: string }> {
  // We use a simple fetch here since we need to handle 404 specifically
  const url = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}`;

  try {
    const checkResponse = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiToken}`,
      },
    });

    if (checkResponse.ok) {
      const data = await checkResponse.json();
      return data.result;
    }

    if (checkResponse.status === 404) {
      console.log(`[Cloudflare] Project ${projectName} not found. Creating...`);
      const createResponse = await fetch(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiToken}`,
          },
          body: JSON.stringify({
            name: projectName,
            production_branch: "main",
          }),
        }
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
  } catch (error) {
    throw error;
  }
}

/**
 * Prepares the deployment package from disk.
 * Returns the manifest (path -> hash) and a map of files (hash -> buffer).
 */
async function generatePackageFromDisk(dirPath: string) {
  const manifest: Record<string, string> = {};
  const fileMap: Record<string, Buffer> = {};
  const debugFiles: Record<string, any> = {};

  // Recursive directory scanner
  async function scan(currentDir: string, relativeRoot: string = "") {
    const entries = await readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Ensure forward slashes for Cloudflare paths
      // relativeRoot is like "css", entry.name is "style.css" -> "css/style.css"
      // or "" and "index.html" -> "index.html"
      const relativePath = path.join(relativeRoot, entry.name).replace(/\\/g, "/");

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
        fileMap[sha256] = content;

        // 4. Debug Object Construction
        const base64Preview = content.toString("base64").substring(0, 50) + "...";
        debugFiles[relativePath] = {
          size: stats.size,
          sha256: sha256,
          md5: md5,
          mime: getMimeType(entry.name),
          preview_base64: base64Preview,
          preview_text: content.length < 100 ? content.toString("utf8") : content.toString("utf8").substring(0, 100) + "..."
        };

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

  return { manifest, fileMap };
}

/**
 * Performs a Two-Step Direct Upload:
 * 1. POST /deployments with manifest -> Get upload_url
 * 2. POST files to upload_url (multipart/form-data where key=hash)
 */
async function uploadToCloudflareTwoStep(
  accountId: string,
  projectName: string,
  apiToken: string,
  manifest: Record<string, string>,
  fileMap: Record<string, Buffer>
) {
  // --- Step 1: Create Deployment (Send Manifest) ---
  console.log(`[Cloudflare] Step 1: Creating deployment for project '${projectName}' with manifest (${Object.keys(manifest).length} files)...`);

  const createUrl = `${CLOUDFLARE_API_BASE}/accounts/${accountId}/pages/projects/${projectName}/deployments`;

  const createBody = JSON.stringify({
    branch: "main",
    stage: "production", // Added explicitly as per working script
    manifest: manifest,
  });

  // Log strict body for debugging
  console.log("[Cloudflare] Step 1 Body Preview:", createBody.substring(0, 500) + "...");

  const createResponse = await fetch(createUrl, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`
    },
    body: createBody,
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    console.error(`[Cloudflare] Step 1 Failed: ${createResponse.status} - ${errorText}`);
    throw new Error(`Cloudflare Deployment Creation Failed: ${createResponse.status} - ${errorText}`);
  }

  const createResult = await createResponse.json();
  const uploadUrl = createResult.result?.upload_url;
  const deploymentId = createResult.result?.id;

  if (!uploadUrl) {
    // If no upload_url, it might mean all files are already present (deduplicated)
    console.log("[Cloudflare] No upload_url returned. Deployment might be complete (all files cached).");
    return createResult;
  }

  console.log(`[Cloudflare] Step 1 Success. Deployment ID: ${deploymentId}. Upload URL: ${uploadUrl}`);

  // --- Step 2: Upload Files (Multipart where key=SHA256) ---
  const form = new FormData();
  let totalBytes = 0;

  for (const [hash, buffer] of Object.entries(fileMap)) {
    form.append(hash, buffer, {
      filename: hash, // Filename usually ignored but good practice
      contentType: "application/octet-stream",
    });
    totalBytes += buffer.length;
  }

  console.log(`[Cloudflare] Step 2: Uploading ${Object.keys(fileMap).length} files (${totalBytes} bytes) to ${uploadUrl}...`);

  const uploadHeaders = form.getHeaders();

  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    body: form.getBuffer() as any, // Cast to any for fetch compatibility
    headers: {
        ...uploadHeaders,
        // No Auth header needed for signed upload_url
    }
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Cloudflare File Upload Failed: ${uploadResponse.status} - ${errorText}`);
  }

  console.log("[Cloudflare] Step 2 Success: Files uploaded.");

  return createResult;
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

            // Ensure directory exists
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

    // 7. Generate Package (Manifest + File Map)
    const { manifest, fileMap } = await generatePackageFromDisk(tempDir);

    // 8. Upload (Two-Step Flow)
    const result: any = await uploadToCloudflareTwoStep(
        tokenDoc.accountId,
        cfProjectName,
        tokenDoc.apiToken,
        manifest,
        fileMap
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
