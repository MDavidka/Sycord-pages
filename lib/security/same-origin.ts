import { NextResponse } from "next/server"

/**
 * Reject cross-site state-changing requests when Origin/Referer is present
 * and does not match the app host. SameSite=Lax already helps; this is defense in depth.
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get("origin")
  const referer = request.headers.get("referer")
  const host = request.headers.get("host")
  if (!host) return null

  const allowed = new Set<string>()
  const proto = request.headers.get("x-forwarded-proto") || "https"
  allowed.add(`${proto}://${host}`)
  allowed.add(`https://${host}`)
  allowed.add(`http://${host}`)
  if (process.env.NEXT_PUBLIC_APP_URL) {
    try {
      allowed.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin)
    } catch {
      /* ignore */
    }
  }
  if (process.env.NEXTAUTH_URL) {
    try {
      allowed.add(new URL(process.env.NEXTAUTH_URL).origin)
    } catch {
      /* ignore */
    }
  }

  const check = (value: string | null) => {
    if (!value) return true
    try {
      const url = new URL(value)
      return allowed.has(url.origin)
    } catch {
      return false
    }
  }

  if (origin && !check(origin)) {
    return NextResponse.json({ message: "Forbidden origin" }, { status: 403 })
  }
  if (!origin && referer && !check(referer)) {
    return NextResponse.json({ message: "Forbidden referer" }, { status: 403 })
  }
  return null
}
