import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkCoolifyHealth, isCoolifyConfigured } from "@/lib/deploy/coolify-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isCoolifyConfigured()) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      coolify: {
        configured: false,
        reachable: false,
        error: "DEPLOYER_API_KEY or DEPLOYER_API_URL is not set.",
      },
      // Legacy key for /dubrg UI
      dokploy: {
        configured: false,
        reachable: false,
        error: "Deploy platform migrated to Coolify. Set DEPLOYER_API_KEY and DEPLOYER_API_URL.",
      },
    })
  }

  const health = await checkCoolifyHealth()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
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
