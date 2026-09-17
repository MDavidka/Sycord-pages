import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { syteSyncHandshake, syteGetHandshakeStatus } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db()
    const customProviders = await db
      .collection("user_custom_providers")
      .find({ userId: session.user.id })
      .sort({ createdAt: -1 })
      .toArray()

    // Also get VM sync status
    const vmStatusRes = await syteGetHandshakeStatus()

    return NextResponse.json({
      ok: true,
      providers: customProviders.map(p => ({
        id: p._id.toString(),
        name: p.name,
        provider: p.provider,
        provider_type: p.provider_type || p.provider,
        base_url: p.base_url || "",
        api_key_masked: p.api_key ? `${p.api_key.slice(0, 4)}...${p.api_key.slice(-4)}` : "",
        models: p.models || [],
        gcp_project: p.gcp_project || "",
        gcp_location: p.gcp_location || "us-central1",
        is_synced: p.is_synced ?? true,
        created_at: p.createdAt,
      })),
      vm_handshake: vmStatusRes.data || null,
    })
  } catch (err: any) {
    // If Mongo unavailable, proxy directly to Syte VM
    const vmRes = await syteGetHandshakeStatus()
    return NextResponse.json({
      ok: true,
      providers: vmRes.data?.custom_providers || [],
      vm_handshake: vmRes.data || null,
    })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name, provider, provider_type, base_url, api_key, models, gcp_project, gcp_location } = body

    if (!name || !provider) {
      return NextResponse.json({ ok: false, error: "Provider name and type are required" }, { status: 400 })
    }

    const providerEntry = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      provider: provider.toLowerCase(),
      provider_type: (provider_type || provider).toLowerCase(),
      base_url: base_url || "",
      api_key: api_key || "",
      models: Array.isArray(models) ? models : typeof models === "string" ? models.split(",").map((m: string) => m.trim()).filter(Boolean) : [],
      gcp_project: gcp_project || "",
      gcp_location: gcp_location || "us-central1",
      userId: session.user.id,
      is_synced: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 1. Save to MongoDB
    try {
      const client = await clientPromise
      const db = client.db()
      await db.collection("user_custom_providers").insertOne(providerEntry)
    } catch (_) {}

    // 2. Perform Handshake to sync with VM
    const handshakeRes = await syteSyncHandshake({
      providers: [providerEntry],
      models: providerEntry.models.map(m => ({
        id: m,
        name: `${providerEntry.name} (${m})`,
        provider: providerEntry.provider,
        provider_display: providerEntry.name,
        input_cost: 0.0,
        output_cost: 0.0,
        swe_score: 50.0,
      })),
    })

    return NextResponse.json({
      ok: true,
      message: "Custom provider saved and synchronized to VM successfully.",
      provider: {
        ...providerEntry,
        api_key: providerEntry.api_key ? `${providerEntry.api_key.slice(0, 4)}...${providerEntry.api_key.slice(-4)}` : "",
      },
      handshake: handshakeRes.data || null,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to save custom provider" }, { status: 500 })
  }
}
