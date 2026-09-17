import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { syteGetHandshakeStatus, syteSyncHandshake } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const result = await syteGetHandshakeStatus()
  if (!result.ok || !result.data) {
    return NextResponse.json({ ok: false, error: result.error || "Failed to fetch handshake status" }, { status: result.status || 500 })
  }

  return NextResponse.json(result.data)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const result = await syteSyncHandshake(body || {})
    if (!result.ok || !result.data) {
      return NextResponse.json({ ok: false, error: result.error || "Handshake synchronization failed" }, { status: result.status || 500 })
    }

    return NextResponse.json(result.data)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Invalid JSON payload" }, { status: 400 })
  }
}
