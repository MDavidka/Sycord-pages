import {
  coolify,
  extractDeploymentUuid,
  extractUuid,
  getCoolifyConfig,
  isCoolifyConfigured,
} from "@/lib/deploy/coolify-client"

export type CoolifyMcpAction =
  | "health"
  | "version"
  | "list_projects"
  | "create_project"
  | "list_servers"
  | "list_applications"
  | "get_application"
  | "deploy_application"
  | "restart_application"
  | "stop_application"
  | "start_application"
  | "list_deployments"
  | "get_deployment"
  | "get_application_logs"
  | "execute_command"
  | "bulk_update_envs"

export type CoolifyMcpInput = {
  action: CoolifyMcpAction
  uuid?: string
  applicationUuid?: string
  deploymentUuid?: string
  force?: boolean
  command?: string
  name?: string
  description?: string
  envs?: Array<{ key: string; value: string }>
}

export async function runCoolifyMcpAction(input: CoolifyMcpInput): Promise<{
  ok: boolean
  action: string
  data?: unknown
  error?: string
}> {
  if (!isCoolifyConfigured()) {
    return { ok: false, action: input.action, error: "Coolify not configured (DEPLOYER_API_KEY / DEPLOYER_API_URL)" }
  }

  const appUuid = input.applicationUuid || input.uuid

  switch (input.action) {
    case "health": {
      const res = await coolify.health()
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "version": {
      const res = await coolify.version()
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "list_projects": {
      const res = await coolify.listProjects()
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "create_project": {
      const name = input.name?.trim()
      if (!name) return { ok: false, action: input.action, error: "name required" }
      const res = await coolify.createProject(name, input.description)
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "list_servers": {
      const res = await coolify.listServers()
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "list_applications": {
      const res = await coolify.listApplications()
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "get_application": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      const res = await coolify.getApplication(appUuid)
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "deploy_application": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      const res = await coolify.deploy(appUuid, Boolean(input.force))
      if (!res.ok) {
        const restart = await coolify.restartApplication(appUuid, { force: Boolean(input.force) })
        return restart.ok
          ? { ok: true, action: input.action, data: restart.data }
          : { ok: false, action: input.action, error: res.error || restart.error || "deploy failed" }
      }
      return { ok: true, action: input.action, data: res.data }
    }
    case "restart_application": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      const res = await coolify.restartApplication(appUuid, { force: Boolean(input.force) })
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "stop_application": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      const res = await coolify.stopApplication(appUuid)
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "start_application": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      const res = await coolify.startApplication(appUuid, { force: Boolean(input.force) })
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "list_deployments": {
      const res = await coolify.listDeployments()
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "get_deployment": {
      const depUuid = input.deploymentUuid || input.uuid
      if (!depUuid) return { ok: false, action: input.action, error: "deploymentUuid required" }
      const res = await coolify.getDeployment(depUuid)
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "get_application_logs": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      const deployments = await coolify.listDeployments()
      if (!deployments.ok || !Array.isArray(deployments.data)) {
        return { ok: false, action: input.action, error: deployments.error || "no deployments" }
      }
      const latest = deployments.data
        .filter((d: any) => d?.application_id === appUuid || d?.application_uuid === appUuid)
        .sort((a: any, b: any) => new Date(b?.created_at || 0).getTime() - new Date(a?.created_at || 0).getTime())[0]
      if (!latest?.deployment_uuid) {
        return { ok: true, action: input.action, data: { logs: "", message: "No deployment logs yet" } }
      }
      const dep = await coolify.getDeployment(latest.deployment_uuid)
      return dep.ok ? { ok: true, action: input.action, data: dep.data } : { ok: false, action: input.action, error: dep.error || "failed" }
    }
    case "bulk_update_envs": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      if (!input.envs?.length) return { ok: false, action: input.action, error: "envs array required" }
      const res = await coolify.bulkUpdateEnvs(
        appUuid,
        input.envs.map((e) => ({
          key: e.key,
          value: e.value,
          is_preview: false,
          is_build_time: false,
          is_literal: false,
          is_multiline: false,
          is_shown_once: false,
        })),
      )
      return res.ok ? { ok: true, action: input.action, data: res.data } : { ok: false, action: input.action, error: res.error || "failed" }
    }
    case "execute_command": {
      if (!appUuid) return { ok: false, action: input.action, error: "applicationUuid required" }
      if (!input.command?.trim()) return { ok: false, action: input.action, error: "command required" }
      // Coolify runs one-shot commands via pre/post deployment hooks on redeploy.
      const patch = await coolify.updateApplication(appUuid, {
        post_deployment_command: input.command,
        post_deployment_command_container: "application",
      })
      if (!patch.ok) {
        return { ok: false, action: input.action, error: patch.error || "Failed to set command" }
      }
      const deploy = await coolify.restartApplication(appUuid, { force: false })
      const deploymentUuid = extractDeploymentUuid(deploy.data)
      return deploy.ok
        ? {
            ok: true,
            action: input.action,
            data: {
              message: "Command queued via post_deployment_command + restart",
              command: input.command,
              deploymentUuid,
              deploy: deploy.data,
            },
          }
        : { ok: false, action: input.action, error: deploy.error || "Failed to run command" }
    }
    default:
      return { ok: false, action: input.action, error: `Unknown action: ${input.action}` }
  }
}

export function formatCoolifyMcpForAI(result: Awaited<ReturnType<typeof runCoolifyMcpAction>>): string {
  if (!result.ok) {
    return `[SYSTEM] ❌ Coolify MCP ${result.action} failed: ${result.error}`
  }
  const payload = JSON.stringify(result.data, null, 2)
  return `[SYSTEM] ✅ Coolify MCP ${result.action} succeeded:\n${payload.slice(0, 6000)}`
}

export function getCoolifyMcpToolDescription(): string {
  const config = isCoolifyConfigured() ? getCoolifyConfig() : null
  return (
    "Call Coolify deploy platform API (MCP-compatible actions). " +
    (config ? `Connected to ${config.baseUrl}. ` : "Requires DEPLOYER_API_KEY. ") +
    "Actions: health, version, list_projects, create_project, list_servers, list_applications, get_application, " +
    "deploy_application, restart_application, stop_application, start_application, list_deployments, " +
    "get_deployment, get_application_logs, bulk_update_envs, execute_command."
  )
}
