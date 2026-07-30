import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const domain = searchParams.get("domain")

  if (!domain || !domain.includes(".")) {
    return NextResponse.json({ error: "Invalid domain name" }, { status: 400 })
  }

  const cfApiKey = process.env.CLOUDFLARE_API_KEY
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!cfApiKey || !cfAccountId) {
    // Without Cloudflare credentials, assume available and redirect to Cloudflare
    return NextResponse.json({
      success: true,
      domain,
      available: null, // unknown
      purchaseUrl: `https://www.cloudflare.com/products/registrar/`,
      message: "Cloudflare API not configured — redirecting to Cloudflare Registrar",
    })
  }

  try {
    // Cloudflare Registrar: check domain availability
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/registrar/domains/${encodeURIComponent(domain)}/check`,
      {
        headers: {
          Authorization: `Bearer ${cfApiKey}`,
          "Content-Type": "application/json",
        },
      }
    )

    if (!res.ok) {
      const errText = await res.text().catch(() => "")
      console.error(`[Domains/Check] Cloudflare API error ${res.status}:`, errText)
      return NextResponse.json({
        success: true,
        domain,
        available: null,
        purchaseUrl: `https://www.cloudflare.com/products/registrar/`,
      })
    }

    const data = await res.json()
    const available = data?.result?.available ?? null
    const pricing = data?.result?.pricing?.registration?.price ?? null

    // Build Cloudflare purchase URL — link directly to Cloudflare domain registration
    const purchaseUrl = `https://www.cloudflare.com/products/registrar/`

    return NextResponse.json({
      success: true,
      domain,
      available,
      price: pricing,
      currency: "USD",
      purchaseUrl,
    })
  } catch (error: any) {
    console.error("[Domains/Check] Error:", error)
    return NextResponse.json({
      success: true,
      domain,
      available: null,
      purchaseUrl: `https://www.cloudflare.com/products/registrar/`,
      error: error.message,
    })
  }
}
