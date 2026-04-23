"use client";
import type React from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield, Zap, Globe } from "lucide-react";

export default function LoginForm() {
  return (
    <div className="min-h-screen bg-background flex flex-col lg:flex-row">
      {/* Left side - Login form */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 sm:mb-8 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Vissza a főoldalra
          </Link>

          <div className="border border-border rounded-xl sm:rounded-2xl p-6 sm:p-8 bg-card shadow-lg backdrop-blur-sm">
            <div className="flex items-center gap-3 mb-6 sm:mb-8">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Image src="/logo.png" alt="Logo" width={40} height={40} />
              </div>
              <span className="text-xl sm:text-2xl font-bold text-foreground">Sycord</span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">Üdvözöljük újra</h1>
            <p className="text-sm sm:text-base text-muted-foreground mb-6 sm:mb-8">
              Jelentkezzen be a fiókjába a folytatáshoz.
            </p>

            <div className="flex flex-col gap-3 sm:gap-4">
              <Button
                onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                variant="outline"
                className="w-full bg-white text-black hover:bg-gray-50 border-gray-200 h-12 sm:h-14 relative rounded-xl text-sm sm:text-base font-medium transition-all hover:shadow-md"
              >
                {/* Google Logo SVG - Full color version */}
                <svg className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Folytatás Google-fiókkal
              </Button>
            </div>

            {/* Terms */}
            <p className="text-[10px] sm:text-xs text-muted-foreground text-center mt-6 sm:mt-8 leading-relaxed">
              A bejelentkezéssel elfogadja az{" "}
              <Link href="#" className="underline hover:text-foreground">
                Általános Szerződési Feltételeket
              </Link>{" "}
              és az{" "}
              <Link href="#" className="underline hover:text-foreground">
                Adatvédelmi Szabályzatot
              </Link>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Features (hidden on mobile, visible on larger screens) */}
      <div className="hidden lg:flex flex-1 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5 items-center justify-center p-8 border-l border-border">
        <div className="max-w-md space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Építsd meg álmaid weboldalát
            </h2>
            <p className="text-muted-foreground text-lg">
              AI-alapú weboldal építő, amely percek alatt elkészíti a professionális weboldalad.
            </p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Villámgyors generálás</h3>
                <p className="text-sm text-muted-foreground">
                  AI-val másodpercek alatt generálhatod a teljes weboldalad.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Cloudflare telepítés</h3>
                <p className="text-sm text-muted-foreground">
                  Egy kattintással publikáld weboldalad a Cloudflare Pages-re.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground mb-1">Biztonságos infrastruktúra</h3>
                <p className="text-sm text-muted-foreground">
                  SSL és CDN automatikusan, globális lefedettséggel.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
