"use client"

import Link from "next/link"
import Image from "next/image"
import { useEffect, useRef, useState, useCallback } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Check, Zap, Sparkles } from "lucide-react"

/* ─────────────────────── Scroll hooks ─────────────────────── */

/** Scroll-driven parallax value (0→1 over the element's visible travel) */
function useScrollProgress() {
  const ref = useRef<HTMLDivElement>(null)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      const rect = el.getBoundingClientRect()
      const vh = window.innerHeight
      // 0 when bottom enters viewport, 1 when top leaves
      const raw = 1 - rect.top / vh
      setProgress(Math.max(0, Math.min(1, raw)))
    }
    window.addEventListener("scroll", onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return { ref, progress }
}

/** Intersection-observer reveal (fires once) */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("scroll-visible")
          observer.unobserve(el)
        }
      },
      { threshold }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [threshold])
  return ref
}

function RevealSection({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) {
  const ref = useScrollReveal()
  return (
    <section ref={ref} id={id} className={`scroll-hidden ${className}`}>
      {children}
    </section>
  )
}

/** Horizontal carousel active-card tracker */
function useCarouselIndex(count: number) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onScroll = () => {
      const viewportCenter = el.scrollLeft + el.clientWidth / 2
      const cards = el.querySelectorAll("[data-carousel-card]")
      let closestIdx = 0
      let closestDist = Infinity
      cards.forEach((card, i) => {
        const cardEl = card as HTMLElement
        const cardCenter = cardEl.offsetLeft + cardEl.offsetWidth / 2
        const dist = Math.abs(viewportCenter - cardCenter)
        if (dist < closestDist) { closestDist = dist; closestIdx = i }
      })
      setActiveIndex(closestIdx)
    }
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => el.removeEventListener("scroll", onScroll)
  }, [count])

  return { scrollRef, activeIndex }
}

/** Hook for continuous scroll-linked opacity / transform (Apple-style) */
function useParallaxOnScroll() {
  const ref = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    const el = ref.current
    if (!el) return
    
    const onScroll = () => {
      const scrollY = window.scrollY
      const vh = window.innerHeight
      // Fade the hero heading as user scrolls
      const heroText = el.querySelector("[data-hero-text]") as HTMLElement
      const heroSub = el.querySelector("[data-hero-sub]") as HTMLElement
      const heroCta = el.querySelector("[data-hero-cta]") as HTMLElement

      if (heroText) {
        const fade = Math.max(0, 1 - scrollY / (vh * 0.45))
        const yShift = scrollY * 0.25
        heroText.style.opacity = `${fade}`
        heroText.style.transform = `translateY(${yShift}px)`
      }
      if (heroSub) {
        const fade = Math.max(0, 1 - scrollY / (vh * 0.4))
        const yShift = scrollY * 0.18
        heroSub.style.opacity = `${fade}`
        heroSub.style.transform = `translateY(${yShift}px)`
      }
      if (heroCta) {
        const fade = Math.max(0, 1 - scrollY / (vh * 0.35))
        const yShift = scrollY * 0.12
        heroCta.style.opacity = `${fade}`
        heroCta.style.transform = `translateY(${yShift}px)`
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return ref
}

/* ─── Sparkle icon (4-point star from the screenshot) ─── */
function SparkleIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L14.09 8.26L20 12L14.09 15.74L12 22L9.91 15.74L4 12L9.91 8.26L12 2Z" />
    </svg>
  )
}

/* ═══════════════════════════ MAIN PAGE ═══════════════════════════ */

export default function LandingPage() {
  const { data: session } = useSession()
  const parallaxRef = useParallaxOnScroll()
  const { ref: cardsProgressRef, progress: cardsProgress } = useScrollProgress()

  const featureImages = [
    {
      src: "https://github.com/user-attachments/assets/6f4659c9-0989-47c0-b282-731ae5961df7",
      alt: "Best AI model on the market — Gemini 3.1",
    },
    {
      src: "https://github.com/user-attachments/assets/95665e35-5f9c-4a6d-9255-8a5b9dfd5d01",
      alt: "Share it! better with friend",
    },
    {
      src: "https://github.com/user-attachments/assets/9c1a2ed9-1179-4e69-9c24-40058dc0e53d",
      alt: "building never been this easy",
    },
  ]
  const { scrollRef: featuresScrollRef, activeIndex: featuresActiveIndex } = useCarouselIndex(featureImages.length)

  // User initials for the avatar pill
  const userInitial = session?.user?.name?.[0]?.toUpperCase() || ""

  return (
    <div className="min-h-screen bg-[#0A0A0A] flex flex-col items-center overflow-x-hidden font-sans">

      {/* ─────────── Header ─────────── */}
      <header className="flex w-full px-5 md:px-8 py-4 items-center justify-between z-30 sticky top-0 frosted-header">
        <Link href="/" className="flex items-center gap-2">
          <Image src="/logo.png" alt="Sycord" width={30} height={30} className="opacity-80" priority />
        </Link>

        {/* Right side: user pill or login */}
        {session?.user ? (
          <Link href="/dashboard" className="flex items-center gap-2 bg-[#1C1C1E] hover:bg-[#252527] border border-white/[0.06] rounded-full pl-4 pr-1.5 py-1.5 transition-colors">
            <span className="text-white/50 text-xs font-medium hidden sm:inline">{session.user.name?.split(" ")[0]}</span>
            <Avatar className="h-7 w-7">
              <AvatarImage src={session.user.image || ""} />
              <AvatarFallback className="bg-[#2A2A2C] text-white text-xs font-semibold">{userInitial}</AvatarFallback>
            </Avatar>
          </Link>
        ) : (
          <Button asChild className="bg-white text-[#0A0A0A] hover:bg-white/90 text-xs font-semibold px-5 h-8 rounded-full">
            <Link href="/login">Sign in</Link>
          </Button>
        )}
      </header>

      {/* ─────────── Main ─────────── */}
      <main className="w-full flex-1 flex flex-col" ref={parallaxRef}>

        {/* ── HERO — black→navy gradient, Apple-style parallax ── */}
        <section className="relative w-full min-h-[100svh] flex flex-col items-center justify-center px-6">
          {/* Background gradient: black top → dark navy bottom */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A0A0A] via-[#080C14] to-[#0A1628] z-0" />

          {/* Hero content */}
          <div className="relative z-10 flex flex-col items-center text-center max-w-2xl mx-auto -mt-16">
            <h1
              data-hero-text
              className="text-[clamp(2rem,8vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-white mb-3 will-change-transform"
            >
              Build your project
            </h1>

            <div
              data-hero-sub
              className="flex items-center gap-2.5 mb-8 will-change-transform"
            >
              <span className="text-[clamp(1.5rem,5vw,2.25rem)] font-medium text-white/40">with</span>
              <SparkleIcon className="w-6 h-6 md:w-7 md:h-7 text-white/30" />
              <span className="text-[clamp(1.5rem,5vw,2.25rem)] font-medium text-white/40">syra</span>
            </div>

            <div data-hero-cta className="will-change-transform">
              <Button
                asChild
                className="bg-white/[0.08] hover:bg-white/[0.14] text-white/60 text-sm font-medium px-8 h-11 rounded-full border border-white/[0.06] backdrop-blur-sm transition-all duration-300"
              >
                <Link href={session ? "/dashboard" : "/login"}>Get started</Link>
              </Button>
            </div>
          </div>

          {/* ── Feature cards (parallax-rise from bottom) ── */}
          <div
            ref={cardsProgressRef}
            className="absolute bottom-0 left-0 right-0 z-10 overflow-visible"
            style={{ height: "40vh" }}
          >
            <div
              ref={featuresScrollRef}
              className="flex items-end justify-center gap-4 md:gap-6 w-full h-full overflow-x-auto md:overflow-x-visible scrollbar-hide px-6 md:px-0 pb-20"
              style={{ scrollSnapType: "x mandatory", scrollBehavior: "smooth" }}
            >
              {featureImages.map((img, i) => {
                // Stagger: center card rises first
                const stagger = i === 1 ? 0 : 0.12
                const cardProgress = Math.max(0, Math.min(1, (cardsProgress - stagger) / (0.6 - stagger)))
                const yShift = (1 - cardProgress) * 120
                const scaleVal = 0.88 + cardProgress * 0.12
                const opacityVal = 0.3 + cardProgress * 0.7

                return (
                  <div
                    key={i}
                    data-carousel-card
                    className="relative flex-shrink-0 w-[42vw] md:w-[220px] aspect-[3/4] rounded-2xl overflow-hidden border border-white/[0.06] bg-[#0D1117]"
                    style={{
                      scrollSnapAlign: "center",
                      transform: `translateY(${yShift}px) scale(${scaleVal})`,
                      opacity: opacityVal,
                      transition: "transform 0.1s linear, opacity 0.1s linear",
                    }}
                  >
                    <Image
                      src={img.src}
                      alt={img.alt}
                      fill
                      className="object-cover"
                      loading="lazy"
                      sizes="(max-width: 768px) 42vw, 220px"
                    />
                  </div>
                )
              })}
            </div>

            {/* Dot indicators */}
            <div className="flex md:hidden items-center justify-center gap-2.5 absolute bottom-6 left-0 right-0">
              {featureImages.map((_, i) => (
                <div
                  key={i}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    i === featuresActiveIndex ? "w-7 bg-white/50" : "w-2.5 bg-white/15"
                  }`}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ── Meet Syra — video section ── */}
        <RevealSection className="w-full py-16 md:py-24 bg-[#0A0A0A] border-t border-white/[0.04]">
          <div className="max-w-5xl mx-auto px-5 md:px-8">
            <p className="text-center text-white/30 text-xs font-medium tracking-widest uppercase mb-3">Introducing</p>
            <h2 className="text-center text-white text-xl md:text-3xl font-bold mb-12 md:mb-16">
              Meet Syra, Your AI Builder
            </h2>
            <div className="flex flex-col md:flex-row md:items-center md:gap-10">
              <div className="relative w-full md:w-3/5 flex-shrink-0 rounded-2xl overflow-hidden bg-[#111]/90 backdrop-blur-xl border border-white/[0.06]">
                <video className="w-full h-auto rounded-2xl" autoPlay muted loop playsInline>
                  <source src="/Meet%20syra%20your%20ai%20builder.mp4" type="video/mp4" />
                </video>
              </div>
              <div className="mt-6 md:mt-0 md:w-2/5">
                <p className="text-white text-base md:text-lg font-medium leading-relaxed mb-3">Start building for free</p>
                <p className="text-white/40 text-sm md:text-base leading-relaxed">
                  You receive 200 credits on your first login — that&apos;s enough to start your business and build your first project.
                </p>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ── Always Online ── */}
        <RevealSection className="w-full py-16 md:py-24 bg-[#0A0A0A]">
          <div className="max-w-5xl mx-auto px-6 md:px-8 flex flex-col items-center">
            <div className="w-full max-w-xl mx-auto mb-8 md:mb-12">
              <Image
                src="/thinking.svg"
                alt="Always-online infrastructure"
                width={697}
                height={347}
                className="w-full h-auto opacity-90"
              />
            </div>
            <div className="max-w-lg mx-auto text-center">
              <p className="text-white text-base md:text-lg font-medium leading-relaxed mb-3">Sycord saves you time and money</p>
              <p className="text-white/40 text-sm md:text-base leading-relaxed">
                By solving storage, host and security problems. Our services always online, never sleep.
              </p>
            </div>
          </div>
        </RevealSection>

        {/* ── Pricing ── */}
        <RevealSection id="pricing" className="w-full px-4 md:px-8 py-14 md:py-24">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-2xl md:text-4xl font-bold text-white text-center mb-3">Simple, Transparent Pricing</h2>
            <p className="text-sm md:text-base text-white/40 text-center mb-12 max-w-xl mx-auto">
              Choose the perfect plan for your needs. Always flexible to scale as you grow.
            </p>

            {/* Desktop */}
            <div className="hidden md:grid grid-cols-3 gap-6 max-w-5xl mx-auto">
              {/* Free */}
              <div className="frosted-card rounded-2xl p-8 flex flex-col relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-2 h-2 rounded-full bg-[#3A3B3D]" />
                  <div className="w-2 h-2 rounded-full bg-[#3A3B3D]" />
                  <div className="w-2 h-2 rounded-full bg-[#3A3B3D]" />
                </div>
                <h3 className="text-2xl font-bold text-[#6B6E71] mb-2">Sycord</h3>
                <p className="text-white/40 text-sm mb-6">Basic app</p>
                <div className="mb-6"><span className="text-3xl font-bold text-white">$0</span><span className="text-white/40 text-sm">/month</span></div>
                <Button asChild className="w-full bg-[#3A3B3D] hover:bg-[#4A4B4D] text-white mb-6 h-10 rounded-full"><Link href="/login">Get Started</Link></Button>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white/70 text-sm">1 Project</span></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white/70 text-sm">Syra Lite</span></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-[#6B6E71] flex-shrink-0" /><span className="text-white/40 text-sm">Limited Integration</span></li>
                </ul>
              </div>

              {/* Plus — featured */}
              <div className="frosted-glass-dark rounded-2xl p-8 border-2 border-yellow-500/40 flex flex-col relative overflow-hidden transform scale-105 z-10 shadow-[0_0_40px_-10px_rgba(234,179,8,0.15)]">
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1"><span className="text-yellow-500 text-xs font-semibold">Most Popular</span></div>
                <div className="flex items-center gap-2 mb-4 mt-2"><Zap className="w-4 h-4 text-yellow-500" /></div>
                <h3 className="text-2xl font-bold text-white mb-2">Sycord+</h3>
                <p className="text-white/40 text-sm mb-6">Complex apps</p>
                <div className="mb-6"><span className="text-3xl font-bold text-white">$2</span><span className="text-white/40 text-sm">/month</span></div>
                <Button asChild className="w-full bg-white hover:bg-white/90 text-[#0A0A0A] font-semibold mb-6 h-10 rounded-full"><Link href="/login">Upgrade Now</Link></Button>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white text-sm font-medium">3 Projects</span></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white/70 text-sm">Syra Pro</span></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white/70 text-sm">Integration</span></li>
                </ul>
              </div>

              {/* Enterprise */}
              <div className="frosted-card rounded-2xl p-8 flex flex-col relative overflow-hidden">
                <div className="flex items-center gap-2 mb-4"><Sparkles className="w-4 h-4 text-purple-500" /></div>
                <h3 className="text-2xl font-bold text-white mb-2">Enterprise</h3>
                <p className="text-white/40 text-sm mb-6">Security system</p>
                <div className="mb-6"><span className="text-3xl font-bold text-white">$10</span><span className="text-white/40 text-sm">/month</span></div>
                <Button asChild variant="outline" className="w-full border-white/20 hover:bg-white/5 text-white mb-6 h-10 rounded-full"><Link href="/contact">Contact Sales</Link></Button>
                <ul className="space-y-3 flex-1">
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white/70 text-sm">5 Projects</span></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white/70 text-sm">Syra Pro</span></li>
                  <li className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500 flex-shrink-0" /><span className="text-white/70 text-sm">Integration</span></li>
                </ul>
              </div>
            </div>

            {/* Mobile pricing carousel */}
            <div className="md:hidden overflow-x-auto scrollbar-hide pb-4">
              <div className="flex gap-4 w-max px-0">
                <div className="w-72 frosted-card rounded-2xl p-5 flex-shrink-0 relative overflow-hidden">
                  <div className="flex items-center gap-1.5 mb-4"><div className="w-2 h-2 rounded-full bg-[#3A3B3D]" /><div className="w-2 h-2 rounded-full bg-[#3A3B3D]" /><div className="w-2 h-2 rounded-full bg-[#3A3B3D]" /></div>
                  <h3 className="text-xl font-bold text-[#6B6E71] mb-1">Sycord</h3>
                  <p className="text-white/40 text-xs mb-4">Basic app</p>
                  <div className="mb-4"><span className="text-2xl font-bold text-white">$0</span><span className="text-white/40 text-xs">/mo</span></div>
                  <Button asChild className="w-full bg-[#3A3B3D] hover:bg-[#4A4B4D] text-white text-xs h-9 rounded-full mb-4"><Link href="/login">Get Started</Link></Button>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white/70 text-xs">1 Project</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white/70 text-xs">Syra Lite</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-[#6B6E71] flex-shrink-0" /><span className="text-white/40 text-xs">Limited Integration</span></li>
                  </ul>
                </div>

                <div className="w-72 frosted-glass-dark rounded-2xl p-5 flex-shrink-0 relative overflow-hidden border-2 border-yellow-500/40 shadow-[0_0_20px_-5px_rgba(234,179,8,0.15)]">
                  <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent" />
                  <div className="flex items-center gap-1.5 mb-4"><div className="w-2 h-2 rounded-full bg-yellow-500" /><div className="w-2 h-2 rounded-full bg-yellow-500/50" /><div className="w-2 h-2 rounded-full bg-yellow-500/20" /></div>
                  <h3 className="text-xl font-bold text-white mb-1">Sycord+</h3>
                  <p className="text-white/40 text-xs mb-4">Complex apps</p>
                  <div className="mb-4"><span className="text-2xl font-bold text-white">$2</span><span className="text-white/40 text-xs">/mo</span></div>
                  <Button asChild className="w-full bg-white hover:bg-white/90 text-[#0A0A0A] font-semibold text-xs h-9 rounded-full mb-4"><Link href="/login">Upgrade Now</Link></Button>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white text-xs font-medium">3 Projects</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white/70 text-xs">Syra Pro</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white/70 text-xs">Integration</span></li>
                  </ul>
                </div>

                <div className="w-72 frosted-card rounded-2xl p-5 flex-shrink-0 relative overflow-hidden">
                  <div className="flex items-center gap-1 mb-3"><Sparkles className="w-3.5 h-3.5 text-purple-500" /></div>
                  <h3 className="text-xl font-bold text-white mb-1">Enterprise</h3>
                  <p className="text-white/40 text-xs mb-4">Security system</p>
                  <div className="mb-4"><span className="text-2xl font-bold text-white">$10</span><span className="text-white/40 text-xs">/mo</span></div>
                  <Button asChild variant="outline" className="w-full border-white/20 hover:bg-white/5 text-white text-xs h-9 rounded-full mb-4"><Link href="/contact">Contact Sales</Link></Button>
                  <ul className="space-y-2">
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white/70 text-xs">5 Projects</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white/70 text-xs">Syra Pro</span></li>
                    <li className="flex items-center gap-2"><Check className="w-3 h-3 text-green-500 flex-shrink-0" /><span className="text-white/70 text-xs">Integration</span></li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </RevealSection>

        {/* ── CTA ── */}
        <RevealSection className="w-full px-4 md:px-8 py-14 md:py-20">
          <div className="max-w-2xl mx-auto frosted-glass rounded-2xl p-8 md:p-12 text-center relative overflow-hidden">
            <div className="relative z-10">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Ready to build your website?</h2>
              <p className="text-white/40 mb-6 md:mb-8 text-sm md:text-base">
                Join thousands of creators and businesses already using Sycord to build amazing websites.
              </p>
              <Button asChild className="bg-white text-[#0A0A0A] hover:bg-white/90 font-semibold px-8 h-11 md:h-12 rounded-full">
                <Link href="/login">Start Building Now</Link>
              </Button>
            </div>
          </div>
        </RevealSection>
      </main>

      {/* ─────────── Footer ─────────── */}
      <footer className="w-full border-t border-white/[0.04] mt-8 md:mt-16 bg-[#0A0A0A]">
        <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 md:py-14">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10 md:gap-16 mb-10">
            <div className="flex-shrink-0">
              <div className="flex items-center gap-2 mb-3">
                <Image src="/logo.png" alt="Sycord" width={24} height={24} className="opacity-80" />
                <span className="text-white font-bold text-base tracking-tight">Sycord</span>
              </div>
              <p className="text-white/30 text-xs max-w-[200px]">Build stunning websites in minutes. No coding required.</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8 md:gap-14">
              <div>
                <h3 className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">Product</h3>
                <ul className="space-y-2">
                  <li><Link href="#" className="text-white/40 hover:text-white text-xs transition-colors">Features</Link></li>
                  <li><Link href="#pricing" className="text-white/40 hover:text-white text-xs transition-colors">Pricing</Link></li>
                  <li><Link href="#" className="text-white/40 hover:text-white text-xs transition-colors">Security</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">Company</h3>
                <ul className="space-y-2">
                  <li><Link href="/about" className="text-white/40 hover:text-white text-xs transition-colors">About</Link></li>
                  <li><Link href="#" className="text-white/40 hover:text-white text-xs transition-colors">Blog</Link></li>
                  <li><Link href="/contact" className="text-white/40 hover:text-white text-xs transition-colors">Contact</Link></li>
                </ul>
              </div>
              <div>
                <h3 className="text-white/30 text-[11px] font-semibold uppercase tracking-widest mb-3">Legal</h3>
                <ul className="space-y-2">
                  <li><Link href="/pap" className="text-white/40 hover:text-white text-xs transition-colors">Privacy</Link></li>
                  <li><Link href="/tos" className="text-white/40 hover:text-white text-xs transition-colors">Terms</Link></li>
                </ul>
              </div>
            </div>
          </div>
          <div className="border-t border-white/[0.04] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-white/25 text-[11px]">© {new Date().getFullYear()} Sycord. All rights reserved.</span>
            <div className="flex items-center gap-4">
              <Link href="#" className="text-white/25 hover:text-white text-[11px] transition-colors">Twitter</Link>
              <Link href="#" className="text-white/25 hover:text-white text-[11px] transition-colors">GitHub</Link>
              <Link href="#" className="text-white/25 hover:text-white text-[11px] transition-colors">Discord</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
