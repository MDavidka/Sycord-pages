import { NextResponse } from "next/server";
import { NodeSSH } from "node-ssh";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/vps/logs?lines=100&type=runner|tunnel|all
 * Tails the runner.log or tunnel.log from the VPS.
 */
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.email !== "dmarton336@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const lines = Math.min(parseInt(searchParams.get("lines") || "80", 10), 500)
    const logType = searchParams.get("type") || "runner"

    const host = process.env.VPS_IP
    const username = process.env.VPS_USERNAME
    const password = process.env.VPS_PASSWORD

    if (!host || !username || !password) {
      return NextResponse.json({ logs: [], error: "VPS credentials not configured" })
    }

    const ssh = new NodeSSH()
    try {
      await ssh.connect({ host, username, password, readyTimeout: 5000 })
    } catch {
      return NextResponse.json({ logs: [], error: "Cannot reach VPS via SSH" })
    }

    const homeDir = username === "root" ? "/root" : `/home/${username}`
    const cwd = `${homeDir}/myapp`

    const logFiles: Record<string, string> = {
      runner: `${cwd}/runner.log`,
      tunnel: `${cwd}/tunnel.log`,
      server: `/var/sycord/data/server.log`,
    }

    let allLogs: string[] = []

    if (logType === "all") {
      for (const [name, path] of Object.entries(logFiles)) {
        const res = await ssh.execCommand(`tail -n ${lines} ${path} 2>/dev/null`, { cwd })
        if (res.stdout) {
          const tagged = res.stdout
            .split("\n")
            .filter(Boolean)
            .map((line) => `[${name}] ${line}`)
          allLogs = allLogs.concat(tagged)
        }
      }
    } else {
      const logPath = logFiles[logType] || logFiles.runner
      const res = await ssh.execCommand(`tail -n ${lines} ${logPath} 2>/dev/null`, { cwd })
      if (res.stdout) {
        allLogs = res.stdout.split("\n").filter(Boolean)
      }
      if (!allLogs.length && res.stderr) {
        allLogs = [`[error] ${res.stderr}`]
      }
    }

    ssh.dispose()

    return NextResponse.json({ logs: allLogs })
  } catch (error: any) {
    console.error("[VPS Logs] Error:", error)
    return NextResponse.json({ logs: [], error: error.message || "Failed to fetch logs" })
  }
}
