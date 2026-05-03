import { spawn } from "node:child_process"
import { once } from "node:events"
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
    env: { ...process.env, ...options.env },
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

export async function pm2Describe(processName: string) {
  return runCommand(config.pm2Binary, ["jlist"])
    .then(({ stdout }) => {
      const json = JSON.parse(stdout.join("\n") || "[]") as Array<any>
      return json.find((entry) => entry.name === processName) || null
    })
    .catch(() => null)
}

export async function startOrRestartProcess(projectId: string, processName: string, port: number, cwd: string, envFile: string) {
  const existing = await pm2Describe(processName)
  const env = { PORT: String(port), HOSTNAME: "0.0.0.0", NODE_ENV: "production", ENV_FILE: envFile }

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
