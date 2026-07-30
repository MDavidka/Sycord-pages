import { NextResponse } from "next/server"
import { probeDeployVmSsh, readDeployVmDiagnostics, getTunnelStateFromDb } from "@/lib/admin/vm-ssh"
import { verifyCloudflareCredentials } from "@/lib/admin/cloudflare-api"
import { requireAdminResponse } from "../_shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function maskHost(host?: string): string | null {
  if (!host) return null
  // Show enough to recognise the VM without exposing the full address.
  if (host.length <= 6) return `${host.slice(0, 2)}***`
  return `${host.slice(0, 4)}***${host.slice(-3)}`
}

/**
 * Admin preflight — independently checks every credential the setuper needs and
 * returns granular, actionable detail. This replaces the old "authentication
 * error" guesswork: each line tells you exactly which credential failed and why.
 * Everything is read from the environment — no IP / root password input needed.
 */
export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const vpsHost = process.env.VPS_HOST || process.env.VPS_SSH_HOST
  const vpsPassword = process.env.VPS_ROOT_PSW || process.env.VPS_SSH_ROOT_PASSWORD
  const vpsPort = Number(process.env.VPS_SSH_PORT || "22")

  const env = {
    vpsHost: {
      ok: !!vpsHost,
      source: process.env.VPS_HOST ? "VPS_HOST" : process.env.VPS_SSH_HOST ? "VPS_SSH_HOST" : null,
      value: maskHost(vpsHost),
    },
    vpsPassword: {
      ok: !!vpsPassword,
      source: process.env.VPS_ROOT_PSW ? "VPS_ROOT_PSW" : process.env.VPS_SSH_ROOT_PASSWORD ? "VPS_SSH_ROOT_PASSWORD" : null,
    },
    vpsPort,
    cloudflareApiKey: { ok: !!process.env.CLOUDFLARE_API_KEY },
    cloudflareAccountId: { ok: !!process.env.CLOUDFLARE_ACCOUNT_ID },
    cloudflareZoneId: { ok: !!process.env.CLOUDFLARE_ZONE_ID },
    baseDomain: process.env.SYCORD_BASE_DOMAIN || "sycord.site",
  }

  // SSH probe (uses unified env fallback inside probeDeployVmSsh)
  let ssh: { ok: boolean; detail: string } = { ok: false, detail: "Not checked" }
  let diagnostics: any = null
  if (vpsHost && vpsPassword) {
    const probe = await probeDeployVmSsh()
    ssh = probe.reachable
      ? { ok: true, detail: `Root SSH to ${maskHost(vpsHost)}:${vpsPort} succeeded` }
      : { ok: false, detail: probe.error || "SSH login failed" }
    if (probe.reachable) {
      diagnostics = await readDeployVmDiagnostics().catch(() => null)
    }
  } else {
    ssh = {
      ok: false,
      detail: "VM host/password env vars are not set (VPS_HOST + VPS_ROOT_PSW or VPS_SSH_HOST + VPS_SSH_ROOT_PASSWORD)",
    }
  }

  // Cloudflare credential verification (account / zone / tunnel)
  const cloudflare = await verifyCloudflareCredentials()

  // Persisted tunnel state
  const state = await getTunnelStateFromDb().catch(() => null)

  const checks = {
    sshReady: ssh.ok,
    cloudflareReady: cloudflare.configured && cloudflare.account.ok && cloudflare.zone.ok,
    runnerRunning: !!diagnostics?.runner?.running,
    nginxRunning: !!diagnostics?.nginx?.running,
    cloudflaredRunning: !!diagnostics?.cloudflared?.running,
  }

  const ready = checks.sshReady && checks.cloudflareReady

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    ready,
    env,
    ssh,
    cloudflare,
    diagnostics,
    tunnelState: state
      ? {
          configured: !!state.configured,
          mode: state.mode || "unknown",
          tunnelId: state.tunnelId ? `${String(state.tunnelId).slice(0, 8)}…` : null,
          baseDomain: state.baseDomain,
          configuredAt: state.configuredAt,
        }
      : null,
    checks,
  })
}
