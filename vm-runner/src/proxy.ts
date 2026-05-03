import { promises as fs } from "node:fs"
import { config } from "./config.js"
import { getProxyConfigPath } from "./paths.js"
import { runCommand } from "./processes.js"

export async function writeProxyConfig(projectId: string, serverName: string, port: number) {
  const template = await fs.readFile(config.nginxTemplatePath, "utf8")
  const rendered = template
    .replace(/__SERVER_NAME__/g, serverName)
    .replace(/__PORT__/g, String(port))
  await fs.mkdir(config.nginxSitesDir, { recursive: true })
  await fs.writeFile(getProxyConfigPath(projectId), rendered)
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
