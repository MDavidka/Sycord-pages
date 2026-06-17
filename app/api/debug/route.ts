import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { probeSshConnection, getVpsDiagnostics, getVpsDebugInfo } from "@/lib/deploy/ssh-deploy"
import clientPromise from "@/lib/mongodb"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getTunnelDebugInfo(): Promise<Record<string, unknown>> {
  try {
    let credentials: { host: string; username: string; password: string; port: number } | null = null

    // Try env vars first
    if (process.env.VPS_HOST && process.env.VPS_ROOT_PSW) {
      credentials = {
        host: process.env.VPS_HOST,
        username: process.env.VPS_USERNAME || "root",
        password: process.env.VPS_ROOT_PSW,
        port: 22,
      }
    }

    // Fall back to stored deployer config from DB
    if (!credentials) {
      try {
        const client = await clientPromise
        const db = client.db()
        const deployer = await db.collection("deployer_config").findOne({ key: "cloudflare_tunnel" })
        if (deployer?.host) {
          // We don't store passwords, try docker SSH keys or env
          if (process.env.VPS_ROOT_PSW) {
            credentials = {
              host: deployer.host,
              username: "root",
              password: process.env.VPS_ROOT_PSW,
              port: 22,
            }
          }
        }
      } catch {}
    }

    if (!credentials) {
      const vps = getVpsDebugInfo()
      return {
        configured: false,
        reason: `VPS credentials not set. Have env: VPS_HOST=${!!process.env.VPS_HOST}, VPS_ROOT_PSW=${!!process.env.VPS_ROOT_PSW}, deployer_config in DB=${"checked"}`,
        envHost: process.env.VPS_HOST || "not set",
        envUser: process.env.VPS_USERNAME || "not set",
        envPsw: !!process.env.VPS_ROOT_PSW,
      }
    }

    const { NodeSSH } = await import("node-ssh")
    const ssh = new NodeSSH()
    await ssh.connect(credentials)

    const [serviceStatus, ingressConfig, nginxSites, pm2List] = await Promise.all([
      ssh.execCommand("systemctl is-active cloudflared 2>&1 || echo 'inactive'"),
      ssh.execCommand("cat /etc/cloudflared/config.yml 2>&1 || echo 'NO_CONFIG'"),
      ssh.execCommand("ls /etc/nginx/sites-enabled/ 2>&1 || echo 'NO_SITES'"),
      ssh.execCommand("pm2 jlist 2>&1 | head -80 || echo 'NO_PM2'"),
    ])

    // Discover tunnel name from config
    let tunnelName = ""
    const configMatch = ingressConfig.stdout.match(/^tunnel:\s*(\S+)/m)
    if (configMatch) tunnelName = configMatch[1]

    let tunnelInfo = { raw: "no tunnel name found" }
    let dnsRoutes = "no tunnel name"
    if (tunnelName) {
      const [infoResult, routesResult] = await Promise.all([
        ssh.execCommand(`cloudflared tunnel info ${tunnelName} 2>&1 || echo 'NO_INFO'`),
        ssh.execCommand(`cloudflared tunnel route dns list ${tunnelName} 2>&1 | head -30 || echo 'NO_ROUTES'`),
      ])
      tunnelInfo = { raw: infoResult.stdout.trim().slice(0, 500) }
      dnsRoutes = routesResult.stdout.trim().slice(0, 500)
    }

    ssh.dispose()

    const parseTunnelInfo = (raw: string) => {
      const result: Record<string, string> = {}
      const lines = raw.split("\n")
      for (const line of lines) {
        const match = line.match(/^(\w[\w\s]*?):\s*(.+)$/)
        if (match) result[match[1].trim()] = match[2].trim()
      }
      return result
    }

    // Parse PM2 processes from jlist JSON
    let pm2Processes: any[] = []
    try {
      const jlist = JSON.parse(pm2List.stdout)
      pm2Processes = Array.isArray(jlist) ? jlist.map((p: any) => ({
        name: p.name,
        status: p.pm2_env?.status,
        pid: p.pid,
        uptime: p.pm2_env?.pm_uptime ? Math.round((Date.now() - p.pm2_env.pm_uptime) / 1000) + "s" : "?",
        cpu: p.monit?.cpu,
        memory: p.monit?.memory ? Math.round(p.monit.memory / 1024 / 1024) + "MB" : "?",
        port: (p.pm2_env?.PORT || p.pm2_env?.env?.PORT || "?"),
      })) : []
    } catch {}

    ssh.dispose()

    return {
      configured: true,
      serviceActive: serviceStatus.stdout.includes("active"),
      serviceOutput: serviceStatus.stdout.trim(),
      tunnelName: tunnelName || "unknown",
      tunnelInfo: parseTunnelInfo(tunnelInfo.raw || ""),
      tunnelRawInfo: (tunnelInfo.raw || "").slice(0, 500),
      ingressConfig: ingressConfig.stdout.trim().slice(0, 1000),
      dnsRoutes: dnsRoutes.slice(0, 500),
      nginxSites: nginxSites.stdout.trim().split("\n").filter(Boolean),
      pm2Processes,
    }
  } catch (err: any) {
    return { configured: false, error: err?.message || "Tunnel debug failed" }
  }
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [sshProbe, vpsDiag, tunnelDebug] = await Promise.all([
    probeSshConnection(),
    getVpsDiagnostics(),
    getTunnelDebugInfo(),
  ])

  let containerCount = 0
  let tunnelConfig: any = null
  try {
    const client = await clientPromise
    const db = client.db()
    containerCount = await db.collection("containers").countDocuments()
    tunnelConfig = await db.collection("deployer_config").findOne({ key: "cloudflare_tunnel" })
  } catch {}

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    vps: {
      config: getVpsDebugInfo(),
      sshReachable: sshProbe.reachable,
      sshError: sshProbe.error || null,
      diagnostics: vpsDiag,
    },
    containers: {
      total: containerCount,
    },
    cloudflare: {
      tunnelSetup: !!tunnelConfig,
      tunnelConfig: tunnelConfig ? {
        tunnelId: tunnelConfig.tunnelId?.slice(0, 8) + "...",
        baseDomain: tunnelConfig.baseDomain,
        configuredAt: tunnelConfig.configuredAt,
      } : null,
      live: tunnelDebug,
    },
    env: {
      VPS_HOST_set: !!process.env.VPS_HOST,
      VPS_USERNAME_set: !!process.env.VPS_USERNAME,
      VPS_ROOT_PSW_set: !!process.env.VPS_ROOT_PSW,
    },
  })
}
