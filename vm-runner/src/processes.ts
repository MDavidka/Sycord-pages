import { spawn } from "node:child_process"
import { once } from "node:events"
import { readFile } from "node:fs/promises"
import { config } from "./config.js"

export async function runCommand(
  command: string,
  args: string[],
  options: {
    cwd?: string
    env?: NodeJS.ProcessEnv
    onLine?: (line: string, stream: "stdout" | "stderr") => void
  } = {},
) {
  const child = spawn(command, args, {
    cwd: options.cwd,
    env: { ...process.env, ...options.env, PATH: (options.env?.PATH || process.env.PATH || '') + ':/usr/local/bin:/usr/bin:/bin:/opt/node/bin:~/.npm-global/bin' },
    stdio: ["ignore", "pipe", "pipe"],
  })

  const stdout: string[] = []
  const stderr: string[] = []
  const forward = (stream: "stdout" | "stderr", chunk: Buffer) => {
    const text = chunk.toString("utf8")
    const lines = text.split(/\r?\n/).filter(Boolean)
    for (const line of lines) {
      if (stream === "stdout") stdout.push(line)
      else stderr.push(line)
      options.onLine?.(line, stream)
    }
  }

  child.stdout?.on("data", (chunk) => forward("stdout", chunk))
  child.stderr?.on("data", (chunk) => forward("stderr", chunk))

  const [code] = (await once(child, "close")) as [number]
  return { code, stdout, stderr }
}

async function loadEnvFile(envFile: string): Promise<Record<string, string>> {
  const env: Record<string, string> = {}
  try {
    const content = await readFile(envFile, "utf8")
    const lines = content.split("\n").filter(Boolean)
    for (const line of lines) {
      const eq = line.indexOf("=")
      if (eq <= 0) continue
      const key = line.slice(0, eq).trim()
      let value = line.slice(eq + 1).trim()
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1)
      }
      env[key] = value
    }
  } catch {
    // env file may not exist yet; that's fine
  }
  return env
}

export async function pm2Describe(processName: string) {
  return runCommand(config.pm2Binary, ["jlist"])
    .then(({ stdout }) => {
      const json = JSON.parse(stdout.join("\n") || "[]") as Array<any>
      return json.find((entry) => entry.name === processName) || null
    })
    .catch(() => null)
}

export async function startOrRestartProcess(projectId: string, processName: string, port: number, cwd: string, envFile: string) {
  const envFileVars = await loadEnvFile(envFile)
  const existing = await pm2Describe(processName)
  const env: NodeJS.ProcessEnv = {
    PORT: String(port),
    HOSTNAME: "0.0.0.0",
    ENV_FILE: envFile,
    ...envFileVars,
    NODE_ENV:
      envFileVars.NODE_ENV === "development" || envFileVars.NODE_ENV === "test"
        ? envFileVars.NODE_ENV
        : "production",
  }

  if (existing) {
    return runCommand(config.pm2Binary, ["restart", processName, "--update-env"], { cwd, env })
  }

  return runCommand(
    config.pm2Binary,
    ["start", "npm", "--name", processName, "--cwd", cwd, "--", "run", "start"],
    { cwd, env },
  )
}

export async function stopProcess(processName: string) {
  return runCommand(config.pm2Binary, ["stop", processName])
}

export async function deleteProcess(processName: string) {
  return runCommand(config.pm2Binary, ["delete", processName])
}
