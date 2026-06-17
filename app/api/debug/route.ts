import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { probeSshConnection, getVpsDiagnostics, getVpsDebugInfo } from "@/lib/deploy/ssh-deploy"
import clientPromise from "@/lib/mongodb"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function getTunnelDebugInfo(): Promise<Record<string, unknown>> {
  try {
    const vps = getVpsDebugInfo()
    if (!vps.passwordConfigured || vps.host === "not set") {
      return { configured: false, reason: "VPS credentials not set" }
    }

    const { NodeSSH } = await import("node-ssh")
    const ssh = new NodeSSH()
    const vpsConfig = {
      host: process.env.VPS_HOST || vps.host,
      username: process.env.VPS_USERNAME || "root",
      password: process.env.VPS_ROOT_PSW || "",
      port: 22,
    }

    await ssh.connect(vpsConfig)

    const [serviceStatus, tunnelInfo, ingressConfig, dnsRoutes, nginxSites, pm2List] = await Promise.all([
      ssh.execCommand("systemctl is-active cloudflared 2>&1 || echo 'inactive'"),
      ssh.execCommand("cloudflared tunnel info sycord-deployer 2>&1 || echo 'NO_TUNNEL'"),
      ssh.execCommand("cat /etc/cloudflared/config.yml 2>&1 || echo 'NO_CONFIG'"),
      ssh.execCommand("cloudflared tunnel route dns list sycord-deployer 2>&1 | head -30 || echo 'NO_ROUTES'"),
      ssh.execCommand("ls /etc/nginx/sites-enabled/ 2>&1 || echo 'NO_SITES'"),
      ssh.execCommand("pm2 list --no-color 2>&1 | head -40 || echo 'NO_PM2'"),
    ])

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

    return {
      configured: true,
      serviceActive: serviceStatus.stdout.includes("active"),
      serviceOutput: serviceStatus.stdout.trim(),
      tunnelInfo: parseTunnelInfo(tunnelInfo.stdout),
      tunnelRawInfo: tunnelInfo.stdout.trim().slice(0, 500),
      ingressConfig: ingressConfig.stdout.trim().slice(0, 1000),
      dnsRoutes: dnsRoutes.stdout.trim().slice(0, 500),
      nginxSites: nginxSites.stdout.trim().split("\n").filter(Boolean),
      pm2Processes: pm2List.stdout.trim().slice(0, 500),
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
