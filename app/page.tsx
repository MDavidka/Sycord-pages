"use client"

import { useRef } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import {
  ArrowRight, Briefcase, CheckCircle2, Cloud, Globe,
  Lock, Rocket, Server, Sparkles, Wand2, Zap,
} from "lucide-react"

const BG = "#181818"
const BORDER = "#2a2c30"
const MUTED = "#A7AAB0"
const TEXT = "#E5E7EB"

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full text-white" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: BG }}>
      <Hero />
      <TrustStrip />
      <Pricing />
      <PriceComparison />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}

function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0">
      <div
        className="absolute inset-0 opacity-30"
        style={{
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent 0%, black 20%, black 72%, transparent 100%)",
          maskImage:
            "linear-gradient(to bottom, transparent 0%, black 20%, black 72%, transparent 100%)",
        }}
      >
        <Image
          src="/hero-glass-bg.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[center_35%] md:object-[center_40%]"
        />
      </div>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${BG} 0%, rgba(24,24,24,0.65) 12%, transparent 28%, transparent 70%, rgba(24,24,24,0.45) 90%, ${BG} 100%)`,
        }}
      />
    </div>
  )
}

function HeroNav() {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-[1200px] shrink-0 items-center justify-between pl-[max(1.25rem,env(safe-area-inset-left,0px))] pr-[max(1.25rem,env(safe-area-inset-right,0px))] pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] sm:px-8 sm:pt-8 lg:px-10">
      <Link href="/" className="inline-flex items-center gap-2">
        <Image
          src="/logo.png"
          alt="Sycord"
          width={40}
          height={40}
          priority
          className="h-9 w-9 opacity-90 sm:h-10 sm:w-10"
        />
      </Link>
      <Link
        href="/contact"
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/35 px-4 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/50 sm:h-10 sm:px-5"
      >
        <Phone className="size-4 text-white" strokeWidth={1.75} />
        inquiry
      </Link>
    </header>
  )
}

function HeroCopyMobile({
  className = "",
  style,
}: {
  className?: string
  style?: React.ComponentProps<typeof motion.div>["style"]
}) {
  return (
    <motion.div
      className={`relative z-20 mx-auto flex w-full max-w-[760px] flex-col items-center px-5 text-center ${className}`}
      style={style}
    >
      <h1 className="whitespace-nowrap text-[clamp(34px,8.5vw,52px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
        Your coding agent
      </h1>
      <div
        className="relative mt-5 w-[140px] overflow-hidden sm:mt-7 sm:w-[240px]"
        style={{ aspectRatio: "170 / 99" }}
      >
        <Image
          src="/dev.svg"
          alt="made fore developer since 2026"
          width={3000}
          height={4500}
          className="absolute left-0 top-0"
          style={{ width: "117.6471%", height: "auto", transform: "translate(0%, -35%)" }}
        />
      </div>
      <Button
        asChild
        size="sm"
        className="mt-5 h-11 min-w-[160px] rounded-full bg-white px-6 text-sm font-semibold text-[#0a0a0a] shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition-transform hover:scale-[1.03] hover:bg-white"
      >
        <Link href="/login">
          Start for free
          <ArrowRight className="size-3.5" />
        </Link>
      </Button>
    </motion.div>
  )
}

function HeroDesktop() {
  return (
    <div className="relative z-20 mx-auto hidden h-full w-full max-w-[1240px] grid-cols-2 items-center gap-8 px-8 pb-8 pt-4 md:grid lg:gap-10 lg:px-10">
      {/* Left copy */}
      <motion.div
        className="relative z-20 flex max-w-[560px] flex-col items-start text-left"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-[clamp(48px,5.6vw,76px)] font-extrabold leading-[1.02] tracking-[-0.035em] text-white">
          The AI agent
        </h1>
        <p className="mt-4 max-w-[420px] text-[17px] leading-relaxed text-white/75 lg:text-[18px]">
          this is a subheading this is a subheading
        </p>
        <div
          className="relative mt-7 w-[220px] overflow-hidden lg:mt-8 lg:w-[260px]"
          style={{ aspectRatio: "170 / 99" }}
        >
          <Image
            src="/dev.svg"
            alt="made fore developer since 2026"
            width={3000}
            height={4500}
            className="absolute left-0 top-0"
            style={{ width: "117.6471%", height: "auto", transform: "translate(0%, -35%)" }}
          />
        </div>
        <div className="mt-8 flex flex-wrap items-center gap-3 lg:mt-9">
          <Button
            asChild
            className="h-12 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0a0a0a] shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition-transform hover:scale-[1.03] hover:bg-white"
          >
            <Link href="/login">
              Start for free
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 rounded-full border-white/30 bg-transparent px-7 text-[15px] font-semibold text-white hover:bg-white/5 hover:text-white"
          >
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </motion.div>

      {/* Right phone — large, cropped bottom/right */}
      <motion.div
        className="relative hidden h-full min-h-0 md:block"
        initial={{ opacity: 0, x: 36 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.12, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute -bottom-[12%] -right-[14%] top-[4%] w-[min(118%,580px)] lg:-right-[10%] lg:top-0 lg:w-[min(115%,600px)]">
          <Image
            src="/hero-phone.webp"
            alt="Syra coding agent on phone"
            width={880}
            height={1780}
            priority
            sizes="(min-width: 1024px) 600px, 50vw"
            className="h-full w-full object-cover object-top drop-shadow-[0_40px_80px_rgba(0,0,0,0.55)]"
            style={{ borderRadius: "48px" }}
          />
        </div>
      </motion.div>
    </div>
  )
}

function Hero() {
  const trackRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: trackRef,
    offset: ["start start", "end end"],
  })

  // Mobile scroll story: peek → rise fully → hold → fade out → rest of site
  const phoneY = useTransform(scrollYProgress, [0, 0.42, 0.6, 0.82], ["46vh", "0vh", "0vh", "-10vh"])
  const phoneOpacity = useTransform(scrollYProgress, [0, 0.6, 0.74, 0.9], [1, 1, 0.4, 0])
  const phoneScale = useTransform(scrollYProgress, [0, 0.42, 0.82], [0.92, 1, 0.96])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.25, 0.45], [1, 0.5, 0])
  const copyY = useTransform(scrollYProgress, [0, 0.45], [0, -40])
  const stageOpacity = useTransform(scrollYProgress, [0.8, 0.95], [1, 0])

  return (
      <section
      ref={trackRef}
      className="relative h-[180vh] w-full md:h-[100svh] md:min-h-[600px]"
      style={{ backgroundColor: BG }}
    >
      <div className="sticky top-0 h-[100svh] overflow-hidden md:relative md:h-full">
        <div className="absolute inset-0 hidden md:block">
          <HeroBackground />
        </div>
        <motion.div className="absolute inset-0 md:hidden" style={{ opacity: stageOpacity }}>
          <HeroBackground />
        </motion.div>

        <div className="relative z-20 flex h-full flex-col">
          <HeroNav />

          {/* Mobile centered stack + scroll phone */}
          <HeroCopyMobile
            className="pt-[clamp(56px,12vh,120px)] md:hidden"
            style={{ opacity: copyOpacity, y: copyY }}
          />

          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center md:hidden">
            <motion.div
              style={{ y: phoneY, opacity: phoneOpacity, scale: phoneScale }}
              className="w-[min(78vw,320px)]"
            >
              <Image
                src="/hero-phone.webp"
                alt="Syra coding agent on phone"
                width={880}
                height={1780}
                priority
                sizes="80vw"
                className="h-auto w-full rounded-[36px] shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
              />
            </motion.div>
          </div>

          {/* Desktop split: copy left, phone right */}
          <div className="relative hidden min-h-0 flex-1 md:block">
            <HeroDesktop />
          </div>
        </div>
      </div>
    </section>
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
    <section className="mx-auto w-full max-w-6xl px-5 pt-16 sm:px-8 sm:pt-20">
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {items.map(it => (
          <div key={it.label} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm" style={{ borderColor: BORDER, backgroundColor: BG, color: TEXT }}>
            <span style={{ color: MUTED }}>{it.icon}</span>{it.label}
          </div>
        ))}
      </div>
    </section>
  )
}

function Pricing() {
  const plans = [
    { name: "Starter", price: "Free", tagline: "For trying things out", features: ["10 AI generation credits", "Hosting included", "Free SSL", "Sycord subdomain"], cta: "Start for free", highlighted: false, illo: <IlloPlanStarter /> },
    { name: "Pro", price: "$19", period: "/mo", tagline: "For makers and small teams", features: ["200 AI generation credits", "Custom domain", "Free SSL", "Analytics", "Email support"], cta: "Start Pro", highlighted: true, illo: <IlloPlanPro /> },
    { name: "Business", price: "$49", period: "/mo", tagline: "For growing companies", features: ["Unlimited AI generations", "Multiple custom domains", "Free SSL", "Advanced analytics", "Priority support"], cta: "Start Business", highlighted: false, illo: <IlloPlanBusiness /> },
  ]
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Pricing" title="Simple, transparent pricing" subtitle="Start free. Scale when you're ready." />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map(p => (
          <div key={p.name} className={`flex flex-col rounded-3xl border p-6 transition-colors ${p.highlighted ? "shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] lg:scale-[1.02]" : ""}`} style={{ borderColor: p.highlighted ? "rgba(255,255,255,0.15)" : BORDER, backgroundColor: BG }}>
            <div className="mb-5 overflow-hidden rounded-2xl border" style={{ borderColor: BORDER, backgroundColor: "#111213" }}>{p.illo}</div>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{p.name}</h3>
              {p.highlighted ? <span className="rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-wider text-white" style={{ borderColor: BORDER, backgroundColor: BG }}>Popular</span> : null}
            </div>
            <p className="mt-1 text-sm" style={{ color: MUTED }}>{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{p.price}</span>
              {p.period ? <span className="text-sm" style={{ color: MUTED }}>{p.period}</span> : null}
            </div>
            <ul className="mt-5 space-y-2 text-sm" style={{ color: TEXT }}>
              {p.features.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" /><span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={p.highlighted ? "default" : "outline"}
              className={`mt-6 rounded-xl ${p.highlighted ? "bg-white text-black hover:bg-white/90" : "bg-transparent text-white hover:text-white"}`}
              style={p.highlighted ? {} : { borderColor: BORDER }}
            >
              <Link href="/login">{p.cta}</Link>
            </Button>
          </div>
        ))}
      </div>
    </section>
  )
}

function IlloPlanStarter() {
  return (
    <div aria-hidden="true" className="flex aspect-[16/7] w-full items-center justify-center p-4">
      <div className="flex w-full max-w-[200px] items-center gap-3">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border" style={{ borderColor: BORDER, backgroundColor: BG }}>
          <Wand2 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 rounded-full border px-3 py-1.5" style={{ borderColor: BORDER, backgroundColor: BG }}>
            <span className="text-[10px] font-medium" style={{ color: MUTED }}>you.sycord.app</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map(i => <span key={i} className="h-1.5 flex-1 rounded-full bg-white/15" />)}
            <Sparkles className="h-3 w-3 shrink-0 text-[#7C6FF5]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function IlloPlanPro() {
  return (
    <div aria-hidden="true" className="flex aspect-[16/7] w-full items-center justify-center p-4">
      <div className="w-full max-w-[210px] space-y-2">
        <div className="flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5" style={{ backgroundColor: BG }}>
          <Lock className="h-3 w-3 shrink-0 text-emerald-400" />
          <span className="text-[10px] font-semibold text-white">yourdomain.com</span>
          <TrendingUp className="ml-auto h-3 w-3 shrink-0 text-[#7C6FF5]" />
        </div>
        <div className="flex items-end gap-1.5 rounded-xl border px-3 pb-2 pt-3" style={{ borderColor: BORDER, backgroundColor: BG }}>
          {[8, 14, 10, 18, 13, 22, 17, 26].map((h, i) => (
            <span key={i} className="w-full rounded-t-sm bg-[#7C6FF5]/60" style={{ height: h }} />
          ))}
        </div>
      </div>
    </div>
  )
}

function IlloPlanBusiness() {
  return (
    <div aria-hidden="true" className="flex aspect-[16/7] w-full items-center justify-center p-4">
      <div className="relative h-full w-full max-w-[210px]">
        <div className="absolute left-3 top-1/2 w-[85%] -translate-y-[30%] rounded-xl border px-3 py-2 opacity-60" style={{ borderColor: BORDER, backgroundColor: "#1c1d20" }}>
          <div className="h-1.5 w-16 rounded-full bg-white/20" />
        </div>
        <div className="absolute left-1.5 top-1/2 w-[90%] -translate-y-[55%] rounded-xl border px-3 py-2 opacity-80" style={{ borderColor: BORDER, backgroundColor: "#1e1f23" }}>
          <div className="h-1.5 w-20 rounded-full bg-white/25" />
        </div>
        <div className="absolute left-0 top-1/2 flex w-[95%] -translate-y-[80%] items-center gap-2 rounded-xl border border-white/20 px-3 py-2" style={{ backgroundColor: "#232428" }}>
          <Server className="h-3.5 w-3.5 shrink-0 text-white" />
          <div className="h-1.5 w-20 rounded-full bg-white/40" />
          <span className="ml-auto flex items-center gap-1 rounded-full bg-emerald-400/10 px-1.5 py-0.5">
            <span className="h-1 w-1 rounded-full bg-emerald-400" />
            <span className="text-[8px] font-semibold uppercase tracking-wider text-emerald-400">99.99%</span>
          </span>
        </div>
      </div>
    </div>
  )
}

function PriceComparison() {
  const competitors = [
    {
      name: "Cursor",
      icon: "/icons/cursor.svg",
      price: "$20",
      period: "/mo",
      tagline: "AI-first code editor",
      features: ["AI code completions", "Inline editing", "Chat with codebase", "Terminal integration", "Multiple models"],
      highlight: false,
    },
    {
      name: "Cloud Code",
      icon: "/icons/cloud-code.svg",
      price: "Free",
      period: "/mo",
      tagline: "Google Cloud developer tools",
      features: ["Cloud IDE", "GitHub integration", "Docker support", "Kubernetes tools", "Google Cloud connectors"],
      highlight: false,
    },
    {
      name: "Sycord",
      icon: "/logo.png",
      price: "Free",
      period: " / mo",
      tagline: "AI website builder with hosting",
      features: ["AI site generation", "Global hosting included", "Free SSL & CDN", "Custom domains", "One-click publish"],
      highlight: true,
    },
  ]
  return (
    <section id="compare" className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Compare" title="Cursor vs Cloud Code vs Sycord" subtitle="See how Sycord stacks up against the competition." />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {competitors.map(c => (
          <div key={c.name} className={`flex flex-col rounded-3xl border p-6 transition-colors ${c.highlight ? "shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] lg:scale-[1.02]" : ""}`} style={{ borderColor: c.highlight ? "rgba(255,255,255,0.15)" : BORDER, backgroundColor: BG }}>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border" style={{ borderColor: BORDER, backgroundColor: "#111213" }}>
                <Image src={c.icon} alt={c.name} width={24} height={24} className="h-6 w-6 object-contain" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">{c.name}</h3>
                <p className="text-xs" style={{ color: MUTED }}>{c.tagline}</p>
              </div>
            </div>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{c.price}</span>
              <span className="text-sm" style={{ color: MUTED }}>{c.period}</span>
            </div>
            <ul className="mt-5 space-y-2 text-sm" style={{ color: TEXT }}>
              {c.features.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" /><span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={c.highlight ? "default" : "outline"}
              className={`mt-6 rounded-xl ${c.highlight ? "bg-white text-black hover:bg-white/90" : "bg-transparent text-white hover:text-white"}`}
              style={c.highlight ? {} : { borderColor: BORDER }}
            >
              <Link href={c.name === "Sycord" ? "/login" : c.name === "Cursor" ? "https://cursor.com" : "https://cloud.google.com/code"} target="_blank" rel="noopener noreferrer">{c.name === "Sycord" ? "Start for free" : "View Pricing"}</Link>
            </Button>
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
      <div className="mt-8 rounded-3xl border" style={{ borderColor: BORDER, backgroundColor: BG }}>
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`} className={`px-5 ${i === faqs.length - 1 ? "border-b-0" : ""}`} style={{ borderColor: BORDER }}>
              <AccordionTrigger className="text-base font-semibold text-white hover:no-underline">{f.q}</AccordionTrigger>
              <AccordionContent className="text-sm" style={{ color: MUTED }}>{f.a}</AccordionContent>
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
      <div className="overflow-hidden rounded-[36px] border p-10 text-center sm:rounded-[55px] sm:p-16" style={{ borderColor: BORDER, backgroundColor: BG, backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1.4px, transparent 1.4px)", backgroundSize: "26px 26px" }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>Launch your site with AI</h2>
        <p className="mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ color: MUTED }}>Build, host, and publish from one powerful platform.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-xl bg-white text-black hover:bg-white/90">
            <Link href="/login">Start for free <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl bg-transparent text-white hover:text-white" style={{ borderColor: BORDER }}>
            <Link href="/login">Get started</Link>
          </Button>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    { title: "Product", links: [{ label: "Pricing", href: "#pricing" }, { label: "Compare", href: "#compare" }, { label: "Changelog", href: "/releases" }] },
    { title: "Pricing", links: [{ label: "Plans", href: "#pricing" }, { label: "Compare", href: "#pricing" }, { label: "Enterprise", href: "/contact" }] },
    { title: "Docs", links: [{ label: "Getting started", href: "#" }, { label: "Custom domains", href: "#" }, { label: "API", href: "#" }] },
    { title: "Support", links: [{ label: "Help center", href: "/contact" }, { label: "Contact", href: "/contact" }, { label: "Status", href: "#" }] },
  ]
  return (
    <footer className="mx-auto mt-24 w-full max-w-6xl px-5 pb-12 sm:px-8 sm:mt-32">
      <div className="rounded-3xl border p-8 sm:p-10" style={{ borderColor: BORDER, backgroundColor: BG }}>
        <div className="grid gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="logo" width={28} height={28} className="opacity-90" />
              <span className="text-base font-semibold text-white">Sycord</span>
            </div>
            <p className="mt-3 max-w-sm text-sm" style={{ color: MUTED }}>The AI website builder with hosting built in. Generate, customize, and publish — all from one platform.</p>
          </div>
          {cols.map(c => (
            <div key={c.title}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>{c.title}</div>
              <ul className="mt-4 space-y-2 text-sm">
                {c.links.map(l => (
                  <li key={l.label}>
                    <Link href={l.href} className="transition-colors duration-150 hover:text-white" style={{ color: TEXT }}>{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 h-[1px] w-full rounded-full bg-white/10" />
        <div className="mt-6 flex flex-col items-start justify-between gap-4 text-xs sm:flex-row sm:items-center" style={{ color: MUTED }}>
          <span>© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          <div className="flex items-center gap-3">
            <Link href="/tos" className="transition-colors duration-150 hover:text-white">Terms</Link>
            <span>·</span>
            <Link href="/pap" className="transition-colors duration-150 hover:text-white">Privacy</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider" style={{ borderColor: BORDER, backgroundColor: BG, color: MUTED }}>{eyebrow}</span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>{title}</h2>
      <p className="mt-3 text-base" style={{ color: MUTED }}>{subtitle}</p>
    </div>
  )
}
