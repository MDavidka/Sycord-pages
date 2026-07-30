"use client"

import type React from "react"
import { useRef, useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { motion, useScroll, useTransform } from "framer-motion"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/status-badge"
import {
  ArrowRight,
  BriefcaseBusiness,
  Check,
  Code2,
  Gamepad2,
  Globe2,
  Laptop2,
  MapPin,
  Phone,
  Rocket,
  Server,
  ShieldCheck,
  Sparkles,
  Terminal,
  WandSparkles,
  Zap,
} from "lucide-react"

const BG = "#181818"
const BORDER = "#2a2c30"
const MUTED = "#A7AAB0"
const TEXT = "#E5E7EB"

const lanes = [
  {
    label: "Productivity",
    icon: <Zap className="size-4" />,
    title: "Turn the busywork into momentum.",
    copy: "Draft, organize, and ship the little things before they become the big things.",
    accent: "#f1c75b",
    tasks: ["Plan the week", "Summarize research", "Write the first draft"],
  },
  {
    label: "Business",
    icon: <BriefcaseBusiness className="size-4" />,
    title: "Make a sharp business presence.",
    copy: "From first idea to a polished site, one agent keeps the whole launch moving.",
    accent: "#86d6b5",
    tasks: ["Shape the offer", "Build the landing page", "Publish the update"],
  },
  {
    label: "Gaming",
    icon: <Gamepad2 className="size-4" />,
    title: "Build worlds worth coming back to.",
    copy: "Create community hubs, launch pages, and playful experiments without breaking flow.",
    accent: "#b9a5ff",
    tasks: ["Sketch the world", "Create the showcase", "Share with your squad"],
  },
  {
    label: "Office",
    icon: <Laptop2 className="size-4" />,
    title: "Give every team a better starting point.",
    copy: "A calm, capable agent for docs, internal tools, and the work between meetings.",
    accent: "#83b9ed",
    tasks: ["Prepare the brief", "Polish the workspace", "Keep everyone aligned"],
  },
]

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full text-white" style={{ fontFamily: "'Inter', sans-serif", backgroundColor: BG }}>
      <Hero />
      <TrustStrip />
      <GlobalNetwork />
      <UseCases />
      <AgentWorkflow />
      <FAQ />
      <FinalCTA />
      <Footer />
    </main>
  )
}

function HeroBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 opacity-35" style={{ WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 72%, transparent 100%)", maskImage: "linear-gradient(to bottom, transparent 0%, black 18%, black 72%, transparent 100%)" }}>
        <Image src="/hero-glass-bg.webp" alt="" fill priority sizes="100vw" className="object-cover object-[center_35%]" />
      </div>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 75% 55% at 50% 28%, rgba(124,111,245,0.16), transparent 72%), linear-gradient(to bottom, ${BG} 0%, rgba(24,24,24,0.52) 22%, transparent 58%, ${BG} 100%)` }} />
      <div className="absolute -left-24 top-28 h-72 w-72 rounded-full bg-[#7c6ff5]/10 blur-[100px]" />
      <div className="absolute -right-28 bottom-10 h-80 w-80 rounded-full bg-[#4bbd9a]/10 blur-[110px]" />
    </div>
  )
}

function HeroNav() {
  return (
    <header className="relative z-30 mx-auto flex w-full max-w-[1200px] shrink-0 items-center justify-between px-[max(1.25rem,env(safe-area-inset-left,0px))] pt-[calc(env(safe-area-inset-top,0px)+1.5rem)] sm:px-8 sm:pt-8 lg:px-10">
      <Link href="/" className="inline-flex items-center gap-2">
        <Image src="/logo.png" alt="Sycord" width={40} height={40} priority className="h-9 w-9 opacity-90 sm:h-10 sm:w-10" />
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/releases" className="hidden text-xs font-medium text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline sm:inline">
          0.1 Private alpha
        </Link>
        <Link href="/contact" className="inline-flex h-9 items-center gap-2 rounded-full border border-white/15 bg-black/25 px-4 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-black/45 sm:h-10 sm:px-5">
          <Phone className="size-4" strokeWidth={1.75} />
          inquiry
        </Link>
      </div>
    </header>
  )
}

function HeroCopyMobile({ className = "", style }: { className?: string; style?: React.ComponentProps<typeof motion.div>["style"] }) {
  return (
    <motion.div className={`relative z-20 mx-auto flex w-full max-w-[760px] flex-col items-center px-5 text-center ${className}`} style={style}>
      <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/50">The all-purpose AI agent</p>
      <h1 className="max-w-[350px] text-[clamp(40px,10vw,58px)] font-extrabold leading-[0.96] tracking-[-0.05em] text-white drop-shadow-[0_2px_24px_rgba(0,0,0,0.45)]">
        One agent.<br /><span className="text-white/55">Every direction.</span>
      </h1>
      <p className="mt-5 max-w-xs text-sm leading-relaxed text-white/65">Think it, build it, ship it — with an agent that keeps up.</p>
      <Button asChild size="sm" className="mt-6 h-11 min-w-[160px] rounded-full bg-white px-6 text-sm font-semibold text-[#0a0a0a] shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition-transform hover:scale-[1.03] hover:bg-white">
        <Link href="/login">Start for free <ArrowRight className="size-3.5" /></Link>
      </Button>
    </motion.div>
  )
}

function HeroDesktop() {
  return (
    <div className="relative z-20 mx-auto hidden h-full w-full max-w-[1240px] grid-cols-2 items-center gap-8 px-8 pb-8 pt-4 md:grid lg:gap-10 lg:px-10">
      <motion.div className="relative z-20 flex max-w-[560px] flex-col items-start text-left" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
        <p className="mb-5 text-[11px] font-semibold uppercase tracking-[0.3em] text-white/50">The all-purpose AI agent</p>
        <h1 className="text-[clamp(52px,6vw,80px)] font-extrabold leading-[0.96] tracking-[-0.055em] text-white">One agent.<br /><span className="text-white/50">Every direction.</span></h1>
        <p className="mt-6 max-w-[430px] text-[17px] leading-relaxed text-white/70 lg:text-[18px]">Think it, build it, ship it — with an agent that moves from idea to outcome with you.</p>
        <div className="mt-8 flex flex-wrap items-center gap-3 lg:mt-9">
          <Button asChild className="h-12 rounded-full bg-white px-7 text-[15px] font-semibold text-[#0a0a0a] shadow-[0_12px_36px_rgba(0,0,0,0.35)] transition-transform hover:scale-[1.03] hover:bg-white"><Link href="/login">Start for free <ArrowRight className="size-4" /></Link></Button>
          <Link href="/releases" className="px-3 text-sm font-medium text-white/55 underline-offset-4 transition-colors hover:text-white hover:underline">0.1 Private alpha</Link>
        </div>
      </motion.div>

      <motion.div className="relative hidden h-full min-h-0 md:block" initial={{ opacity: 0, x: 36 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.12, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}>
        <div className="absolute -bottom-[12%] -right-[14%] top-[4%] w-[min(118%,580px)] lg:-right-[10%] lg:top-0 lg:w-[min(115%,600px)]">
          <Image src="/hero-phone.webp" alt="Syra coding agent on phone" width={880} height={1780} priority sizes="(min-width: 1024px) 600px, 50vw" className="h-full w-full object-cover object-top drop-shadow-[0_40px_80px_rgba(0,0,0,0.55)]" style={{ borderRadius: "48px" }} />
        </div>
      </motion.div>
    </div>
  )
}

function Hero() {
  const trackRef = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: trackRef, offset: ["start start", "end end"] })
  const phoneY = useTransform(scrollYProgress, [0, 0.34, 0.58, 0.78], ["40vh", "0vh", "0vh", "-8vh"])
  const phoneOpacity = useTransform(scrollYProgress, [0, 0.56, 0.74, 0.88], [1, 1, 0.55, 0])
  const phoneScale = useTransform(scrollYProgress, [0, 0.34, 0.78], [0.9, 1, 0.96])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.2, 0.4], [1, 0.55, 0])
  const copyY = useTransform(scrollYProgress, [0, 0.4], [0, -40])
  const stageOpacity = useTransform(scrollYProgress, [0.74, 0.94], [1, 0])
  const storyOpacity = useTransform(scrollYProgress, [0.55, 0.7, 0.9], [0, 1, 0])

  return (
    <section ref={trackRef} className="relative h-[145svh] w-full md:h-[100svh] md:min-h-[600px]" style={{ backgroundColor: BG }}>
      <div className="sticky top-0 h-[100svh] overflow-hidden md:relative md:h-full">
        <div className="absolute inset-0 hidden md:block"><HeroBackground /></div>
        <motion.div className="absolute inset-0 md:hidden" style={{ opacity: stageOpacity }}><HeroBackground /></motion.div>
        <div className="relative z-20 flex h-full flex-col">
          <HeroNav />
          <HeroCopyMobile className="pt-[clamp(56px,12vh,120px)] md:hidden" style={{ opacity: copyOpacity, y: copyY }} />
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center md:hidden">
            <motion.div style={{ y: phoneY, opacity: phoneOpacity, scale: phoneScale }} className="w-[min(78vw,320px)] transform-gpu will-change-transform">
              <Image src="/hero-phone.webp" alt="Syra coding agent on phone" width={880} height={1780} priority sizes="80vw" className="h-auto w-full rounded-[36px] shadow-[0_24px_60px_rgba(0,0,0,0.55)]" />
            </motion.div>
          </div>
          <motion.div style={{ opacity: storyOpacity }} className="pointer-events-none absolute inset-x-5 bottom-[9%] z-20 text-center md:hidden">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/45">More than a chat box</p>
            <p className="mx-auto mt-3 max-w-[280px] text-xl font-semibold leading-tight tracking-[-0.03em] text-white">From your next task to your next launch.</p>
          </motion.div>
          <div className="relative hidden min-h-0 flex-1 md:block"><HeroDesktop /></div>
        </div>
      </div>
    </section>
  )
}

function TrustStrip() {
  const items = [
    { icon: <Sparkles className="size-3.5" />, label: "AI site generation" },
    { icon: <Zap className="size-3.5" />, label: "Fast hosting" },
    { icon: <ShieldCheck className="size-3.5" />, label: "Free SSL" },
    { icon: <Rocket className="size-3.5" />, label: "One-click publish" },
    { icon: <Globe2 className="size-3.5" />, label: "Global reach" },
  ]
  return <section className="mx-auto w-full max-w-6xl px-5 pt-16 sm:px-8 sm:pt-20"><div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">{items.map((item) => <div key={item.label} className="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium sm:text-sm" style={{ borderColor: BORDER, backgroundColor: BG, color: TEXT }}><span className="text-white/55">{item.icon}</span>{item.label}</div>)}</div></section>
}

function GlobalNetwork() {
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="grid overflow-hidden rounded-[32px] border bg-[#1c1d21] lg:grid-cols-[0.82fr_1.18fr]" style={{ borderColor: BORDER }}>
        <div className="flex flex-col justify-between p-7 sm:p-10 lg:p-12">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/45">Always within reach</span>
            <h2 className="mt-5 max-w-md text-3xl font-extrabold leading-[1.02] tracking-[-0.04em] text-white sm:text-5xl">One agent, wherever the work takes you.</h2>
            <p className="mt-5 max-w-md text-base leading-relaxed text-white/55">Your projects move fast. Our infrastructure follows with three ready locations and a calm, clear status view.</p>
          </div>
          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3 text-sm text-white/60"><StatusBadge /><Link href="/servers" className="inline-flex items-center gap-1.5 text-white/40 underline-offset-4 hover:text-white hover:underline"><Server className="size-3.5" /> Explore servers <ArrowRight className="size-3" /></Link></div>
        </div>
        <WorldIllustration />
      </div>
    </section>
  )
}

function WorldIllustration() {
  const locations = [
    { name: "Virginia", x: 178, y: 156, detail: "US East" },
    { name: "Amsterdam", x: 415, y: 111, detail: "EU West" },
    { name: "Singapore", x: 598, y: 248, detail: "AP Southeast" },
  ]
  return (
    <div className="relative min-h-[330px] overflow-hidden border-t border-white/[0.06] bg-[radial-gradient(circle_at_50%_42%,rgba(124,111,245,0.14),transparent_58%)] lg:min-h-[440px] lg:border-l lg:border-t-0">
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)", backgroundSize: "42px 42px" }} />
      <svg viewBox="0 0 760 400" className="absolute inset-0 h-full w-full" aria-label="World map showing Sycord server locations" role="img">
        <defs><linearGradient id="continent" x1="0" x2="1" y1="0" y2="1"><stop stopColor="#69708b" stopOpacity=".46" /><stop offset="1" stopColor="#353b55" stopOpacity=".12" /></linearGradient><filter id="glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
        <g fill="url(#continent)" stroke="#a8afd0" strokeOpacity=".18" strokeWidth="1">
          <path d="M82 102 116 77 168 71 198 89 224 92 243 125 224 146 209 178 179 179 159 158 128 162 109 141 87 135 69 116Z" />
          <path d="M246 187 273 201 287 232 278 262 294 297 277 332 253 318 249 286 233 262 238 230 221 210Z" />
          <path d="M346 95 378 72 420 74 437 90 473 94 493 119 475 141 448 142 427 157 397 148 374 128 350 126 332 109Z" />
          <path d="M443 165 475 153 509 167 532 195 553 208 548 238 518 245 498 229 478 236 458 214 438 205Z" />
          <path d="M555 118 591 107 633 120 671 144 691 173 672 190 643 182 625 202 591 188 575 163 548 151Z" />
          <path d="M634 264 675 263 699 281 687 300 654 301 632 286Z" />
        </g>
        <path d="M178 156 Q295 73 415 111 T598 248" fill="none" stroke="#9b91ff" strokeDasharray="5 8" strokeOpacity=".4" />
        {locations.map((location) => <g key={location.name} filter="url(#glow)"><circle cx={location.x} cy={location.y} r="18" fill="#9b91ff" fillOpacity=".09" /><circle cx={location.x} cy={location.y} r="5" fill="#c3baff" /><circle cx={location.x} cy={location.y} r="2" fill="white" /></g>)}
      </svg>
      <div className="absolute inset-x-5 bottom-5 flex flex-wrap justify-between gap-3 sm:inset-x-8 sm:bottom-8">{locations.map((location) => <div key={location.name} className="flex items-center gap-2 text-xs text-white/70"><span className="h-1.5 w-1.5 rounded-full bg-[#a79cff] shadow-[0_0_12px_#a79cff]" /><span>{location.name}</span><span className="text-white/30">{location.detail}</span></div>)}</div>
    </div>
  )
}

function UseCases() {
  const [active, setActive] = useState(0)
  const lane = lanes[active]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <div className="mx-auto max-w-2xl text-center"><span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/45">Made for the whole day</span><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-5xl">Your work has more than one mode.</h2><p className="mt-4 text-base text-white/55">Keep one capable agent close, whether you are deep in focus or making something fun.</p></div>
      <div className="mt-10 rounded-[32px] border p-2 sm:p-3" style={{ borderColor: BORDER, backgroundColor: "#1c1d21" }}>
        <div className="grid grid-cols-2 gap-1 md:grid-cols-4">{lanes.map((item, index) => <button key={item.label} type="button" onClick={() => setActive(index)} className={`flex items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors sm:py-4 ${index === active ? "bg-white text-black" : "text-white/45 hover:bg-white/[0.04] hover:text-white"}`}>{item.icon}<span>{item.label}</span></button>)}</div>
        <motion.div key={lane.label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="grid gap-8 px-5 pb-5 pt-10 sm:px-8 sm:pb-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-12 lg:py-14">
          <div><div className="mb-5 flex items-center gap-2 text-sm font-medium" style={{ color: lane.accent }}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: lane.accent }} /> {lane.label} mode</div><h3 className="max-w-lg text-3xl font-bold leading-tight tracking-[-0.035em] text-white sm:text-4xl">{lane.title}</h3><p className="mt-4 max-w-md text-base leading-relaxed text-white/55">{lane.copy}</p><Link href="/login" className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-white underline-offset-4 hover:underline">Try it free <ArrowRight className="size-4" /></Link></div>
          <div className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-[#151619] p-5 sm:p-7"><div className="absolute -right-14 -top-14 h-40 w-40 rounded-full opacity-20 blur-3xl" style={{ backgroundColor: lane.accent }} /><div className="relative flex items-center justify-between border-b border-white/[0.08] pb-4"><div className="flex items-center gap-2 text-sm font-semibold text-white"><WandSparkles className="size-4" style={{ color: lane.accent }} /> Syra workspace</div><span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-emerald-300/80"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Ready</span></div><div className="relative mt-5 space-y-3">{lane.tasks.map((task, index) => <div key={task} className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3 text-sm text-white/75"><span className="flex h-6 w-6 items-center justify-center rounded-lg text-xs font-bold text-black" style={{ backgroundColor: index === 0 ? lane.accent : `${lane.accent}55` }}>{index + 1}</span>{task}<Check className="ml-auto size-4 text-white/35" /></div>)}</div></div>
        </motion.div>
      </div>
    </section>
  )
}

function AgentWorkflow() {
  const steps = [
    { icon: <Terminal className="size-5" />, title: "Start with a thought", copy: "Describe the outcome, not the perfect prompt." },
    { icon: <Code2 className="size-5" />, title: "Shape it together", copy: "Refine the work in a live, responsive workspace." },
    { icon: <Rocket className="size-5" />, title: "Send it into the world", copy: "Publish with hosting, SSL, and status built in." },
  ]
  return <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32"><div className="grid gap-10 rounded-[32px] border p-7 sm:p-10 lg:grid-cols-[0.75fr_1.25fr] lg:items-center lg:p-14" style={{ borderColor: BORDER, backgroundColor: "#1b1c20" }}><div><span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/45">A simpler loop</span><h2 className="mt-4 max-w-md text-3xl font-extrabold leading-tight tracking-[-0.04em] text-white sm:text-5xl">Less setup.<br /><span className="text-white/45">More making.</span></h2></div><div className="space-y-3">{steps.map((step, index) => <div key={step.title} className="flex gap-4 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 sm:p-5"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.07] text-white">{step.icon}</div><div><div className="flex items-center gap-2 text-sm font-semibold text-white"><span className="text-white/35">0{index + 1}</span>{step.title}</div><p className="mt-1 text-sm leading-relaxed text-white/45">{step.copy}</p></div></div>)}</div></div></section>
}

function FAQ() {
  const faqs = [
    { q: "What can Syra help me make?", a: "Syra can help with websites, internal tools, launch pages, documents, research, and the everyday work that connects them." },
    { q: "Is hosting included?", a: "Yes. Publish with global hosting, free SSL, and a Sycord subdomain included." },
    { q: "Can I edit the work myself?", a: "Absolutely. Keep the conversation going or jump into the responsive workspace and shape every detail." },
    { q: "Is it mobile responsive?", a: "Yes. Sycord tunes layouts for mobile, tablet, and desktop as part of the build." },
  ]
  const [open, setOpen] = useState<number | null>(null)
  return <section className="mx-auto w-full max-w-3xl px-5 pt-24 sm:px-8 sm:pt-32"><div className="mx-auto max-w-2xl text-center"><span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/45">FAQ</span><h2 className="mt-4 text-3xl font-extrabold tracking-[-0.035em] text-white sm:text-4xl">A few useful answers.</h2></div><div className="mt-8 overflow-hidden rounded-3xl border" style={{ borderColor: BORDER, backgroundColor: "#1b1c20" }}>{faqs.map((faq, index) => <div key={faq.q} className="border-b last:border-b-0" style={{ borderColor: BORDER }}><button type="button" onClick={() => setOpen(open === index ? null : index)} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left text-base font-semibold text-white"><span>{faq.q}</span><span className={`text-xl font-normal text-white/35 transition-transform ${open === index ? "rotate-45" : ""}`}>+</span></button>{open === index && <p className="px-5 pb-5 text-sm leading-relaxed text-white/50">{faq.a}</p>}</div>)}</div></section>
}

function FinalCTA() {
  return <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32"><div className="relative overflow-hidden rounded-[36px] border p-10 text-center sm:rounded-[55px] sm:p-16" style={{ borderColor: BORDER, backgroundColor: "#1c1d21" }}><div className="pointer-events-none absolute inset-0 opacity-50" style={{ background: "radial-gradient(circle at 50% 0%, rgba(124,111,245,0.25), transparent 55%)" }} /><div className="relative"><p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-white/45">Your next direction starts here</p><h2 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold tracking-[-0.04em] text-white sm:text-5xl">Make something that moves.</h2><p className="mx-auto mt-4 max-w-xl text-base sm:text-lg" style={{ color: MUTED }}>Build, host, and publish from one calm, capable workspace.</p><div className="mt-8 flex flex-wrap items-center justify-center gap-3"><Button asChild className="rounded-xl bg-white text-black hover:bg-white/90"><Link href="/login">Start for free <ArrowRight className="ml-1 size-4" /></Link></Button><Link href="/servers" className="inline-flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white/55 transition-colors hover:text-white"><MapPin className="size-4" /> See the infrastructure</Link></div></div></div></section>
}

function Footer() {
  const cols = [
    { title: "Product", links: [{ label: "Servers", href: "/servers" }, { label: "Versions", href: "/releases" }, { label: "Contact", href: "/contact" }] },
    { title: "Explore", links: [{ label: "About", href: "/about" }, { label: "Status", href: "/servers" }, { label: "Business report", href: "/business-report" }] },
    { title: "Support", links: [{ label: "Terms", href: "/tos" }, { label: "Privacy", href: "/pap" }, { label: "Get started", href: "/login" }] },
  ]
  return <footer className="mx-auto mt-24 w-full max-w-6xl px-5 pb-12 sm:mt-32 sm:px-8"><div className="rounded-3xl border p-8 sm:p-10" style={{ borderColor: BORDER, backgroundColor: "#1b1c20" }}><div className="grid gap-8 lg:grid-cols-5"><div className="lg:col-span-2"><div className="flex items-center gap-2"><Image src="/logo.png" alt="Sycord" width={28} height={28} className="opacity-90" /><span className="text-base font-semibold text-white">Sycord</span></div><p className="mt-3 max-w-sm text-sm leading-relaxed" style={{ color: MUTED }}>One capable agent for the work, ideas, and launches that make up your day.</p><Link href="/releases" className="mt-5 inline-block text-xs text-white/45 underline-offset-4 hover:text-white hover:underline">0.1 Private alpha</Link></div>{cols.map((column) => <div key={column.title}><div className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>{column.title}</div><ul className="mt-4 space-y-2 text-sm">{column.links.map((link) => <li key={link.label}><Link href={link.href} className="transition-colors duration-150 hover:text-white" style={{ color: TEXT }}>{link.label}</Link></li>)}</ul></div>)}</div><div className="mt-10 h-px w-full rounded-full bg-white/10" /><div className="mt-6 flex flex-col items-start justify-between gap-4 text-xs sm:flex-row sm:items-center" style={{ color: MUTED }}><span>© {new Date().getFullYear()} Sycord. All rights reserved.</span><span>Built for the next direction.</span></div></div></footer>
}
