import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const host = request.headers.get('host')

  // Prevent redirect loops and issues with local development
  if (!host || host === 'localhost:3000') {
    return NextResponse.next()
  }

  // Define the main domain to exclude from rewrites
  const mainDomain = 'ltpd.xyz'

  // Check if the host is a subdomain and not the main domain
  if (host.endsWith(`.${mainDomain}`) || (host.endsWith(mainDomain) && host !== mainDomain)) {
    const subdomain = host.replace(`.${mainDomain}`, '').split('.')[0];
    if (subdomain) {
      console.log(`Rewriting subdomain "${subdomain}" to /dashboard/webshop-demo`);
      return NextResponse.rewrite(new URL('/dashboard/webshop-demo', request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
