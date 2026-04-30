"use client"

import Link from "next/link"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { ArrowLeft, Globe, Shield, Zap } from "lucide-react"

export default function LoginForm() {
  return (
    <main
      className="relative min-h-screen w-full overflow-hidden bg-[#18191B] text-white"
      style={{
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.07) 1.6px, transparent 1.6px)",
        backgroundSize: "38px 38px",
        backgroundPosition: "0 0",
      }}
    >
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" aria-label="Home" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="logo"
            width={56}
            height={56}
            priority
            className="h-12 w-12 opacity-90 sm:h-14 sm:w-14"
          />
        </Link>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-[#1d1e21] px-3 py-2 text-sm font-medium text-[#A7AAB0] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#212327] hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Vissza a főoldalra</span>
        </Link>
      </header>

      {/* Body */}
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-2 lg:gap-16">
        {/* Login card */}
        <div className="flex items-start justify-center lg:items-center">
          <div className="w-full max-w-md">
            <div
              className="rounded-3xl border border-[#2a2c30] bg-[#1d1e21] p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:p-8"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0f1012]">
                  <Image
                    src="/logo.png"
                    alt="Sycord"
                    width={28}
                    height={28}
                    className="opacity-90"
                  />
                </div>
                <span className="text-lg font-semibold text-white">Sycord</span>
              </div>

              <h1
                className="mt-7 font-extrabold tracking-tight text-white"
                style={{
                  fontSize: "clamp(26px, 4.4vw, 34px)",
                  lineHeight: 1.1,
                  letterSpacing: "-0.02em",
                }}
              >
                Üdvözöljük <span className="text-[#A7AAB0]">újra</span>
              </h1>
              <p className="mt-3 text-sm text-[#A7AAB0] sm:text-base">
                Jelentkezzen be a fiókjába a folytatáshoz.
              </p>

              <button
                type="button"
                onClick={() =>
                  signIn("google", { callbackUrl: "/dashboard" })
                }
                className="mt-7 inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#2a2c30] bg-white text-sm font-semibold text-black transition-transform hover:scale-[1.01] sm:h-14 sm:text-base"
              >
                <svg className="h-5 w-5 sm:h-6 sm:w-6" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                Folytatás Google-fiókkal
              </button>

              <div className="my-6 flex items-center gap-3">
                <div className="h-px flex-1 bg-[#2a2c30]" />
                <span className="text-[11px] uppercase tracking-wider text-[#A7AAB0]">
                  Biztonságos bejelentkezés
                </span>
                <div className="h-px flex-1 bg-[#2a2c30]" />
              </div>

              <p className="text-center text-[11px] leading-relaxed text-[#A7AAB0] sm:text-xs">
                A bejelentkezéssel elfogadja az{" "}
                <Link
                  href="/tos"
                  className="text-white underline-offset-2 hover:underline"
                >
                  Általános Szerződési Feltételeket
                </Link>{" "}
                és az{" "}
                <Link
                  href="/pap"
                  className="text-white underline-offset-2 hover:underline"
                >
                  Adatvédelmi Szabályzatot
                </Link>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Feature side */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <h2
              className="font-extrabold tracking-tight text-white"
              style={{
                fontSize: "clamp(28px, 3.6vw, 44px)",
                lineHeight: 1.1,
                letterSpacing: "-0.02em",
              }}
            >
              Építsd meg <span className="text-[#A7AAB0]">álmaid</span> weboldalát
            </h2>
            <p className="mt-4 max-w-md text-base text-[#A7AAB0]">
              AI-alapú weboldal építő, amely percek alatt elkészíti a
              professzionális weboldalad — gyors hostinggal és SSL-lel együtt.
            </p>

            <ul className="mt-10 space-y-4">
              <FeatureRow
                icon={<Zap className="h-4 w-4" />}
                title="Villámgyors generálás"
                desc="AI-val másodpercek alatt elkészül a teljes weboldalad."
              />
              <FeatureRow
                icon={<Globe className="h-4 w-4" />}
                title="Globális hosting"
                desc="Egy kattintással publikáld — gyorsan, mindenhol."
              />
              <FeatureRow
                icon={<Shield className="h-4 w-4" />}
                title="Biztonságos infrastruktúra"
                desc="SSL és CDN automatikusan, globális lefedettséggel."
              />
            </ul>
          </div>
        </div>
      </div>
    </main>
  )
}

function FeatureRow({
  icon,
  title,
  desc,
}: {
  icon: React.ReactNode
  title: string
  desc: string
}) {
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-[#2a2c30] bg-[#1d1e21] p-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#0f1012] text-white">
        {icon}
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-[#A7AAB0]">{desc}</p>
      </div>
    </li>
  )
}
