import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import clientPromise from "@/lib/mongodb";
import { ObjectId } from "mongodb";

/**
 * Cloudflare API Configuration
 */
const CLOUDFLARE_API_BASE = "https://api.cloudflare.com/client/v4";

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

  if (options.headers) {
    Object.assign(headers, options.headers);
  }

  let lastError: any;
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, { ...options, headers });

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
        const waitTime = 1000 * Math.pow(2, i);
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

async function getWorkersSubdomain(accountId: string, apiToken: string): Promise<string> {
    const res = await cloudflareApiCall(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/subdomain`,
        { method: "GET" },
        apiToken
    );
    if (!res.ok) throw new Error("Failed to get workers subdomain");
    const data = await res.json();
    return data.result.subdomain;
}

async function deployWorkerScript(accountId: string, scriptName: string, content: string, apiToken: string) {
    // 1. Upload Script (PUT) using multipart/form-data for ES Module support
    const form = new FormData();

    // Metadata part: Defines the main module
    const metadata = JSON.stringify({ main_module: "worker.js" });
    const metadataBlob = new Blob([metadata], { type: "application/json" });
    form.append("metadata", metadataBlob);

    // Script part: The ES Module content
    const scriptBlob = new Blob([content], { type: "application/javascript+module" });
    form.append("worker.js", scriptBlob, "worker.js");

    const uploadRes = await cloudflareApiCall(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}`,
        {
            method: "PUT",
            body: form,
            // @ts-ignore - 'duplex' is often needed in Node fetch for streaming bodies
            duplex: 'half'
        },
        apiToken
    );

    if (!uploadRes.ok) {
        const err = await uploadRes.text();
        throw new Error(`Worker upload failed: ${err}`);
    }

    // 2. Enable on Subdomain (POST)
    const enableRes = await cloudflareApiCall(
        `${CLOUDFLARE_API_BASE}/accounts/${accountId}/workers/scripts/${scriptName}/subdomain`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: true })
        },
        apiToken
    );

    if (!enableRes.ok) {
        const txt = await enableRes.text();
        console.warn(`[Cloudflare] Subdomain enable warning: ${txt}`);
    }
}

/**
 * POST /api/cloudflare/deploy
 * Deploys the project as a standard Cloudflare Worker (workers.dev)
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

    // 3. Determine Cloudflare Worker Name
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

    // 4. Collect Pages
    const pages = await db
      .collection("pages")
      .find({ projectId: new ObjectId(projectId) })
      .toArray();

    // Construct a simple router map (Path -> HTML Content)
    const routes: Record<string, string> = {};
    let defaultContent = "";

    if (pages.length === 0) {
        // Fallback "Start Imagining"
        defaultContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${project.name || "New Site"}</title>
    <style>
        body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f0f9ff; color: #0f172a; }
        .card { background: white; padding: 2rem; border-radius: 1rem; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1); text-align: center; max-width: 400px; border: 1px solid #e2e8f0; }
        h1 { margin: 0 0 1rem; color: #0284c7; }
        p { color: #64748b; line-height: 1.5; }
        .badge { background: #e0f2fe; color: #0369a1; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.875rem; font-weight: 500; margin-top: 1rem; display: inline-block; }
    </style>
</head>
<body>
    <div class="card">
        <h1>${project.name || "New Site"}</h1>
        <p>This site is successfully deployed as a Cloudflare Worker.</p>
        <div class="badge">Workers Mode</div>
    </div>
</body>
</html>`;
        routes["/"] = defaultContent;
    } else {
        pages.forEach(page => {
            // Map "index" to "/" and "/index.html"
            const content = page.content || `<h1>${page.name}</h1>`;
            if (page.name === "index") {
                routes["/"] = content;
                routes["/index.html"] = content;
            } else {
                routes[`/${page.name}`] = content;
                routes[`/${page.name}.html`] = content;
            }
        });
        // Set default to index or first page
        defaultContent = routes["/"] || Object.values(routes)[0];
    }

    // 5. Generate Worker Script
    const workerScript = `
const ROUTES = ${JSON.stringify(routes)};
const DEFAULT_HTML = ${JSON.stringify(defaultContent)};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // API Stub
    if (path.startsWith("/api/")) {
       return new Response(JSON.stringify({
         msg: "API is working",
         path: path,
         time: new Date().toISOString()
       }), {
         headers: { "content-type": "application/json" }
       });
    }

    // Router lookup
    let content = ROUTES[path];

    // Fallback: Try removing trailing slash or adding .html
    if (!content) {
        if (path.endsWith("/") && path.length > 1) {
             content = ROUTES[path.slice(0, -1)];
        } else if (!path.endsWith(".html")) {
             content = ROUTES[path + ".html"];
        }
    }

    // SPA Fallback (Serve default content for unknown routes)
    if (!content) {
        content = DEFAULT_HTML;
    }

    return new Response(content, {
      headers: { "content-type": "text/html; charset=utf-8" }
    });
  }
};
`;

    // 6. Deploy to Cloudflare Workers
    console.log(`[Cloudflare] Deploying Worker Script: ${cfProjectName}`);
    await deployWorkerScript(tokenDoc.accountId, cfProjectName, workerScript, tokenDoc.apiToken);

    // 7. Get Subdomain & Construct URL
    const subdomain = await getWorkersSubdomain(tokenDoc.accountId, tokenDoc.apiToken);
    const deploymentUrl = `https://${cfProjectName}.${subdomain}.workers.dev`;

    console.log(`[Cloudflare] Success! Worker URL: ${deploymentUrl}`);

    // 8. Update DB
    await db.collection("projects").updateOne(
      { _id: new ObjectId(projectId) },
      {
        $set: {
          cloudflareProjectName: cfProjectName,
          cloudflareUrl: deploymentUrl,
          cloudflareDeployedAt: new Date(),
          cloudflareDeploymentId: "worker-latest",
        },
      }
    );

    return NextResponse.json({
      success: true,
      url: deploymentUrl,
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
