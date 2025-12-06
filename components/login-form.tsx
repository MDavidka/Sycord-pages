"use client"

import type React from "react"
import Link from "next/link"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Triangle } from "lucide-react"

export default function LoginForm() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Vissza a főoldalra
        </Link>

        <div className="border border-border rounded-lg p-6 sm:p-8 bg-card shadow-sm">
          <div className="flex items-center gap-2 mb-8">
            <Image src="/logo.png" alt="Logo" width={40} height={40} />
            <span className="text-2xl font-semibold text-foreground">Sycord</span>
          </div>

          <h1 className="text-2xl font-bold text-foreground mb-2">Üdvözöljük újra</h1>
          <p className="text-muted-foreground mb-8">Jelentkezzen be a fiókjába a folytatáshoz.</p>

          <div className="flex flex-col gap-3">
             <a href="/api/auth/authorize" className="w-full">
               <Button
                className="w-full bg-black text-white hover:bg-neutral-800 border border-neutral-800 h-11"
              >
                <Triangle className="fill-white h-4 w-4 mr-2" />
                Sign in with Vercel
              </Button>
            </a>

            <Button
              onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
              variant="outline"
              className="w-full bg-white text-black hover:bg-gray-50 border-gray-200 h-11 relative"
            >
               {/* Google Logo SVG */}
              <svg className="h-5 w-5 mr-2" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
              Folytatás Google-fiókkal
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
