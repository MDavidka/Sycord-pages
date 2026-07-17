"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowRight, Menu, X } from "lucide-react"

export function HeroSection() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <section
      className="relative w-full overflow-hidden"
      style={{ backgroundColor: "#18191B" }}
    >
      {/* Decorative background squares */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-[32px] bg-[#222427]"
          style={{ width: 200, height: 200, top: -30, right: -30 }}
        />
        <div
          className="absolute rounded-[28px] bg-[#1e1f22]"
          style={{ width: 160, height: 160, top: 140, right: 110 }}
        />
        <div
          className="absolute rounded-[28px] bg-[#222427]"
          style={{ width: 130, height: 130, top: 260, left: "55%" }}
        />
        <div
          className="absolute rounded-[28px] bg-[#1e1f22]"
          style={{ width: 110, height: 110, top: 360, left: "35%" }}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, transparent 0%, transparent 52%, rgba(255,255,255,0.03) 52%, rgba(255,255,255,0.03) 100%)",
          }}
        />
      </div>

      {/* Navbar */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Sycord"
            width={32}
            height={32}
            priority
            className="h-8 w-8 opacity-90"
          />
          <span className="text-base font-semibold tracking-tight text-white">sycord</span>
        </Link>

        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex h-10 w-10 items-center justify-center rounded-2xl text-[#A7AAB0] transition-colors hover:bg-[#212327] hover:text-white"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {menuOpen && (
        <nav className="absolute right-5 top-[68px] z-30 w-52 rounded-3xl border border-[#2a2c30] bg-[#1c1d20] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.6)] sm:right-8">
          {[
            { label: "Pricing", href: "#pricing" },
            { label: "How it works", href: "#showcase" },
            { label: "Changelog", href: "/releases" },
            { label: "Sign in", href: "/login" },
          ].map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="block rounded-2xl px-4 py-2.5 text-sm font-medium text-[#E5E7EB] transition-colors hover:bg-[#26272b] hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-5 pt-16 text-center sm:pt-20">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px)",
            backgroundSize: "38px 38px",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 55% at 50% 45%, black 30%, transparent 88%)",
            maskImage:
              "radial-gradient(ellipse 60% 55% at 50% 45%, black 30%, transparent 88%)",
          }}
        />

        <h1
          className="relative font-extrabold tracking-tight text-balance text-white"
          style={{
            fontSize: "clamp(38px, 10vw, 72px)",
            lineHeight: 1.07,
            letterSpacing: "-0.03em",
          }}
        >
          The{" "}
          <span
            className="inline-block rounded-2xl px-3 py-1"
            style={{ background: "rgba(255,255,255,0.09)" }}
          >
            coding agent
          </span>{" "}
          for
          <br />
          all need
        </h1>

        {/* dev.svg — full badge illustration (laurels + copy baked in) */}
        <div
          className="relative mt-8 overflow-hidden"
          style={{ width: "min(88vw, 260px)", aspectRatio: "2905 / 1367" }}
        >
          <Image
            src="/dev.svg"
            alt="Made for developer since 2026"
            fill
            priority
            sizes="260px"
            className="object-cover object-top"
          />
        </div>

        <Button
          asChild
          size="sm"
          className="mt-7 h-7 rounded-full bg-white px-3.5 text-xs font-semibold text-zinc-950 shadow-[0_12px_36px_rgba(255,255,255,0.09)] hover:bg-white/90"
        >
          <Link href="/login">
            Start for free
            <ArrowRight className="h-3 w-3" />
          </Link>
        </Button>
      </div>

      {/* Phone mockup — bottom-cropped */}
      <div className="relative z-10 mx-auto mt-10 flex w-full flex-col items-center px-5">
        <div className="relative w-[min(82vw,320px)] sm:w-[360px] lg:w-[400px]">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-12 -top-8 bottom-0"
            style={{
              background:
                "radial-gradient(ellipse 55% 40% at 50% 38%, rgba(124,111,245,0.11) 0%, transparent 70%)",
            }}
          />
          <Image
            src="/hero-phone.webp"
            alt="Syra, the Sycord cloud coding agent, reading files and running commands on a phone"
            width={880}
            height={1780}
            priority
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 360px, 82vw"
            className="relative h-auto w-full drop-shadow-[0_36px_72px_rgba(0,0,0,0.65)]"
            style={{ clipPath: "inset(0 0 12% 0 round 36px 36px 0 0)" }}
          />
        </div>
      </div>
    </section>
  )
}
