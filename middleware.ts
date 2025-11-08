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

  const parts = host.split(".")
  let subdomain: string | null = null

  if (parts.length >= 3) {
    subdomain = parts[0]
    console.log("[v0] Subdomain detected:", subdomain)

    if (subdomain === "www" || subdomain === "admin") {
      console.log("[v0] Skipping reserved subdomain:", subdomain)
      subdomain = null
    }
  }

  if (subdomain && !url.pathname.startsWith("/api")) {
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
