# How to Deploy Your Website to Firebase

This guide explains how to deploy your Sycord Pages website to Firebase Hosting.

## Quick Start (3 Steps)

### 1. Create Your Website
Use the AI Builder in Sycord Pages to generate your website content.

### 2. Authenticate with Google
Click the "Authenticate with Google" button and grant Firebase permissions.

### 3. Deploy
Click "Deploy to Firebase" and your site will be live at `https://your-project.web.app`!

---

## Prerequisites

Before you can deploy, you need:

### Option A: Use an Existing Firebase Project

If you already have a Firebase project:
1. Make sure Firebase Hosting is enabled in your project
2. You have owner or editor permissions on the project
3. That's it! You can skip to the deployment section.

### Option B: Create a New Firebase Project

If you don't have a Firebase project yet:

1. **Go to Firebase Console**: https://console.firebase.google.com/
2. **Create Project**: Click "Add project" or "Create a project"
3. **Project Setup**:
   - Enter a project name (e.g., "My Awesome Website")
   - Accept the terms
   - (Optional) Enable Google Analytics
   - Click "Create project"
4. **Enable Hosting**:
   - In your new project, click "Hosting" in the left menu
   - Click "Get started"
   - Follow the wizard (you don't need to install Firebase CLI)
   - Click "Finish"
5. **Done!** Your Firebase project is ready for deployment

---

## Deployment Steps

### Step 1: Authenticate with Google

1. Navigate to your project in Sycord Pages
2. Go to the "Firebase Deploy" tab
3. Click **"1. Authenticate with Google"**
4. You'll be redirected to Google OAuth
5. Grant the following permissions:
   - View and manage your data across Google Cloud services
   - View and administer your Firebase data
   - View and administer Firebase Hosting
6. After granting permissions, you'll be redirected back to your project
7. You should see a success message: "Authentication successful!"

**Note:** You only need to authenticate once per project. The tokens are stored securely and will be automatically refreshed.

### Step 2: Deploy to Firebase

1. Make sure you have pages in your project (generated via AI Builder)
2. Click **"2. Deploy to Firebase"**
3. Watch the deployment logs in real-time:
   - ✅ Files prepared successfully
   - ☁️ Creating hosting version...
   - 📤 Uploading files to Firebase Hosting...
   - 🔨 Finalizing version...
   - 🚀 Creating release...
   - 🎉 Deployment completed!
4. Once complete, you'll see your live URL (e.g., `https://my-site-abc123.web.app`)
5. Click the URL to view your live website! 🎉

---

## What Happens During Deployment?

Behind the scenes, Sycord Pages:

1. **Validates Authentication**: Checks if you have valid Firebase access tokens
2. **Checks Project**: Verifies your Firebase project exists
3. **Checks Hosting**: Ensures Hosting is initialized
4. **Creates Version**: Creates a new hosting version in Firebase
5. **Uploads Files**: Uploads all your pages to Firebase
6. **Finalizes**: Marks the version as ready
7. **Releases**: Makes your site live on the web

All of this happens automatically using the Firebase REST API - no CLI required!

---

## Troubleshooting

### "No Firebase authentication found"

**Problem:** You haven't authenticated yet.

**Solution:** Click "1. Authenticate with Google" and grant permissions.

---

### "Firebase project does not exist"

**Problem:** The Firebase project hasn't been created yet.

**Solution:** The deployment will show you instructions:
1. Go to https://console.firebase.google.com/
2. Create a new project
3. Enable Hosting in the project
4. Return and try deploying again

---

### "Firebase Hosting not initialized"

**Problem:** Hosting hasn't been set up in your Firebase project.

**Solution:** The deployment will show you instructions:
1. Go to your Firebase project in the console
2. Navigate to Hosting
3. Click "Get started" to initialize
4. Return and try deploying again

---

### "Token refresh failed"

**Problem:** Your access token has expired and couldn't be refreshed.

**Solution:** Re-authenticate by clicking "1. Authenticate with Google" again.

---

### "Permission denied"

**Problem:** You don't have the necessary permissions for the Firebase project.

**Solution:** 
1. Make sure you're the owner or editor of the Firebase project
2. Check that you granted all required OAuth scopes
3. Try re-authenticating

---

### "File too large"

**Problem:** One of your files exceeds the 10MB limit.

**Solution:**
1. Check the debug panel to see which file is too large
2. Reduce the file size (compress images, minify code, etc.)
3. Try deploying again

---

## Advanced Features

### Deployment Channels

By default, deployments go to the "live" channel. You can also deploy to preview channels for testing:

- **Live**: `https://your-project.web.app`
- **Preview**: `https://your-project--preview.web.app`

(Channel selection coming soon in the UI)

---

### Debug Panel

Click "Show Debug Information" to see:

- **Project Status**: Pages count, Firebase project ID, deployment URL
- **Authentication Status**: Token status, expiration time
- **Pages List**: All pages with file sizes
- **Recommendations**: Helpful tips based on your current state

---

### Deployment Logs

All deployments show real-time logs so you can track progress and debug issues.

---

## Security & Privacy

### Token Storage
- OAuth tokens are stored encrypted in our database
- Tokens are scoped to your specific project
- Access tokens expire after 1 hour and are automatically refreshed
- Only you can deploy to your Firebase projects

### Permissions
- You grant Sycord Pages permission to deploy to Firebase
- Sycord Pages never has access to your Firebase project data
- You can revoke access anytime in your Google Account settings

### Data Privacy
- Your website content is sent directly to Firebase
- We don't store copies of your deployed website
- All communication uses HTTPS encryption

---

## Firebase Hosting Features

Once deployed, your website gets:

- **Free SSL Certificate**: Automatic HTTPS
- **Global CDN**: Fast loading worldwide
- **Auto Scaling**: Handles any amount of traffic
- **Custom Domains**: Add your own domain (configure in Firebase Console)
- **Automatic Rollbacks**: Restore previous versions if needed
- **Analytics**: View traffic and performance metrics

---

## Cost

Firebase Hosting has a generous free tier:

- **Storage**: 10 GB free
- **Bandwidth**: 360 MB/day free
- **Custom Domains**: Free
- **SSL Certificate**: Free

For most personal websites, you'll stay well within the free tier!

See pricing: https://firebase.google.com/pricing

---

## Need Help?

### Check the Documentation
- [Firebase Deployment Guide](./FIREBASE_DEPLOYMENT.md)
- [REST API Documentation](./FIREBASE_REST_API_DEPLOYMENT.md)
- [Workflow Diagrams](./FIREBASE_WORKFLOW_DIAGRAM.md)

### Common Issues
- Use the Debug Panel to diagnose issues
- Check deployment logs for error messages
- Ensure your Firebase project is set up correctly

### Firebase Resources
- [Firebase Console](https://console.firebase.google.com/)
- [Firebase Documentation](https://firebase.google.com/docs/hosting)
- [Firebase Support](https://firebase.google.com/support)

---

## Alternative: Standalone Deployment

If you prefer to deploy from the command line, we provide standalone scripts:

### Node.js Script
```bash
node scripts/firebase-deploy-standalone.js \
  --project=my-project \
  --token=YOUR_ACCESS_TOKEN \
  --dir=./public
```

### Python Script
```bash
python3 scripts/firebase-deploy-standalone.py \
  --project=my-project \
  --token=YOUR_ACCESS_TOKEN \
  --dir=./public
```

See [FIREBASE_REST_API_DEPLOYMENT.md](./FIREBASE_REST_API_DEPLOYMENT.md) for details.

---

## What's Next?

After your first deployment:

1. **Custom Domain**: Add your own domain in Firebase Console
2. **Analytics**: Track visitors and page views
3. **Updates**: Make changes and redeploy anytime
4. **Share**: Your website is live - share the URL!

Happy deploying! 🚀
