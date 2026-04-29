"use client"

import Image from "next/image"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

export default function LandingPage() {
  const { data: session } = useSession()
  const userInitial =
    session?.user?.name?.trim()?.charAt(0)?.toUpperCase() || "M"

  return (
    <main className="relative min-h-[100svh] w-full overflow-hidden bg-[#0f1115] text-white">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.09) 1.25px, transparent 1.25px)",
          backgroundSize: "26px 26px",
        }}
      />

      <div className="relative z-10 mx-auto flex min-h-[100svh] w-full max-w-6xl flex-col px-5 pt-6 sm:px-8 sm:pt-8 lg:px-12 lg:pt-10">
        <header className="flex items-center justify-between">
          <Image
            src="/logo.png"
            alt="Sycord"
            width={48}
            height={48}
            priority
            className="h-8 w-auto opacity-60 sm:h-9 lg:h-10"
          />

          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.04] p-1.5 backdrop-blur-sm">
            <div
              aria-hidden
              className="h-7 w-20 rounded-full bg-white/[0.05] sm:w-28"
            />
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={28}
                height={28}
                className="h-7 w-7 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[13px] font-semibold text-black">
                {userInitial}
              </div>
            )}
          </div>
        </header>

        <section className="flex flex-1 flex-col items-center justify-center pb-10 pt-10 text-center sm:pb-14 sm:pt-14">
          <h1 className="text-balance text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Create <span className="text-zinc-500">your site</span>
            <br />
            under a minute
          </h1>

          <div className="mt-10 flex items-center justify-center gap-3 sm:mt-12">
            <Button variant="outline">Button</Button>
            <Button variant="outline">Button</Button>
          </div>
        </section>

        <div
          aria-hidden
          className="mx-auto mt-auto h-[42svh] w-full max-w-5xl rounded-t-[2rem] border border-b-0 border-white/[0.06] bg-white/[0.04] sm:h-[48svh] sm:rounded-t-[2.5rem] lg:h-[52svh]"
        />
      </div>
    </main>
  )
}
