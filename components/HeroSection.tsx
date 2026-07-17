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
      {/* Background begyar.svg decorative blocks */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* top-right large block */}
        <Image
          src="/begyar.svg"
          alt=""
          width={220}
          height={220}
          className="absolute"
          style={{ top: -40, right: -40, opacity: 0.7, width: 220, height: 220 }}
        />
        {/* top-right smaller block */}
        <Image
          src="/begyar.svg"
          alt=""
          width={140}
          height={140}
          className="absolute"
          style={{ top: 30, right: 60, opacity: 0.5, width: 140, height: 140 }}
        />
        {/* top-center/mid block (below navbar) */}
        <Image
          src="/begyar.svg"
          alt=""
          width={100}
          height={100}
          className="absolute"
          style={{ top: "14%", left: "50%", transform: "translateX(-50%)", opacity: 0.35, width: 100, height: 100 }}
        />
        {/* left mid block */}
        <Image
          src="/begyar.svg"
          alt=""
          width={110}
          height={110}
          className="absolute"
          style={{ top: "38%", left: -20, opacity: 0.55, width: 110, height: 110 }}
        />
        {/* left mid smaller block */}
        <Image
          src="/begyar.svg"
          alt=""
          width={80}
          height={80}
          className="absolute"
          style={{ top: "48%", left: 30, opacity: 0.35, width: 80, height: 80 }}
        />
        {/* bottom-left block */}
        <Image
          src="/begyar.svg"
          alt=""
          width={130}
          height={130}
          className="absolute"
          style={{ bottom: "18%", left: 20, opacity: 0.5, width: 130, height: 130 }}
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

      {/* Hero content */}
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-5 pt-16 text-center sm:pt-20">
        {/* Dot grid background behind headline */}
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

        {/* Main headline */}
        <h1
          className="relative font-extrabold tracking-tight text-balance text-white"
          style={{
            fontSize: "clamp(40px, 11vw, 76px)",
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

        {/* "Made for developer" badge using dev.svg illustration */}
        <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-[#2a2c30] bg-[#1c1d20] px-4 py-2">
          <Image
            src="/dev.svg"
            alt="made for developer"
            width={44}
            height={44}
            className="h-11 w-11 flex-shrink-0"
          />
          <div className="text-left">
            <p className="text-xs font-semibold text-white leading-tight">made fore developer</p>
            <p className="text-[11px] text-[#A7AAB0] leading-tight">since 2026</p>
          </div>
        </div>

        {/* CTA button — large pill */}
        <Button
          asChild
          size="lg"
          className="mt-7 rounded-full bg-white px-8 text-base font-semibold text-zinc-950 shadow-[0_12px_36px_rgba(255,255,255,0.09)] hover:bg-white/90 transition-transform hover:scale-[1.03]"
        >
          <Link href="/login">
            Start for free
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Phone mockup — bottom-cropped, same as screenshot */}
      <div className="relative z-10 mx-auto mt-10 flex w-full flex-col items-center px-5 pb-0">
        <div className="relative w-[min(88vw,380px)] sm:w-[400px] lg:w-[440px]">
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
            sizes="(min-width: 1024px) 440px, (min-width: 640px) 400px, 88vw"
            className="relative h-auto w-full drop-shadow-[0_36px_72px_rgba(0,0,0,0.65)]"
            style={{
              clipPath: "inset(0 0 8% 0 round 36px 36px 0 0)",
            }}
          />
        </div>
      </div>
    </section>
  )
}
