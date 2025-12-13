# Cloudflare Pages Deployment Integration

This document explains how the Cloudflare Pages deployment integration works in Sycord Pages.

## Recent Updates

### Deployment Fix (December 2024)
- **Fixed**: Added required `stage` parameter to deployment API calls
- **Issue**: Previous deployments might have failed due to missing `stage` parameter
- **Solution**: Now explicitly sets `stage: "production"` for main branch deployments
- **Added**: Comprehensive debug logging throughout the deployment process
- **Reference**: [Cloudflare API Documentation](https://developers.cloudflare.com/api/operations/pages-deployment-create-deployment)

## Overview

The Cloudflare Pages deployment feature allows users to deploy their AI-generated websites directly to Cloudflare Pages with just a few clicks. The deployment process includes:

1. Cloudflare API token configuration
2. Automatic Cloudflare Pages project creation (if needed)
3. File upload to Cloudflare Pages via Direct Upload API
4. Automatic SSL certificate and global CDN
5. Live deployment at `your-project.pages.dev`

## Architecture

### Flow Diagram

\`\`\`
User provides API credentials (token + account ID)
  ↓
Store credentials in MongoDB (cloudflare_tokens collection)
  ↓
Validate credentials with Cloudflare API
  ↓
User clicks "Deploy to Cloudflare"
  ↓
POST to /api/cloudflare/deploy
  ↓
Check if project exists, create if needed
  ↓
Create deployment via Cloudflare Pages API
  ↓
Upload files using Direct Upload
  ↓
Store deployment info in MongoDB
  ↓
Return deployment URL to user
\`\`\`

### Components

#### 1. Frontend Component
- **Location**: `components/cloudflare-deployment.tsx`
- **Purpose**: User interface for deployment
- **Features**:
  - API credential configuration form
  - Deploy button with real-time status
  - Deployment logs display
  - Debug information panel

#### 2. API Routes

##### `/api/cloudflare/auth` (POST/DELETE)
- **Purpose**: Store and validate Cloudflare API credentials
- **Authentication**: Requires NextAuth session
- **Request Body**:
  \`\`\`json
  {
    "projectId": "mongodb_object_id",
    "apiToken": "cloudflare_api_token",
    "accountId": "cloudflare_account_id"
  }
  \`\`\`
- **Validation**: Makes test API call to Cloudflare to verify credentials
- **Storage**: Stores in `cloudflare_tokens` MongoDB collection

##### `/api/cloudflare/deploy` (POST)
- **Purpose**: Deploy project to Cloudflare Pages
- **Authentication**: Requires NextAuth session
- **Request Body**:
  \`\`\`json
  {
    "projectId": "mongodb_object_id",
    "cloudflareProjectName": "optional-custom-name"
  }
  \`\`\`
- **Process**:
  1. Retrieves credentials from database
  2. Fetches project pages from MongoDB
  3. Checks/creates Cloudflare Pages project
  4. Creates deployment
  5. Uploads files via Direct Upload API
  6. Updates project with deployment URL
- **Response**:
  \`\`\`json
  {
    "success": true,
    "url": "https://project-name.pages.dev",
    "deploymentId": "deployment_id",
    "projectName": "project-name"
  }
  \`\`\`

##### `/api/cloudflare/status` (GET)
- **Purpose**: Get deployment status and debug information
- **Authentication**: Requires NextAuth session
- **Query Params**: `projectId`
- **Response**: Debug information including project status, credentials, and pages

#### 3. Standalone Scripts

Two standalone deployment scripts are provided for use outside the web interface:

##### Node.js Script (`scripts/cloudflare-deploy.js`)
\`\`\`bash
node scripts/cloudflare-deploy.js \
  --account=your_account_id \
  --token=your_api_token \
  --project=my-site \
  --dir=./out
\`\`\`

##### Python Script (`scripts/cloudflare-deploy.py`)
\`\`\`bash
python3 scripts/cloudflare-deploy.py \
  --account=your_account_id \
  --token=your_api_token \
  --project=my-site \
  --dir=./out
\`\`\`

Both scripts support environment variables:
- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_PROJECT_NAME`
- `DEPLOY_DIR`
- `DEPLOY_BRANCH`

## Database Schema

### `cloudflare_tokens` Collection
\`\`\`javascript
{
  _id: ObjectId,
  projectId: ObjectId,        // Reference to projects collection
  userId: String,             // User email from NextAuth
  apiToken: String,           // Cloudflare API token
  accountId: String,          // Cloudflare Account ID
  createdAt: Date,
  updatedAt: Date
}
\`\`\`

### `projects` Collection (Updated Fields)
\`\`\`javascript
{
  _id: ObjectId,
  userId: String,
  name: String,
  // ... other fields ...
  cloudflareProjectName: String,     // Cloudflare Pages project name
  cloudflareUrl: String,             // Deployment URL
  cloudflareDeployedAt: Date,        // Last deployment timestamp
  cloudflareDeploymentId: String     // Latest deployment ID
}
\`\`\`

## Cloudflare Pages API Integration

### Authentication
All API calls use Bearer token authentication:
\`\`\`
Authorization: Bearer <CLOUDFLARE_API_TOKEN>
\`\`\`

### Required API Token Permissions
Create a token with the following permission:
- **Account → Cloudflare Pages → Edit**

### Key Endpoints Used

#### 1. List Projects
\`\`\`
GET /accounts/{account_id}/pages/projects
\`\`\`
Lists all Pages projects (used for validation).

#### 2. Get Project
\`\`\`
GET /accounts/{account_id}/pages/projects/{project_name}
\`\`\`
Checks if a specific project exists.

#### 3. Create Project
\`\`\`
POST /accounts/{account_id}/pages/projects
Body: { "name": "project-name", "production_branch": "main" }
\`\`\`
Creates a new Pages project.

#### 4. Create Deployment
\`\`\`
POST /accounts/{account_id}/pages/projects/{project_name}/deployments
Body: {
  "branch": "main",
  "stage": "production"  // Required: "production" or "preview"
}
\`\`\`
Initiates a new deployment and returns an upload URL.

**Important**: The `stage` parameter is required and must be set to either:
- `"production"` - Deploys to the main production URL (`project-name.pages.dev`)
- `"preview"` - Deploys to a preview URL (for testing branches)

Reference: [Cloudflare API - Stage Schema](https://developers.cloudflare.com/api/operations/pages-deployment-create-deployment)

#### 5. Upload Files
\`\`\`
POST {upload_url}
Body: { "manifest": { "/index.html": "base64_content", ... } }
\`\`\`
Uploads files using Direct Upload manifest.

## How to Use

### Prerequisites

1. **Cloudflare Account**: Create a free account at https://dash.cloudflare.com/
2. **API Token**: Create a token with Pages:Edit permission
3. **Account ID**: Find in Cloudflare dashboard URL or Workers & Pages section

### Step-by-Step Guide

#### 1. Get Your Cloudflare Credentials

**Find Account ID:**
- Log in to Cloudflare Dashboard
- Go to Workers & Pages or any page
- Your Account ID is in the URL: `dash.cloudflare.com/{account_id}/...`
- Or find it in the right sidebar of most pages

**Create API Token:**
- Go to https://dash.cloudflare.com/profile/api-tokens
- Click "Create Token"
- Use "Edit Cloudflare Pages" template OR create custom token
- For custom token, set:
  - Permissions: Account → Cloudflare Pages → Edit
  - Account Resources: Include → Your Account
- Click "Continue to summary" then "Create Token"
- **Save the token** (you won't see it again)

#### 2. Configure in Sycord Pages

1. Navigate to your project in Sycord Pages
2. Go to the "Deploy" tab
3. Click "Show configuration"
4. Paste your API Token
5. Paste your Account ID
6. Click "Save Credentials"

The system will validate your credentials before saving.

#### 3. Deploy Your Website

1. Click "Deploy to Cloudflare"
2. Watch the deployment logs in real-time
3. Once complete, your site will be live at `https://your-project.pages.dev`

### Custom Domain (Optional)

To use a custom domain:

1. Go to Cloudflare Dashboard → Workers & Pages
2. Select your project
3. Go to "Custom domains"
4. Add your domain
5. If it's an apex domain (example.com), it must be a Cloudflare zone
6. For subdomains (www.example.com), add a CNAME record

## Troubleshooting

### Common Issues

#### "Invalid Cloudflare API token or account ID"
- Verify your token has the correct permissions (Pages:Edit)
- Check that the Account ID matches the account where you created the token
- Ensure the token hasn't expired

#### "Failed to create project"
- Project names must be lowercase, alphanumeric, and can include hyphens
- Project names must be unique within your account
- Maximum length is 58 characters

#### "No files found to deploy"
- Ensure your project has at least one page created
- Check that pages have content

#### "Failed to upload files"
- Individual files must be under 25MB
- Total deployment size has limits based on your Cloudflare plan
- Check Cloudflare status page for any service issues

### Debug Logging

The deployment system now includes detailed debug logging to help diagnose issues:

#### What's Logged

1. **API Calls**: Every API request to Cloudflare with attempt counts
2. **Response Status**: HTTP status codes and response details
3. **Deployment Details**:
   - Project name and account ID (masked)
   - Branch and stage settings
   - Deployment ID and stage confirmation
4. **File Upload Details**:
   - Each file being uploaded with size information
   - Base64 encoding size
   - Total manifest size
5. **Error Details**: Full error responses from Cloudflare API

#### Viewing Debug Logs

**Server-side logs** (for developers):
- Check your server console/logs where the Next.js app is running
- Logs are prefixed with `[Cloudflare]` and `DEBUG:` for easy filtering

**Standalone script logs**:
- Debug output is automatically included in console output
- Look for `📊 DEBUG:` entries for detailed information

**Example debug output**:
\`\`\`
[Cloudflare] DEBUG: Creating deployment for project: my-site
[Cloudflare] DEBUG: Branch: main, Stage: production
[Cloudflare] DEBUG: API call attempt 1/3 to https://api.cloudflare.com/...
[Cloudflare] DEBUG: Response status: 200 OK
[Cloudflare] DEBUG: Deploy response: { "result": { "id": "...", "stage": "production", ... } }
[Cloudflare] ✅ Deployment created (ID: abc123, Stage: production)
[Cloudflare] DEBUG: Adding file: /index.html (1024 bytes, 1368 base64 chars)
[Cloudflare] DEBUG: Total files in manifest: 3
\`\`\`

### Getting Help

1. Check deployment logs for specific error messages
2. Verify credentials in the Debug Information panel
3. Test credentials with Cloudflare's API directly
4. Check Cloudflare's API documentation
5. Review Cloudflare dashboard for project status

## Security Best Practices

1. **Protect API Tokens**: Never commit tokens to version control
2. **Use Scoped Tokens**: Only grant necessary permissions (Pages:Edit)
3. **Rotate Tokens**: Periodically create new tokens and delete old ones
4. **Monitor Usage**: Check Cloudflare audit logs for unexpected activity
5. **Remove Unused Credentials**: Delete credentials when no longer needed

## Rate Limits and Quotas

Cloudflare Pages has the following limits:

- **Free Plan**:
  - 500 builds per month
  - 1 build at a time
  - Unlimited sites
  - Unlimited requests
  - Unlimited bandwidth

- **Paid Plans**: Higher limits available

For current limits, see: https://developers.cloudflare.com/pages/platform/limits/

## Resources

- [Cloudflare Pages Docs](https://developers.cloudflare.com/pages/)
- [Pages API Reference](https://developers.cloudflare.com/api/operations/pages-project-get-projects)
- [Direct Upload Guide](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [API Token Creation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Custom Domains](https://developers.cloudflare.com/pages/configuration/custom-domains/)

## Migration from Firebase

If you previously used Firebase Hosting, the migration is straightforward:

1. Configure Cloudflare credentials (replaces Google OAuth)
2. Deploy to Cloudflare (same one-click process)
3. Update any external links to your new `.pages.dev` URL
4. (Optional) Set up custom domain on Cloudflare
5. (Optional) Archive or delete old Firebase project

Key differences:
- **Authentication**: API token instead of OAuth
- **Project Creation**: Automatic in Cloudflare (no manual setup needed)
- **URLs**: `.pages.dev` instead of `.web.app`
- **Performance**: Cloudflare's global network (often faster)
- **Pricing**: More generous free tier

Both services provide:
- Automatic SSL
- Global CDN
- Custom domains
- Preview deployments
- Instant rollbacks
