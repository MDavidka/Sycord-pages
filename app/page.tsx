"use client"

import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const { data: session } = useSession()
  const userInitial = session?.user?.name?.trim()?.charAt(0)?.toUpperCase() || "M"

  return (
    <main className="min-h-screen bg-[#0f1218] text-white relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.10) 1.5px, transparent 1.5px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-10">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Sycord" width={44} height={44} className="opacity-90" priority />
          </div>

          <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2 backdrop-blur">
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={32}
                height={32}
                className="h-8 w-8 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-sm font-semibold">
                {userInitial}
              </div>
            )}
          </div>
        </header>

        <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center text-center">
          <h1 className="text-5xl font-semibold tracking-tight sm:text-6xl">
            Create <span className="text-zinc-400">your site</span>
            <br />
            under a minute
          </h1>

          <div className="mt-12 flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              variant="outline"
              className="h-12 min-w-[160px] rounded-2xl border-white/20 bg-transparent text-lg text-white hover:bg-white/10"
            >
              <Link href="/login">Get Started</Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className="h-12 min-w-[160px] rounded-2xl border-white/20 bg-transparent text-lg text-white hover:bg-white/10"
            >
              <Link href="/dashboard">Dashboard</Link>
            </Button>
          </div>
        </section>

        <section className="mx-auto mb-6 h-[340px] w-full max-w-5xl rounded-[2.5rem] border border-white/10 bg-white/[0.05]" />
      </div>
    </main>
  )
}
