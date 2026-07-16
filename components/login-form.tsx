"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { signIn } from "next-auth/react"
import { ArrowLeft, Globe, Shield, Zap, ArrowRight, RotateCcw } from "lucide-react"

type Step = "code" | "auth"

export default function LoginForm() {
  const [step, setStep] = useState<Step>("code")
  const [code, setCode] = useState("")
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (code.trim().toUpperCase() === "SYT3ST") {
      setError(false)
      setStep("auth")
    } else {
      setError(true)
      setShake(true)
      setCode("")
      setTimeout(() => setShake(false), 500)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }

  return (
    <main
      className="relative min-h-screen w-full overflow-hidden bg-[#18191B] text-white"
      style={{
        backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.6px, transparent 1.6px)",
        backgroundSize: "38px 38px",
        backgroundPosition: "0 0",
        fontFamily: "'Inter', sans-serif",
      }}
    >
      {/* Shake keyframe */}
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-6px)}
          40%{transform:translateX(6px)}
          60%{transform:translateX(-4px)}
          80%{transform:translateX(4px)}
        }
        .shake { animation: shake 0.45s ease; }
      `}</style>

      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Image src="/logo.png" alt="Sycord" width={36} height={36} priority className="h-8 w-8 opacity-90" />
          <span className="text-sm font-semibold tracking-tight text-white">sycord</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[#2a2c30] bg-[#18191B] px-4 py-2 text-xs font-medium text-[#A7AAB0] transition-colors hover:bg-[#212327] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Back</span>
        </Link>
      </header>

      {/* Body */}
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 pb-20 pt-12 sm:px-8 sm:pt-20 lg:grid-cols-2 lg:gap-16">

        {/* ── Card ── */}
        <div className="flex items-start justify-center lg:items-center">
          <div className="w-full max-w-md">
            <div className="rounded-3xl border border-[#2a2c30] bg-[#18191B] p-6 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_30px_80px_-40px_rgba(0,0,0,0.8)] sm:p-8">

              {/* Logo row */}
              <div className="flex items-center gap-3">
                <Image src="/logo.png" alt="Sycord" width={28} height={28} className="opacity-90" />
                <span className="text-sm font-semibold text-white">sycord</span>
              </div>

              {/* ── STEP 1: Access code ── */}
              {step === "code" && (
                <>
                  <h1
                    className="mt-7 font-extrabold tracking-tight text-white"
                    style={{ fontSize: "clamp(24px, 4vw, 32px)", lineHeight: 1.1, letterSpacing: "-0.025em" }}
                  >
                    Enter access code
                  </h1>
                  <p className="mt-2 text-sm text-[#6B6F78]">
                    This is an early-access product. Paste your invite code to continue.
                  </p>

                  <form onSubmit={handleCodeSubmit} className="mt-7 space-y-3">
                    <div className={shake ? "shake" : ""}>
                      <input
                        ref={inputRef}
                        value={code}
                        onChange={(e) => { setCode(e.target.value); setError(false) }}
                        placeholder="e.g. XXXXXX"
                        autoComplete="off"
                        spellCheck={false}
                        className={`h-12 w-full rounded-2xl border bg-[#111213] px-4 text-sm font-mono tracking-widest text-white placeholder-[#3a3c40] outline-none transition-colors focus:border-white/30 sm:h-14 sm:text-base ${
                          error ? "border-red-500/60" : "border-[#2a2c30]"
                        }`}
                      />
                      {error && (
                        <p className="mt-2 text-xs text-red-400">Invalid code — check your invite and try again.</p>
                      )}
                    </div>

                    <button
                      type="submit"
                      className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-black transition-transform hover:scale-[1.01] sm:h-14 sm:text-base"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </form>

                  <p className="mt-6 text-center text-[11px] text-[#4B4F58]">
                    Don&apos;t have a code?{" "}
                    <Link href="mailto:hello@sycord.com" className="text-[#A7AAB0] hover:text-white">
                      Request access
                    </Link>
                  </p>
                </>
              )}

              {/* ── STEP 2: Login method ── */}
              {step === "auth" && (
                <>
                  <h1
                    className="mt-7 font-extrabold tracking-tight text-white"
                    style={{ fontSize: "clamp(24px, 4vw, 32px)", lineHeight: 1.1, letterSpacing: "-0.025em" }}
                  >
                    Welcome back
                  </h1>
                  <p className="mt-2 text-sm text-[#6B6F78]">
                    Choose how you want to sign in.
                  </p>

                  <button
                    type="button"
                    onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
                    className="mt-7 inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[#2a2c30] bg-white text-sm font-semibold text-black transition-transform hover:scale-[1.01] sm:h-14 sm:text-base"
                  >
                    <svg className="h-5 w-5" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                    </svg>
                    Continue with Google
                  </button>

                  <div className="my-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-[#2a2c30]" />
                    <span className="text-[11px] uppercase tracking-wider text-[#4B4F58]">Secure sign-in</span>
                    <div className="h-px flex-1 bg-[#2a2c30]" />
                  </div>

                  <p className="text-center text-[11px] leading-relaxed text-[#4B4F58] sm:text-xs">
                    By signing in you agree to the{" "}
                    <Link href="/tos" className="text-[#A7AAB0] underline-offset-2 hover:underline">Terms</Link>
                    {" "}and{" "}
                    <Link href="/pap" className="text-[#A7AAB0] underline-offset-2 hover:underline">Privacy Policy</Link>.
                  </p>

                  <button
                    type="button"
                    onClick={() => { setStep("code"); setCode(""); setError(false) }}
                    className="mt-5 inline-flex w-full items-center justify-center gap-1.5 text-xs text-[#4B4F58] transition-colors hover:text-[#A7AAB0]"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Use a different code
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* ── Feature side (desktop only) ── */}
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <h2
              className="font-extrabold tracking-tight text-white"
              style={{ fontSize: "clamp(28px, 3.6vw, 44px)", lineHeight: 1.1, letterSpacing: "-0.02em" }}
            >
              Build your{" "}<span className="text-[#A7AAB0]">dream</span>{" "}site
            </h2>
            <p className="mt-4 max-w-md text-base text-[#6B6F78]">
              AI-powered website builder that creates your professional site in minutes — with fast hosting and SSL included.
            </p>
            <ul className="mt-10 space-y-4">
              <FeatureRow icon={<Zap className="h-4 w-4" />} title="Lightning-fast generation" desc="AI builds your entire site in seconds." />
              <FeatureRow icon={<Globe className="h-4 w-4" />} title="Global hosting" desc="Publish in one click — fast, everywhere." />
              <FeatureRow icon={<Shield className="h-4 w-4" />} title="Secure infrastructure" desc="SSL and CDN automatically, globally." />
            </ul>
          </div>
        </div>

      </div>
    </main>
  )
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-4 rounded-2xl border border-[#2a2c30] bg-[#18191B] p-4">
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#18191B] text-white">{icon}</div>
      <div>
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="mt-1 text-sm text-[#6B6F78]">{desc}</p>
      </div>
    </li>
  )
}
