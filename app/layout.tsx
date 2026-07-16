import type React from "react"
import AuthProvider from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import "./globals.css"
import { Geist, Geist_Mono, Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const geistSans = Geist({ subsets: ['latin'], variable: '--font-agent-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-agent-mono' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-[#18191B] dark">
      <body className={`${inter.className} ${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-[#18191B]`}>
        <ThemeProvider attribute="class" defaultTheme="dark" forcedTheme="dark" disableTransitionOnChange>
          <AuthProvider>
            {children}
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}

export const metadata = {
  title: 'Sycord - Create Your Website Under 5 Minutes',
  description: 'Build beautiful websites in minutes with AI-powered tools. No coding required. Start for free.',
  generator: 'v0.app',
  icons: {
    icon: [
      { url: '/icon-dark-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: '/apple-icon.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover' as const,
  themeColor: '#18191B',
};
