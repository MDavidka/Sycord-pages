import { NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

const locales = ["en", "hu", "ro"];
const defaultLocale = "en";

const i18nMiddleware = createMiddleware({
  locales,
  defaultLocale,
});

export default function middleware(request: NextRequest) {
  const host = request.headers.get("host");
  const mainDomain = "ltpd.xyz";

  if (host && host !== `www.${mainDomain}` && host.endsWith(mainDomain) && host !== mainDomain) {
    const subdomain = host.split(".")[0];
    console.log(`Rewriting subdomain "${subdomain}" to /en/dashboard/webshop-demo`);
    return NextResponse.rewrite(new URL(`/en/dashboard/webshop-demo`, request.url));
  }

  return i18nMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
