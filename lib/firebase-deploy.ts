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
        if (e.code === 404 || e.response?.status === 404) {
            // Note: If siteId == projectId (default site), it should exist.
            // If it doesn't, maybe the project is fresh and site not initialized.
            // But usually default site is created automatically.
            // If we are using a secondary siteId, we must create it.
            // But secondary sites require Blaze plan.
            // If we are here with default siteId and 404, it's weird.
            console.log(`[Firebase Deploy] Site ${siteId} not found. Attempting to create (if not default)...`);

            // Try creation
            try {
                await firebaseHosting.projects.sites.create({
                    parent: `projects/${projectId}`,
                    siteId: siteId
                });
            } catch (createErr: any) {
                console.error(`[Firebase Deploy] Failed to create site ${siteId}:`, createErr.message);
                throw new Error(`Site ${siteId} could not be found or created. Ensure your project has the correct plan or site configuration.`);
            }
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
    await crm.projects.create({
        requestBody: {
            projectId,
            name: displayName
        }
    });

    console.log("[Firebase Create] Waiting for project creation (10s)...");
    await new Promise(r => setTimeout(r, 10000)); // Increased wait to 10s

    // 3. Enable APIs
    // We need: firebase.googleapis.com, firebasehosting.googleapis.com, serviceusage.googleapis.com
    const services = [
        "serviceusage.googleapis.com",
        "firebase.googleapis.com",
        "firebasehosting.googleapis.com"
    ];

    console.log("[Firebase Create] Enabling Services...");
    for (const service of services) {
        try {
            console.log(`[Firebase Create] Enabling ${service}...`);
            await serviceUsage.services.enable({
                name: `projects/${projectId}/services/${service}`
            });
            await new Promise(r => setTimeout(r, 2000)); // Wait between enables
        } catch (e: any) {
             console.error(`[Firebase Create] Failed to enable ${service}:`, e.message);
        }
    }

    await new Promise(r => setTimeout(r, 5000)); // Wait for API propagation

    // 4. Add Firebase with Retry
    console.log("[Firebase Create] Adding Firebase...");
    let firebaseAdded = false;
    let attempts = 0;
    while (!firebaseAdded && attempts < 5) {
        try {
            attempts++;
            const addOp = await firebase.projects.addFirebase({
                project: `projects/${projectId}`,
                requestBody: {}
            });

            // Poll for completion
            let opName = addOp.data.name;
            if (opName) {
                console.log(`[Firebase Create] Polling operation: ${opName}`);
                while (true) {
                    // @ts-ignore
                    const op = await firebase.operations.get({ name: opName });
                    if (op.data.done) {
                        if (op.data.error) throw new Error(op.data.error.message);
                        break;
                    }
                    await new Promise(r => setTimeout(r, 2000));
                }
            }
            firebaseAdded = true;
            console.log("[Firebase Create] Firebase added successfully.");

        } catch (e: any) {
            console.warn(`[Firebase Create] AddFirebase attempt ${attempts} failed:`, e.message);
            if (e.message.includes("permission") || e.message.includes("Caller does not have permission")) {
                console.log("[Firebase Create] Waiting for IAM propagation (5s)...");
                await new Promise(r => setTimeout(r, 5000));
            } else {
                 // If other error (e.g. already exists), maybe break?
                 // But sticking to retry if it might be transient.
                 // If fatal, we throw eventually.
                 if (attempts >= 5) throw e;
            }
        }
    }

    if (!firebaseAdded) {
        throw new Error("Failed to add Firebase to project after multiple attempts.");
    }

    console.log(`[Firebase Create] Project ready: ${projectId}`);
    return { projectId };
}
