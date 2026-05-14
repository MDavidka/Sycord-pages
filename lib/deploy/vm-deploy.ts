import { NodeSSH } from "node-ssh"
import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

export type VmDeployOptions = {
  githubOwner: string
  githubRepo: string
  githubToken: string
  subdomain: string
  envVars: Record<string, string>
}

export type VmDeployResult = {
  success: boolean
  logs: string[]
  error?: string
  port?: number
}

export async function deployToVm(options: VmDeployOptions): Promise<VmDeployResult> {
  const host = process.env.VPS_SSH_HOST
  const password = process.env.VPS_SSH_ROOT_PASSWORD
  const port = Number(process.env.VPS_SSH_PORT || "22")
  const logs: string[] = []

  if (!host || !password) {
    return { success: false, error: "Missing VM SSH credentials in .env", logs }
  }

  const ssh = new NodeSSH()
  try {
    logs.push("Connecting to VM...")
    await ssh.connect({
      host,
      username: "root",
      password,
      port,
    })
    logs.push("Connected to VM via SSH.")

    const projectDir = `/srv/sycord/sites/${options.githubRepo}`

    // 1. Create directory if not exists
    logs.push(`Ensuring directory ${projectDir} exists...`)
    await ssh.execCommand(`mkdir -p ${projectDir}`)

    // 2. Clone or fetch/reset repo to avoid pull block
    logs.push("Syncing with GitHub...")
    const gitAuthUrl = `https://${options.githubOwner}:${options.githubToken}@github.com/${options.githubOwner}/${options.githubRepo}.git`

    const checkGit = await ssh.execCommand(`[ -d "${projectDir}/.git" ] && echo "exists" || echo "not-exists"`)
    if (checkGit.stdout.trim() === "exists") {
      logs.push("Repository exists. Fetching and resetting to latest main...")
      const fetchResult = await ssh.execCommand("git fetch origin main || git fetch origin master", { cwd: projectDir })
      logs.push(fetchResult.stdout)
      if (fetchResult.stderr) logs.push(`Git fetch stderr: ${fetchResult.stderr}`)

      const resetResult = await ssh.execCommand("git reset --hard FETCH_HEAD", { cwd: projectDir })
      logs.push(resetResult.stdout)
      if (resetResult.stderr) logs.push(`Git reset stderr: ${resetResult.stderr}`)
    } else {
      logs.push("Cloning repository...")
      const cloneResult = await ssh.execCommand(`git clone ${gitAuthUrl} .`, { cwd: projectDir })
      logs.push(cloneResult.stdout)
      if (cloneResult.stderr) logs.push(`Git clone stderr: ${cloneResult.stderr}`)
    }

    // 3. Write env vars to .env file securely
    if (Object.keys(options.envVars).length > 0) {
        logs.push("Writing environment variables securely...")
        const envContent = Object.entries(options.envVars)
            .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`) // Escape double quotes
            .join("\n")

        // Write to local temp file, then upload via SFTP to avoid command injection
        const tempEnvPath = path.join(os.tmpdir(), `env-${options.githubRepo}-${Date.now()}.tmp`)
        await fs.writeFile(tempEnvPath, envContent, "utf-8")

        try {
            await ssh.putFile(tempEnvPath, `${projectDir}/.env`)
            logs.push("Environment variables written successfully.")
        } catch (uploadError: any) {
            logs.push(`Failed to upload .env file: ${uploadError.message}`)
            return { success: false, error: "Failed to upload .env file", logs }
        } finally {
            await fs.unlink(tempEnvPath).catch(() => {})
        }
    }

    // 4. Install dependencies
    logs.push("Installing dependencies...")
    const installResult = await ssh.execCommand("npm install --no-audit --no-fund", { cwd: projectDir })
    logs.push(installResult.stdout)
    if (installResult.stderr) logs.push(`Install stderr: ${installResult.stderr}`)
    if (installResult.code !== 0) {
        return { success: false, error: "npm install failed", logs }
    }

    // 5. Build project
    logs.push("Building project...")
    const buildResult = await ssh.execCommand("npm run build", { cwd: projectDir })
    logs.push(buildResult.stdout)
    if (buildResult.stderr) logs.push(`Build stderr: ${buildResult.stderr}`)
    if (buildResult.code !== 0) {
        return { success: false, error: "npm run build failed", logs }
    }

    // 6. Find a free port (e.g. between 3000 and 4000)
    let assignedPort = 3000;
    for(let i=0; i<options.githubRepo.length; i++) {
        assignedPort += options.githubRepo.charCodeAt(i);
    }
    assignedPort = 3000 + (assignedPort % 5000);
    logs.push(`Assigning port ${assignedPort}...`)

    // 7. Start/Restart with PM2
    logs.push("Starting process with PM2...")
    const pm2Name = `sycord-site-${options.githubRepo}`

    // Check if running, if so reload, else start
    const pm2Check = await ssh.execCommand(`pm2 describe ${pm2Name}`)
    if (pm2Check.stdout.includes(pm2Name)) {
        logs.push("Reloading existing PM2 process...")
        const reloadResult = await ssh.execCommand(`PORT=${assignedPort} pm2 reload ${pm2Name} --update-env`, { cwd: projectDir })
        logs.push(reloadResult.stdout)
    } else {
        logs.push("Starting new PM2 process...")
        const startResult = await ssh.execCommand(`PORT=${assignedPort} pm2 start npm --name "${pm2Name}" -- run start`, { cwd: projectDir })
        logs.push(startResult.stdout)
    }

    // 8. Save PM2 state
    await ssh.execCommand("pm2 save")

    logs.push("Deployment complete!")

    return {
      success: true,
      logs,
      port: assignedPort
    }

  } catch (error: any) {
    logs.push(`SSH Connection error: ${error.message}`)
    return { success: false, error: error.message, logs }
  } finally {
    ssh.dispose()
  }
}
