# How to Deploy Your Website to Cloudflare Pages

This guide explains how to deploy your Sycord Pages website to Cloudflare Pages.

> **Latest Update**: Deployment logic has been fixed and enhanced with detailed debug logging to help diagnose any issues. All deployments now correctly use the production stage for reliable publishing.

## Quick Start (3 Steps)

### 1. Create Your Website
Use the AI Builder in Sycord Pages to generate your website content.

### 2. Configure Cloudflare Credentials
Add your Cloudflare API token and Account ID to enable deployment.

### 3. Deploy
Click "Deploy to Cloudflare" and your site will be live at `https://your-project.pages.dev`!

---

## Prerequisites

Before you can deploy, you need a Cloudflare account (free) and API credentials.

### Step-by-Step: Get Your Cloudflare Credentials

#### 1. Create a Cloudflare Account (if needed)

1. Go to https://dash.cloudflare.com/
2. Click "Sign up" and create a free account
3. Verify your email address

#### 2. Find Your Account ID

1. Log in to your Cloudflare dashboard
2. Your Account ID appears in several places:
   - In the URL: `dash.cloudflare.com/{account_id}/...`
   - In the sidebar of most pages
   - In Workers & Pages → Overview → Account ID
3. Copy your Account ID (it looks like: `a1b2c3d4e5f6...`)

#### 3. Create an API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **"Create Token"**
3. Use the **"Edit Cloudflare Pages"** template, OR create a custom token:
   - **Token name**: "Sycord Pages Deployment"
   - **Permissions**:
     - Account → Cloudflare Pages → Edit
   - **Account Resources**:
     - Include → Your Account
   - **TTL**: Optional (set expiration if desired)
4. Click **"Continue to summary"**
5. Click **"Create Token"**
6. **IMPORTANT**: Copy and save your token immediately
   - You won't be able to see it again!
   - Store it securely (password manager, secure notes, etc.)

---

## Deployment Steps

### Step 1: Configure Credentials in Sycord Pages

1. Navigate to your project in Sycord Pages
2. Click the **Deploy** tab
3. Click **"Show configuration"** or **"Configure"** button
4. Enter your credentials:
   - **API Token**: Paste your Cloudflare API token
   - **Account ID**: Paste your Cloudflare Account ID
5. Click **"Save Credentials"**
6. The system will validate your credentials with Cloudflare

**Note:** You only need to configure credentials once per project. They are stored securely and reused for future deployments.

### Step 2: Deploy Your Website

1. Make sure you have at least one page in your project (use AI Builder to create pages)
2. Click **"Deploy to Cloudflare"**
3. Watch the deployment progress in real-time:
   - 🔐 Validating credentials...
   - 🚀 Starting deployment...
   - 🔍 Checking project...
   - 📝 Creating deployment...
   - 📤 Uploading files...
   - ✅ Deployment successful!
4. Once complete, you'll see your live URL: `https://your-project.pages.dev`
5. Click the link to view your live website! 🎉

### Step 3: Share Your Website

Your website is now live on the internet! You can:

- Share the `.pages.dev` URL with anyone
- Add a custom domain (see below)
- Update your site by making changes and redeploying

---

## What Happens During Deployment?

Behind the scenes, Sycord Pages:

1. **Validates Credentials**: Verifies your API token and Account ID with Cloudflare
2. **Checks Project**: Verifies your Cloudflare Pages project exists (creates it if needed)
3. **Creates Deployment**: Initiates a new deployment via Cloudflare Pages API
4. **Uploads Files**: Uploads all your pages using Cloudflare's Direct Upload API
5. **Finalizes**: Your site goes live on Cloudflare's global CDN network

All of this happens automatically using the Cloudflare Pages REST API - no CLI required!

---

## Adding a Custom Domain (Optional)

Want to use your own domain (e.g., `www.mysite.com`) instead of `.pages.dev`?

1. Go to https://dash.cloudflare.com/
2. Navigate to **Workers & Pages**
3. Click on your project
4. Go to **Custom domains** tab
5. Click **"Set up a custom domain"**
6. Enter your domain or subdomain
7. Follow the instructions to configure DNS

**For Apex Domains** (e.g., `mysite.com`):
- The domain must be a Cloudflare zone
- Add the domain to Cloudflare first
- Then add it as a custom domain in Pages

**For Subdomains** (e.g., `www.mysite.com`):
- Add a CNAME record pointing to your `.pages.dev` URL
- Or use Cloudflare's automatic setup

---

## Troubleshooting

### "Invalid Cloudflare API token or account ID"

**Problem:** Your credentials are incorrect or the token doesn't have proper permissions.

**Solution:**
1. Verify your token has **"Cloudflare Pages: Edit"** permission
2. Check that the Account ID matches the account where you created the token
3. Make sure the token hasn't expired
4. Create a new token if needed at https://dash.cloudflare.com/profile/api-tokens

---

### "Failed to create project"

**Problem:** Project name is invalid or already exists in your account.

**Solution:**
1. Project names must be lowercase, alphanumeric, with hyphens only
2. Must be unique within your Cloudflare account
3. Maximum 58 characters
4. The system will auto-generate a valid name from your project title
5. If you have a project with the same name, rename or delete it in Cloudflare dashboard

---

### "No files found to deploy"

**Problem:** Your project doesn't have any pages yet.

**Solution:**
1. Use the AI Builder to create at least one page
2. Make sure pages have content (not empty)
3. Check the debug panel to see page count
4. Try deploying again after adding content

---

### "Failed to upload files"

**Problem:** File upload to Cloudflare failed.

**Solution:**
1. Check that individual files are under 25MB (Cloudflare's limit)
2. Verify your internet connection is stable
3. Check Cloudflare's status at https://www.cloudflarestatus.com/
4. Wait a moment and try deploying again
5. If the problem persists, check the deployment logs for specific errors

---

### "Rate limit exceeded"

**Problem:** You've made too many API requests to Cloudflare.

**Solution:**
1. Wait a few minutes before trying again
2. Cloudflare has generous rate limits - this is rare
3. Check if you're making multiple deployments simultaneously

---

### Deployment Stuck or Failing

**Problem:** Deployment starts but doesn't complete, or fails with unclear errors.

**Solution:**
1. Check the deployment logs - look for detailed `DEBUG:` entries that show exactly what's happening
2. Verify the deployment is using `stage: production` (shown in debug logs)
3. Ensure your project name is valid (lowercase, alphanumeric, hyphens only)
4. Check that all files are valid HTML/text content
5. Look at server logs if you have access (for Next.js deployments)
6. Try creating a simple test page first to verify the deployment pipeline

**Debug Information to Look For:**
- `[Cloudflare] DEBUG: Creating deployment for project: ...`
- `[Cloudflare] DEBUG: Branch: main, Stage: production` (should say "production")
- `[Cloudflare] ✅ Deployment created (ID: ..., Stage: production)`
- Any error responses with full details

---

### Token Expired

**Problem:** Your API token has expired.

**Solution:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create a new token with the same permissions
3. Update your credentials in Sycord Pages
4. Try deploying again

---

## Advanced Features

### Multiple Deployments

- Each deployment creates a new version
- Previous versions are kept (can access via dashboard)
- Instant rollback available in Cloudflare dashboard

### Preview Deployments

- Preview deployments (branches) can be created via Cloudflare dashboard
- Each branch gets its own URL: `branch-name.your-project.pages.dev`

### Environment Variables

- Set via Cloudflare dashboard: Workers & Pages → Your Project → Settings
- Available at build time and runtime

### Analytics

- Free analytics available in Cloudflare dashboard
- View traffic, performance, and more
- No tracking scripts needed on your site

---

## Cloudflare Pages vs Firebase Hosting

If you're migrating from Firebase, here are the key differences:

| Feature | Firebase Hosting | Cloudflare Pages |
|---------|-----------------|------------------|
| Authentication | Google OAuth | API Token |
| Free Tier | 10GB storage, 360MB/day | Unlimited sites, bandwidth |
| Builds/Month | 2,000 | 500 |
| CDN | Google's network | Cloudflare's network (275+ cities) |
| URL Format | `.web.app` or `.firebaseapp.com` | `.pages.dev` |
| Setup | Manual project creation | Automatic |
| Custom Domains | Supported | Supported |
| SSL | Automatic | Automatic |
| Rollbacks | Via CLI/Console | Instant (dashboard) |

Both are excellent choices! Cloudflare Pages offers:
- ✅ Simpler authentication (just API token)
- ✅ More generous free tier
- ✅ Faster global network
- ✅ Automatic project creation

---

## Getting Help

If you run into issues:

1. **Check Deployment Logs**: Review error messages in the deployment log panel
2. **Debug Information**: Expand the "Debug Information" section for details
3. **Cloudflare Dashboard**: Check your project status at https://dash.cloudflare.com/
4. **Cloudflare Docs**: Visit https://developers.cloudflare.com/pages/
5. **Status Page**: Check for Cloudflare incidents at https://www.cloudflarestatus.com/

---

## Security Best Practices

1. **Never Share Your API Token**: Treat it like a password
2. **Use Scoped Tokens**: Only grant "Pages: Edit" permission (not full account access)
3. **Set Token Expiration**: Create tokens with expiration dates when possible
4. **Rotate Tokens Periodically**: Create new tokens and delete old ones regularly
5. **Remove When Done**: Delete credentials if you're no longer using deployment

---

## Next Steps

After deploying your website:

1. ✅ Test your site thoroughly
2. 🎨 Customize your pages with AI Builder
3. 🌐 Add a custom domain (optional)
4. 📊 Check analytics in Cloudflare dashboard
5. 🚀 Share your site with the world!

Happy deploying! 🎉
