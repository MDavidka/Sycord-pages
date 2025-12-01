import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getToken } from "next-auth/jwt"

export async function middleware(request: NextRequest) {
  // Check for NextAuth token
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  })

  // Check for Vercel Manual Token
  const vercelToken = request.cookies.get("access_token")?.value

  // Dashboard Protection
  if (request.nextUrl.pathname.startsWith("/dashboard")) {
    // Allow if either token exists
    if (!token && !vercelToken) {
      return NextResponse.redirect(new URL("/login", request.url))
    }
  }

  // Login Page Redirection
  if (request.nextUrl.pathname === "/login") {
    // Redirect if either token exists
    if (token || vercelToken) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/((?!_next/static|_next/image|favicon.ico|logo.png).*)"],
}
