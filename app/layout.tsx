import type React from "react"
import AuthProvider from "@/components/auth-provider"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "sonner"
import "./globals.css"
import { Geist, Geist_Mono, Inter, Sora } from 'next/font/google'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700'] })
const sora = Sora({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-ara',
})
const geistSans = Geist({ subsets: ['latin'], variable: '--font-agent-sans' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-agent-mono' })

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-[#0a0a0b] dark">
      <body className={`${inter.className} ${sora.variable} ${geistSans.variable} ${geistMono.variable} font-sans antialiased bg-[#0a0a0b]`}>
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
  title: 'Sycord — Build, debug, and ship with AI',
  description: 'The AI workspace that helps you build, debug, and ship.',
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
