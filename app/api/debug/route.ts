import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkCoolifyHealth, isCoolifyConfigured } from "@/lib/deploy/coolify-client"
import { checkSyteHealth, isSyteConfigured, useSyteWorkspace } from "@/lib/deploy/syte-client"
import { isAdmin } from "@/lib/is-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (useSyteWorkspace()) {
    const health = await checkSyteHealth()
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      platform: "syte",
      syte: {
        configured: true,
        reachable: health.reachable,
        apiUrl: health.apiUrl,
        version: health.version ?? null,
        latencyMs: health.latencyMs ?? null,
        error: health.error ?? null,
        documentation: "https://sycord.site/api/",
      },
      coolify: {
        configured: false,
        reachable: false,
        note: "Using Syte workspace API (DEPLOYER_API_URL=https://sycord.site)",
      },
      dokploy: {
        configured: true,
        reachable: health.reachable,
        apiUrl: health.apiUrl,
        note: "Legacy alias — platform is Syte workspace API",
      },
    })
  }

  if (!isCoolifyConfigured() && !isSyteConfigured()) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      syte: {
        configured: false,
        reachable: false,
        error: "DEPLOYER_API_KEY or DEPLOYER_API_URL is not set.",
        documentation: "https://sycord.site/api/",
      },
      coolify: {
        configured: false,
        reachable: false,
        error: "DEPLOYER_API_KEY or DEPLOYER_API_URL is not set.",
      },
      dokploy: {
        configured: false,
        reachable: false,
        error: "Set DEPLOYER_API_KEY (syte_ token) and DEPLOYER_API_URL=https://sycord.site",
      },
    })
  }

  const health = await checkCoolifyHealth()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    platform: "coolify",
    coolify: {
      configured: true,
      reachable: health.reachable,
      apiUrl: health.apiUrl,
      version: health.version ?? null,
      latencyMs: health.latencyMs ?? null,
      error: health.error ?? null,
    },
    dokploy: {
      configured: true,
      reachable: health.reachable,
      apiUrl: health.apiUrl,
      version: health.version ?? null,
      latencyMs: health.latencyMs ?? null,
      error: health.error ?? null,
      note: "Legacy alias — platform is Coolify",
    },
  })
}
