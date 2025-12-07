# Firebase Deployment Integration

This document explains how the Firebase deployment integration works in Sycord Pages.

## Overview

The Firebase deployment feature allows users to deploy their AI-generated websites directly to Firebase Hosting with just a few clicks. The deployment process includes:

1. Google OAuth authentication for Firebase access
2. Automatic Firebase project creation (if needed)
3. File upload to Firebase Hosting
4. Automatic SSL certificate and global CDN
5. Live deployment at `your-project.web.app`

## Architecture

### Flow Diagram

\`\`\`
User clicks "Authenticate with Google"
  ↓
Redirect to /api/firebase/auth/initiate
  ↓
Redirect to Google OAuth with required scopes
  ↓
User grants permissions
  ↓
Google redirects to /api/firebase/auth/callback
  ↓
Exchange authorization code for access & refresh tokens
  ↓
Store tokens in MongoDB (firebase_tokens collection)
  ↓
Redirect back to project page with success message
  ↓
User clicks "Deploy to Firebase"
  ↓
POST to /api/firebase/deploy
  ↓
Check if Firebase project exists → Create if not
  ↓
Create hosting version
  ↓
Upload all files using populateFiles API
  ↓
Finalize version
  ↓
Create release → Site goes live!
\`\`\`

## API Endpoints

### Authentication Endpoints

#### `GET /api/firebase/auth/initiate`

Initiates the OAuth flow by redirecting to Google OAuth.

**Query Parameters:**
- `projectId` (required): The project ID to associate with the OAuth tokens

**Response:**
- Redirects to Google OAuth consent screen

**Scopes Requested:**
- `openid`
- `profile`
- `email`
- `https://www.googleapis.com/auth/cloud-platform`
- `https://www.googleapis.com/auth/firebase`
- `https://www.googleapis.com/auth/firebase.hosting`

#### `GET /api/firebase/auth/callback`

Handles the OAuth callback from Google.

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: JSON string containing `{ projectId, userId }`

**Response:**
- Redirects to `/dashboard/sites/{projectId}?firebase_auth=success`

**Database Update:**
- Stores tokens in `firebase_tokens` collection:
  \`\`\`json
  {
    "projectId": ObjectId,
    "userId": String,
    "accessToken": String,
    "refreshToken": String,
    "expiresIn": Number,
    "tokenType": String,
    "scope": String,
    "createdAt": Date,
    "updatedAt": Date
  }
  \`\`\`

#### `POST /api/firebase/auth/refresh`

Refreshes an expired access token using the refresh token.

**Request Body:**
\`\`\`json
{
  "projectId": "string",
  "userId": "string"
}
\`\`\`

**Response:**
\`\`\`json
{
  "accessToken": "string",
  "success": true
}
\`\`\`

### Deployment Endpoints

#### `POST /api/firebase/deploy`

Main deployment endpoint that handles the entire Firebase deployment process.

**Request Body:**
\`\`\`json
{
  "projectId": "string",
  "firebaseProjectId": "string" (optional)
}
\`\`\`

**Process:**
1. Get valid access token (refresh if needed)
2. Check if Firebase project exists
3. Create Firebase project if needed
4. Create hosting version
5. Upload files to Firebase Hosting
6. Finalize version
7. Create release

**Response (Success):**
\`\`\`json
{
  "success": true,
  "message": "Deployment successful",
  "url": "https://your-project.web.app",
  "projectId": "your-project-id",
  "versionName": "sites/your-project/versions/xxx",
  "releaseName": "sites/your-project/releases/xxx"
}
\`\`\`

**Response (Error):**
\`\`\`json
{
  "message": "Error message",
  "error": "Detailed error"
}
\`\`\`

#### `GET /api/firebase/status`

Returns debug information about the project's Firebase deployment status.

**Query Parameters:**
- `projectId` (required): The project ID

**Response:**
\`\`\`json
{
  "project": {
    "id": "string",
    "name": "string",
    "hasPages": boolean,
    "pagesCount": number,
    "firebaseProjectId": "string | null",
    "firebaseUrl": "string | null",
    "firebaseDeployedAt": "string | null"
  },
  "authentication": {
    "isAuthenticated": boolean,
    "hasAccessToken": boolean,
    "hasRefreshToken": boolean,
    "tokenCreatedAt": "string | null",
    "tokenUpdatedAt": "string | null",
    "tokenExpiresIn": "number | null",
    "scopes": "string | null"
  },
  "pages": [
    {
      "name": "string",
      "size": number
    }
  ],
  "recommendations": ["string"]
}
\`\`\`

## Environment Variables

The following environment variables are required:

\`\`\`env
# Google OAuth (already configured for NextAuth)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# NextAuth
NEXTAUTH_URL=https://your-domain.com
AUTH_SECRET=your-secret-key

# MongoDB (already configured)
MONGO_URI=mongodb://...
\`\`\`

## Google Cloud Console Setup

To use Firebase deployment, you need to set up a Google Cloud project:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Firebase Management API
   - Firebase Hosting API
   - Cloud Resource Manager API
4. Configure OAuth consent screen:
   - User Type: External
   - Add required scopes (listed above)
   - Add test users if in development
5. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs: `https://your-domain.com/api/firebase/auth/callback`
6. Copy Client ID and Client Secret to environment variables

## Database Schema

### Collection: `firebase_tokens`

Stores OAuth tokens for Firebase deployment.

\`\`\`javascript
{
  _id: ObjectId,
  projectId: ObjectId,        // Reference to projects collection
  userId: String,             // User ID from session
  accessToken: String,        // OAuth access token
  refreshToken: String,       // OAuth refresh token
  expiresIn: Number,          // Token expiration time in seconds
  tokenType: String,          // Usually "Bearer"
  scope: String,              // Granted scopes
  createdAt: Date,           // When token was first created
  updatedAt: Date            // When token was last refreshed
}
\`\`\`

**Indexes:**
- `{ projectId: 1, userId: 1 }` (unique)

### Collection: `projects` (Updated)

Added Firebase-related fields:

\`\`\`javascript
{
  // ... existing fields ...
  firebaseProjectId: String,      // Firebase project ID
  firebaseUrl: String,            // Deployed site URL
  firebaseDeployedAt: Date,       // Last deployment timestamp
  pages: [                        // Pages to deploy
    {
      name: String,               // e.g., "index.html"
      content: String             // HTML/CSS/JS content
    }
  ]
}
\`\`\`

## UI Components

### FirebaseDeployment Component

Location: `/components/firebase-deployment.tsx`

A comprehensive React component that handles the entire deployment UI:

**Features:**
- Two-step deployment process (Authenticate → Deploy)
- Real-time deployment logs
- Debug panel with project/auth status
- Error handling with user-friendly messages
- Success state with live URL link

**Props:**
\`\`\`typescript
interface FirebaseDeploymentProps {
  projectId: string
  projectName: string
}
\`\`\`

**Usage:**
\`\`\`tsx
import { FirebaseDeployment } from "@/components/firebase-deployment"

<FirebaseDeployment 
  projectId={projectId} 
  projectName={projectName} 
/>
\`\`\`

## Error Handling

The deployment system includes comprehensive error handling:

1. **Authentication Errors:**
   - Missing OAuth configuration
   - Token exchange failure
   - Expired tokens (auto-refresh)

2. **Deployment Errors:**
   - Missing pages/content
   - Firebase project creation failure
   - File upload errors
   - Version finalization failure

3. **Retry Logic:**
   - API calls retry up to 3 times with exponential backoff
   - Token refresh on expiration

## Debugging

### Debug Panel

The UI includes a debug panel that shows:
- Project status (pages, Firebase project ID, deployment URL)
- Authentication status (tokens, expiration)
- List of pages to deploy with sizes
- Recommendations based on current state

### Server Logs

All endpoints use consistent logging with `[Firebase]` prefix:

\`\`\`javascript
console.log("[Firebase] Step description")
console.error("[Firebase] Error description:", error)
\`\`\`

### Status Endpoint

Use `/api/firebase/status?projectId=xxx` to get detailed debug information about a project's deployment state.

## Security Considerations

1. **Token Storage:**
   - OAuth tokens are stored securely in MongoDB
   - Access tokens expire and are automatically refreshed
   - Tokens are tied to specific projects and users

2. **Authorization:**
   - All endpoints check user session
   - Users can only deploy their own projects
   - Tokens are only accessible by the owning user

3. **OAuth Scopes:**
   - Minimal required scopes for Firebase deployment
   - User must explicitly grant permissions

## Troubleshooting

### "No Firebase authentication found"

**Solution:** Click "Authenticate with Google" to grant Firebase access.

### "No pages to deploy"

**Solution:** Use the AI Builder to generate your website first.

### "Token refresh failed"

**Solution:** Re-authenticate by clicking "Authenticate with Google" again.

### "Failed to create Firebase project"

**Possible causes:**
- Invalid Google Cloud project configuration
- Missing Firebase Management API
- Insufficient permissions

**Solution:** Check Google Cloud Console setup and API enablement.

### "Failed to upload files"

**Possible causes:**
- Large file sizes
- Network issues
- Invalid file content

**Solution:** Check debug panel for file sizes and content validity.

## Future Enhancements

Potential improvements:

1. **Custom Domain Support:** Allow users to use their own domains
2. **Deployment History:** Track and rollback to previous deployments
3. **Build Optimization:** Minify HTML/CSS/JS before deployment
4. **Preview Deployments:** Deploy to preview URLs before going live
5. **Deployment Analytics:** Track page views and performance
6. **Multi-region Hosting:** Deploy to multiple regions for better performance

## References

- [Firebase Hosting API Documentation](https://firebase.google.com/docs/reference/hosting/rest)
- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Firebase Management API](https://firebase.google.com/docs/reference/firebase-management/rest)
