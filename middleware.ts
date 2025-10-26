import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['en', 'hu', 'ro'],

  defaultLocale: 'en'
});

export const config = {
  matcher: ['/', '/(hu|ro|en)/:path*']
};