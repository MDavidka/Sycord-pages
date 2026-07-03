import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/** Routes where the in-browser WebContainer preview must be cross-origin isolated. */
const CROSS_ORIGIN_ISOLATION_HEADERS: Record<string, string> = {
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
}

function needsCrossOriginIsolation(pathname: string): boolean {
  if (pathname === "/builder") return true
  if (pathname.startsWith("/builder/")) return true
  // Isolated Syra iframe shell (WebContainer preview)
  if (/^\/dashboard\/sites\/[^/]+\/syra\/?$/.test(pathname)) return true
  // Legacy: full dashboard page (kept for direct loads)
  if (/^\/dashboard\/sites\/[^/]+$/.test(pathname)) return true
  return false
}

function applyCrossOriginIsolation(response: NextResponse) {
  for (const [key, value] of Object.entries(CROSS_ORIGIN_ISOLATION_HEADERS)) {
    response.headers.set(key, value)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const needsIsolation = needsCrossOriginIsolation(pathname)

  // Check for NextAuth token
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  // Check for Vercel Manual Token
  const vercelToken = request.cookies.get("access_token")?.value

  // Dashboard Protection
  if (pathname.startsWith("/dashboard")) {
    // Allow if either token exists
    if (!token && !vercelToken) {
      const redirect = NextResponse.redirect(new URL("/login", request.url))
      return needsIsolation ? applyCrossOriginIsolation(redirect) : redirect
    }
  }

  // Login Page Redirection
  if (pathname === "/login") {
    // Redirect if either token exists
    if (token || vercelToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  const response = NextResponse.next()
  return needsIsolation ? applyCrossOriginIsolation(response) : response
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/builder", "/builder/:path*", "/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
}
