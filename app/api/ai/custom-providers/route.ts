import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { syteSyncHandshake, syteGetHandshakeStatus } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export const DEFAULT_SYSTEM_PROVIDERS = [
  {
    id: "cp_vyceai",
    name: "Vyce AI",
    provider: "vyceai",
    provider_type: "vyceai",
    base_url: "https://vyceai.com/v1",
    api_key: "sk-358124256568957fd788fcdb8c9eb7dd521989cfc12fc68e",
    api_key_masked: "sk-3...c68e",
    models: ["claude-sonnet-4-6", "deepseek-v4.1", "agnes-3.0-flash"],
    gcp_project: "",
    gcp_location: "us-central1",
    is_synced: true,
    created_at: "2026-10-11T00:00:00.000Z",
  },
]

export async function GET() {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || "guest_user"

  try {
    const client = await clientPromise
    const db = client.db()
    const customProviders = await db
      .collection("user_custom_providers")
      .find({ userId })
      .sort({ createdAt: -1 })
      .toArray()

    // Also get VM sync status
    const vmStatusRes = await syteGetHandshakeStatus().catch(() => ({ data: null }))

    const formatted = customProviders.map((p) => ({
      id: p.id || p._id?.toString(),
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
    }))

    // Ensure Vyce AI is always present
    const hasVyce = formatted.some((p) => p.provider === "vyceai" || p.name === "Vyce AI")
    const allProviders = hasVyce ? formatted : [...DEFAULT_SYSTEM_PROVIDERS, ...formatted]

    return NextResponse.json({
      ok: true,
      providers: allProviders,
      vm_handshake: vmStatusRes?.data || null,
    })
  } catch (err: any) {
    // If Mongo unavailable, return default system providers merged with VM providers
    const vmRes = await syteGetHandshakeStatus().catch(() => ({ data: null }))
    const vmProviders = vmRes?.data?.custom_providers || []
    const hasVyce = vmProviders.some((p: any) => p.provider === "vyceai" || p.name === "Vyce AI")
    const allProviders = hasVyce ? vmProviders : [...DEFAULT_SYSTEM_PROVIDERS, ...vmProviders]

    return NextResponse.json({
      ok: true,
      providers: allProviders,
      vm_handshake: vmRes?.data || null,
    })
  }
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || "guest_user"

  try {
    const body = await request.json()
    const { name, provider, provider_type, base_url, api_key, models, gcp_project, gcp_location } = body

    if (!name || (!provider && !name)) {
      return NextResponse.json({ ok: false, error: "Provider name is required" }, { status: 400 })
    }

    const providerSlug = (provider || name).toLowerCase().replace(/[^a-z0-9_-]/g, "_")
    const modelList = Array.isArray(models)
      ? models
      : typeof models === "string"
        ? models.split(",").map((m: string) => m.trim()).filter(Boolean)
        : []

    const providerEntry = {
      id: `cp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name,
      provider: providerSlug,
      provider_type: (provider_type || providerSlug).toLowerCase(),
      base_url: base_url || "",
      api_key: api_key || "",
      models: modelList,
      gcp_project: gcp_project || "",
      gcp_location: gcp_location || "us-central1",
      userId,
      is_synced: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    // 1. Save to MongoDB
    try {
      const client = await clientPromise
      const db = client.db()
      await db.collection("user_custom_providers").updateOne(
        { userId, provider: providerSlug },
        { $set: providerEntry },
        { upsert: true }
      )
    } catch (_) {}

    // 2. Perform Handshake to sync with VM
    const handshakeRes = await syteSyncHandshake({
      providers: [providerEntry],
      models: providerEntry.models.map((m: string) => ({
        id: m.includes("/") ? m : `${providerEntry.provider}/${m}`,
        name: `${providerEntry.name} (${m})`,
        provider: providerEntry.provider,
        provider_display: providerEntry.name,
        input_cost: 0.0,
        output_cost: 0.0,
        swe_score: 50.0,
      })),
    }).catch(() => ({ data: null }))

    return NextResponse.json({
      ok: true,
      message: "Custom provider saved and synchronized successfully.",
      provider: {
        ...providerEntry,
        api_key: providerEntry.api_key ? `${providerEntry.api_key.slice(0, 4)}...${providerEntry.api_key.slice(-4)}` : "",
      },
      handshake: handshakeRes?.data || null,
    })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to save custom provider" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const session = await getServerSession(authOptions)
  const userId = session?.user?.id || "guest_user"

  try {
    const url = new URL(request.url)
    const providerId = url.searchParams.get("id") || url.searchParams.get("provider")

    if (!providerId) {
      return NextResponse.json({ ok: false, error: "Provider ID or slug is required" }, { status: 400 })
    }

    try {
      const client = await clientPromise
      const db = client.db()
      await db.collection("user_custom_providers").deleteMany({
        userId,
        $or: [{ id: providerId }, { provider: providerId }],
      })
    } catch (_) {}

    return NextResponse.json({ ok: true, message: "Custom provider removed successfully." })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Failed to delete custom provider" }, { status: 500 })
  }
}
