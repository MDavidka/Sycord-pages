# 🚀 Cloudflare Pages Deployment - Quick Start

This repository now supports deployment to Cloudflare Pages! This guide will get you deploying in 5 minutes.

> **✨ Latest Update**: Deployment system has been enhanced with correct API parameters and detailed debug logging for easier troubleshooting!

## What You Need

1. **Cloudflare Account** (free): https://dash.cloudflare.com/
2. **API Token** with "Cloudflare Pages: Edit" permission
3. **Account ID** from your Cloudflare dashboard

## Quick Setup

### 1. Get Your Cloudflare Credentials

**Account ID:**
- Log in to https://dash.cloudflare.com/
- Your Account ID is in the URL or sidebar
- Copy it (looks like: `a1b2c3d4e5f6...`)

**API Token:**
- Go to https://dash.cloudflare.com/profile/api-tokens
- Click "Create Token"
- Use "Edit Cloudflare Pages" template
- Create and save your token securely

### 2. Configure in Sycord Pages

1. Go to your project → Deploy tab
2. Click "Show configuration"
3. Enter your API Token and Account ID
4. Click "Save Credentials"

### 3. Deploy!

1. Click "Deploy to Cloudflare"
2. Wait for deployment to complete
3. Your site is live at `https://your-project.pages.dev` 🎉

## CLI Deployment (Optional)

### Node.js
```bash
node scripts/cloudflare-deploy.js \
  --account=your_account_id \
  --token=your_api_token \
  --project=my-site \
  --dir=./out
```

### Python
```bash
python3 scripts/cloudflare-deploy.py \
  --account=your_account_id \
  --token=your_api_token \
  --project=my-site \
  --dir=./out
```

## Documentation

- **[Deployment Guide](./CLOUDFLARE_DEPLOYMENT.md)** - Comprehensive guide
- **[How to Deploy](./HOW_TO_DEPLOY.md)** - Step-by-step instructions
- **[Migration Summary](./CLOUDFLARE_MIGRATION_SUMMARY.md)** - Technical details

## Features

✨ **Simple Setup**: Just API token and Account ID - no OAuth  
🚀 **Fast Deployments**: Direct Upload to Cloudflare's global network  
🌍 **275+ CDN Locations**: Lightning-fast content delivery  
💰 **Generous Free Tier**: Unlimited sites and bandwidth  
🔒 **Secure**: Token validation and scoped permissions  
⚡ **Automatic HTTPS**: SSL certificates included  
🔄 **Instant Updates**: Redeploy anytime with one click  

## Troubleshooting

### "Invalid credentials"
- Verify token has "Pages: Edit" permission
- Check Account ID matches token's account
- Create a new token if needed

### "No files found"
- Create at least one page in your project
- Use the AI Builder to generate content

### "Failed to upload"
- Check your internet connection
- Try again (automatic retry is built-in)
- Verify files are under 25MB each

### Debug Logging
The deployment system includes detailed logging to help diagnose issues:
- Look for `📊 DEBUG:` entries in CLI output
- Check for `[Cloudflare] DEBUG:` in server logs
- Verify `Stage: production` appears in deployment logs
- Full API responses are logged for troubleshooting

**Example debug output:**
```
📊 DEBUG: Creating deployment for project: my-site
📊 DEBUG: Branch: main, Stage: production
✅ Deployment created (ID: abc123, Stage: production)
📊 DEBUG: Adding file: /index.html (1024 bytes → 1368 base64 chars)
📊 DEBUG: Total files in manifest: 3
```

## Need Help?

1. Check the [Deployment Guide](./CLOUDFLARE_DEPLOYMENT.md)
2. Review deployment logs in the UI
3. Check Cloudflare status: https://www.cloudflarestatus.com/
4. Visit Cloudflare Docs: https://developers.cloudflare.com/pages/

## Why Cloudflare Pages?

We migrated from Firebase to Cloudflare Pages because:
- **Simpler auth**: API token vs complex OAuth
- **Better performance**: Faster global CDN
- **More generous free tier**: No bandwidth limits
- **Automatic setup**: Projects created automatically
- **Developer friendly**: Great API and tooling

## What About Firebase?

Firebase integration is still available and working. You can use either platform or both!

---

**Ready to deploy?** Head to your project's Deploy tab and get started! 🚀
