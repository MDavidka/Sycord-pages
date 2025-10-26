import type React from "react"
import type { Metadata } from "next"
import { Rubik } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import AuthProvider from "@/components/auth-provider"
import { I18nProvider } from "@/components/i18n-provider"
import "./globals.css"

const rubik = Rubik({ subsets: ["latin"] })

export default function RootLayout({
  children,
  params: { lang },
}: Readonly<{
  children: React.ReactNode
  params: { lang: string }
}>) {
  return (
    <html lang={lang} className="dark">
      <body className={`${rubik.className} font-sans antialiased`}>
        <I18nProvider lang={lang}>
          <AuthProvider>
            {children}
            <Analytics />
          </AuthProvider>
        </I18nProvider>
      </body>
    </html>
  )
}
