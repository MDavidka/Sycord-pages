# Cloudflare Workers Deployment Guide

This document explains the updated deployment system which publishes the project as a **Cloudflare Worker** (on `workers.dev`) instead of a Pages project.

## 1. Overview

The system now deploys a single JavaScript worker script that contains the entire website content embedded within it. This eliminates propagation delays, caching issues, and "white page" errors associated with complex asset pipelines.

### Architecture

*   **Target**: Cloudflare Workers API (`PUT /accounts/{id}/workers/scripts/{name}`)
*   **Format**: `multipart/form-data` containing:
    *   `metadata`: JSON configuration (`{"main_module": "worker.js"}`)
    *   `worker.js`: The ES Module script content.
*   **Routing**: The worker script includes a lightweight router to serve embedded HTML content based on the request URL.

## 2. Technical Implementation

### `deployWorkerScript(accountId, scriptName, content, apiToken)`
*   Constructs a standard `FormData` object.
*   Appends `metadata` as `application/json` Blob.
*   Appends `worker.js` as `application/javascript+module` Blob.
*   Sends a `PUT` request to the Cloudflare Workers API.
*   Triggers the subdomain enablement via a subsequent `POST` to `/subdomain`.

### Worker Script Generation
The backend dynamically generates a `worker.js` file string that includes:
*   `ROUTES`: A JSON object mapping paths (e.g., `/`, `/about`) to HTML content strings.
*   `DEFAULT_HTML`: The fallback content for SPA routing or 404s.
*   `fetch` handler: Intercepts requests, looks up the path in `ROUTES`, and returns a `Response` with `Content-Type: text/html`.

## 3. Testing Instructions

### Prerequisites
1.  Cloudflare Account ID and API Token (with "Workers Scripts: Edit" permissions).
2.  A valid `workers.dev` subdomain setup on your Cloudflare account.

### Step-by-Step Test
1.  **Navigate to Dashboard**: Go to your project list.
2.  **Trigger Deployment**: Click "Deploy to Cloudflare".
3.  **Monitor Logs**: The logs will show "Deploying Worker Script..." followed by "Success! Worker URL...".
4.  **Verify URL**: Click the returned link (e.g., `https://my-project.my-subdomain.workers.dev`).
    *   **Success**: The page loads immediately (Red/White background depending on content).
    *   **API Check**: Visit `/api/status` on the deployed URL to verify the worker is active.

## 4. Troubleshooting

*   **Auth Error (401/403)**: Ensure your API Token has **Workers Scripts: Edit** permissions (and potentially Account Settings permissions to read the subdomain).
*   **Upload Failed**: Check the console logs for specific API error messages (e.g., "Script too large" - though unlikely for simple sites).
*   **URL Not Working**: Ensure you have a `workers.dev` subdomain claimed in your Cloudflare dashboard (Workers & Pages > Overview).
