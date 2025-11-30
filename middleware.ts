import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  const host = request.headers.get("host") || ""
  const url = request.nextUrl.clone()

  console.log("[v0] Middleware processing:", { host, pathname: url.pathname })

  // Define allowed domains for subdomain routing
  const isProductionDomain = host.endsWith(".ltpd.xyz")
  const isLocalhost = host.includes("localhost")

  // Only attempt to extract subdomain if we are on the production domain or localhost.
  // This prevents Vercel preview URLs (*.vercel.app) from being interpreted as subdomains.
  let subdomain: string | null = null

  if (isProductionDomain || isLocalhost) {
      const parts = host.split(".")
      // For localhost:3000, parts is ["localhost:3000"] (length 1) -> No subdomain
      // For sub.localhost:3000, parts is ["sub", "localhost:3000"] (length 2) -> Subdomain = sub
      // For sub.ltpd.xyz, parts is ["sub", "ltpd", "xyz"] (length 3) -> Subdomain = sub

      if (isLocalhost && parts.length >= 2) {
          subdomain = parts[0]
      } else if (isProductionDomain && parts.length >= 3) {
          subdomain = parts[0]
      }

      if (subdomain === "www" || subdomain === "admin") {
        console.log("[v0] Skipping reserved subdomain:", subdomain)
        subdomain = null
      }
  } else {
      console.log("[v0] Host not matching domain allowlist, skipping subdomain logic:", host)
  }

  if (subdomain) {
    console.log("[v0] Subdomain detected:", subdomain)
  }

  if (subdomain && !url.pathname.startsWith("/api") && !url.pathname.startsWith("/_next")) {
    console.log("[v0] Rewriting to sites page:", { subdomain, originalPath: url.pathname })
    url.pathname = `/sites/${subdomain}${url.pathname === "/" ? "" : url.pathname}`
    return NextResponse.rewrite(url)
  }

  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  if (request.nextUrl.pathname === "/login") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
}
