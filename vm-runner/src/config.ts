import path from "node:path"

function readNumber(name: string, fallback: number) {
  const value = Number(process.env[name] || fallback)
  return Number.isFinite(value) ? value : fallback
}

export const config = {
  host: process.env.RUNNER_HOST || "0.0.0.0",
  port: readNumber("RUNNER_PORT", 5050),
  token: process.env.VPS_RUNNER_TOKEN || "",
  baseDomain: process.env.SYCORD_BASE_DOMAIN || "sycord.site",
  sitesDir: process.env.SYCORD_SITES_DIR || "/srv/sycord/sites",
  logsDir: process.env.SYCORD_LOGS_DIR || "/srv/sycord/logs",
  envDir: process.env.SYCORD_ENV_DIR || "/srv/sycord/env",
  stateFile: process.env.SYCORD_STATE_FILE || "/srv/sycord/runner/state.json",
  portStart: readNumber("SYCORD_PORT_START", 4100),
  portEnd: readNumber("SYCORD_PORT_END", 4999),
  proxy: process.env.SYCORD_PROXY || "nginx",
  nginxSitesDir: process.env.SYCORD_NGINX_SITES_DIR || "/etc/nginx/sites-enabled",
  nginxTemplatePath: path.join(process.cwd(), "templates", "nginx-site.conf"),
  pm2Binary: process.env.SYCORD_PM2_BIN || "pm2",
  setupScriptPath: path.join(process.cwd(), "scripts", "setup-ubuntu.sh"),
}
