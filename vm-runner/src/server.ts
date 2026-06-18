import Fastify from "fastify"
import { promises as fs } from "node:fs"
import os from "node:os"
import { config } from "./config.js"
import { requireBearerToken } from "./auth.js"
import { deployProject } from "./deploy.js"
import { appendLog, ensureBaseDirectories, readLog } from "./logs.js"
import { getSetupStatus, runSetup } from "./setup.js"
import { createSseReply } from "./stream.js"
import { getProcessName, getProjectRoot, validateProjectId } from "./paths.js"
import { deleteProcess, pm2Describe, stopProcess } from "./processes.js"
import { getWebsiteState, readState, removeWebsiteState, upsertWebsiteState } from "./state.js"
import { runHealthCheck } from "./health.js"
import { ensureRunnerProxyConfig, ensureWildcardProxyConfig, reloadProxy, removeProxyConfig } from "./proxy.js"

const app = Fastify({ logger: true })

app.addHook("preHandler", requireBearerToken)

app.get("/api/status", async () => {
  const setup = await getSetupStatus()
  const state = await readState()
  return {
    ...setup,
    websites: Object.keys(state.websites).length,
    runningSites: Object.values(state.websites).filter((site) => site.status === "running").length,
    failedSites: Object.values(state.websites).filter((site) => site.status === "failed").length,
    tunnelOnline: setup.tunnel.ok,
    proxyOnline: setup.proxy.ok,
    hostname: os.hostname(),
  }
})

app.get("/api/setup/status", async () => getSetupStatus())
app.post("/api/setup", async (_request, reply) => {
  const result = await runSetup()
  if (!result.success) {
    return reply.code(500).send(result)
  }
  return result
})
app.post("/api/runner/start", async () => ({ success: true, message: "Runner API already active" }))
app.post("/api/runner/stop", async () => ({ success: true, message: "Use systemd to stop the runner service" }))
app.post("/api/runner/destroy", async () => {
  const state = await readState()
  await Promise.all(
    Object.values(state.websites).map(async (site) => {
      await deleteProcess(site.processName).catch(() => undefined)
      await removeProxyConfig(site.projectId).catch(() => undefined)
    }),
  )
  await reloadProxy().catch(() => undefined)
  return { success: true }
})

app.get("/api/websites", async () => {
  const state = await readState()
  return {
    success: true,
    websites: Object.values(state.websites).map((site) => ({
      id: site.projectId,
      ...site,
    })),
  }
})

app.get("/api/websites/:projectId", async (request) => {
  const { projectId } = request.params as { projectId: string }
  validateProjectId(projectId)
  const site = await getWebsiteState(projectId)
  if (!site) return { success: false, error: "Website not found" }
  return { success: true, website: site }
})

app.post("/api/websites/:projectId/start", async (request) => {
  const { projectId } = request.params as { projectId: string }
  const site = await getWebsiteState(projectId)
  if (!site) return { success: false, error: "Website not found" }
  const { startOrRestartProcess } = await import("./processes.js")
  const envFile = `${config.envDir}/${projectId}.env`
  const result = await startOrRestartProcess(projectId, site.processName, site.port, getProjectRoot(projectId), envFile)
  await upsertWebsiteState({ ...site, status: result.code === 0 ? "running" : "failed" })
  return { success: result.code === 0 }
})

app.post("/api/websites/:projectId/stop", async (request) => {
  const { projectId } = request.params as { projectId: string }
  const site = await getWebsiteState(projectId)
  if (!site) return { success: false, error: "Website not found" }
  const result = await stopProcess(site.processName)
  await upsertWebsiteState({ ...site, status: result.code === 0 ? "stopped" : "failed" })
  return { success: result.code === 0 }
})

app.post("/api/websites/:projectId/restart", async (request) => {
  const { projectId } = request.params as { projectId: string }
  const site = await getWebsiteState(projectId)
  if (!site) return { success: false, error: "Website not found" }
  const { startOrRestartProcess } = await import("./processes.js")
  const envFile = `${config.envDir}/${projectId}.env`
  const result = await startOrRestartProcess(projectId, site.processName, site.port, getProjectRoot(projectId), envFile)
  return { success: result.code === 0 }
})

app.post("/api/websites/:projectId/health", async (request) => {
  const { projectId } = request.params as { projectId: string }
  const site = await getWebsiteState(projectId)
  if (!site) return { success: false, error: "Website not found" }
  const health = await runHealthCheck(projectId, site.port)
  await upsertWebsiteState({
    ...site,
    health: health.ok && health.htmlOk ? "healthy" : "unhealthy",
    lastHealthCheckAt: new Date().toISOString(),
  })
  return { success: health.ok, health }
})

app.delete("/api/websites/:projectId", async (request) => {
  const { projectId } = request.params as { projectId: string }
  const site = await getWebsiteState(projectId)
  if (site) {
    await deleteProcess(site.processName).catch(() => undefined)
  }
  await fs.rm(getProjectRoot(projectId), { recursive: true, force: true }).catch(() => undefined)
  await fs.rm(`${config.envDir}/${projectId}.env`, { force: true }).catch(() => undefined)
  await removeProxyConfig(projectId).catch(() => undefined)
  await reloadProxy().catch(() => undefined)
  await removeWebsiteState(projectId)
  return { success: true }
})

app.get("/api/websites/:projectId/logs", async (request) => {
  const { projectId } = request.params as { projectId: string }
  const query = request.query as { type?: "deploy" | "build" | "runtime" | "error" | "health"; limit?: string }
  const type = query.type || "runtime"
  const limit = Number(query.limit || "300")
  return {
    success: true,
    logs: await readLog(projectId, type, limit),
  }
})

app.post("/api/deploy/:projectId", async (request, reply) => {
  const { projectId } = request.params as { projectId: string }
  try {
    const payload = request.body as any
    const result = await deployProject(projectId, payload, null)
    if (!result.success) {
      return reply.code(400).send(result)
    }
    return result
  } catch (error: any) {
    await appendLog(projectId, "error", error?.message || "Deployment failed")
    return await reply.code(500).send({
      success: false,
      deployment_mode: "next-server",
      project_id: projectId,
      build: { ok: false, logs: [], error: error?.message || "Deployment failed" },
      running: false,
      health: { ok: false, htmlOk: false },
      logs: [],
      error: error?.message || "Deployment failed",
    })
  }
})

app.post("/api/deploy/:projectId/stream", async (request, reply) => {
  const { projectId } = request.params as { projectId: string }
  const stream = createSseReply(reply)
  try {
    const result = await deployProject(projectId, request.body as any, stream)
    if (!result.success) {
      stream.stage("failed", "error", result.error || "Deployment failed")
      stream.error({
        error: result.error || "Deployment failed",
        stage: result.health?.ok ? "build" : "health-check",
        logs: result.build?.logs || [],
        health: result.health,
      })
    }
  } catch (error: any) {
    await appendLog(projectId, "error", error?.message || "Deployment failed")
    stream.stage("failed", "error", error?.message || "Deployment failed")
    stream.error({
      error: error?.message || "Deployment failed",
      stage: "failed",
      logs: await readLog(projectId, "error", 50),
    })
  } finally {
    reply.raw.end()
  }
})

ensureBaseDirectories()
  .then(() => ensureWildcardProxyConfig())
  .then(() => ensureRunnerProxyConfig())
  .then(() => reloadProxy().catch(() => undefined))
  .then(() => app.listen({ host: config.host, port: config.port }))
  .catch((error) => {
    app.log.error(error)
    process.exit(1)
  })
