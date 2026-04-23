import { NextResponse } from "next/server";
import { NodeSSH } from "node-ssh";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/vps/status
 * Checks whether the Flask runner process is alive on the VPS, returns status,
 * uptime, port binding, and tunnel state.
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.email !== "dmarton336@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const host = process.env.VPS_IP
    const username = process.env.VPS_USERNAME
    const password = process.env.VPS_PASSWORD

    if (!host || !username || !password) {
      return NextResponse.json({
        online: false,
        runner: false,
        tunnel: false,
        error: "VPS credentials not configured",
      })
    }

    const ssh = new NodeSSH()
    try {
      await ssh.connect({ host, username, password, readyTimeout: 5000 })
    } catch {
      return NextResponse.json({
        online: false,
        runner: false,
        tunnel: false,
        error: "Cannot reach VPS via SSH",
      })
    }

    const homeDir = username === "root" ? "/root" : `/home/${username}`
    const cwd = `${homeDir}/myapp`

    const run = async (cmd: string) => {
      const res = await ssh.execCommand(cmd, { cwd })
      return res
    }

    // Check if runner.py process is alive
    const runnerPs = await run('pgrep -f "python3.*/runner.py" -a')
    const runnerRunning = !!runnerPs.stdout.trim()

    // Check if port 5000 is bound
    const portCheck = await run("ss -tlnp | grep :5000")
    const portBound = !!portCheck.stdout.trim()

    // Check if cloudflared tunnel is running
    const tunnelPs = await run('pgrep -f "cloudflared tunnel" -a')
    const tunnelRunning = !!tunnelPs.stdout.trim()

    // Get runner uptime (process start time)
    let uptime = ""
    if (runnerRunning) {
      const uptimeRes = await run(
        'ps -o etime= -p $(pgrep -f "python3.*/runner.py" | head -1) 2>/dev/null'
      )
      uptime = uptimeRes.stdout.trim()
    }

    // Quick health check via HTTP
    let httpOk = false
    if (portBound) {
      const healthRes = await run(
        "curl -s -o /dev/null -w '%{http_code}' --max-time 3 http://127.0.0.1:5000/"
      )
      httpOk = healthRes.stdout.trim() === "200"
    }

    // Check if required packages are installed
    const pipCheck = await run(
      'python3 -c "import flask; print(flask.__version__)" 2>&1'
    )
    const flaskInstalled = !pipCheck.stderr && !pipCheck.stdout.includes("No module")
    const flaskVersion = flaskInstalled ? pipCheck.stdout.trim() : null

    // Check npm/node availability
    const npmCheck = await run("npm --version 2>/dev/null")
    const npmInstalled = !!npmCheck.stdout.trim()
    const nodeCheck = await run("node --version 2>/dev/null")
    const nodeInstalled = !!nodeCheck.stdout.trim()

    // Check for missing dependencies
    const warnings: string[] = []
    if (!flaskInstalled) {
      warnings.push("Flask is not installed – runner.py cannot start")
    }
    if (!npmInstalled) {
      warnings.push("npm is not installed – project builds will fail")
    }
    if (!nodeInstalled) {
      warnings.push("node is not installed – project builds will fail")
    }

    // Check if config.yml exists for tunnel
    const configCheck = await run(`test -f ${cwd}/config.yml && echo "exists"`)
    if (!configCheck.stdout.includes("exists")) {
      warnings.push("config.yml not found – tunnel cannot start")
    }

    // Check if runner.py exists
    const runnerFileCheck = await run(`test -f ${cwd}/runner.py && echo "exists"`)
    if (!runnerFileCheck.stdout.includes("exists")) {
      warnings.push("runner.py not found on VPS")
    }

    // Check required env vars for deploy DNS (if not set here, .env.server
    // on the VPS won't have them either)
    const envChecks = ["CLOUDFLARE_API_KEY", "CLOUDFLARE_ZONE_ID"]
    for (const envVar of envChecks) {
      if (!process.env[envVar]) {
        warnings.push(`${envVar} not set in platform env – Flask DNS auto-config will be disabled`)
      }
    }

    // Verify .env.server exists on VPS
    const envServerCheck = await run(`test -f ${cwd}/.env.server && echo "exists"`)
    if (!envServerCheck.stdout.includes("exists")) {
      warnings.push(".env.server not found on VPS – restart the runner to auto-generate it")
    }

    const envLoaded = {
      cloudflareApiKey: !!process.env.CLOUDFLARE_API_KEY,
      cloudflareZoneId: !!process.env.CLOUDFLARE_ZONE_ID,
    }

    // List active deployments
    // Symlinks in /var/sycord/data/projects represent subdomains
    const activeDeployments: string[] = []
    try {
      const deployRes = await run("find /var/sycord/data/projects -maxdepth 1 -type l -printf '%f\n'")
      if (deployRes.stdout) {
        const lines = deployRes.stdout.trim().split("\n")
        for (const line of lines) {
          if (line) activeDeployments.push(`${line}.sycord.site`)
        }
      }
    } catch {
      // Non-critical; activeDeployments will be empty
    }

    // Gather CPU & RAM stats
    let cpuUsage: number | null = null
    let memTotal: number | null = null
    let memUsed: number | null = null
    let memPercent: number | null = null
    let diskTotal: string | null = null
    let diskUsed: string | null = null
    let diskPercent: string | null = null

    try {
      // CPU: idle % from top output, convert to usage.
      // Supports formats like "97.0 id", "97.0%id", "97.0 %id" across Ubuntu/Debian/CentOS.
      const cpuRes = await run("top -bn1 | grep '%Cpu\\|Cpu(s)' | head -1")
      const cpuLine = cpuRes.stdout.trim()
      const idleMatch = cpuLine.match(/([\d.]+)\s*(?:%?\s*)?id/)
      if (idleMatch) {
        cpuUsage = Math.round((100 - parseFloat(idleMatch[1])) * 10) / 10
      } else {
        // Fallback: parse /proc/stat (less precise but universal)
        const statRes = await run("head -1 /proc/stat")
        const statParts = statRes.stdout.trim().split(/\s+/)
        if (statParts.length >= 5) {
          const idle = parseInt(statParts[4]) || 0
          const total = statParts.slice(1).reduce((s, v) => s + (parseInt(v) || 0), 0)
          if (total > 0) {
            cpuUsage = Math.round((1 - idle / total) * 1000) / 10
          }
        }
      }

      // RAM from /proc/meminfo (more reliable than free -m parsing)
      const memRes = await run("cat /proc/meminfo | head -3")
      const memLines = memRes.stdout.trim().split("\n")
      for (const line of memLines) {
        const totalMatch = line.match(/MemTotal:\s+(\d+)/)
        const availMatch = line.match(/MemAvailable:\s+(\d+)/)
        if (totalMatch) memTotal = Math.round(parseInt(totalMatch[1]) / 1024)
        if (availMatch) {
          const availMB = Math.round(parseInt(availMatch[1]) / 1024)
          if (memTotal) {
            memUsed = memTotal - availMB
            memPercent = Math.round((memUsed / memTotal) * 1000) / 10
          }
        }
      }

      // Disk usage for root partition
      const diskRes = await run("df -h / | tail -1")
      const diskParts = diskRes.stdout.trim().split(/\s+/)
      if (diskParts.length >= 5) {
        diskTotal = diskParts[1]
        diskUsed = diskParts[2]
        diskPercent = diskParts[4]
      }
    } catch {
      // Non-critical; stats will be null
    }

    ssh.dispose()

    return NextResponse.json({
      online: true,
      runner: runnerRunning && portBound,
      tunnel: tunnelRunning,
      httpOk,
      uptime: uptime || null,
      flaskVersion,
      npmInstalled,
      nodeInstalled,
      warnings,
      cpu: cpuUsage,
      mem: { total: memTotal, used: memUsed, percent: memPercent },
      disk: { total: diskTotal, used: diskUsed, percent: diskPercent },
      envLoaded,
      activeDeployments,
    })
  } catch (error: any) {
    console.error("[VPS Status] Error:", error)
    return NextResponse.json({
      online: false,
      runner: false,
      tunnel: false,
      error: error.message || "Failed to check VPS status",
    })
  }
}
