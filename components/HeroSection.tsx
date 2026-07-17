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
      {/* Background rounded squares */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute rounded-[32px] bg-[#1e1f22]"
          style={{ width: 220, height: 220, top: -40, right: -40, opacity: 0.7 }}
        />
        <div
          className="absolute rounded-[24px] bg-[#212327]"
          style={{ width: 140, height: 140, top: 30, right: 60, opacity: 0.5 }}
        />
        <div
          className="absolute rounded-[28px] bg-[#1e1f22]"
          style={{ width: 100, height: 100, top: "38%", left: -20, opacity: 0.45 }}
        />
        <div
          className="absolute rounded-[28px] bg-[#212327]"
          style={{ width: 130, height: 130, bottom: "18%", left: 20, opacity: 0.4 }}
        />
      </div>

      {/* Navbar */}
      <header className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        {/* Logo */}
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

        {/* Desktop: dashed "contact us" button */}
        <Link
          href="/contact"
          className="hidden sm:inline-flex items-center rounded-full border border-dashed border-[#4a4d55] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#212327]"
        >
          contact us
        </Link>

        {/* Mobile: hamburger */}
        <button
          type="button"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
          className="flex sm:hidden h-10 w-10 items-center justify-center rounded-2xl text-[#A7AAB0] transition-colors hover:bg-[#212327] hover:text-white"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <nav className="absolute right-5 top-[68px] z-30 w-52 rounded-3xl border border-[#2a2c30] bg-[#1c1d20] p-2 shadow-[0_24px_60px_rgba(0,0,0,0.6)]">
          {[
            { label: "Pricing", href: "#pricing" },
            { label: "How it works", href: "#showcase" },
            { label: "Changelog", href: "/releases" },
            { label: "Contact us", href: "/contact" },
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
      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-5 pt-16 text-center sm:pt-24">
        {/* Dot grid */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1.5px, transparent 1.5px)",
            backgroundSize: "38px 38px",
            WebkitMaskImage: "radial-gradient(ellipse 60% 55% at 50% 45%, black 30%, transparent 88%)",
            maskImage: "radial-gradient(ellipse 60% 55% at 50% 45%, black 30%, transparent 88%)",
          }}
        />

        {/* Headline */}
        <h1
          className="relative font-extrabold tracking-tight text-balance text-white"
          style={{ fontSize: "clamp(38px, 10vw, 72px)", lineHeight: 1.07, letterSpacing: "-0.03em" }}
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

        {/* Laurel badge */}
        <div className="mt-8 inline-flex items-center gap-3">
          {/* Left laurel SVG */}
          <svg width="28" height="44" viewBox="0 0 28 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M14 40C14 40 3 31 3 18C3 11 7 5 14 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.85"/>
            <path d="M14 33C14 33 5 27 6 18" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.65"/>
            <path d="M14 25C14 25 7 21 9 14" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.45"/>
            <path d="M14 18C14 18 9 16 12 10" stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity="0.35"/>
            <path d="M5 28C8 26 10 22 9 18" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
            <path d="M4 21C7 20 8 17 7 13" stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity="0.3"/>
          </svg>

          <div className="text-center">
            <p className="text-sm font-semibold text-white leading-snug">made fore developer</p>
            <p className="text-xs text-[#A7AAB0] leading-snug">since 2026</p>
          </div>

          {/* Right laurel SVG (mirrored) */}
          <svg width="28" height="44" viewBox="0 0 28 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style={{ transform: "scaleX(-1)" }}>
            <path d="M14 40C14 40 3 31 3 18C3 11 7 5 14 4" stroke="white" strokeWidth="1.4" strokeLinecap="round" opacity="0.85"/>
            <path d="M14 33C14 33 5 27 6 18" stroke="white" strokeWidth="1.1" strokeLinecap="round" opacity="0.65"/>
            <path d="M14 25C14 25 7 21 9 14" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.45"/>
            <path d="M14 18C14 18 9 16 12 10" stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity="0.35"/>
            <path d="M5 28C8 26 10 22 9 18" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.4"/>
            <path d="M4 21C7 20 8 17 7 13" stroke="white" strokeWidth="0.7" strokeLinecap="round" opacity="0.3"/>
          </svg>
        </div>

        {/* CTA */}
        <Button
          asChild
          size="sm"
          className="mt-6 rounded-full bg-white px-6 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_12px_36px_rgba(255,255,255,0.09)] hover:bg-white/90 transition-transform hover:scale-[1.03]"
        >
          <Link href="/login">
            Start for free
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {/* Phone mockup */}
      <div className="relative z-10 mx-auto mt-12 flex w-full flex-col items-center px-5 pb-0">
        <div className="relative w-[min(82vw,320px)] sm:w-[360px] lg:w-[400px]">
          {/* Purple glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-x-12 -top-8 bottom-0"
            style={{
              background: "radial-gradient(ellipse 55% 40% at 50% 38%, rgba(124,111,245,0.13) 0%, transparent 70%)",
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
            style={{ clipPath: "inset(0 0 12% 0 round 44px 44px 0 0)" }}
          />
        </div>
      </div>
    </section>
  )
}
