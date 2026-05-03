import os from "node:os"
import { promises as fs } from "node:fs"
import { config } from "./config.js"
import { ensureBaseDirectories } from "./logs.js"
import { runCommand } from "./processes.js"

async function checkSystemctl(service: string) {
  const result = await runCommand("systemctl", ["is-active", service])
  return result.code === 0
}

async function diskUsage() {
  const result = await runCommand("bash", ["-lc", `df -h ${config.sitesDir} | tail -1 | awk '{print $5}'`])
  return result.stdout.join("").trim() || null
}

export async function getSetupStatus() {
  await ensureBaseDirectories()
  let stateExists = false
  try {
    await fs.access(config.stateFile)
    stateExists = true
  } catch {}

  return {
    success: true,
    online: true,
    setupComplete: stateExists,
    setup: {
      sitesDirReady: true,
      envDirReady: true,
      stateFileReady: stateExists,
    },
    tunnel: {
      ok: await checkSystemctl("cloudflared"),
      status: (await checkSystemctl("cloudflared")) ? "online" : "offline",
    },
    proxy: {
      ok: await checkSystemctl("nginx"),
      status: (await checkSystemctl("nginx")) ? "online" : "offline",
    },
    cpu: Math.round(os.loadavg()[0] * 100) / 100,
    mem: {
      total: os.totalmem(),
      free: os.freemem(),
      percent: Math.round(((os.totalmem() - os.freemem()) / os.totalmem()) * 100),
    },
    disk: {
      percent: await diskUsage(),
    },
  }
}

export async function runSetup() {
  await ensureBaseDirectories()
  await fs.writeFile(config.stateFile, JSON.stringify({ websites: {} }, null, 2), { flag: "a+" })
  return getSetupStatus()
}
