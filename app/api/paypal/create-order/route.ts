import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"

const PAYPAL_API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com"

/** Canonical plan prices — never trust client-supplied amounts. */
const PLAN_PRICES: Record<string, { price: string; currency: string }> = {
  "Sycord+": { price: "9.00", currency: "USD" },
  "Sycord Enterprise": { price: "29.00", currency: "USD" },
  Professional: { price: "9.00", currency: "USD" },
  Ultra: { price: "29.00", currency: "USD" },
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_API_KEY
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET

  if (!clientId) throw new Error("PAYPAL_API_KEY is not configured")
  if (!clientSecret) throw new Error("PAYPAL_CLIENT_SECRET is not configured")

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`PayPal token error: ${res.status} ${text}`)
  }

  const data = await res.json()
  return data.access_token as string
}

async function resolvePlanPrice(planName: string): Promise<{ price: string; currency: string } | null> {
  if (PLAN_PRICES[planName]) return PLAN_PRICES[planName]

  // Prefer DB tier price when available (admin-managed), but only for known named tiers.
  try {
    const client = await clientPromise
    const db = client.db()
    const tier = await db.collection("subscriptionTiers").findOne({ name: planName })
    if (tier && typeof tier.price === "number" && tier.price > 0) {
      const currency =
        typeof tier.currency === "string" && ["USD", "EUR", "GBP", "CAD", "AUD"].includes(tier.currency)
          ? tier.currency
          : "USD"
      return { price: Number(tier.price).toFixed(2), currency }
    }
  } catch (err) {
    console.warn("[paypal] Failed to load subscription tier from DB:", err)
  }

  return null
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let body: { planName?: string }
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const planName = typeof body.planName === "string" ? body.planName.trim() : ""
    if (!planName) {
      return NextResponse.json({ error: "planName is required" }, { status: 400 })
    }

    const priced = await resolvePlanPrice(planName)
    if (!priced) {
      return NextResponse.json({ error: "Unknown or unpriced plan" }, { status: 400 })
    }

    const accessToken = await getAccessToken()

    const appUrl = process.env.NEXT_PUBLIC_APP_URL
    if (!appUrl) {
      throw new Error("NEXT_PUBLIC_APP_URL environment variable is not configured")
    }

    const order = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            description: `Sycord ${planName} Plan — Monthly Subscription`,
            custom_id: `${session.user.id}:${planName}`,
            amount: {
              currency_code: priced.currency,
              value: priced.price,
            },
          },
        ],
        application_context: {
          brand_name: "Sycord",
          landing_page: "BILLING",
          user_action: "PAY_NOW",
          return_url: `${appUrl}/subscriptions?success=1`,
          cancel_url: `${appUrl}/subscriptions?cancelled=1`,
        },
      }),
    })

    if (!order.ok) {
      const text = await order.text()
      throw new Error(`PayPal order creation error: ${order.status} ${text}`)
    }

    const orderData = await order.json()
    return NextResponse.json(orderData)
  } catch (error) {
    console.error("[paypal] create-order error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create PayPal order" },
      { status: 500 },
    )
  }
}
