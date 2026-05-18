import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const SYCORD_DEPLOY_API_BASE = process.env.SYCORD_DEPLOY_API_BASE || "https://sycord.site"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params
  const session = await getServerSession(authOptions)

  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!/^\d+$/.test(repoId)) {
    return NextResponse.json({ error: "Repository ID must be a numeric string" }, { status: 400 })
  }

  const url = new URL(request.url)
  const limit = url.searchParams.get("limit") || "200"

  try {
    const upstream = await fetch(
      `${SYCORD_DEPLOY_API_BASE.replace(/\/+$/, "")}/api/logs?project_id=${encodeURIComponent(repoId)}&limit=${encodeURIComponent(limit)}`,
      { headers: { Accept: "application/json" } },
    )
    const data = await upstream.json().catch(() => ({}))
    return NextResponse.json(data, { status: upstream.status })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to fetch deployment logs" }, { status: 500 })
  }
}
