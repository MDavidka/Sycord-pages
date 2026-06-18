# Sycord Deployer Architecture (AI Agent Reference)

## Traffic Flow

```
User opens <user>.sycord.site
  → Cloudflare DNS (wildcard CNAME *.sycord.site)
    → Cloudflare Tunnel (cloudflared daemon on VM)
      → Nginx :80 (wildcard server_name *.sycord.site)
        → PM2 project :4100–4999 (Next.js per-site)

User calls deploy API at api.sycord.site
  → Cloudflare DNS → Cloudflare Tunnel
    → Runner :5050 (Fastify — this is the deployer API)
```

## Port Map

| Port | Owner | Purpose |
|------|-------|---------|
| 5050 | vm-runner (Fastify) | Deployer API — handles deploy(), proxy management, health checks |
| 80   | Nginx | Reverse proxy — wildcard *.sycord.site → per-site PM2 |
| 3000 | Central app (default) | Multi-tenant fallback backend (configurable) |
| 4100–4999 | PM2 | Per-project Next.js sites |

## Cloudflare Tunnel Ingress

```yaml
ingress:
  - hostname: "api.sycord.site"
    service: http://localhost:5050   # runner API, direct
  - hostname: "*.sycord.site"
    service: http://localhost:80     # nginx → per-site
  - hostname: "sycord.site"
    service: http://localhost:80
  - service: http_status:404
```

**Critical:** `api.sycord.site` routes DIRECTLY to the runner:5050, bypassing Nginx.
All other traffic goes through Nginx:80.

## Deployer API (Runner on :5050)

The runner is a Fastify HTTP server at `/srv/sycord/vm-runner/`.
Systemd unit: `sycord-vm-runner.service`

### Core Endpoints

```
POST /api/deploy/:projectId          — deploy a Next.js project
POST /api/deploy/:projectId/stream   — SSE-streamed deploy with real-time logs
GET  /api/status                     — full system status
GET  /api/setup/status               — diagnostics (nginx, cloudflared, runner, ports)
POST /api/setup                      — run bootstrap (install deps, configure nginx)
GET  /api/websites                   — list all deployed sites
GET  /api/websites/:projectId        — get single site state
POST /api/websites/:projectId/start  — start a stopped site
POST /api/websites/:projectId/stop   — stop a running site
POST /api/websites/:projectId/restart
DELETE /api/websites/:projectId      — delete site, PM2 process, nginx config
GET  /api/websites/:projectId/logs?type=runtime&limit=300
POST /api/websites/:projectId/health — run local health check
```

### Proxy Management Endpoints (NEW)

```
GET  /api/proxy                      — list all nginx proxy configs + sites
POST /api/proxy/reload               — reload nginx (nginx -t && systemctl reload nginx)
POST /api/proxy/write                — write nginx vhost config ({ projectId, serverName, port })
DELETE /api/proxy/:projectId          — remove nginx vhost config
POST /api/proxy/ensure-wildcard      — ensure sycord-wildcard.conf exists
```

### Deployment Payload

```json
{
  "files": [
    { "path": "package.json", "content": "..." },
    { "path": "app/page.tsx", "content": "..." }
  ],
  "subdomain": "userproject",
  "deployment_mode": "next-server",
  "env_vars": { "DATABASE_URL": "..." }
}
```

### Deployment Response (includes detailed debug)

```json
{
  "success": true,
  "project_id": "abc123",
  "domain": "userproject.sycord.site",
  "url": "https://userproject.sycord.site",
  "port": 4101,
  "processName": "sycord-site-abc123",
  "running": true,
  "build": { "ok": true, "logs": [...] },
  "health": { "ok": true, "htmlOk": true, "statusCode": 200 },
  "debug": {
    "startedAt": "2026-06-18T...",
    "completedAt": "2026-06-18T...",
    "durationMs": 45200,
    "cwd": "/srv/sycord/sites/abc123/current",
    "envFile": "/srv/sycord/env/abc123.env",
    "fileCount": 42,
    "envVarCount": 3,
    "nodeVersion": "v22.14.0",
    "npmVersion": "10.9.8",
    "portAllocation": { "phase": "fresh", "attempts": 1 },
    "pm2Start": { "attempts": 1, "exitCodes": [0], "eaddrRetries": 0 },
    "nginx": {
      "configPath": "/etc/nginx/sites-enabled/abc123.conf",
      "serverName": "userproject.sycord.site",
      "proxyPort": 4101,
      "nginxPort": 80,
      "reloaded": true
    },
    "healthChecks": {
      "local": { "url": "http://127.0.0.1:4101/", "ok": true, "htmlOk": true, "statusCode": 200 },
      "public": { "urls": ["https://userproject.sycord.site/", "http://userproject.sycord.site/"], "ok": true, "htmlOk": true, "protocol": "https" }
    }
  }
}
```

## Deployment Pipeline (deployProject function)

1. **Write files** → `/srv/sycord/sites/<projectId>/current/`
2. **Write env** → `/srv/sycord/env/<projectId>.env` (chmod 600)
3. **npm install + npm run build** — in project cwd
4. **Allocate port** — scan 4100–4999 for free port
5. **PM2 start** — `pm2 start npm --name sycord-site-<id> -- run start` with PORT env
6. **Write nginx vhost** → `/etc/nginx/sites-enabled/<projectId>.conf` (listen 80, server_name <sub>.sycord.site, proxy_pass :<port>)
7. **Nginx graceful reload** — `systemctl reload nginx` (HUP signal, zero downtime)
8. **Health check local** — `http://127.0.0.1:<port>/` validates HTML response
9. **Health check public** — `https://<subdomain>.sycord.site/` via Cloudflare

## Nginx Configuration

### Wildcard config (`/etc/nginx/sites-enabled/sycord-wildcard.conf`)
Listens on port 80, `server_name *.sycord.site sycord.site`, proxies to central backend (default :3000). This is the fallback — per-site configs with exact server_name matches take priority.

### Per-site config (`/etc/nginx/sites-enabled/<projectId>.conf`)
Listens on port 80, exact `server_name <sub>.sycord.site`, proxies to `127.0.0.1:<projectPort>`.

### Graceful reload
```
nginx -t && systemctl reload nginx
```
Uses HUP signal — never `restart` in production.

## State File (`/srv/sycord/runner/state.json`)
```json
{
  "websites": {
    "abc123": {
      "projectId": "abc123",
      "subdomain": "userproject",
      "domain": "userproject.sycord.site",
      "port": 4101,
      "processName": "sycord-site-abc123",
      "status": "running",
      "health": "healthy",
      "lastDeployAt": "...",
      "lastHealthCheckAt": "..."
    }
  },
  "ports": { "4101": "abc123" }
}
```

## Directory Layout (on VM)

```
/srv/sycord/
  sites/<projectId>/current/    — project source files
  logs/<projectId>/              — deploy.log, build.log, runtime.log, error.log, health.log
  env/<projectId>.env            — environment variables (chmod 600)
  runner/state.json              — persistent state
  vm-runner/                     — the runner source & dist
    dist/server.js               — compiled entrypoint
    templates/
      nginx-site.conf            — per-site nginx vhost template
      nginx-wildcard.conf        — wildcard fallback template
      cloudflared-config.yml     — cloudflare tunnel config template
    scripts/
      setup-ubuntu.sh            — full bootstrap script
      install-service.sh         — systemd service installer
```

## Key Principles

- **Zero downtime:** Nginx reloads via HUP signal only. Never restart in production.
- **Port collision prevention:** Port allocator scans 4100–4999, checks OS-level availability.
- **EADDRINUSE retry:** If PM2 start fails with EADDRINUSE, retries with a fresh port.
- **Graceful degradation:** Failed deployments leave state for debugging, never leave orphaned processes.
- **Auth required:** All runner API endpoints require Bearer token (VPS_RUNNER_TOKEN).
