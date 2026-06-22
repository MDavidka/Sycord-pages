import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { checkDokployHealth, isDokployConfigured } from "@/lib/deploy/dokploy-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!isDokployConfigured()) {
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      dokploy: {
        configured: false,
        reachable: false,
        error: "DOKPLOY_API_KEY is not set. Add it to your environment variables.",
      },
    })
  }

  const health = await checkDokployHealth()

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    dokploy: {
      configured: true,
      reachable: health.reachable,
      apiUrl: health.apiUrl,
      projectsCount: health.projectsCount ?? 0,
      latencyMs: health.latencyMs ?? null,
      error: health.error ?? null,
    },
  })
}
