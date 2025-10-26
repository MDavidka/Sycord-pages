"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export default function LoginForm({ lang }: { lang: string }) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href={`/${lang}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>

        <div className="border border-border rounded-lg p-8 bg-card">
          <div className="flex items-center gap-2 mb-8">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <span className="text-2xl font-semibold text-foreground">Sycord</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">Welcome back</h1>
          <p className="text-muted-foreground mb-8">Sign in to continue to your account.</p>

          <Button
            onClick={() => signIn("google", { callbackUrl: `/${lang}/dashboard` })}
            className="w-full bg-white text-black hover:bg-white/90"
          >
            Continue with Google
          </Button>
        </div>
      </div>
    </div>
  )
}
