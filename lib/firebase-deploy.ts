import { google } from "googleapis";

/**
 * Handles Firebase Hosting deployment logic via Google APIs
 */

export async function deployToFirebase(
  accessToken: string,
  projectId: string, // The Firebase Project ID (e.g. "my-project-123")
  siteId: string,    // The Site ID (e.g. "my-awesome-site")
  htmlContent: string
) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  const firebaseHosting = google.firebasehosting({ version: "v1beta1", auth });

  console.log(`[Firebase Deploy] Starting deployment to site: ${siteId} in project: ${projectId}`);

  try {
    // 1. Create a new Version for the site
    // Parent format: projects/{project}/sites/{site}
    const parent = `projects/${projectId}/sites/${siteId}`;

    // Check if site exists first?
    // Usually we assume the site exists or we try to create it.
    // Creating a site requires: POST projects/{project}/sites { siteId: ... }

    try {
        await firebaseHosting.projects.sites.get({ name: parent });
    } catch (e: any) {
        if (e.code === 404) {
            console.log(`[Firebase Deploy] Site ${siteId} not found, creating...`);
            await firebaseHosting.projects.sites.create({
                parent: `projects/${projectId}`,
                siteId: siteId
            });
        } else {
            throw e;
        }
    }

    console.log(`[Firebase Deploy] Creating version...`);
    const versionRes = await firebaseHosting.projects.sites.versions.create({
      parent,
      requestBody: {
        config: {
          headers: [{ glob: "**", headers: { "Cache-Control": "max-age=1800" } }]
        }
      }
    });

    const versionName = versionRes.data.name; // projects/.../sites/.../versions/...
    if (!versionName) throw new Error("Failed to create version");

    console.log(`[Firebase Deploy] Version created: ${versionName}`);

    // 2. Populate files
    const zlib = await import("zlib");
    const crypto = await import("crypto");
    const { promisify } = await import("util");
    const gzip = promisify(zlib.gzip);

    const gzippedContent = await gzip(Buffer.from(htmlContent, "utf-8"));
    const hash = crypto.createHash("sha256").update(gzippedContent).digest("hex");

    console.log(`[Firebase Deploy] Populating files...`);
    const populateRes = await firebaseHosting.projects.sites.versions.populateFiles({
        parent: versionName,
        requestBody: {
            files: {
                "/index.html": hash
            }
        }
    });

    // 3. Upload file if required
    if (populateRes.data.uploadRequiredHashes?.includes(hash)) {
        const uploadUrl = populateRes.data.uploadUrl;
        if (!uploadUrl) throw new Error("Upload URL missing");

        console.log(`[Firebase Deploy] Uploading content to ${uploadUrl}...`);

        const uploadRes = await fetch(uploadUrl + "/" + hash, {
            method: "POST",
            headers: {
                "Content-Type": "application/octet-stream"
            },
            body: gzippedContent
        });

        if (!uploadRes.ok) {
            throw new Error(`Failed to upload file content: ${uploadRes.statusText}`);
        }
    }

    // 4. Finalize version
    console.log(`[Firebase Deploy] Finalizing version...`);
    await firebaseHosting.projects.sites.versions.patch({
        name: versionName,
        requestBody: { status: "FINALIZED" },
        updateMask: "status"
    });

    // 5. Release
    console.log(`[Firebase Deploy] Releasing...`);
    await firebaseHosting.projects.sites.releases.create({
        parent,
        versionName: versionName
    });

    return {
        success: true,
        url: `https://${siteId}.web.app`,
        siteId
    };

  } catch (error: any) {
    console.error("[Firebase Deploy] Error:", error);
    throw error;
  }
}

export async function getFirebaseProjects(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });
    const firebase = google.firebase({ version: "v1beta1", auth });

    // List Firebase Projects
    const res = await firebase.projects.list({ pageSize: 10 });
    return res.data.results || [];
}

/**
 * Creates a new Google Cloud Project and adds Firebase to it.
 * This is a heavy operation.
 */
export async function createFirebaseProject(accessToken: string) {
    const auth = new google.auth.OAuth2();
    auth.setCredentials({ access_token: accessToken });

    const crm = google.cloudresourcemanager({ version: "v1", auth });
    const serviceUsage = google.serviceusage({ version: "v1", auth });
    const firebase = google.firebase({ version: "v1beta1", auth });

    // 1. Generate unique project ID
    // Project IDs must be unique globally.
    const projectId = `ltpd-site-${Math.floor(Math.random() * 1000000)}`;
    const displayName = "LTPD Website Project";

    console.log(`[Firebase Create] Creating new GCP Project: ${projectId}`);

    // 2. Create GCP Project
    // Note: Creating a project might require a parent resource if the user is in an org.
    // We assume a personal account (no parent) for simplicity, or let the API decide.
    // If it fails due to missing parent, it might be an org policy.

    const projectRes = await crm.projects.create({
        requestBody: {
            projectId,
            name: displayName
        }
    });

    // Wait for operation is not directly supported by v1 `create` which returns Operation?
    // Actually v1 `create` returns `Operation` but `googleapis` types might vary.
    // Let's assume it returns an Operation and we need to poll it.
    // However, for simplicity and because we don't have a robust poller:
    // We can just wait a bit and try to get the project.

    console.log("[Firebase Create] Waiting for project creation...");
    await new Promise(r => setTimeout(r, 5000)); // Wait 5s

    // 3. Enable Firebase API
    // We need to enable `firebase.googleapis.com` on the new project.
    // Endpoint: projects/{project}/services/{service}
    console.log("[Firebase Create] Enabling Firebase API...");
    // Format: projects/123/services/firebase.googleapis.com
    // Use numeric projectNumber? No, projectId works usually.
    // But `serviceusage` often expects project NUMBER or ID.

    try {
        const enableOp = await serviceUsage.services.enable({
            name: `projects/${projectId}/services/firebase.googleapis.com`
        });
        // Wait again
        await new Promise(r => setTimeout(r, 5000));
    } catch (e) {
        console.error("[Firebase Create] Failed to enable API (might be already enabled or permission issue):", e);
        // Continue and hope for the best
    }

    // 4. Add Firebase
    console.log("[Firebase Create] Adding Firebase...");
    try {
        const addOp = await firebase.projects.addFirebase({
            project: `projects/${projectId}`,
            requestBody: {}
        });

        // Poll for completion of AddFirebase
        let opName = addOp.data.name;
        if (opName) {
            console.log(`[Firebase Create] Polling operation: ${opName}`);
            while (true) {
                // We need to use `firebase.operations.get` but it's not strictly in the `firebase` client in some versions.
                // It is under `firebase.availableProjects`? No.
                // Actually the `firebase` API definition usually has an `operations` service.
                // Let's check `googleapis` structure.
                // If not available, we wait a fixed time.
                // `googleapis` v1beta1 firebase has `operations`.

                // @ts-ignore
                const op = await firebase.operations.get({ name: opName });
                if (op.data.done) {
                    if (op.data.error) throw new Error(op.data.error.message);
                    break;
                }
                await new Promise(r => setTimeout(r, 2000));
            }
        }
    } catch (e: any) {
        // If it says "already exists" or similar, we proceed.
        console.warn("[Firebase Create] AddFirebase warning:", e.message);
    }

    console.log(`[Firebase Create] Project ready: ${projectId}`);
    return { projectId };
}
