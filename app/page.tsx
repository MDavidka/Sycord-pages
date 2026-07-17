"use client"

import Image from "next/image"
import Link from "next/link"
import { HeroSection } from "@/components/HeroSection"
import { Button } from "@/components/ui/button"
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import {
  ArrowRight, Briefcase, CheckCircle2, ChevronRight, Cloud, Database, Globe,
  LayoutTemplate, Lock, MousePointerClick, Palette, Rocket, Server, ShieldCheck,
  ShoppingBag, Smartphone, Sparkles, Star, TrendingUp, User, Wand2, Zap,
} from "lucide-react"

export default function LandingPage() {
  return (
    <main className="min-h-screen w-full bg-[#18191B] text-white" style={{ fontFamily: "'Inter', sans-serif" }}>
      <HeroSection />
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
        {items.map(it => (
          <div key={it.label} className="inline-flex items-center gap-2 rounded-full border border-[#2a2c30] bg-[#18191B] px-3.5 py-2 text-xs font-medium text-[#E5E7EB] sm:text-sm">
            <span className="text-[#A7AAB0]">{it.icon}</span>{it.label}
          </div>
        ))}
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { n: "01", icon: <Wand2 className="h-5 w-5" />, title: "Describe your site", body: "Tell Sycord what you need in plain language — purpose, style, content.", illo: <IlloPrompt /> },
    { n: "02", icon: <Sparkles className="h-5 w-5" />, title: "AI builds it instantly", body: "Pages, sections, copy, and layout are generated and ready to edit.", illo: <IlloBuild /> },
    { n: "03", icon: <Rocket className="h-5 w-5" />, title: "Publish on fast hosting", body: "One click ships your site to a global CDN with SSL and your domain.", illo: <IlloDeploy /> },
  ]
  return (
    <section id="showcase" className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="How it works" title="Launch in minutes" subtitle="Generate, customize, and publish your site with AI-powered hosting." />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map(s => (
          <div key={s.n} className="flex flex-col rounded-3xl border border-[#2a2c30] bg-[#18191B] p-6 transition-colors hover:bg-[#212327]">
            <div className="mb-5 overflow-hidden rounded-2xl border border-[#2a2c30] bg-[#111213]">{s.illo}</div>
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#2a2c30] bg-[#18191B] text-white">{s.icon}</span>
              <span className="text-xs font-semibold tracking-widest text-[#A7AAB0]">{s.n}</span>
            </div>
            <h3 className="mt-5 text-lg font-semibold text-white">{s.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#A7AAB0]">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function IlloPrompt() {
  return (
    <div aria-hidden="true" className="flex aspect-[16/9] w-full flex-col justify-center gap-3 p-5">
      <div className="inline-flex max-w-[85%] flex-col gap-1.5 self-end rounded-2xl rounded-br-md bg-white px-3.5 py-2.5">
        <div className="h-1.5 w-28 rounded-full bg-black/70" />
        <div className="h-1.5 w-20 rounded-full bg-black/40" />
      </div>
      <div className="flex items-center gap-2.5 rounded-2xl border border-[#2a2c30] bg-[#18191B] px-3.5 py-3">
        <div className="h-1.5 w-24 rounded-full bg-white/20" />
        <div className="h-3.5 w-0.5 animate-pulse rounded bg-white/70" />
        <div className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-white">
          <ArrowRight className="h-3.5 w-3.5 text-black" />
        </div>
      </div>
    </div>
  )
}

function IlloBuild() {
  return (
    <div aria-hidden="true" className="flex aspect-[16/9] w-full items-center justify-center p-5">
      <div className="w-full max-w-[220px] overflow-hidden rounded-xl border border-[#2a2c30] bg-[#18191B]">
        <div className="flex items-center gap-1.5 border-b border-[#2a2c30] px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-[#2a2c30]" />
          <span className="h-2 w-2 rounded-full bg-[#2a2c30]" />
          <span className="h-2 w-2 rounded-full bg-[#2a2c30]" />
        </div>
        <div className="space-y-2 p-3">
          <div className="h-8 rounded-lg border border-dashed border-[#7C6FF5]/50 bg-[#7C6FF5]/10" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-6 rounded-lg bg-[#26272b]" />
            <div className="h-6 rounded-lg bg-[#26272b]" />
            <div className="h-6 rounded-lg border border-dashed border-white/25 bg-white/5" />
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 shrink-0 text-[#7C6FF5]" />
            <div className="h-1.5 w-20 rounded-full bg-[#7C6FF5]/50" />
          </div>
        </div>
      </div>
    </div>
  )
}

function IlloDeploy() {
  return (
    <div aria-hidden="true" className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-3 p-5">
      <div className="flex w-full max-w-[220px] items-center gap-2 rounded-full border border-[#2a2c30] bg-[#18191B] px-3.5 py-2.5">
        <Lock className="h-3 w-3 shrink-0 text-emerald-400" />
        <span className="text-[11px] font-medium text-[#E5E7EB]">yoursite.com</span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">Live</span>
        </span>
      </div>
      <div className="flex items-center gap-2 text-[#A7AAB0]">
        <Globe className="h-3.5 w-3.5" />
        <div className="flex items-center gap-1">
          {[0, 1, 2, 3, 4].map(i => (
            <span key={i} className="h-1 rounded-full bg-white/25" style={{ width: 14 + (i % 3) * 8 }} />
          ))}
        </div>
        <Zap className="h-3.5 w-3.5 text-[#7C6FF5]" />
      </div>
    </div>
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
        {features.map(f => <FeatureCard key={f.title} {...f} />)}
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
        {features.map(f => <FeatureCard key={f.title} {...f} />)}
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
        {items.map(t => (
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
    { name: "Starter", price: "Free", tagline: "For trying things out", features: ["10 AI generation credits", "Hosting included", "Free SSL", "Sycord subdomain"], cta: "Start for free", highlighted: false, illo: <IlloPlanStarter /> },
    { name: "Pro", price: "$19", period: "/mo", tagline: "For makers and small teams", features: ["200 AI generation credits", "Custom domain", "Free SSL", "Analytics", "Email support"], cta: "Start Pro", highlighted: true, illo: <IlloPlanPro /> },
    { name: "Business", price: "$49", period: "/mo", tagline: "For growing companies", features: ["Unlimited AI generations", "Multiple custom domains", "Free SSL", "Advanced analytics", "Priority support"], cta: "Start Business", highlighted: false, illo: <IlloPlanBusiness /> },
  ]
  return (
    <section id="pricing" className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Pricing" title="Simple, transparent pricing" subtitle="Start free. Scale when you're ready." />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map(p => (
          <div key={p.name} className={`flex flex-col rounded-3xl border p-6 transition-colors ${p.highlighted ? "border-white/20 bg-[#18191B] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] lg:scale-[1.02]" : "border-[#2a2c30] bg-[#18191B] hover:bg-[#212327]"}`}>
            <div className="mb-5 overflow-hidden rounded-2xl border border-[#2a2c30] bg-[#111213]">{p.illo}</div>
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
              {p.features.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" /><span>{f}</span>
                </li>
              ))}
            </ul>
            <Button
              asChild
              variant={p.highlighted ? "default" : "outline"}
              className={`mt-6 rounded-xl ${p.highlighted ? "bg-white text-black hover:bg-white/90" : "border-[#2a2c30] bg-transparent text-white hover:bg-[#212327] hover:text-white"}`}
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
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-[#2a2c30] bg-[#18191B]">
          <Wand2 className="h-5 w-5 text-white" />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex items-center gap-2 rounded-full border border-[#2a2c30] bg-[#18191B] px-3 py-1.5">
            <span className="text-[10px] font-medium text-[#A7AAB0]">you.sycord.app</span>
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
        <div className="flex items-center gap-2 rounded-full border border-white/20 bg-[#18191B] px-3 py-1.5">
          <Lock className="h-3 w-3 shrink-0 text-emerald-400" />
          <span className="text-[10px] font-semibold text-white">yourdomain.com</span>
          <TrendingUp className="ml-auto h-3 w-3 shrink-0 text-[#7C6FF5]" />
        </div>
        <div className="flex items-end gap-1.5 rounded-xl border border-[#2a2c30] bg-[#18191B] px-3 pb-2 pt-3">
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
        <div className="absolute left-3 top-1/2 w-[85%] -translate-y-[30%] rounded-xl border border-[#2a2c30] bg-[#1c1d20] px-3 py-2 opacity-60">
          <div className="h-1.5 w-16 rounded-full bg-white/20" />
        </div>
        <div className="absolute left-1.5 top-1/2 w-[90%] -translate-y-[55%] rounded-xl border border-[#2a2c30] bg-[#1e1f23] px-3 py-2 opacity-80">
          <div className="h-1.5 w-20 rounded-full bg-white/25" />
        </div>
        <div className="absolute left-0 top-1/2 flex w-[95%] -translate-y-[80%] items-center gap-2 rounded-xl border border-white/20 bg-[#232428] px-3 py-2">
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
      <div className="overflow-hidden rounded-[36px] border border-[#2a2c30] bg-[#18191B] p-10 text-center sm:rounded-[55px] sm:p-16" style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.05) 1.4px, transparent 1.4px)", backgroundSize: "26px 26px" }}>
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>Launch your site with AI</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#A7AAB0] sm:text-lg">Build, host, and publish from one powerful platform.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="rounded-xl bg-white text-black hover:bg-white/90">
            <Link href="/login">Start for free <ArrowRight className="ml-1 h-4 w-4" /></Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl border-[#2a2c30] bg-transparent text-white hover:bg-[#212327] hover:text-white">
            <Link href="#showcase">See demo</Link>
          </Button>
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
          {cols.map(c => (
            <div key={c.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">{c.title}</div>
              <ul className="mt-4 space-y-2 text-sm">
                {c.links.map(l => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-[#E5E7EB] transition-colors duration-150 hover:text-white">{l.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 h-[2px] w-full rounded-full bg-white/10" />
        <div className="mt-6 flex flex-col items-start justify-between gap-4 text-xs text-[#A7AAB0] sm:flex-row sm:items-center">
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
      <span className="inline-flex items-center rounded-full border border-[#2a2c30] bg-[#18191B] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#A7AAB0]">{eyebrow}</span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>{title}</h2>
      <p className="mt-3 text-base text-[#A7AAB0]">{subtitle}</p>
    </div>
  )
}
