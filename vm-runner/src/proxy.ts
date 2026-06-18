import { promises as fs } from "node:fs"
import { config } from "./config.js"
import { getProxyConfigPath } from "./paths.js"
import { runCommand } from "./processes.js"

async function renderTemplate(templatePath: string, vars: Record<string, string>) {
  const template = await fs.readFile(templatePath, "utf8")
  let rendered = template
  for (const [key, value] of Object.entries(vars)) {
    rendered = rendered.replaceAll(key, value)
  }
  return rendered
}

export async function writeProxyConfig(projectId: string, serverName: string, port: number) {
  await fs.mkdir(config.nginxSitesDir, { recursive: true })
  const rendered = await renderTemplate(config.nginxSiteTemplatePath, {
    __NGINX_PORT__: String(config.nginxPort),
    __SERVER_NAME__: serverName,
    __PORT__: String(port),
  })
  await fs.writeFile(getProxyConfigPath(projectId), rendered)
}

export async function ensureWildcardProxyConfig() {
  const wildcardConfPath = `${config.nginxSitesDir}/sycord-wildcard.conf`
  try {
    await fs.access(wildcardConfPath)
    return
  } catch {}

  try {
    await fs.mkdir(config.nginxSitesDir, { recursive: true })
    const rendered = await renderTemplate(config.nginxWildcardTemplatePath, {
      __NGINX_PORT__: String(config.nginxPort),
      __CENTRAL_PORT__: String(config.centralBackendPort),
    })
    await fs.writeFile(wildcardConfPath, rendered)
  } catch {}
}

export async function ensureRunnerProxyConfig() {
  const runnerConfPath = `${config.nginxSitesDir}/sycord-runner.conf`
  try {
    await fs.access(runnerConfPath)
    return
  } catch {}

  try {
    await fs.mkdir(config.nginxSitesDir, { recursive: true })
    const rendered = await renderTemplate(config.nginxRunnerTemplatePath, {
      __NGINX_PORT__: String(config.nginxPort),
      __RUNNER_PORT__: String(config.port),
      __BASE_DOMAIN__: config.baseDomain,
    })
    await fs.writeFile(runnerConfPath, rendered)
  } catch {}
}

export async function removeProxyConfig(projectId: string) {
  await fs.rm(getProxyConfigPath(projectId), { force: true })
}

export async function reloadProxy() {
  const test = await runCommand("nginx", ["-t"])
  if (test.code !== 0) {
    throw new Error(test.stderr.join("\n") || "nginx config test failed")
  }
  const reload = await runCommand("systemctl", ["reload", "nginx"])
  if (reload.code !== 0) {
    throw new Error(reload.stderr.join("\n") || "nginx reload failed")
  }
}
