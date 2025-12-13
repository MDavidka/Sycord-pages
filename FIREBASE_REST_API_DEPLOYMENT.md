# Firebase Hosting REST API Deployment Guide

This document provides a complete, self-contained guide for deploying static websites to Firebase Hosting using **only REST API calls** - no Firebase CLI required!

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Authentication Setup](#authentication-setup)
4. [Deployment Workflow](#deployment-workflow)
5. [API Reference](#api-reference)
6. [Standalone Scripts](#standalone-scripts)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)

---

## Overview

This implementation uses Firebase Hosting REST API to deploy websites. The workflow is:

1. **Authenticate** - Get OAuth access token with Firebase permissions
2. **Check Project** - Verify Firebase project exists
3. **Check Hosting** - Verify Hosting is initialized
4. **Create Version** - Create a new hosting version
5. **Upload Files** - Upload site files to the version
6. **Finalize** - Mark version as finalized
7. **Release** - Create release to make site live

### Why REST API?

- ✅ No Firebase CLI dependency
- ✅ Works in any environment (Node.js, Python, browser, etc.)
- ✅ Full control over deployment process
- ✅ Easy to integrate into CI/CD pipelines
- ✅ Works with multiple users deploying to their own projects

---

## Prerequisites

### 1. Google Cloud Project

You need a Google Cloud project with Firebase enabled:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Firebase Management API
   - Firebase Hosting API
   - Cloud Resource Manager API

### 2. Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Add Firebase to your Google Cloud project
3. Initialize **Hosting**:
   - Navigate to Hosting section
   - Click "Get Started"
   - Complete the setup wizard

### 3. OAuth Credentials

For user-based deployment (recommended):

1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID
3. Configure OAuth consent screen:
   - User Type: **External**
   - Add required scopes (see below)
4. Add authorized redirect URIs:
   \`\`\`
   https://your-domain.com/api/firebase/auth/callback
   http://localhost:3000/api/firebase/auth/callback  (for development)
   \`\`\`
5. Save Client ID and Client Secret

### Required OAuth Scopes

\`\`\`
openid
profile
email
https://www.googleapis.com/auth/cloud-platform
https://www.googleapis.com/auth/firebase
https://www.googleapis.com/auth/firebase.hosting
\`\`\`

---

## Authentication Setup

### Option 1: OAuth 2.0 Flow (Recommended for Multi-User)

This is the approach used in the Sycord Pages application.

**Step 1: Initiate OAuth Flow**

\`\`\`http
GET https://accounts.google.com/o/oauth2/v2/auth
  ?client_id=YOUR_CLIENT_ID
  &redirect_uri=https://your-app.com/callback
  &response_type=code
  &scope=openid profile email https://www.googleapis.com/auth/firebase.hosting
  &access_type=offline
  &prompt=consent
\`\`\`

**Step 2: Exchange Code for Tokens**

\`\`\`http
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

code=AUTHORIZATION_CODE
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&redirect_uri=https://your-app.com/callback
&grant_type=authorization_code
\`\`\`

**Response:**
\`\`\`json
{
  "access_token": "ya29.a0...",
  "refresh_token": "1//0g...",
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "..."
}
\`\`\`

**Step 3: Refresh Token When Expired**

\`\`\`http
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET
&refresh_token=YOUR_REFRESH_TOKEN
&grant_type=refresh_token
\`\`\`

### Option 2: Service Account (For Server-Side Only)

Use Google Cloud Service Account for automated deployments:

1. Create service account in Google Cloud Console
2. Grant Firebase Admin role
3. Download JSON key file
4. Use with Google Auth Library

**Example (Node.js):**
\`\`\`javascript
const { GoogleAuth } = require('google-auth-library');

const auth = new GoogleAuth({
  keyFile: 'service-account-key.json',
  scopes: ['https://www.googleapis.com/auth/firebase.hosting']
});

const accessToken = await auth.getAccessToken();
\`\`\`

### Storing Credentials Securely

**❌ NEVER:**
- Commit access tokens to git
- Store tokens in client-side code
- Share tokens between users

**✅ ALWAYS:**
- Store tokens in encrypted database (like MongoDB)
- Use environment variables for secrets
- Implement token refresh logic
- Use HTTPS for all API calls

---

## Deployment Workflow

### Complete Step-by-Step Process

#### Step 1: Check if Firebase Project Exists

\`\`\`http
GET https://firebase.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID
Authorization: Bearer YOUR_ACCESS_TOKEN
\`\`\`

**Success Response (200):**
\`\`\`json
{
  "name": "projects/YOUR_PROJECT_ID",
  "projectId": "YOUR_PROJECT_ID",
  "displayName": "My Project"
}
\`\`\`

**Failure (404):**
- Project doesn't exist
- User needs to create it at https://console.firebase.google.com/

#### Step 2: Check if Hosting is Initialized

\`\`\`http
GET https://firebasehosting.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID
Authorization: Bearer YOUR_ACCESS_TOKEN
\`\`\`

**Success Response (200):**
\`\`\`json
{
  "name": "projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID",
  "defaultUrl": "https://YOUR_SITE_ID.web.app"
}
\`\`\`

**Failure (404):**
- Hosting not initialized
- User needs to enable it in Firebase Console

#### Step 3: Create a New Hosting Version

\`\`\`http
POST https://firebasehosting.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "config": {
    "headers": [{
      "glob": "**",
      "headers": {
        "Cache-Control": "public, max-age=3600"
      }
    }]
  }
}
\`\`\`

**Success Response (200):**
\`\`\`json
{
  "name": "projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions/VERSION_ID",
  "status": "CREATED",
  "config": { ... }
}
\`\`\`

#### Step 4: Upload Files to the Version

\`\`\`http
POST https://firebasehosting.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions/VERSION_ID:populateFiles
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "files": {
    "/index.html": "IMASF9EUSF...",  // base64 encoded content
    "/style.css": "Q1NNIEJP...",
    "/script.js": "Y29uc2..."
  }
}
\`\`\`

**File Preparation:**
\`\`\`javascript
// Node.js example
const files = {
  "/index.html": Buffer.from(htmlContent, 'utf-8').toString('base64'),
  "/style.css": Buffer.from(cssContent, 'utf-8').toString('base64')
};
\`\`\`

**Success Response (200):**
\`\`\`json
{
  "uploadUrl": "...",
  "uploadRequiredHashes": []
}
\`\`\`

#### Step 5: Finalize the Version

\`\`\`http
PATCH https://firebasehosting.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions/VERSION_ID?update_mask=status
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "status": "FINALIZED"
}
\`\`\`

**Success Response (200):**
\`\`\`json
{
  "name": "projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions/VERSION_ID",
  "status": "FINALIZED"
}
\`\`\`

#### Step 6: Create Release (Deploy Live)

**For Live Channel:**
\`\`\`http
POST https://firebasehosting.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/releases?versionName=projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions/VERSION_ID
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "message": "Deployed from my app"
}
\`\`\`

**For Preview Channel:**
\`\`\`http
POST https://firebasehosting.googleapis.com/v1beta1/projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/channels/preview/releases?versionName=projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions/VERSION_ID
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "message": "Preview deployment"
}
\`\`\`

**Success Response (200):**
\`\`\`json
{
  "name": "projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/releases/RELEASE_ID",
  "version": {
    "name": "projects/YOUR_PROJECT_ID/sites/YOUR_SITE_ID/versions/VERSION_ID",
    "status": "FINALIZED"
  },
  "type": "DEPLOY"
}
\`\`\`

**Your site is now live at:**
- Live: `https://YOUR_SITE_ID.web.app`
- Preview: `https://YOUR_SITE_ID--preview.web.app`

---

## API Reference

### Base URLs

- **Firebase Management API:** `https://firebase.googleapis.com/v1beta1`
- **Firebase Hosting API:** `https://firebasehosting.googleapis.com/v1beta1`
- **Google OAuth:** `https://oauth2.googleapis.com`

### Common Headers

All API requests require:
\`\`\`http
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
\`\`\`

### Rate Limits

- Check [Firebase quotas](https://firebase.google.com/docs/hosting/quotas-pricing)
- Implement exponential backoff for retries
- Default: 100 requests per 100 seconds per user

### Error Codes

| Code | Meaning | Solution |
|------|---------|----------|
| 401 | Invalid token | Refresh access token |
| 403 | Permission denied | Check project permissions |
| 404 | Project/site not found | Create project/initialize hosting |
| 429 | Rate limit exceeded | Implement backoff |
| 500 | Server error | Retry with exponential backoff |

---

## Standalone Scripts

We provide ready-to-run deployment scripts in both Node.js and Python.

### Node.js Script

**Location:** `scripts/firebase-deploy-standalone.js`

**Usage:**
\`\`\`bash
node scripts/firebase-deploy-standalone.js \
  --project=my-project-id \
  --token=ya29.a0... \
  --dir=./public \
  --channel=live
\`\`\`

**Environment Variables:**
\`\`\`bash
export FIREBASE_PROJECT_ID=my-project-id
export FIREBASE_ACCESS_TOKEN=ya29.a0...
export DEPLOY_DIR=./public
export DEPLOY_CHANNEL=live

node scripts/firebase-deploy-standalone.js
\`\`\`

### Python Script

**Location:** `scripts/firebase-deploy-standalone.py`

**Installation:**
\`\`\`bash
pip install requests
\`\`\`

**Usage:**
\`\`\`bash
python3 scripts/firebase-deploy-standalone.py \
  --project=my-project-id \
  --token=ya29.a0... \
  --dir=./public \
  --channel=live
\`\`\`

**Environment Variables:**
\`\`\`bash
export FIREBASE_PROJECT_ID=my-project-id
export FIREBASE_ACCESS_TOKEN=ya29.a0...
export DEPLOY_DIR=./public
export DEPLOY_CHANNEL=live

python3 scripts/firebase-deploy-standalone.py
\`\`\`

---

## Error Handling

### Missing Permissions

**Error:**
\`\`\`json
{
  "error": {
    "code": 403,
    "message": "PERMISSION_DENIED"
  }
}
\`\`\`

**Solution:**
1. Verify user has Firebase Admin or Hosting Admin role
2. Check OAuth scopes include `firebase.hosting`
3. Ensure project exists and user has access

### Invalid Token

**Error:**
\`\`\`json
{
  "error": {
    "code": 401,
    "message": "Request had invalid authentication credentials"
  }
}
\`\`\`

**Solution:**
1. Check if token expired (expires_in from OAuth response)
2. Use refresh token to get new access token
3. Re-authenticate user if refresh fails

### Project Not Found

**Provide clear instructions:**
\`\`\`
Firebase project 'my-project' does not exist.

Please create it:
1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Use project ID: my-project
4. Enable Hosting in the console
5. Return here and try again
\`\`\`

### File Upload Failures

**Common causes:**
- File too large (max 10MB per file)
- Invalid base64 encoding
- Network timeout

**Solution:**
- Compress files before upload
- Split large files
- Implement retry logic with exponential backoff

---

## Security Considerations

### Token Storage

**Best Practices:**
- Store tokens encrypted in database
- Never log tokens
- Rotate tokens regularly
- Use short-lived access tokens with refresh tokens

**Example MongoDB Storage:**
\`\`\`javascript
{
  projectId: ObjectId("..."),
  userId: "user123",
  accessToken: "ya29.encrypted...",  // Encrypt this!
  refreshToken: "1//0g.encrypted...", // Encrypt this!
  expiresIn: 3600,
  createdAt: ISODate("2024-01-01T00:00:00Z"),
  updatedAt: ISODate("2024-01-01T00:00:00Z")
}
\`\`\`

### OAuth Security

- Always use HTTPS for OAuth callbacks
- Validate `state` parameter to prevent CSRF
- Use `prompt=consent` to always get refresh token
- Implement token rotation

### File Upload Security

- Validate file types before upload
- Scan for malicious content
- Limit file sizes
- Sanitize file paths

---

## Deployment Channels

Firebase Hosting supports multiple deployment channels:

### Live Channel

The production site accessible to all users:
\`\`\`
https://YOUR_PROJECT_ID.web.app
\`\`\`

### Preview Channels

Temporary deployments for testing:
\`\`\`
https://YOUR_PROJECT_ID--preview.web.app
https://YOUR_PROJECT_ID--pr-123.web.app
\`\`\`

**Creating Preview Deployment:**
Use the same workflow but change release endpoint to include channel:
\`\`\`
POST .../channels/preview/releases?versionName=...
\`\`\`

---

## Complete Example

### Full Deployment Flow (JavaScript)

\`\`\`javascript
async function deployToFirebase(projectId, siteId, files, accessToken) {
  const headers = {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  };

  // 1. Create version
  const versionRes = await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/versions`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        config: {
          headers: [{
            glob: '**',
            headers: { 'Cache-Control': 'public, max-age=3600' }
          }]
        }
      })
    }
  );
  const { name: versionName } = await versionRes.json();

  // 2. Upload files
  const fileList = {};
  for (const [path, content] of Object.entries(files)) {
    fileList[path] = Buffer.from(content).toString('base64');
  }

  await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ files: fileList })
    }
  );

  // 3. Finalize
  await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/${versionName}?update_mask=status`,
    {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: 'FINALIZED' })
    }
  );

  // 4. Release
  await fetch(
    `https://firebasehosting.googleapis.com/v1beta1/projects/${projectId}/sites/${siteId}/releases?versionName=${versionName}`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: 'Deployed!' })
    }
  );

  return `https://${siteId}.web.app`;
}
\`\`\`

---

## Resources

- [Firebase Hosting REST API Documentation](https://firebase.google.com/docs/reference/hosting/rest)
- [Firebase Management REST API](https://firebase.google.com/docs/reference/firebase-management/rest)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)

---

## Support

If you encounter issues:

1. Check the [Firebase Status Dashboard](https://status.firebase.google.com/)
2. Review deployment logs for error details
3. Verify OAuth scopes and permissions
4. Check Firebase project quotas
5. Review this documentation

---

**Last Updated:** December 2024
