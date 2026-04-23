import { NextRequest, NextResponse } from "next/server";

const PAYPAL_API_BASE =
  process.env.NODE_ENV === "production" ?"https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com"

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

export async function POST(req: NextRequest) {
  try {
    const { planName, price, currency = "USD" } = await req.json()

    if (!planName || price === undefined) {
      return NextResponse.json(
        { error: "planName and price are required" },
        { status: 400 }
      )
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
            amount: {
              currency_code: currency,
              value: parseFloat(String(price)).toFixed(2),
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
      { status: 500 }
    )
  }
}
