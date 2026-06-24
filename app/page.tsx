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
  Activity,
  ArrowRight,
  BarChart3,
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
    <main className="min-h-screen w-full bg-[#101010] text-white">
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

/* ---------- Hero ---------- */
function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: "#101010",
        backgroundImage:
          "radial-gradient(rgba(255,255,255,0.07) 1.6px, transparent 1.6px)",
        backgroundSize: "38px 38px",
        backgroundPosition: "0 0",
      }}
    >
      {/* Header */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" aria-label="Home" className="inline-flex items-center">
          <Image
            src="/logo.png"
            alt="logo"
            width={56}
            height={56}
            priority
            className="h-9 w-9 opacity-90 sm:h-10 sm:w-10"
          />
        </Link>

        <Link
          href="/dashboard"
          aria-label="Open dashboard"
          className="flex items-center gap-1.5 rounded-2xl border border-[#2a2c30] bg-[#101010] px-2.5 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] transition-colors hover:bg-[#1a1a1a]"
        >
          <span className="hidden text-xs font-medium text-[#A7AAB0] sm:inline">
            Dashboard
          </span>
          <span className="flex h-6 w-6 items-center justify-center rounded-xl bg-[#101010] text-xs font-semibold text-white">
            M
          </span>
        </Link>
      </header>

      {/* Headline */}
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center px-5 pt-16 text-center sm:pt-24">
        <h1
          className="font-extrabold tracking-tight text-white"
          style={{
            fontSize: "clamp(38px, 9.5vw, 72px)",
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
          }}
        >
          <span>Create </span>
          <span className="text-[#A7AAB0]">your site</span>
          <br />
          <span>under a minute</span>
        </h1>

        <p className="mt-5 max-w-md text-base text-[#A7AAB0] sm:text-lg">
          AI generates your website. We host it on a fast, secure, global
          network — no setup required.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
          >
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#showcase"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-[#101010] px-5 py-3 text-sm font-semibold text-[#E5E7EB] transition-colors hover:bg-[#1a1a1a]"
          >
            See demo
          </Link>
        </div>
      </div>

      {/* Hero preview dashboard */}
      <div className="mx-auto mt-14 w-full max-w-6xl px-4 sm:mt-20 sm:px-8">
        <HeroPreview />
      </div>
    </section>
  )
}

function HeroPreview() {
  return (
    <div
      className="relative w-full overflow-hidden rounded-t-[36px] border border-b-0 border-[#2a2c30] bg-[#101010] p-5 shadow-[0_-30px_80px_-40px_rgba(0,0,0,0.8)] sm:rounded-t-[55px] sm:p-8"
      style={{ minHeight: 460 }}
    >
      {/* Top toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#101010]">
            <Code2 className="h-3.5 w-3.5 text-white/80" />
          </div>
          <span className="text-sm font-semibold text-white">Editor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-[#2a2c30] bg-[#101010] px-2.5 py-1 text-[11px] text-[#A7AAB0] sm:inline-flex">
            <MousePointerClick className="h-3 w-3" />
            Drag &amp; drop
          </span>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a2c30] bg-white px-3 py-1.5 text-xs font-semibold text-black"
          >
            <Rocket className="h-3.5 w-3.5" />
            Publish
          </button>
        </div>
      </div>

      {/* Body grid: section list + browser-like preview */}
      <div className="mt-5 grid grid-cols-12 gap-4">
        {/* Section list */}
        <div className="col-span-12 space-y-2 sm:col-span-4">
          {[
            { label: "Hero", active: true },
            { label: "Features" },
            { label: "Pricing" },
            { label: "FAQ" },
            { label: "Footer" },
          ].map(({ label, active }) => (
            <div
              key={label}
              className={`flex items-center justify-between rounded-xl border border-[#2a2c30] px-3 py-2.5 text-xs font-medium ${
                active
                  ? "bg-white text-black"
                  : "bg-[#101010] text-[#E5E7EB]"
              }`}
            >
              {label}
              <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            </div>
          ))}
        </div>

        {/* Browser-like preview */}
        <div className="col-span-12 overflow-hidden rounded-2xl border border-[#2a2c30] bg-[#101010] sm:col-span-8">
          <div className="flex items-center justify-between border-b border-[#2a2c30] px-4 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#2a2c30]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2a2c30]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#2a2c30]" />
            </div>
            <div className="rounded-md bg-[#101010] px-2 py-0.5 text-[11px] text-[#A7AAB0]">
              myportfolio.sycord.app
            </div>
            <div className="w-10" />
          </div>
          <div className="aspect-[16/10] w-full bg-gradient-to-br from-[#101010] to-[#101010] p-5">
            <div className="h-2.5 w-28 rounded bg-white/80" />
            <div className="mt-2 h-1.5 w-44 rounded bg-white/30" />
            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="aspect-square rounded-lg bg-white/[0.06]" />
              <div className="aspect-square rounded-lg bg-white/[0.04]" />
              <div className="aspect-square rounded-lg bg-white/[0.05]" />
            </div>
            <div className="mt-3 h-6 w-28 rounded-full bg-white/90" />
          </div>
        </div>
      </div>

      {/* Bottom row: hosting status + analytics */}
      <div className="mt-4 grid grid-cols-12 gap-4">
        <div className="col-span-12 rounded-2xl border border-[#2a2c30] bg-[#101010] p-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">
              <Server className="h-3.5 w-3.5" />
              Hosting
            </div>
            <span className="rounded-full border border-[#2a2c30] bg-[#101010] px-2 py-0.5 text-[11px] text-emerald-300">
              Healthy
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <MetricBlock label="Edge nodes" value="120+" />
            <MetricBlock label="Avg. TTFB" value="42ms" />
            <MetricBlock label="Cache hit" value="98%" />
          </div>
        </div>
        <div className="col-span-12 rounded-2xl border border-[#2a2c30] bg-[#101010] p-4 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">
              <TrendingUp className="h-3.5 w-3.5" />
              Analytics
            </div>
            <span className="text-[11px] text-[#A7AAB0]">Last 7 days</span>
          </div>
          <Sparkline />
        </div>
      </div>
    </div>
  )
}

function StatusCard({
  icon,
  title,
  value,
  tag,
}: {
  icon: React.ReactNode
  title: string
  value: string
  tag: string
}) {
  return (
    <div className="rounded-2xl border border-[#2a2c30] bg-[#101010] p-3">
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#A7AAB0]">
        {icon}
        {title}
      </div>
      <div className="mt-1.5 truncate text-sm font-semibold text-white">
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-[#A7AAB0]">{tag}</div>
    </div>
  )
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#2a2c30] bg-[#101010] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[#A7AAB0]">
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-white">{value}</div>
    </div>
  )
}

function Sparkline() {
  // Simple decorative SVG sparkline
  return (
    <svg
      viewBox="0 0 200 60"
      className="mt-3 h-16 w-full"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.25)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      <path
        d="M0,45 L20,40 L40,42 L60,30 L80,33 L100,22 L120,28 L140,18 L160,22 L180,12 L200,16 L200,60 L0,60 Z"
        fill="url(#g)"
      />
      <path
        d="M0,45 L20,40 L40,42 L60,30 L80,33 L100,22 L120,28 L140,18 L160,22 L180,12 L200,16"
        fill="none"
        stroke="rgba(255,255,255,0.7)"
        strokeWidth="1.5"
      />
    </svg>
  )
}

/* ---------- Section 1: Trust strip ---------- */
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
          <div
            key={it.label}
            className="inline-flex items-center gap-2 rounded-full border border-[#2a2c30] bg-[#101010] px-3.5 py-2 text-xs font-medium text-[#E5E7EB] sm:text-sm"
          >
            <span className="text-[#A7AAB0]">{it.icon}</span>
            {it.label}
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- Section 2: How it works ---------- */
function HowItWorks() {
  const steps = [
    {
      n: "01",
      icon: <Wand2 className="h-5 w-5" />,
      title: "Describe your site",
      body: "Tell Sycord what you need in plain language — purpose, style, content.",
    },
    {
      n: "02",
      icon: <Sparkles className="h-5 w-5" />,
      title: "AI builds it instantly",
      body: "Pages, sections, copy, and layout are generated and ready to edit.",
    },
    {
      n: "03",
      icon: <Rocket className="h-5 w-5" />,
      title: "Publish on fast hosting",
      body: "One click ships your site to a global CDN with SSL and your domain.",
    },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading
        eyebrow="How it works"
        title="Launch in minutes"
        subtitle="Generate, customize, and publish your site with AI-powered hosting."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div
            key={s.n}
            className="rounded-3xl border border-[#2a2c30] bg-[#101010] p-6 transition-colors hover:bg-[#1a1a1a]"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2a2c30] bg-[#101010] text-white">
                {s.icon}
              </span>
              <span className="text-xs font-semibold tracking-widest text-[#A7AAB0]">
                {s.n}
              </span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm text-[#A7AAB0]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- Section 3: AI builder features ---------- */
function AIBuilderFeatures() {
  const features = [
    {
      icon: <LayoutTemplate className="h-5 w-5" />,
      title: "AI-generated structure",
      body: "Pages, sections, and navigation built from your prompt.",
    },
    {
      icon: <Sparkles className="h-5 w-5" />,
      title: "AI-written copy",
      body: "On-brand headlines, body, and CTAs ready to go live.",
    },
    {
      icon: <Palette className="h-5 w-5" />,
      title: "Smart page sections",
      body: "Hero, features, pricing, FAQ — composed with intent.",
    },
    {
      icon: <Smartphone className="h-5 w-5" />,
      title: "Auto mobile optimization",
      body: "Every layout adapts to every screen, automatically.",
    },
    {
      icon: <MousePointerClick className="h-5 w-5" />,
      title: "Instant editing",
      body: "Click anything to refine text, layout, and styling.",
    },
    {
      icon: <Star className="h-5 w-5" />,
      title: "Templates powered by AI",
      body: "Start from a template — customize with prompts.",
    },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading
        eyebrow="AI builder"
        title="Built for speed"
        subtitle="Everything you need to design, write, and publish — generated in seconds."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  )
}

/* ---------- Section 4: Hosting features ---------- */
function HostingFeatures() {
  const features = [
    {
      icon: <Cloud className="h-5 w-5" />,
      title: "Fast global hosting",
      body: "Edge-delivered from 120+ regions for low latency everywhere.",
    },
    {
      icon: <Lock className="h-5 w-5" />,
      title: "Free SSL certificates",
      body: "Automatic HTTPS for every domain, renewed for you.",
    },
    {
      icon: <Globe className="h-5 w-5" />,
      title: "Custom domains",
      body: "Connect your domain in seconds with guided DNS.",
    },
    {
      icon: <Zap className="h-5 w-5" />,
      title: "CDN delivery",
      body: "Static and dynamic assets cached close to your visitors.",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" />,
      title: "Reliable uptime",
      body: "99.99% target backed by automated failover.",
    },
    {
      icon: <Database className="h-5 w-5" />,
      title: "Secure backups",
      body: "Daily snapshots with point-in-time restore.",
    },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading
        eyebrow="Hosting"
        title="Hosting built in"
        subtitle="A production-grade platform under every site you ship."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <FeatureCard key={f.title} {...f} />
        ))}
      </div>
    </section>
  )
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="rounded-3xl border border-[#2a2c30] bg-[#101010] p-6 transition-colors hover:bg-[#1a1a1a]">
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2a2c30] bg-[#101010] text-white">
        {icon}
      </span>
      <h3 className="mt-5 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm text-[#A7AAB0]">{body}</p>
    </div>
  )
}

/* ---------- Section 5: Two-part product showcase ---------- */
function ProductShowcase() {
  return (
    <section
      id="showcase"
      className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32"
    >
      <SectionHeading
        eyebrow="Showcase"
        title="One platform, end-to-end"
        subtitle="Design with the AI builder. Ship and operate from the hosting dashboard."
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        {/* Editor preview */}
        <div className="rounded-3xl border border-[#2a2c30] bg-[#101010] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">
              <Code2 className="h-3.5 w-3.5" />
              Editor
            </div>
            <span className="rounded-full border border-[#2a2c30] bg-[#101010] px-2 py-0.5 text-[11px] text-[#A7AAB0]">
              Drag &amp; drop
            </span>
          </div>
          <div className="mt-4 grid grid-cols-12 gap-3">
            <div className="col-span-4 space-y-2">
              {["Hero", "Features", "Pricing", "FAQ", "Footer"].map((s, i) => (
                <div
                  key={s}
                  className={`flex items-center justify-between rounded-xl border border-[#2a2c30] px-3 py-2 text-xs ${
                    i === 0
                      ? "bg-white text-black"
                      : "bg-[#101010] text-[#E5E7EB]"
                  }`}
                >
                  {s}
                  <ChevronRight className="h-3 w-3 opacity-60" />
                </div>
              ))}
            </div>
            <div className="col-span-8 rounded-2xl border border-[#2a2c30] bg-[#101010] p-4">
              <div className="h-2 w-32 rounded bg-white/80" />
              <div className="mt-2 h-1.5 w-44 rounded bg-white/30" />
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="h-16 rounded-lg bg-white/[0.05]" />
                <div className="h-16 rounded-lg bg-white/[0.06]" />
              </div>
              <div className="mt-3 h-7 w-24 rounded-full bg-white/90" />
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm text-[#A7AAB0]">
            <ShowcaseLine icon={<MousePointerClick className="h-4 w-4" />}>
              Drag &amp; drop sections
            </ShowcaseLine>
            <ShowcaseLine icon={<Wand2 className="h-4 w-4" />}>
              Inline AI editing
            </ShowcaseLine>
            <ShowcaseLine icon={<Smartphone className="h-4 w-4" />}>
              Mobile preview built-in
            </ShowcaseLine>
          </ul>
        </div>

        {/* Hosting / dashboard panel */}
        <div className="rounded-3xl border border-[#2a2c30] bg-[#101010] p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">
              <Server className="h-3.5 w-3.5" />
              Hosting dashboard
            </div>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#2a2c30] bg-white px-3 py-1.5 text-xs font-semibold text-black"
            >
              <Rocket className="h-3.5 w-3.5" />
              Publish
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <PanelStat
              label="Performance"
              value="98"
              suffix="/ 100"
              accent="emerald"
            />
            <PanelStat
              label="Uptime"
              value="99.99%"
              suffix="30d"
              accent="emerald"
            />
            <PanelStat label="Bandwidth" value="34 GB" suffix="this mo." />
            <PanelStat label="Visitors" value="12.4k" suffix="+18%" />
          </div>

          <div className="mt-4 rounded-2xl border border-[#2a2c30] bg-[#101010] p-4">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-white">
                Domain status
              </div>
              <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-300">
                Verified
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="text-[#A7AAB0]">myportfolio.com</span>
              <span className="text-[#A7AAB0]">SSL active</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function ShowcaseLine({
  icon,
  children,
}: {
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <li className="flex items-center gap-2">
      <span className="text-white/80">{icon}</span>
      {children}
    </li>
  )
}

function PanelStat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string
  value: string
  suffix?: string
  accent?: "emerald"
}) {
  return (
    <div className="rounded-2xl border border-[#2a2c30] bg-[#101010] p-3">
      <div className="text-[11px] uppercase tracking-wider text-[#A7AAB0]">
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span
          className={`text-lg font-semibold ${
            accent === "emerald" ? "text-emerald-300" : "text-white"
          }`}
        >
          {value}
        </span>
        {suffix ? (
          <span className="text-[11px] text-[#A7AAB0]">{suffix}</span>
        ) : null}
      </div>
    </div>
  )
}

/* ---------- Section 6: Templates / use cases ---------- */
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
      <SectionHeading
        eyebrow="Templates"
        title="Built for every kind of site"
        subtitle="Start from a template — Sycord tunes it to your brand."
      />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((t) => (
          <div
            key={t.label}
            className="group relative overflow-hidden rounded-3xl border border-[#2a2c30] bg-[#101010] p-5 transition-colors hover:bg-[#1a1a1a]"
          >
            <div
              className={`aspect-[16/9] w-full rounded-2xl border border-[#2a2c30] bg-gradient-to-br ${t.hue}`}
            >
              <div className="flex h-full w-full flex-col justify-between p-4">
                <div className="flex items-center justify-between">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black/40 text-white">
                    {t.icon}
                  </span>
                  <span className="rounded-full border border-[#2a2c30] bg-[#101010] px-2 py-0.5 text-[10px] uppercase tracking-wider text-[#A7AAB0]">
                    Template
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="h-2 w-24 rounded bg-white/70" />
                  <div className="h-1.5 w-32 rounded bg-white/30" />
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                {t.label}
              </span>
              <ChevronRight className="h-4 w-4 text-[#A7AAB0] transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- Section 7: Pricing ---------- */
function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      tagline: "For trying things out",
      features: [
        "10 AI generation credits",
        "Hosting included",
        "Free SSL",
        "Sycord subdomain",
      ],
      cta: "Start for free",
      highlighted: false,
    },
    {
      name: "Pro",
      price: "$19",
      period: "/mo",
      tagline: "For makers and small teams",
      features: [
        "200 AI generation credits",
        "Custom domain",
        "Free SSL",
        "Analytics",
        "Email support",
      ],
      cta: "Start Pro",
      highlighted: true,
    },
    {
      name: "Business",
      price: "$49",
      period: "/mo",
      tagline: "For growing companies",
      features: [
        "Unlimited AI generations",
        "Multiple custom domains",
        "Free SSL",
        "Advanced analytics",
        "Priority support",
      ],
      cta: "Start Business",
      highlighted: false,
    },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading
        eyebrow="Pricing"
        title="Simple, transparent pricing"
        subtitle="Start free. Scale when you're ready."
      />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map((p) => (
          <div
            key={p.name}
            className={`flex flex-col rounded-3xl border p-6 transition-colors ${
              p.highlighted
                ? "border-white/20 bg-[#101010] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] lg:scale-[1.02]"
                : "border-[#2a2c30] bg-[#101010] hover:bg-[#1a1a1a]"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{p.name}</h3>
              {p.highlighted ? (
                <span className="rounded-full border border-[#2a2c30] bg-[#101010] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">
                  Popular
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-[#A7AAB0]">{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{p.price}</span>
              {p.period ? (
                <span className="text-sm text-[#A7AAB0]">{p.period}</span>
              ) : null}
            </div>
            <ul className="mt-5 space-y-2 text-sm text-[#E5E7EB]">
              {p.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              href="/login"
              className={`mt-6 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${
                p.highlighted
                  ? "bg-white text-black hover:bg-white/90"
                  : "border border-[#2a2c30] bg-[#101010] text-white hover:bg-[#1a1a1a]"
              }`}
            >
              {p.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---------- Section 8: FAQ ---------- */
function FAQ() {
  const faqs = [
    {
      q: "How fast can I launch?",
      a: "Most users go from prompt to live site in under a minute. Generation, editing, and publish are all in-app.",
    },
    {
      q: "Is hosting included?",
      a: "Yes — every plan, including the free tier, ships with global hosting, free SSL, and a Sycord subdomain.",
    },
    {
      q: "Can I connect my own domain?",
      a: "Pro and Business plans include custom domain support with guided DNS and automatic SSL.",
    },
    {
      q: "Can I edit the AI-generated site?",
      a: "Absolutely. Click any section to refine text, layout, or style. You can also re-prompt sections.",
    },
    {
      q: "Is it mobile responsive?",
      a: "Every site is responsive by default. Sycord auto-tunes layouts for mobile, tablet, and desktop.",
    },
  ]
  return (
    <section className="mx-auto w-full max-w-3xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading
        eyebrow="FAQ"
        title="Frequently asked questions"
        subtitle="Everything you need to know to get started."
      />
      <div className="mt-8 rounded-3xl border border-[#2a2c30] bg-[#101010]">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem
              key={f.q}
              value={`item-${i}`}
              className={`border-[#2a2c30] px-5 ${
                i === faqs.length - 1 ? "border-b-0" : ""
              }`}
            >
              <AccordionTrigger className="text-base font-semibold text-white hover:no-underline">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-[#A7AAB0]">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}

/* ---------- Section 9: Final CTA ---------- */
function FinalCTA() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <div
        className="overflow-hidden rounded-[36px] border border-[#2a2c30] bg-[#101010] p-10 text-center sm:rounded-[55px] sm:p-16"
        style={{
          backgroundImage:
            "radial-gradient(rgba(255,255,255,0.05) 1.4px, transparent 1.4px)",
          backgroundSize: "26px 26px",
        }}
      >
        <h2
          className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl"
          style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
        >
          Launch your site with AI
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#A7AAB0] sm:text-lg">
          Build, host, and publish from one powerful platform.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]"
          >
            Start for free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="#showcase"
            className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-[#101010] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1a1a1a]"
          >
            See demo
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ---------- Footer ---------- */
function Footer() {
  const cols = [
    {
      title: "Product",
      links: [
        { label: "AI Builder", href: "#showcase" },
        { label: "Hosting", href: "#showcase" },
        { label: "Templates", href: "#" },
        { label: "Changelog", href: "/releases" },
      ],
    },
    {
      title: "Pricing",
      links: [
        { label: "Plans", href: "#pricing" },
        { label: "Compare", href: "#pricing" },
        { label: "Enterprise", href: "/contact" },
      ],
    },
    {
      title: "Docs",
      links: [
        { label: "Getting started", href: "#" },
        { label: "Custom domains", href: "#" },
        { label: "API", href: "#" },
      ],
    },
    {
      title: "Support",
      links: [
        { label: "Help center", href: "/contact" },
        { label: "Contact", href: "/contact" },
        { label: "Status", href: "#" },
      ],
    },
  ]
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-5 pb-12 sm:px-8 sm:mt-32">
      <div className="rounded-3xl border border-[#2a2c30] bg-[#101010] p-8 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.png"
                alt="logo"
                width={28}
                height={28}
                className="opacity-90"
              />
              <span className="text-base font-semibold text-white">Sycord</span>
            </div>
            <p className="mt-3 max-w-sm text-sm text-[#A7AAB0]">
              The AI website builder with hosting built in. Generate, customize,
              and publish — all from one platform.
            </p>
          </div>
          {cols.map((c) => (
            <div key={c.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">
                {c.title}
              </div>
              <ul className="mt-4 space-y-2 text-sm">
                {c.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-[#E5E7EB] transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-[#2a2c30] pt-6 text-xs text-[#A7AAB0] sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <Link href="/tos" className="hover:text-white">
              Terms
            </Link>
            <span>·</span>
            <Link href="/pap" className="hover:text-white">
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

/* ---------- Shared section heading ---------- */
function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string
  title: string
  subtitle: string
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center rounded-full border border-[#2a2c30] bg-[#101010] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#A7AAB0]">
        {eyebrow}
      </span>
      <h2
        className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl"
        style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}
      >
        {title}
      </h2>
      <p className="mt-3 text-base text-[#A7AAB0]">{subtitle}</p>
    </div>
  )
}
