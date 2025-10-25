import type React from "react"
import type { Metadata } from "next"
import { Rubik } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"

const rubik = Rubik({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sycord - Build Your Web Presence",
  description: "Create webpages for your mobile store, hosting, and services with ease",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${rubik.className} font-sans antialiased`}>
        {children}
        <Analytics />
      </body>
    </html>
  )
}
