import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

/** Chromium — credentialless allows third-party assets in the builder shell. */
const COEP_CREDENTIALLESS: Record<string, string> = {
  "Cross-Origin-Embedder-Policy": "credentialless",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "cross-origin",
}

/**
 * Safari (incl. iOS) does not treat credentialless as cross-origin isolated.
 * That is fine: Syra preview uses Syte server preview (not WebContainer) on Safari,
 * and require-corp would block Vite assets that lack CORP headers.
 */
function isolationHeadersFor(pathname: string): Record<string, string> | null {
  if (pathname === "/builder" || pathname.startsWith("/builder/")) {
    return COEP_CREDENTIALLESS
  }
  // credentialless keeps SharedArrayBuffer for Chromium WebContainer on /syra
  // while allowing preview*.sycord.site assets inside the proxied iframe.
  // Safari stays non-isolated and uses Syte — never attempt WebContainer there.
  // Match the base /syra route AND any nested sub-paths (e.g. /syra/settings).
  if (/^\/dashboard\/sites\/[^/]+\/syra(\/.*)?$/.test(pathname)) {
    return COEP_CREDENTIALLESS
  }
  return null
}

function applyHeaders(response: NextResponse, headers: Record<string, string>) {
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value)
  }
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isolation = isolationHeadersFor(pathname)

  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  const vercelToken = request.cookies.get("access_token")?.value

  if (pathname.startsWith("/dashboard")) {
    if (!token && !vercelToken) {
      const redirect = NextResponse.redirect(new URL("/login", request.url))
      return isolation ? applyHeaders(redirect, isolation) : redirect
    }
  }

  if (pathname === "/login") {
    if (token || vercelToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  const response = NextResponse.next()
  return isolation ? applyHeaders(response, isolation) : response
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/builder", "/builder/:path*"],
}
