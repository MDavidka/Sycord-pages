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
  ArrowRight, Globe, Lock, Phone, Rocket, Sparkles, Zap,
} from "lucide-react"
import { AgentPromptCycler } from "@/components/agent-prompt-cycler"

const BG = "#181818"
const BORDER = "#2a2c30"
const MUTED = "#A7AAB0"
const TEXT = "#E5E7EB"

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full text-white" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: BG }}>
      <Hero />
      <StatusStrip />
      <TrustStrip />
      <WorldMapSection />
      <OneAgentSection />
      <FAQ />
      <FinalCTA />
      <Footer />
      <VersionMark />
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
  const phoneY = useTransform(scrollYProgress, [0, 0.35, 0.55, 0.78], ["46vh", "0vh", "0vh", "-10vh"])
  const phoneOpacity = useTransform(scrollYProgress, [0, 0.52, 0.7, 0.88], [1, 1, 0.4, 0])
  const phoneScale = useTransform(scrollYProgress, [0, 0.35, 0.78], [0.92, 1, 0.96])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.2, 0.4], [1, 0.5, 0])
  const copyY = useTransform(scrollYProgress, [0, 0.4], [0, -40])
  const stageOpacity = useTransform(scrollYProgress, [0.7, 0.92], [1, 0])

  return (
    <section
      ref={trackRef}
      className="relative h-[140vh] w-full md:h-[100svh] md:min-h-[600px]"
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

function StatusStrip() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8 sm:pt-8">
      <div className="flex justify-center">
        <Link href="/servers" className="inline-flex items-center gap-2.5 rounded-full border px-4 py-2 transition-colors hover:border-white/20" style={{ borderColor: BORDER, backgroundColor: BG }}>
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00E599]" />
          </span>
          <span className="text-xs font-medium" style={{ color: MUTED }}>All systems operational</span>
        </Link>
      </div>
    </section>
  )
}

function WorldMapSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Global Infrastructure" title="Deploy worldwide" subtitle="Three server locations across the globe for low-latency hosting." />
      <div className="mt-10 overflow-hidden rounded-3xl border p-6 sm:p-10 space-y-8" style={{ borderColor: BORDER, backgroundColor: BG }}>
        <div className="relative w-full flex items-center justify-center">
          <img
            src="https://sycord.com/_next/image?url=%2Fb2adf1e2-fe2d-479c-ad8a.png&w=1920&q=75"
            alt="Sycord global infrastructure"
            className="w-full max-w-2xl opacity-50"
            style={{ filter: "invert(1) brightness(0.4)" }}
          />
        </div>
        <WorldMapSVG />
      </div>
    </section>
  )
}

function WorldMapSVG() {
  return (
    <svg viewBox="0 0 900 450" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-hidden="true">
      <defs>
        <radialGradient id="dotGlow1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#00E599" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#00E599" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dotGlow2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#7C6FF5" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#7C6FF5" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="dotGlow3" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.6" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* North America */}
      <path d="M130,60 L200,45 L270,50 L310,65 L340,90 L340,130 L310,160 L280,175 L240,185 L200,190 L150,185 L110,170 L90,145 L100,105 Z" fill="#1e1f23" stroke="#2a2c30" strokeWidth="1" />
      {/* South America */}
      <path d="M200,200 L240,195 L280,200 L290,240 L280,280 L250,330 L220,350 L190,340 L170,310 L170,270 L180,230 Z" fill="#1e1f23" stroke="#2a2c30" strokeWidth="1" />
      {/* Europe */}
      <path d="M410,50 L460,40 L510,45 L540,60 L550,90 L530,110 L500,120 L460,115 L430,105 L400,95 L395,70 Z" fill="#1e1f23" stroke="#2a2c30" strokeWidth="1" />
      {/* Africa */}
      <path d="M430,120 L480,115 L510,130 L520,170 L510,220 L490,260 L460,280 L430,275 L400,250 L390,210 L400,160 Z" fill="#1e1f23" stroke="#2a2c30" strokeWidth="1" />
      {/* Asia */}
      <path d="M560,40 L660,30 L750,35 L800,60 L810,100 L790,130 L750,140 L680,135 L620,125 L570,105 L550,80 Z" fill="#1e1f23" stroke="#2a2c30" strokeWidth="1" />
      {/* Southeast Asia / islands */}
      <path d="M750,145 L780,150 L810,165 L790,185 L760,180 L740,160 Z" fill="#1e1f23" stroke="#2a2c30" strokeWidth="1" />
      {/* Australia */}
      <path d="M720,330 L780,320 L820,340 L820,380 L780,400 L730,390 L710,360 Z" fill="#1e1f23" stroke="#2a2c30" strokeWidth="1" />

      {/* Server location 1: US West (Oregon) */}
      <circle cx="155" cy="118" r="28" fill="url(#dotGlow1)" />
      <circle cx="155" cy="118" r="4" fill="#00E599" />
      <line x1="155" y1="118" x2="155" y2="145" stroke="#2a2c30" strokeWidth="0.8" />
      <rect x="128" y="147" width="54" height="22" rx="6" fill="#111213" stroke="#2a2c30" strokeWidth="0.8" />
      <text x="155" y="162" fill="#A7AAB0" fontSize="9" textAnchor="middle" className="font-medium">US West</text>

      {/* Server location 2: Europe (Frankfurt) */}
      <circle cx="470" cy="85" r="28" fill="url(#dotGlow2)" />
      <circle cx="470" cy="85" r="4" fill="#7C6FF5" />
      <line x1="470" y1="85" x2="470" y2="112" stroke="#2a2c30" strokeWidth="0.8" />
      <rect x="435" y="114" width="70" height="22" rx="6" fill="#111213" stroke="#2a2c30" strokeWidth="0.8" />
      <text x="470" y="129" fill="#A7AAB0" fontSize="9" textAnchor="middle" className="font-medium">Frankfurt</text>

      {/* Server location 3: Asia (Singapore) */}
      <circle cx="770" cy="148" r="28" fill="url(#dotGlow3)" />
      <circle cx="770" cy="148" r="4" fill="#F59E0B" />
      <line x1="770" y1="148" x2="770" y2="175" stroke="#2a2c30" strokeWidth="0.8" />
      <rect x="735" y="177" width="70" height="22" rx="6" fill="#111213" stroke="#2a2c30" strokeWidth="0.8" />
      <text x="770" y="192" fill="#A7AAB0" fontSize="9" textAnchor="middle" className="font-medium">Singapore</text>
    </svg>
  )
}

function OneAgentSection() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="One Agent" title="One agent for all needs" subtitle="From productivity to gaming — a single AI agent that adapts to your workflow." />
      <div className="mt-10 flex justify-center">
        <AgentPromptCycler />
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
    { title: "Product", links: [{ label: "Features", href: "#" }, { label: "Changelog", href: "/releases" }, { label: "Servers", href: "/servers" }] },
    { title: "Resources", links: [{ label: "Documentation", href: "#" }, { label: "API", href: "#" }, { label: "Status", href: "/servers" }] },
    { title: "Support", links: [{ label: "Help center", href: "/contact" }, { label: "Contact", href: "/contact" }, { label: "Enterprise", href: "/contact" }] },
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

function VersionMark() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <Link
        href="/releases"
        className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide backdrop-blur-md transition-all hover:border-white/25"
        style={{
          borderColor: "rgba(255,255,255,0.1)",
          backgroundColor: "rgba(24,24,24,0.85)",
          color: MUTED,
        }}
      >
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
        </span>
        v0.1 Private alpha
      </Link>
    </div>
  )
}
