"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Calendar, Sparkles } from "lucide-react"

const releaseHighlights = [
  {
    title: "Builder polish",
    description: "Cleaner generation summaries and smoother editor handoffs.",
  },
  {
    title: "Hosting upgrades",
    description: "Faster preview spin-up and improved runtime stability.",
  },
  {
    title: "Quality of life",
    description: "Sharper visuals across marketing pages and dashboard views.",
  },
]

export default function ReleasesPage() {
  return (
    <main className="min-h-screen w-full bg-[#18191B] text-white">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" aria-label="Home" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="Sycord logo"
            width={56}
            height={56}
            priority
            className="h-12 w-12 opacity-90 sm:h-14 sm:w-14"
          />
        </Link>

        <Link
          href="/dashboard"
          aria-label="Open dashboard"
          className="flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-[#1d1e21] px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#212327]"
        >
          <span className="hidden text-sm font-medium text-[#A7AAB0] sm:inline">
            Dashboard
          </span>
          <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#0f1012] text-sm font-semibold text-white">
            M
          </span>
        </Link>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 pt-16 text-center sm:pt-24">
        <p className="text-xs uppercase tracking-[0.3em] text-[#A7AAB0]">
          Releases
        </p>
        <h1
          className="mt-4 font-extrabold tracking-tight text-white"
          style={{
            fontSize: "clamp(34px, 7vw, 58px)",
            lineHeight: 1.08,
            letterSpacing: "-0.02em",
          }}
        >
          Latest Sycord updates
        </h1>
        <p className="mt-5 max-w-md text-base text-[#A7AAB0] sm:text-lg">
          Follow the newest improvements across the AI builder, hosting stack,
          and dashboard experience.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
          >
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-[#1d1e21] px-5 py-3 text-sm font-semibold text-[#E5E7EB] transition-colors hover:bg-[#212327]"
          >
            Back to home
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-20 pt-12 sm:px-8 sm:pt-16">
        <div className="grid gap-4 md:grid-cols-3">
          {releaseHighlights.map((item) => (
            <div
              key={item.title}
              className="rounded-2xl border border-[#2a2c30] bg-[#1d1e21] p-6 shadow-[0_12px_30px_-24px_rgba(0,0,0,0.8)]"
            >
              <div className="flex items-center gap-2 text-[#A7AAB0]">
                <Sparkles className="h-4 w-4 text-[#E5E7EB]" />
                <span className="text-xs uppercase tracking-[0.2em]">Update</span>
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">{item.title}</h2>
              <p className="mt-2 text-sm text-[#A7AAB0]">{item.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-[#2a2c30] bg-[#15171a] p-6 text-sm text-[#A7AAB0]">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
            <Calendar className="h-4 w-4 text-[#E5E7EB]" />
            This month
          </div>
          <p className="mt-3 text-base text-white">
            We are shipping a fresh deployment experience and more guided setup
            tools — stay tuned for the full breakdown.
          </p>
        </div>
      </section>
    </main>
  )
}
