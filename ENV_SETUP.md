# Environment Setup for Vercel Integration

To enable Vercel OAuth and Deployment integration, add the following variables to your `.env.local` file:

## Vercel OAuth Application
Register an OAuth integration on Vercel (https://vercel.com/integrations/console) to get these credentials.

- `VERCEL_CLIENT_ID`: The Client ID of your Vercel Integration.
- `VERCEL_CLIENT_SECRET`: The Client Secret of your Vercel Integration.

## Application Configuration
- `NEXTAUTH_URL`: The canonical URL of your application (e.g., `http://localhost:3000` or `https://ltpd.xyz`). This is used for redirection during the OAuth flow.

## Existing Variables (Already Required)
- `MONGODB_URI`: Connection string for MongoDB.
- `GOOGLE_CLIENT_ID`: Google OAuth Client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth Client Secret.
- `AUTH_SECRET`: Secret for NextAuth.js encryption.

## Example .env.local
```env
# Database
MONGODB_URI=mongodb+srv://...

# Auth - Google
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
AUTH_SECRET=...

# Auth - Vercel
VERCEL_CLIENT_ID=...
VERCEL_CLIENT_SECRET=...

# General
NEXTAUTH_URL=http://localhost:3000
```
