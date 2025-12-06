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
    // Let's try to ensure site exists.

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
    // The API expects a specific hash for files, but for simple single-file upload
    // we can use the `populateFiles` method which is a bit complex with raw API
    // because it requires calculating SHA256 hashes and potentially uploading to a signed URL.

    // Simpler approach for single file:
    // The `populateFiles` API returns a map of required uploads.
    // We need to calculate SHA256 gzipped hash of our content.

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
    // If the file hash is new to Firebase, it will ask for uploadUrl.
    if (populateRes.data.uploadRequiredHashes?.includes(hash)) {
        const uploadUrl = populateRes.data.uploadUrl;
        if (!uploadUrl) throw new Error("Upload URL missing");

        console.log(`[Firebase Deploy] Uploading content to ${uploadUrl}...`);

        // We need to POST the raw gzipped content to the uploadUrl with the hash
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
        requestBody: {
            type: "DEPLOY",
            version: { name: versionName } // Only name is needed to link
        } // The API might expect 'versionName' string in some client libs, but REST API usually takes version object or name field.
        // Actually, for `create` release, we pass `versionName` query param OR body.
        // Let's check docs: POST .../releases?versionName=... OR body { message: ..., type: ..., version: {name: ...} } is NOT standard.
        // Standard is query param `versionName` OR body field `version` which is the full resource name.
    });

    // NOTE: The `googleapis` library `create` method parameters:
    // params: { parent, versionName (deprecated in favor of body), requestBody: { ... } }
    // We should put the version name in the body?
    // Looking at the type defs, Release has a `version` field which is an object `Version`.
    // But usually for creation we just refer to it.
    // Let's try passing it in the requestBody.

    /*
       Wait, `releases.create` typically takes `versionName` as a query parameter in REST,
       but in the node library it might be different.
       Actually, `google-api-nodejs-client` maps `versionName` query param to `versionName` in params object.
    */

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
