# Firebase Deployment - Quick Start Guide

This guide will help you quickly set up and test the Firebase deployment integration.

## Prerequisites

- Google Cloud account
- Firebase enabled on your Google Cloud project
- MongoDB database running
- Node.js and npm installed

## Setup Steps

### 1. Google Cloud Console Setup (5-10 minutes)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or use existing)
3. Enable these APIs:
   \`\`\`
   - Firebase Management API
   - Firebase Hosting API
   - Cloud Resource Manager API
   \`\`\`

4. Set up OAuth consent screen:
   - Navigate to: APIs & Services → OAuth consent screen
   - User Type: **External**
   - Fill in app name, support email
   - Add scopes:
     - `openid`
     - `profile`
     - `email`
     - `https://www.googleapis.com/auth/cloud-platform`
     - `https://www.googleapis.com/auth/firebase`
     - `https://www.googleapis.com/auth/firebase.hosting`

5. Create OAuth credentials:
   - Navigate to: APIs & Services → Credentials
   - Create OAuth 2.0 Client ID
   - Application type: **Web application**
   - Add authorized redirect URI:
     \`\`\`
     https://your-domain.com/api/firebase/auth/callback
     http://localhost:3000/api/firebase/auth/callback (for testing)
     \`\`\`
   - Copy **Client ID** and **Client Secret**

### 2. Environment Variables

Add to your `.env.local`:

\`\`\`env
# Google OAuth (for Firebase)
GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret-here

# NextAuth
NEXTAUTH_URL=http://localhost:3000
AUTH_SECRET=your-random-secret-here

# MongoDB
MONGO_URI=mongodb://localhost:27017/sycord-pages
\`\`\`

### 3. Install Dependencies

\`\`\`bash
npm install --legacy-peer-deps
\`\`\`

### 4. Start Development Server

\`\`\`bash
npm run dev
\`\`\`

### 5. Test the Flow

1. **Create a test project:**
   - Navigate to http://localhost:3000
   - Sign in with Google
   - Create a new project

2. **Generate a website:**
   - Go to the AI Builder tab
   - Generate a simple website (e.g., "Create a landing page for a coffee shop")
   - Wait for the generation to complete

3. **Deploy to Firebase:**
   - Go to the "Firebase Deploy" tab
   - Click "1. Authenticate with Google"
   - Grant permissions in the OAuth consent screen
   - After redirect, click "2. Deploy to Firebase"
   - Watch the deployment logs

4. **Verify deployment:**
   - Click the deployment URL when it appears
   - Your site should be live at `https://your-project-id.web.app`

## Testing Checklist

- [ ] OAuth flow completes successfully
- [ ] Tokens are stored in MongoDB
- [ ] Firebase project is created
- [ ] Files are uploaded
- [ ] Deployment goes live
- [ ] Site is accessible at the Firebase URL
- [ ] Debug panel shows correct information
- [ ] Token refresh works (wait for expiration)

## Quick Debug Commands

### Check MongoDB for tokens:
\`\`\`javascript
// In MongoDB shell
use sycord-pages
db.firebase_tokens.find().pretty()
\`\`\`

### Check project deployment status:
\`\`\`javascript
db.projects.find({ firebaseProjectId: { $exists: true } }).pretty()
\`\`\`

### Test status endpoint:
\`\`\`bash
curl http://localhost:3000/api/firebase/status?projectId=YOUR_PROJECT_ID \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN"
\`\`\`

## Common Issues

### "Failed to exchange code for tokens"

**Cause:** Invalid OAuth credentials or redirect URI mismatch

**Fix:**
1. Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in `.env.local`
2. Check redirect URI in Google Cloud Console matches your app URL
3. Make sure callback URL is exactly: `http://localhost:3000/api/firebase/auth/callback`

### "No Firebase authentication found"

**Cause:** Token not stored or expired

**Fix:**
1. Check MongoDB for `firebase_tokens` collection
2. Re-authenticate by clicking the button again
3. Check browser console for errors

### "Failed to create Firebase project"

**Cause:** Missing API enablement or insufficient permissions

**Fix:**
1. Verify all three APIs are enabled in Google Cloud Console
2. Check that your OAuth token has the correct scopes
3. Try re-authenticating

### "Failed to upload files"

**Cause:** File too large or invalid content

**Fix:**
1. Check debug panel for file sizes
2. Ensure files are under 10MB each
3. Verify file content is valid HTML/CSS/JS

## Advanced Testing

### Test token refresh:

1. Get a project with Firebase tokens
2. Manually expire the token in MongoDB:
   \`\`\`javascript
   db.firebase_tokens.updateOne(
     { projectId: ObjectId("your-project-id") },
     { $set: { updatedAt: new Date(Date.now() - 7200000) } } // 2 hours ago
   )
   \`\`\`
3. Try deploying again - should auto-refresh

### Test with multiple projects:

1. Create 3-5 different projects
2. Generate websites for each
3. Deploy each to Firebase
4. Verify all get unique Firebase project IDs
5. Check all are accessible

### Load testing:

1. Create a project with 10+ pages
2. Generate large HTML content (100KB+ each)
3. Deploy and measure upload time
4. Check deployment logs for any errors

## Monitoring

### Watch deployment logs in real-time:

\`\`\`bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Watch logs
tail -f .next/server/server.log | grep "\[Firebase\]"
\`\`\`

### Monitor API calls:

All Firebase API calls log with `[Firebase]` prefix:
- Look for: `[Firebase] OAuth URL generated`
- Look for: `[Firebase] Tokens received`
- Look for: `[Firebase] Project created`
- Look for: `[Firebase] Files uploaded`
- Look for: `[Firebase] Deployment successful`

## Performance Benchmarks

Expected timings (on good connection):

| Step | Expected Duration |
|------|------------------|
| OAuth flow | 5-10 seconds |
| Token exchange | 1-2 seconds |
| Firebase project creation | 5-10 seconds |
| File upload (5 files, ~100KB total) | 3-5 seconds |
| Version finalization | 2-3 seconds |
| Total deployment time | 15-30 seconds |

## Next Steps

After successful testing:

1. **Production setup:**
   - Update `NEXTAUTH_URL` to your production domain
   - Add production redirect URI to Google Cloud Console
   - Test OAuth flow on production

2. **Monitor usage:**
   - Track deployment success/failure rates
   - Monitor Firebase quota usage
   - Check token refresh patterns

3. **Optimize:**
   - Consider file compression before upload
   - Implement deployment caching
   - Add deployment rollback feature

## Support

If you encounter issues:

1. Check the debug panel in the UI
2. Review deployment logs
3. Check MongoDB for stored data
4. Verify Google Cloud Console setup
5. Review `FIREBASE_DEPLOYMENT.md` for detailed documentation

## Resources

- [Firebase Hosting API Docs](https://firebase.google.com/docs/reference/hosting/rest)
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2)
- [Full Documentation](./FIREBASE_DEPLOYMENT.md)
