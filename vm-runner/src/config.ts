import path from "node:path"

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback)
  return Number.isFinite(value) ? value : fallback
}

export const config = {
  host: process.env.RUNNER_HOST || "0.0.0.0",

  /** Internal port the vm-runner Fastify API listens on — the deployer API */
  port: readNumber("RUNNER_PORT", 5050),

  token: process.env.VPS_RUNNER_TOKEN || "",
  baseDomain: process.env.SYCORD_BASE_DOMAIN || "sycord.site",

  /** Port Nginx listens on for wildcard *.sycord.site → per-site routing.
   *  Cloudflare Tunnel routes *.sycord.site → localhost:<nginxPort>.
   *  The runner API (api.sycord.site) is served directly on :5050 via Cloudflare. */
  nginxPort: readNumber("SYCORD_NGINX_PORT", 80),

  /** Default backend for the Nginx wildcard block (multi-tenant central app).
   *  Individual per-site server blocks override this with project-specific ports. */
  centralBackendPort: readNumber("SYCORD_CENTRAL_PORT", 3000),

  sitesDir: process.env.SYCORD_SITES_DIR || "/srv/sycord/sites",
  logsDir: process.env.SYCORD_LOGS_DIR || "/srv/sycord/logs",
  envDir: process.env.SYCORD_ENV_DIR || "/srv/sycord/env",
  stateFile: process.env.SYCORD_STATE_FILE || "/srv/sycord/runner/state.json",

  /** Range allocated to per-project PM2 processes */
  portStart: readNumber("SYCORD_PORT_START", 4100),
  portEnd: readNumber("SYCORD_PORT_END", 4999),

  proxy: process.env.SYCORD_PROXY || "nginx",
  nginxSitesDir: process.env.SYCORD_NGINX_SITES_DIR || "/etc/nginx/sites-enabled",
  nginxSiteTemplatePath: path.join(process.cwd(), "templates", "nginx-site.conf"),
  nginxWildcardTemplatePath: path.join(process.cwd(), "templates", "nginx-wildcard.conf"),
  nginxRunnerTemplatePath: path.join(process.cwd(), "templates", "nginx-runner.conf"),

  pm2Binary: process.env.SYCORD_PM2_BIN || "pm2",
  setupScriptPath: path.join(process.cwd(), "scripts", "setup-ubuntu.sh"),

  /** Optional cloudflared config template path */
  cloudflaredConfigTemplatePath: path.join(process.cwd(), "templates", "cloudflared-config.yml"),
}
