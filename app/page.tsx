"use client"

import Image from "next/image"
import Link from "next/link"

export default function LandingPage() {
  return (
    <main className="device-landing relative min-h-dvh overflow-hidden text-white">
      <div aria-hidden="true" className="device-landing-bg pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(90% 55% at 50% -15%, rgba(255,255,255,0.075) 0%, transparent 55%), radial-gradient(75% 45% at 50% 110%, rgba(45, 78, 110, 0.2) 0%, transparent 60%)",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-5 sm:px-8">
        <header className="device-fade-in flex items-center justify-between pt-5 sm:pt-7">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label="Sycord home">
            <Image
              src="/logo.png"
              alt=""
              width={36}
              height={36}
              priority
              className="h-8 w-8 opacity-95 sm:h-9 sm:w-9"
            />
            <span className="text-lg font-semibold tracking-[-0.03em] sm:text-xl">Sycord</span>
          </Link>

          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-white/85 transition-colors hover:text-white"
            >
              Sign in
            </Link>
            <Link
              href="/dashboard"
              className="rounded-2xl bg-white px-3.5 py-1.5 text-sm font-semibold text-[#111] transition-transform duration-300 hover:scale-[1.03] active:scale-95 sm:px-4"
            >
              Get started
            </Link>
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center pt-12 sm:pt-16">
          <div className="device-fade-in-delay max-w-2xl text-center">
            <h1 className="font-[family-name:var(--font-ara)] text-[2.9rem] font-semibold leading-[0.95] tracking-[-0.055em] sm:text-6xl md:text-[4.5rem]">
              Sycord
            </h1>
            <p className="mx-auto mt-4 max-w-md text-base text-white/60 sm:mt-5 sm:text-lg">
              The AI workspace that helps you build, debug, and ship.
            </p>
            <Link
              href="/dashboard"
              className="mt-7 inline-flex rounded-2xl bg-white px-6 py-2.5 text-sm font-semibold text-[#111] transition-transform duration-300 hover:scale-[1.03] active:scale-95"
            >
              Start building
            </Link>
          </div>

          <div className="device-fade-in-slow relative mt-10 w-full flex-1 sm:mt-12">
            <div
              aria-hidden="true"
              className="device-hero-glow pointer-events-none absolute inset-x-[10%] bottom-[6%] top-[30%] rounded-full blur-3xl"
            />
            <div className="device-float relative z-10">
              <Image
                src="/hero-devices.png"
                alt="Sycord on iPhone and MacBook"
                width={1281}
                height={1920}
                priority
                className="mx-auto h-auto w-full max-w-[26rem] select-none object-contain sm:max-w-[34rem] md:max-w-[42rem]"
              />
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}
