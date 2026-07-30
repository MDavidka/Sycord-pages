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
  ArrowRight, Globe,
  Lock, Phone, Rocket, Sparkles, Zap,
} from "lucide-react"

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
      <AlphaBadge className="mt-4" />
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
        <AlphaBadge className="mt-4" />
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
      <div className="mt-10 overflow-hidden rounded-3xl border p-6 sm:p-10" style={{ borderColor: BORDER, backgroundColor: BG }}>
        <WorldMapSVG />
      </div>
    </section>
  )
}

function WorldMapSVG() {
  const markers = [
    { x: 214, y: 154, label: "USA · Texas", sublabel: "North America", color: "#00E599", labelX: 150, labelY: 206 },
    { x: 456, y: 134, label: "Frankfurt", sublabel: "Europe", color: "#7C6FF5", labelX: 486, labelY: 92 },
    { x: 682, y: 250, label: "Singapore", sublabel: "Asia Pacific", color: "#F59E0B", labelX: 704, labelY: 303 },
  ]

  return (
    <svg viewBox="0 0 900 450" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-hidden="true">
      <defs>
        <linearGradient id="continentFill" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#25272c" />
          <stop offset="100%" stopColor="#17181b" />
        </linearGradient>
        <radialGradient id="mapGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.11" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="900" height="450" rx="32" fill="url(#mapGlow)" opacity="0.65" />
      <g opacity="0.35" stroke="#34373d" strokeWidth="0.7">
        {[120, 240, 360, 480, 600, 720, 840].map(x => <path key={`lng-${x}`} d={`M${x} 34V416`} />)}
        {[90, 160, 230, 300, 370].map(y => <path key={`lat-${y}`} d={`M48 ${y}H852`} />)}
      </g>

      <g fill="url(#continentFill)" stroke="#383b42" strokeWidth="1.4" strokeLinejoin="round">
        <path d="M95 109C116 78 157 64 189 72C207 52 245 51 270 67C302 65 333 84 338 112C369 125 380 154 360 181C342 205 305 203 282 217C250 236 226 226 198 236C159 250 128 226 124 195C96 185 82 155 95 109Z" />
        <path d="M162 246C181 226 222 229 243 254C265 280 257 313 274 337C290 358 274 387 247 397C227 371 205 352 205 317C178 298 164 277 162 246Z" />
        <path d="M411 111C424 88 450 78 476 86C489 72 521 79 533 98C556 103 568 122 557 143C536 137 520 151 500 151C474 151 456 139 435 145C417 138 405 128 411 111Z" />
        <path d="M427 158C460 142 502 151 521 180C537 206 525 237 514 267C501 304 477 331 443 319C416 309 403 278 388 249C372 217 395 176 427 158Z" />
        <path d="M536 111C565 72 626 59 670 75C706 54 773 63 810 98C846 132 831 181 787 194C744 207 716 180 680 198C646 214 608 200 587 176C562 170 532 145 536 111Z" />
        <path d="M650 210C670 202 699 214 711 235C728 236 741 249 735 266C720 274 701 267 689 258C671 261 653 249 650 210Z" />
        <path d="M702 331C735 312 793 313 821 344C842 368 826 396 791 403C748 412 706 389 702 331Z" />
        <path d="M373 91C386 78 410 79 421 93C412 108 387 109 373 91Z" />
      </g>

      <g opacity="0.35" stroke="#555963" strokeWidth="1" strokeDasharray="4 7">
        <path d="M214 154C304 89 383 88 456 134" />
        <path d="M456 134C536 159 612 189 682 250" />
      </g>

      {markers.map(marker => {
        const labelWidth = marker.label.length > 10 ? 104 : 88
        const labelX = marker.labelX - labelWidth / 2

        return (
          <g key={marker.label}>
            <circle cx={marker.x} cy={marker.y} r="30" fill={marker.color} opacity="0.12" />
            <circle cx={marker.x} cy={marker.y} r="16" fill={marker.color} opacity="0.2" />
            <circle cx={marker.x} cy={marker.y} r="5.5" fill={marker.color} />
            <circle cx={marker.x} cy={marker.y} r="9" stroke={marker.color} strokeWidth="1.5" opacity="0.75" />
            <path d={`M${marker.x} ${marker.y + 10}L${marker.labelX} ${marker.labelY - 23}`} stroke={marker.color} strokeWidth="1.2" strokeOpacity="0.7" />
            <rect x={labelX} y={marker.labelY - 24} width={labelWidth} height="42" rx="11" fill="#111213" stroke={marker.color} strokeOpacity="0.35" />
            <text x={marker.labelX} y={marker.labelY - 7} fill="#FFFFFF" fontSize="11" textAnchor="middle" className="font-semibold">{marker.label}</text>
            <text x={marker.labelX} y={marker.labelY + 8} fill="#A7AAB0" fontSize="9" textAnchor="middle" className="font-medium">{marker.sublabel}</text>
          </g>
        )
      })}
    </svg>
  )
}


function BrandIcon({ name }: { name: "gmail" | "discord" | "slack" | "office" }) {
  if (name === "gmail") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
        <path d="M7 14.5C7 12.6 8.6 11 10.5 11h27c1.9 0 3.5 1.6 3.5 3.5v19c0 1.9-1.6 3.5-3.5 3.5h-27C8.6 37 7 35.4 7 33.5v-19Z" fill="#F2F2F2" />
        <path d="M10 14l14 10.5L38 14v6.4L24 31 10 20.4V14Z" fill="#EA4335" />
        <path d="M7 15.5 10 14v20H7V15.5Z" fill="#4285F4" />
        <path d="M41 15.5 38 14v20h3V15.5Z" fill="#34A853" />
        <path d="M10 14l14 10.5L38 14l-3.2-2.3L24 19.8 13.2 11.7 10 14Z" fill="#FBBC04" />
      </svg>
    )
  }

  if (name === "discord") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
        <rect x="6" y="8" width="36" height="32" rx="12" fill="#5865F2" />
        <path d="M17.4 19.2c4.2-1.5 8.6-1.5 13.2 0l1.8 10.6c-5.2 3.7-11.6 3.7-16.8 0l1.8-10.6Z" fill="white" />
        <circle cx="20.4" cy="26" r="1.8" fill="#5865F2" />
        <circle cx="27.6" cy="26" r="1.8" fill="#5865F2" />
        <path d="M20 31c2.5 1.1 5.5 1.1 8 0" stroke="#5865F2" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  if (name === "slack") {
    return (
      <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
        <rect x="10" y="20" width="8" height="18" rx="4" fill="#36C5F0" />
        <rect x="8" y="10" width="18" height="8" rx="4" fill="#2EB67D" />
        <rect x="30" y="10" width="8" height="18" rx="4" fill="#ECB22E" />
        <rect x="22" y="30" width="18" height="8" rx="4" fill="#E01E5A" />
        <rect x="20" y="20" width="8" height="8" rx="3" fill="#111213" opacity="0.18" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 48 48" className="h-10 w-10" aria-hidden="true">
      <defs>
        <linearGradient id="officeGradient" x1="8" x2="40" y1="9" y2="39">
          <stop stopColor="#F25022" />
          <stop offset="0.52" stopColor="#7FBA00" />
          <stop offset="1" stopColor="#00A4EF" />
        </linearGradient>
      </defs>
      <path d="M10 16.5 25 9l13 6.5v17L25 40l-15-7.5v-16Z" fill="url(#officeGradient)" />
      <path d="M25 15.2 16 19.7v8.6l9 4.5 8-4.6v-8.4l-8-4.6Z" fill="#181818" opacity="0.22" />
      <path d="M25 15.2v17.6" stroke="white" strokeOpacity="0.8" strokeWidth="2" />
    </svg>
  )
}

function OneAgentSection() {
  const modes = [
    { icon: "gmail" as const, title: "Productivity", prompt: "Please send an email to Jason about the meeting" },
    { icon: "discord" as const, title: "Gaming", prompt: "Create a Discord landing page for my esports clan" },
    { icon: "slack" as const, title: "Business", prompt: "Build a polished service website for my consulting studio" },
    { icon: "office" as const, title: "Office", prompt: "Generate a team dashboard for tasks, docs, and reports" },
  ]

  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="One Agent" title="One agent for all needs" subtitle="From productivity to gaming — a single AI agent that adapts to your workflow." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {modes.map(m => (
          <div
            key={m.title}
            className="group min-h-[220px] rounded-[28px] p-7 transition-transform duration-200 hover:-translate-y-1 sm:p-8"
            style={{
              background: "linear-gradient(180deg, rgba(255,255,255,0.035), rgba(255,255,255,0.012))",
              boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.07)",
            }}
          >
            <div className="flex items-center gap-4">
              <BrandIcon name={m.icon} />
              <h3 className="text-2xl font-extrabold tracking-[-0.02em] text-white sm:text-3xl">{m.title}</h3>
            </div>
            <div className="flex min-h-[120px] items-center justify-center px-2 text-center">
              <p className="text-[clamp(22px,4vw,34px)] font-extrabold leading-[1.18] tracking-[-0.025em] text-white">
                “{m.prompt}”
              </p>
            </div>
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

function AlphaBadge({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/releases"
      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-medium tracking-wide backdrop-blur-md transition-all hover:border-white/25 ${className}`}
      style={{
        borderColor: "rgba(255,255,255,0.1)",
        backgroundColor: "rgba(24,24,24,0.72)",
        color: MUTED,
      }}
    >
      <span className="relative flex h-1.5 w-1.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-400" />
      </span>
      v0.1 Private alpha
    </Link>
  )
}
