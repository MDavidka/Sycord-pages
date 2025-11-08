import { NextResponse } from "next/server"

export async function POST(request: Request) {
  const { domain } = await request.json()

  if (!domain) {
    return NextResponse.json({ message: "Domain required" }, { status: 400 })
  }

  try {
    console.log("[v0] Checking domain status:", domain)

    const response = await fetch(`https://${domain}`, {
      method: "HEAD",
      redirect: "follow",
      timeout: 5000,
    }).catch(() => null)

    const isLive = response && response.ok
    console.log("[v0] Domain status check:", { domain, isLive, status: response?.status })

    return NextResponse.json({
      domain,
      isLive,
      status: response?.status || null,
    })
  } catch (error: any) {
    console.error("[v0] Error checking domain:", error)

    return NextResponse.json({
      domain,
      isLive: false,
      error: error.message,
    })
  }
}
