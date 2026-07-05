import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"
import {
  COEP_CREDENTIALLESS,
  syraIsolationHeaders,
} from "@/lib/coep-headers"

function isolationHeadersFor(
  pathname: string,
  userAgent: string,
): Record<string, string> | null {
  if (pathname === "/builder" || pathname.startsWith("/builder/")) {
    return COEP_CREDENTIALLESS
  }
  if (/^\/dashboard\/sites\/[^/]+\/syra\/?$/.test(pathname)) {
    return syraIsolationHeaders(userAgent)
  }
  return null
}

function applyHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }
  return response
}

function stripSyraIsolationHeaders(response: NextResponse) {
  response.headers.delete("Cross-Origin-Embedder-Policy")
  response.headers.delete("Cross-Origin-Opener-Policy")
  response.headers.delete("Cross-Origin-Resource-Policy")
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const userAgent = request.headers.get("user-agent") || ""
  const isolation = isolationHeadersFor(pathname, userAgent)
  const isSyraPath = /^\/dashboard\/sites\/[^/]+\/syra\/?$/.test(pathname)

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  const vercelToken = request.cookies.get("access_token")?.value

  if (pathname.startsWith("/dashboard")) {
    if (!token && !vercelToken) {
      const redirect = NextResponse.redirect(new URL("/login", request.url))
      if (isolation) return applyHeaders(redirect, isolation)
      if (isSyraPath) return stripSyraIsolationHeaders(redirect)
      return redirect
    }
  }

  if (pathname === "/login") {
    if (token || vercelToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  const response = NextResponse.next()
  if (isSyraPath) {
    response.headers.set("Vary", "User-Agent")
  }
  if (isolation) return applyHeaders(response, isolation)
  if (isSyraPath) return stripSyraIsolationHeaders(response)
  return response
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/builder", "/builder/:path*"],
}
