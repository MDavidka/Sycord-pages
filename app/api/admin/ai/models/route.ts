import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { isAdminEmail } from "@/lib/is-admin"
import { syteGetOmniModels, syteSyncHandshake, syteAdminUpsertModel } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized: Admin access required" }, { status: 403 })
  }

  const result = await syteGetOmniModels("global")
  if (!result.ok || !result.data) {
    return NextResponse.json({ ok: false, error: result.error || "Failed to fetch models" }, { status: result.status || 500 })
  }

  return NextResponse.json(result.data)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email || !isAdminEmail(session.user.email)) {
    return NextResponse.json({ ok: false, error: "Unauthorized: Admin access required" }, { status: 403 })
  }

  try {
    const body = await request.json()

    // Case 1: Bulk models / providers JSON array
    if (Array.isArray(body) || body.models || body.providers) {
      const modelsList = Array.isArray(body) ? body : body.models || []
      const providersList = body.providers || []

      const result = await syteSyncHandshake({
        providers: providersList,
        models: modelsList,
      })

      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error || "Handshake bulk sync failed" }, { status: result.status || 500 })
      }

      return NextResponse.json({
        ok: true,
        message: `Successfully synchronized ${modelsList.length} models and ${providersList.length} providers to VM.`,
        synced: result.data,
      })
    }

    // Case 2: Single model upsert
    const singleResult = await syteAdminUpsertModel(body)
    if (!singleResult.ok) {
      return NextResponse.json({ ok: false, error: singleResult.error || "Failed to upsert model" }, { status: singleResult.status || 500 })
    }

    return NextResponse.json(singleResult.data)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Invalid JSON payload" }, { status: 400 })
  }
}
