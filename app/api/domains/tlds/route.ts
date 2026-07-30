import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

// TLDs we want to display pricing for
const TARGET_TLDS = ["com", "net", "org", "co", "io", "dev", "app", "store", "online"]

// Fallback prices if the Cloudflare API is unavailable
const FALLBACK_PRICES: Record<string, number> = {
  com: 10.44,
  net: 11.44,
  org: 11.44,
  co: 28.98,
  io: 32.94,
  dev: 14.28,
  app: 14.28,
  store: 5.00,
  online: 3.98,
}

// Cache TLD pricing for 1 hour (in-memory)
let cachedPricing: { data: any; timestamp: number } | null = null
const CACHE_TTL_MS = 60 * 60 * 1000

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Return cached data if still fresh
  if (cachedPricing && Date.now() - cachedPricing.timestamp < CACHE_TTL_MS) {
    return NextResponse.json({ success: true, tlds: cachedPricing.data, cached: true })
  }

  const cfApiKey = process.env.CLOUDFLARE_API_KEY
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (!cfApiKey || !cfAccountId) {
    // Cloudflare not configured — return fallback prices
    const fallback = TARGET_TLDS.map(tld => ({
      tld: `.${tld}`,
      price: FALLBACK_PRICES[tld] ?? 0,
      currency: "USD",
      available: true,
    }))
    return NextResponse.json({ success: true, tlds: fallback, fallback: true })
  }

  try {
    // Cloudflare doesn't have a dedicated "list TLD prices" endpoint,
    // so we query a placeholder domain for each TLD to get current pricing
    // via the "check domain availability" endpoint which returns pricing info.

    const tldResults = await Promise.allSettled(
      TARGET_TLDS.map(async (tld) => {
        const checkRes = await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/registrar/domains/sycord-pricing-lookup.${tld}/check`,
          {
            headers: {
              Authorization: `Bearer ${cfApiKey}`,
              "Content-Type": "application/json",
            },
          }
        )

        if (!checkRes.ok) {
          // API might rate-limit or the TLD might not be supported
          return {
            tld: `.${tld}`,
            price: FALLBACK_PRICES[tld] ?? 0,
            currency: "USD",
            available: true,
            source: "fallback",
          }
        }

        const data = await checkRes.json()
        // Cloudflare check response has pricing info in result
        const pricing = data?.result?.pricing?.registration?.price ??
                        data?.result?.pricing?.renewal?.price ??
                        FALLBACK_PRICES[tld] ?? 0

        return {
          tld: `.${tld}`,
          price: typeof pricing === "number" ? pricing : ((parseFloat(pricing) || FALLBACK_PRICES[tld]) ?? 0),
          currency: "USD",
          available: data?.result?.available ?? true,
          source: "cloudflare",
        }
      })
    )

    const tlds = tldResults.map((r, i) => {
      if (r.status === "fulfilled") return r.value
      return {
        tld: `.${TARGET_TLDS[i]}`,
        price: FALLBACK_PRICES[TARGET_TLDS[i]] ?? 0,
        currency: "USD",
        available: true,
        source: "fallback",
      }
    })

    // Cache the result
    cachedPricing = { data: tlds, timestamp: Date.now() }

    return NextResponse.json({ success: true, tlds })
  } catch (error: any) {
    console.error("[Domains/TLDs] Error fetching pricing:", error)
    // Return fallback on error
    const fallback = TARGET_TLDS.map(tld => ({
      tld: `.${tld}`,
      price: FALLBACK_PRICES[tld] ?? 0,
      currency: "USD",
      available: true,
    }))
    return NextResponse.json({ success: true, tlds: fallback, fallback: true })
  }
}
