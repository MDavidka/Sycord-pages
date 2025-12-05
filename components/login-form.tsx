"use client"
import Link from "next/link"
import Image from "next/image"
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
          <p className="text-muted-foreground mb-8">Jelentkezzen be a Vercel fiókjába a folytatáshoz.</p>

          <div className="flex flex-col gap-3">
            <a href="/api/auth/authorize" className="w-full">
              <Button className="w-full bg-black text-white hover:bg-neutral-800 border border-neutral-800 h-11">
                <Triangle className="fill-white h-4 w-4 mr-2" />
                Sign in with Vercel
              </Button>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
