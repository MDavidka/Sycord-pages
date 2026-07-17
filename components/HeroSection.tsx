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
      className="relative w-full min-h-screen overflow-hidden"
      style={{ backgroundColor: "#18191B" }}
    >
      {/* Background rounded squares — decorative */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* top-right large square */}
        <div
          className="absolute rounded-[32px] bg-[#1e1f22]"
          style={{ width: 220, height: 220, top: -40, right: -40, opacity: 0.7 }}
        />
        {/* top-right smaller square offset */}
        <div
          className="absolute rounded-[24px] bg-[#212327]"
          style={{ width: 140, height: 140, top: 30, right: 60, opacity: 0.5 }}
        />
        {/* left mid square */}
        <div
          className="absolute rounded-[28px] bg-[#1e1f22]"
          style={{ width: 100, height: 100, top: "38%", left: -20, opacity: 0.45 }}
        />
        {/* bottom-left square */}
        <div
          className="absolute rounded-[28px] bg-[#212327]"
          style={{ width: 130, height: 130, bottom: "18%", left: 20, opacity: 0.4 }}
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
          <span className="text-base font-semibold text-white tracking-tight">sycord</span>
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

      {/* Mobile nav dropdown */}
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

      {/* Hero content — Title → dev.svg → button */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6 pt-8 text-center sm:pt-12">
        {/* Dot grid background behind headline */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px)",
            backgroundSize: "32px 32px",
            WebkitMaskImage:
              "radial-gradient(ellipse 60% 55% at 50% 40%, black 28%, transparent 88%)",
            maskImage:
              "radial-gradient(ellipse 60% 55% at 50% 40%, black 28%, transparent 88%)",
          }}
        />

        {/* Title */}
        <h1
          className="relative w-full max-w-[300px] font-extrabold tracking-tight text-balance text-white sm:max-w-[400px]"
          style={{
            fontSize: "clamp(34px, 8.5vw, 64px)",
            lineHeight: 1.06,
            letterSpacing: "-0.03em",
          }}
        >
          The{" "}
          <span
            className="inline-block rounded-xl px-2.5 py-0.5 sm:rounded-2xl sm:px-3 sm:py-1"
            style={{ background: "rgba(255,255,255,0.09)" }}
          >
            coding agent
          </span>{" "}
          for
          <br />
          all needs
        </h1>

        {/* dev.svg badge pill */}
        <div className="relative mt-5 flex justify-center sm:mt-6">
          <Image
            src="/dev.svg"
            alt="made for developers since 2026"
            width={320}
            height={88}
            priority
            className="h-auto w-[230px] sm:w-[250px]"
          />
        </div>

        {/* Button */}
        <Button
          asChild
          size="sm"
          className="mt-5 h-11 min-w-[168px] rounded-full bg-white px-8 text-sm font-semibold text-zinc-950 shadow-[0_12px_36px_rgba(255,255,255,0.09)] hover:bg-white/90 transition-transform hover:scale-[1.03] sm:mt-6 sm:h-12 sm:min-w-[180px] sm:px-9"
        >
          <Link href="/login">
            Start for free
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Phone mockup — unchanged */}
      <div className="relative z-10 mx-auto mt-8 flex w-full flex-col items-center px-6 pb-[env(safe-area-inset-bottom)] sm:mt-10">
        <div className="relative w-[min(78vw,300px)] sm:w-[360px] lg:w-[400px]">
          {/* purple glow behind phone */}
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
            alt="Syra coding agent on mobile"
            width={880}
            height={1780}
            priority
            sizes="(min-width: 1024px) 400px, (min-width: 640px) 360px, 82vw"
            className="relative h-auto w-full drop-shadow-[0_36px_72px_rgba(0,0,0,0.65)]"
            style={{
              /* clip the bottom so it looks like the phone is cropped/emerging */
              clipPath: "inset(0 0 12% 0 round 36px 36px 0 0)",
            }}
          />
        </div>
      </div>
    </section>
  )
}
