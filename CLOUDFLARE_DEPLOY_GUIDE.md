# Cloudflare Pages Deployment Fix

This document explains the new Cloudflare Pages Direct Upload implementation and how to test it.

## 1. Overview of the Fix

The previous deployment system failed with Error 8000096 ("manifest field expected") because it was using an incorrect or mixed API approach (likely the older v1 flow or sending JSON body instead of multipart).

The new implementation uses the **Cloudflare Pages Direct Upload v2** endpoint (`POST /pages/projects/{name}/deployments`), which requires a `multipart/form-data` payload containing:
1.  `manifest`: A JSON object mapping file paths to their SHA1 hash and size.
2.  `file`: A ZIP file containing all the project assets.

### Key Components

*   **ZIP Generation**: Uses `archiver` to bundle all project files (from MongoDB) into a single ZIP buffer in memory.
*   **Manifest Generation**: computes the SHA1 hash (not SHA256) for every file and normalizes paths to start with `/` as per Cloudflare specs.
*   **Multipart Upload**: Uses the `form-data` package to construct the multipart body. It explicitly converts the form to a Buffer (`form.getBuffer()`) and retrieves the correct headers (`form.getHeaders()`) to ensure compatibility with Node.js `fetch`.

## 2. Technical Implementation Details

### `generateDeploymentPackage(files)`
*   Iterates through the file list.
*   Computes SHA1 hash for each file.
*   Adds the file to the ZIP stream.
*   Returns `{ manifest, zipBuffer }`.

### `uploadToCloudflare(...)`
*   Constructs a `FormData` object (from `form-data` package).
*   Appends `manifest` with `{ contentType: "application/json" }`.
*   Appends `file` as the ZIP buffer with `{ filename: "site.zip", contentType: "application/zip" }`.
*   Converts the form to a Buffer using `form.getBuffer()`.
*   Sends the request using `fetch`, explicitly passing the headers from `form.getHeaders()`.

## 3. Testing Instructions

Since this requires a valid Cloudflare API Token and Account ID, you can verify it by attempting a deployment from the UI.

### Prerequisites
1.  Ensure you have a project created in the Dashboard.
2.  Ensure you have authenticated with Cloudflare (added your Account ID and API Token in the settings).

### Step-by-Step Test
1.  **Navigate to Dashboard**: Go to your project list.
2.  **Open Project**: Click on a project to edit it.
3.  **Trigger Deployment**: Click the "Deploy" button (or "Deploy to Cloudflare").
4.  **Monitor Logs**: Check the server console (if running locally) or the browser network tab.
    *   **Success**: You should see a request to `/api/cloudflare/deploy` return `200 OK` with `{ success: true, url: "..." }`.
    *   **Cloudflare Dashboard**: Log in to your Cloudflare account and verify a new deployment appears in the Pages project history.

### Verification of Fix
*   If the error `8000096` is gone, the fix is working.
*   If the site is live at the returned URL, the ZIP upload was successful.

## 4. Troubleshooting

*   **Auth Error (401/403)**: Check your API Token permissions. It needs "Pages:Edit" permissions.
*   **404 Project Not Found**: The system attempts to create the project if missing, but propagation takes a few seconds. Retry after 5-10 seconds.
*   **"Manifest field expected"**: This should no longer happen. If it does, ensure the `form-data` package is correctly installed and the headers are being passed to `fetch`.
