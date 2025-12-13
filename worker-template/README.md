# Cloudflare Worker Site Template

This template demonstrates how to deploy a static site with an API using Cloudflare Workers.

## Project Structure

- `wrangler.toml`: Configuration file. Points to `src/index.js` and the `public/` folder.
- `src/index.js`: The Worker script. Handles API requests and serves static files with SPA fallback.
- `public/`: Place your static files (HTML, CSS, JS) here.

## Deployment Instructions

### 1. Install Wrangler
\`\`\`bash
npm install -g wrangler
\`\`\`

### 2. Local Development
Preview the site and API locally:
\`\`\`bash
wrangler dev
\`\`\`
Visit `http://localhost:8787` (or the URL shown).

### 3. Production Deployment
Deploy to Cloudflare:
\`\`\`bash
wrangler deploy
\`\`\`

## How It Works

The Worker script intercepts all incoming requests:
1.  **API**: Requests starting with `/api/` are handled by custom logic (returning JSON).
2.  **Static Assets**: `env.ASSETS.fetch(request)` serves files from the `public/` folder.
3.  **SPA Fallback**: If a file is not found, `index.html` is served, allowing client-side routing to work.

## Documentation Links

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Serving Static Assets with Workers](https://developers.cloudflare.com/workers/configuration/sites/)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
