import path from "node:path"
import { config } from "./config.js"

const SAFE_PROJECT_ID = /^[a-zA-Z0-9_-]+$/
const SAFE_SUBDOMAIN = /^[a-z0-9-]+$/

export function validateProjectId(projectId: string) {
  if (!SAFE_PROJECT_ID.test(projectId)) {
    throw new Error("Invalid projectId")
  }
}

export function validateSubdomain(subdomain: string) {
  if (!SAFE_SUBDOMAIN.test(subdomain)) {
    throw new Error("Invalid subdomain")
  }
}

export function validateDeployPath(filePath: string) {
  if (!filePath || path.isAbsolute(filePath) || filePath.includes("..")) {
    throw new Error(`Invalid file path: ${filePath}`)
  }
  if (/^\.env(?:\.|$)/.test(filePath) || /\/\.env(?:\.|$)/.test(filePath)) {
    throw new Error(`Env files are not allowed: ${filePath}`)
  }
  if (/(^|\/)\.[^/]+/.test(filePath)) {
    throw new Error(`Hidden files are not allowed: ${filePath}`)
  }
}

export function getProjectRoot(projectId: string) {
  return path.join(config.sitesDir, projectId, "current")
}

export function getProjectLogsDir(projectId: string) {
  return path.join(config.logsDir, projectId)
}

export function getEnvFilePath(projectId: string) {
  return path.join(config.envDir, `${projectId}.env`)
}

export function getProxyConfigPath(projectId: string) {
  return path.join(config.nginxSitesDir, `${projectId}.conf`)
}

export function getProcessName(projectId: string) {
  return `sycord-site-${projectId}`
}
