"use client"

import Image from "next/image"
import Link from "next/link"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Cloud,
  Code2,
  Database,
  Globe,
  LayoutTemplate,
  Lock,
  MousePointerClick,
  Palette,
  Rocket,
  Server,
  ShieldCheck,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  TrendingUp,
  User,
  Wand2,
  Zap,
} from "lucide-react"

export default function LandingPage() {
  return (
    <main
      className="min-h-screen w-full bg-[#18191B] text-white"
      style={{ fontFamily: "'Inter', sans-serif" }}
    >
      <Hero />
      <TrustStrip />
      <HowItWorks />
      <AIBuilderFeatures />
      <HostingFeatures />
      <Templates />
      <Pricing />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}

/* ─────────────────────────────────────────
   HERO
───────────────────────────────────────── */
function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: "#18191B",
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.07) 1.6px, transparent 1.6px)",
        backgroundSize: "38px 38px",
      }}
    >
      {/* ── Navbar ── */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Image
            src="/logo.png"
            alt="Sycord"
            width={36}
            height={36}
            priority
            className="h-8 w-8 opacity-90"
          />
          <span className="text-sm font-semibold tracking-tight text-white">
            sycord
          </span>
        </Link>

        <Link
          href="/login"
          className="rounded-full border border-[#2a2c30] bg-[#18191B] px-5 py-2 text-sm font-medium text-[#E5E7EB] transition-colors hover:bg-[#212327]"
        >
          sign in
        </Link>
      </header>

      {/* ── Headline ── */}
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 pt-14 text-center sm:pt-20">
        <h1
          className="font-extrabold tracking-tight text-white"
          style={{
            fontSize: "clamp(36px, 8.5vw, 68px)",
            lineHeight: 1.06,
            letterSpacing: "-0.025em",
          }}
        >
          The{" "}
          <span
            className="inline-block rounded-xl px-2.5 py-0.5"
            style={{ background: "rgba(255,255,255,0.07)" }}
          >
            Cloud Coding
          </span>
          <br />
          Agent...
        </h1>

        <p className="mt-5 max-w-sm text-sm text-[#6B6F78] sm:text-base">
          AI generates your website. We host it on a fast, secure, global
          network — no setup required.
        </p>

        <div className="mt-8 flex items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
          >
            Start for free
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link
            href="#showcase"
            className="rounded-2xl border border-[#2a2c30] px-5 py-2.5 text-sm font-medium text-[#A7AAB0] transition-colors hover:bg-[#212327]"
          >
            See demo
          </Link>
        </div>
      </div>

      {/* ── Illustration ── */}
      <HeroMockup />
    </section>
  )
}

/* ─────────────────────────────────────────
   HERO MOCKUP  — phone (left) + desktop (right)
   Mobile: bottom-half fades into bg
───────────────────────────────────────── */
function HeroMockup() {
  return (
    <div className="relative mx-auto mt-12 w-full max-w-5xl px-4 sm:mt-16 sm:px-8">
      {/*
        Clipping wrapper:
        • mobile  → overflow-hidden + fixed max-height so image is half-cut
        • sm+     → overflow-visible + no max-height
      */}
      <div
        className="relative overflow-hidden sm:overflow-visible"
        style={{ maxHeight: "clamp(220px, 58vw, 380px)" }}
      >
        {/* sm+ reset via inline style tag */}
        <style>{`@media(min-width:640px){.hmw{max-height:none!important;overflow:visible!important}}`}</style>

        <div className="hmw relative" style={{ maxHeight: "clamp(220px, 58vw, 380px)" }}>
          <div className="flex items-start justify-center gap-3 sm:gap-5">

            {/* ── Phone mockup ── */}
            <div className="w-[38%] flex-shrink-0 sm:w-[30%]">
              <div
                className="relative w-full overflow-hidden rounded-[28px] border border-[#2a2c30] bg-[#111213]"
                style={{ aspectRatio: "9/19" }}
              >
                {/* Phone status bar */}
                <div className="flex items-center justify-between px-4 pt-3 pb-1">
                  <span className="text-[9px] font-semibold text-white/60">17:04</span>
                  <div className="h-1 w-12 rounded-full bg-white/10" />
                  <span className="text-[9px] text-white/40">S M</span>
                </div>

                {/* Back arrow */}
                <div className="px-3 py-1">
                  <div className="h-1.5 w-3 rounded bg-white/20" />
                </div>

                {/* Chat header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <div className="h-6 w-6 rounded-full bg-[#2a2c30]" />
                  <div className="space-y-1">
                    <div className="h-1.5 w-16 rounded bg-white/50" />
                    <div className="h-1 w-10 rounded bg-white/20" />
                  </div>
                </div>

                {/* Chat bubble — AI response card */}
                <div className="mx-2 mt-2 rounded-2xl border border-[#2a2c30] bg-[#18191B] p-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5">
                    <div className="h-3 w-3 rounded bg-[#2a2c30]" />
                    <div className="h-1.5 w-24 rounded bg-white/40" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-1 w-full rounded bg-white/15" />
                    <div className="h-1 w-4/5 rounded bg-white/10" />
                    <div className="h-1 w-full rounded bg-white/15" />
                    <div className="h-1 w-3/5 rounded bg-white/10" />
                  </div>

                  {/* Sub-items */}
                  {["Design System", "Navbar", "Hosting"].map((lbl, i) => (
                    <div key={lbl} className="mt-2 flex items-start gap-1">
                      <div className="mt-0.5 h-1 w-1 flex-shrink-0 rounded-full bg-white/30" />
                      <div className="space-y-0.5">
                        <div className="h-1 w-14 rounded bg-white/30" />
                        <div className="h-1 w-20 rounded bg-white/10" />
                      </div>
                    </div>
                  ))}

                  <p className="mt-2 text-[7px] leading-tight text-[#6B6F78]">
                    Help you write code, debug and ship
                    production-ready work.
                  </p>
                </div>

                {/* Bottom input bar */}
                <div className="absolute bottom-0 left-0 right-0 flex items-center gap-1.5 border-t border-[#2a2c30] bg-[#111213] px-2 py-2">
                  <div className="flex-1 rounded-xl border border-[#2a2c30] bg-[#18191B] px-2 py-1">
                    <div className="h-1 w-16 rounded bg-white/15" />
                  </div>
                  <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#2a2c30]">
                    <div className="h-1.5 w-1.5 rounded-full bg-white/50" />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Desktop dashboard mockup ── */}
            <div className="flex-1 overflow-hidden rounded-t-[20px] border border-b-0 border-[#2a2c30] bg-[#111213] sm:rounded-t-[28px]">
              {/* Top bar */}
              <div className="flex items-center justify-between border-b border-[#2a2c30] px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Image src="/logo.png" alt="" width={18} height={18} className="opacity-70" />
                  <span className="text-xs font-semibold text-white">Sycord</span>
                </div>
                <div className="h-1.5 w-1.5 rounded-full bg-[#2a2c30]" />
              </div>

              {/* Body: sidebar + chat */}
              <div className="flex" style={{ minHeight: 240 }}>
                {/* Sidebar */}
                <div className="hidden w-36 flex-shrink-0 border-r border-[#2a2c30] p-3 sm:block">
                  <div className="mb-3 text-[9px] font-semibold uppercase tracking-widest text-[#4B4F58]">Platform</div>

                  {/* Nav items */}
                  {[
                    { label: "Main", active: true },
                    { label: "Overview" },
                    { label: "Domain" },
                    { label: "Pages" },
                    { label: "Syra", accent: true },
                    { label: "Utility" },
                  ].map(({ label, active, accent }) => (
                    <div
                      key={label}
                      className={`mb-0.5 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9px] font-medium ${
                        active
                          ? "bg-[#1e2022] text-white"
                          : accent
                          ? "text-[#7C6FF5]"
                          : "text-[#6B6F78]"
                      }`}
                    >
                      <div
                        className={`h-2.5 w-2.5 rounded-sm ${
                          active ? "bg-white/20" : "bg-[#2a2c30]"
                        }`}
                      />
                      {label}
                    </div>
                  ))}

                  {/* Bottom user row */}
                  <div className="mt-4 border-t border-[#2a2c30] pt-3">
                    <div className="flex items-center gap-1.5">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2a2c30] text-[8px] font-bold text-white">
                        A
                      </div>
                      <div className="space-y-0.5">
                        <div className="h-1 w-14 rounded bg-white/30" />
                        <div className="h-1 w-8 rounded bg-white/10" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat area */}
                <div className="flex flex-1 flex-col">
                  {/* Welcome message */}
                  <div className="flex-1 px-4 pt-4">
                    <div className="mb-3 inline-block rounded-2xl bg-[#1e2022] px-3 py-2 text-[10px] text-[#A7AAB0]">
                      Hey! 👋 How can I help you today?
                    </div>
                  </div>

                  {/* Bottom input */}
                  <div className="border-t border-[#2a2c30] p-3">
                    <div className="flex items-center gap-2 rounded-xl border border-[#2a2c30] bg-[#18191B] px-3 py-2">
                      <div className="h-1 w-32 rounded bg-white/10" />
                      <div className="ml-auto flex items-center gap-1.5">
                        <div className="h-4 w-4 rounded-lg bg-[#2a2c30]" />
                        <div className="h-4 w-4 rounded-lg bg-[#2a2c30]" />
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between px-1">
                      <div className="flex items-center gap-1.5">
                        <div className="h-3 w-12 rounded bg-[#2a2c30]" />
                        <span className="text-[7px] text-[#4B4F58]">↓</span>
                      </div>
                      <p className="text-[8px] text-[#4B4F58]">
                        Help you write code, debug and ship production-ready work.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Mobile bottom fade — hidden on sm+ */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 sm:hidden"
          style={{
            height: "45%",
            background: "linear-gradient(to bottom, transparent 0%, #18191B 90%)",
          }}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────
   REST OF PAGE (unchanged)
───────────────────────────────────────── */

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2a2c30] bg-[#18191B] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[#A7AAB0]">{label}</div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
    </div>
  )
}

function Sparkline() {
  return (
    <svg viewBox="0 0 200 60" className="mt-3 h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path d="M0,45 L20,40 L40,42 L60,30 L80,33 L100,22 L120,28 L140,18 L160,22 L180,12 L200,16 L200,60 L0,60 Z" fill="url(#g)" />
      <path d="M0,45 L20,40 L40,42 L60,30 L80,33 L100,22 L120,28 L140,18 L160,22 L180,12 L200,16" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" />
    </svg>
  )
}

function TrustStrip() {
  const items = [
    { icon: <Sparkles className="h-3.5 w-3.5" />, label: "AI site generation" },
    { icon: <Zap className="h-3.5 w-3.5" />, label: "Fast hosting" },
    { icon: <Lock className="h-3.5 w-3.5" />, label: "Free SSL" },
    { icon: <Rocket className="h-3.5 w-3.5" />, label: "One-click publish" },
    { icon: <Globe className="h-3.5 w-3.5" />, label: "Custom domain" },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-16 sm:px-8 sm:pt-24">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {items.map((it) => (
          <div key={it.label} className="inline-flex items-center gap-2 rounded-full border border-[#2a2c30] bg-[#18191B] px-3.5 py-2 text-xs font-medium text-[#E5E7EB] sm:text-sm">
            <span className="text-[#A7AAB0]">{it.icon}</span>
            {it.label}
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n: "01", icon: <Wand2 className="h-5 w-5" />, title: "Describe your site", body: "Tell Sycord what you need in plain language — purpose, style, content." },
    { n: "02", icon: <Sparkles className="h-5 w-5" />, title: "AI builds it instantly", body: "Pages, sections, copy, and layout are generated and ready to edit." },
    { n: "03", icon: <Rocket className="h-5 w-5" />, title: "Publish on fast hosting", body: "One click ships your site to a global CDN with SSL and your domain." },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="How it works" title="Launch in minutes" subtitle="Generate, customize, and publish your site with AI-powered hosting." />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="rounded-3xl border border-[#2a2c30] bg-[#18191B] p-6 transition-colors hover:bg-[#212327]">
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2a2c30] bg-[#18191B] text-white">{s.icon}</span>
              <span className="text-xs font-semibold tracking-widest text-[#A7AAB0]">{s.n}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-[#A7AAB0]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function AIBuilderFeatures() {
  const features = [
    { icon: <LayoutTemplate className="h-5 w-5" />, title: "AI-generated structure", body: "Pages, sections, and navigation built from your prompt." },
    { icon: <Sparkles className="h-5 w-5" />, title: "AI-written copy", body: "On-brand headlines, body, and CTAs ready to go live." },
    { icon: <Palette className="h-5 w-5" />, title: "Smart page sections", body: "Hero, features, pricing, FAQ — composed with intent." },
    { icon: <Smartphone className="h-5 w-5" />, title: "Auto mobile optimization", body: "Every layout adapts to every screen, automatically." },
    { icon: <MousePointerClick className="h-5 w-5" />, title: "Instant editing", body: "Click anything to refine text, layout, and styling." },
    { icon: <Star className="h-5 w-5" />, title: "Templates powered by AI", body: "Start from a template — customize with prompts." },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="AI builder" title="Built for speed" subtitle="Everything you need to design, write, and publish — generated in seconds." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => <FeatureCard key={f.title} {...f} />)}
      </div>
    </section>
  )
}

function HostingFeatures() {
  const features = [
    { icon: <Cloud className="h-5 w-5" />, title: "Fast global hosting", body: "Edge-delivered from 120+ regions for low latency everywhere." },
    { icon: <Lock className="h-5 w-5" />, title: "Free SSL certificates", body: "Automatic HTTPS for every domain, renewed for you." },
    { icon: <Globe className="h-5 w-5" />, title: "Custom domains", body: "Connect your domain in seconds with guided DNS." },
    { icon: <Zap className="h-5 w-5" />, title: "CDN delivery", body: "Static and dynamic assets cached close to your visitors." },
    { icon: <ShieldCheck className="h-5 w-5" />, title: "Reliable uptime", body: "99.99% target backed by automated failover." },
    { icon: <Database className="h-5 w-5" />, title: "Secure backups", body: "Daily snapshots with point-in-time restore." },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Hosting" title="Hosting built in" subtitle="A production-grade platform under every site you ship." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => <FeatureCard key={f.title} {...f} />)}
      </div>
    </section>
  )
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-[#2a2c30] bg-[#18191B] p-6 transition-colors hover:bg-[#212327]">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2a2c30] bg-[#18191B] text-white">{icon}</span>
      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-[#A7AAB0]">{body}</p>
    </div>
  )
}

function ShowcaseLine({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-white/80">{icon}</span>
      {children}
    </li>
  )
}

function PanelStat({ label, value, suffix, accent }: { label: string; value: string; suffix?: string; accent?: "emerald" }) {
  return (
    <div className="rounded-2xl border border-[#2a2c30] bg-[#18191B] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[#A7AAB0]">{label}</div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className={`text-lg font-semibold ${accent === "emerald" ? "text-emerald-300" : "text-white"}`}>{value}</span>
        {suffix ? <span className="text-[11px] text-[#A7AAB0]">{suffix}</span> : null}
      </div>
    </div>
  )
}

function Templates() {
  const items = [
    { label: "Portfolio", icon: <User className="h-5 w-5" />, hue: "from-zinc-400/10 to-zinc-700/10" },
    { label: "Startup", icon: <Rocket className="h-5 w-5" />, hue: "from-indigo-400/10 to-indigo-700/10" },
    { label: "Business", icon: <Briefcase className="h-5 w-5" />, hue: "from-emerald-400/10 to-emerald-700/10" },
    { label: "Landing page", icon: <LayoutTemplate className="h-5 w-5" />, hue: "from-amber-400/10 to-amber-700/10" },
    { label: "Storefront", icon: <ShoppingBag className="h-5 w-5" />, hue: "from-rose-400/10 to-rose-700/10" },
    { label: "Personal brand", icon: <Star className="h-5 w-5" />, hue: "from-sky-400/10 to-sky-700/10" },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Templates" title="Built for every kind of site" subtitle="Start from a template — Sycord tunes it to your brand." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <div key={t.label} className="group relative overflow-hidden rounded-3xl border border-[#2a2c30] bg-[#18191B] p-5 transition-colors hover:bg-[#212327]">
            <div className={`aspect-[16/9] w-full rounded-2xl border border-[#2a2c30] bg-gradient-to-br ${t.hue}`}>
              <div className="flex h-full w-full flex-col justify-between p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white">{t.icon}</span>
                  <span className="rounded-full border border-[#2a2c30] bg-[#18191B] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#A7AAB0]">Template</span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-24 rounded bg-white/70" />
                  <div className="h-1.5 w-32 rounded bg-white/30" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">{t.label}</span>
              <ChevronRight className="h-4 w-4 text-[#A7AAB0] transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function Pricing() {
  const plans = [
    { name: "Starter", price: "Free", tagline: "For trying things out", features: ["10 AI generation credits", "Hosting included", "Free SSL", "Sycord subdomain"], cta: "Start for free", highlighted: false },
    { name: "Pro", price: "$19", period: "/mo", tagline: "For makers and small teams", features: ["200 AI generation credits", "Custom domain", "Free SSL", "Analytics", "Email support"], cta: "Start Pro", highlighted: true },
    { name: "Business", price: "$49", period: "/mo", tagline: "For growing companies", features: ["Unlimited AI generations", "Multiple custom domains", "Free SSL", "Advanced analytics", "Priority support"], cta: "Start Business", highlighted: false },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Pricing" title="Simple, transparent pricing" subtitle="Start free. Scale when you're ready." />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className={`flex flex-col rounded-3xl border p-6 transition-colors ${p.highlighted ? "border-white/20 bg-[#18191B] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] lg:scale-[1.02]" : "border-[#2a2c30] bg-[#18191B] hover:bg-[#212327]"}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{p.name}</h3>
              {p.highlighted ? <span className="rounded-full border border-[#2a2c30] bg-[#18191B] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">Popular</span> : null}
            </div>
            <p className="mt-1 text-sm text-[#A7AAB0]">{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{p.price}</span>
              {p.period ? <span className="text-sm text-[#A7AAB0]">{p.period}</span> : null}
            </div>
            <ul className="mt-5 space-y-2 text-sm text-[#E5E7EB]">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className={`mt-6 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${p.highlighted ? "bg-white text-black hover:bg-white/90" : "border border-[#2a2c30] bg-[#18191B] text-white hover:bg-[#212327]"}`}>
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function FAQ() {
  const faqs = [
    { q: "How fast can I launch?", a: "Most users go from prompt to live site in under a minute. Generation, editing, and publish are all in-app." },
    { q: "Is hosting included?", a: "Yes — every plan, including the free tier, ships with global hosting, free SSL, and a Sycord subdomain." },
    { q: "Can I connect my own domain?", a: "Pro and Business plans include custom domain support with guided DNS and automatic SSL." },
    { q: "Can I edit the AI-generated site?", a: "Absolutely. Click any section to refine text, layout, or style. You can also re-prompt sections." },
    { q: "Is it mobile responsive?", a: "Every site is responsive by default. Sycord auto-tunes layouts for mobile, tablet, and desktop." },
  ]
  return (
    <section className="mx-auto w-full max-w-3xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="FAQ" title="Frequently asked questions" subtitle="Everything you need to know to get started." />
      <div className="mt-8 rounded-3xl border border-[#2a2c30] bg-[#18191B]">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`} className={`border-[#2a2c30] px-5 ${i === faqs.length - 1 ? "border-b-0" : ""}`}>
              <AccordionTrigger className="text-base font-semibold text-white hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm text-[#A7AAB0]">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <div
        className="overflow-hidden rounded-[36px] border border-[#2a2c30] bg-[#18191B] p-10 text-center sm:rounded-[55px] sm:p-16"
        style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1.4px, transparent 1.4px)", backgroundSize: "26px 26px" }}
      >
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Launch your site with AI
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#A7AAB0] sm:text-lg">Build, host, and publish from one powerful platform.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]">
            Start for free <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#showcase" className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-[#18191B] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#212327]">
            See demo
          </Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    { title: "Product", links: [{ label: "AI Builder", href: "#showcase" }, { label: "Hosting", href: "#showcase" }, { label: "Templates", href: "#" }, { label: "Changelog", href: "/releases" }] },
    { title: "Pricing", links: [{ label: "Plans", href: "#pricing" }, { label: "Compare", href: "#pricing" }, { label: "Enterprise", href: "/contact" }] },
    { title: "Docs", links: [{ label: "Getting started", href: "#" }, { label: "Custom domains", href: "#" }, { label: "API", href: "#" }] },
    { title: "Support", links: [{ label: "Help center", href: "/contact" }, { label: "Contact", href: "/contact" }, { label: "Status", href: "#" }] },
  ]
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-5 pb-12 sm:px-8 sm:mt-32">
      <div className="rounded-3xl border border-[#2a2c30] bg-[#18191B] p-8 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="logo" width={28} height={28} className="opacity-90" />
              <span className="text-base font-semibold text-white">Sycord</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-[#A7AAB0]">The AI website builder with hosting built in. Generate, customize, and publish — all from one platform.</p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">{c.title}</div>
              <ul className="mt-4 space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[#E5E7EB] transition-colors hover:text-white">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[#2a2c30] pt-6 text-xs text-[#A7AAB0] sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <Link href="/tos" className="hover:text-white">Terms</Link>
            <span>·</span>
            <Link href="/pap" className="hover:text-white">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center rounded-full border border-[#2a2c30] bg-[#18191B] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#A7AAB0]">{eyebrow}</span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>{title}</h2>
      <p className="mt-3 text-base text-[#A7AAB0]">{subtitle}</p>
    </div>
  )
}
