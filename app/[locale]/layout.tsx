import type React from "react"
import type { Metadata } from "next"
import { Rubik } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import {NextIntlClientProvider} from 'next-intl';
import {getMessages} from 'next-intl/server';
import AuthProvider from "@/components/auth-provider"
import LanguageProvider from "@/components/language-provider"
import "../globals.css"

const rubik = Rubik({ subsets: ["latin"] })

export default async function RootLayout({
  children,
  params: {locale}
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body className={`${rubik.className} font-sans antialiased`}>
        <NextIntlClientProvider messages={messages}>
          <AuthProvider>
            <LanguageProvider>
              {children}
            </LanguageProvider>
            <Analytics />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}