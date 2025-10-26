import type React from "react"
import type { Metadata } from "next"
import { Rubik } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import {NextIntlClientProvider, useMessages} from 'next-intl';
import AuthProvider from "@/components/auth-provider"
import "./globals.css"

const rubik = Rubik({ subsets: ["latin"] })

export default function RootLayout({
  children,
  params
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const messages = useMessages();

  return (
    <html lang={params.locale} className="dark">
      <body className={`${rubik.className} font-sans antialiased`}>
        <NextIntlClientProvider locale={params.locale} messages={messages}>
          <AuthProvider>
            {children}
            <Analytics />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
