"use client"

import Image from "next/image"
import Link from "next/link"
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

function Hero() {
  return (
    <section
      className="relative w-full overflow-hidden"
      style={{
        backgroundColor: "#18191B",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.6px, transparent 1.6px)",
        backgroundSize: "38px 38px",
      }}
    >
      {/* Navbar */}
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Image src="/logo.png" alt="Sycord" width={36} height={36} priority className="h-8 w-8 opacity-90" />
          <span className="text-sm font-semibold tracking-tight text-white">sycord</span>
        </Link>
        <Link href="/login" className="rounded-full border border-[#2a2c30] bg-[#18191B] px-5 py-2 text-sm font-medium text-[#E5E7EB] transition-colors hover:bg-[#212327]">
          sign in
        </Link>
      </header>

      {/* Headline */}
      <div className="mx-auto flex w-full max-w-2xl flex-col items-center px-5 pt-14 text-center sm:pt-20">
        <h1
          className="font-extrabold tracking-tight text-white"
          style={{ fontSize: "clamp(36px, 8.5vw, 68px)", lineHeight: 1.06, letterSpacing: "-0.025em" }}
        >
          The{" "}
          <span className="inline-block rounded-xl px-2.5 py-0.5" style={{ background: "rgba(255,255,255,0.07)" }}>Cloud Coding</span>
          <br />Agent...
        </h1>
        <div className="mt-8 flex items-center gap-3">
          <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-2.5 text-sm font-semibold text-black transition-transform hover:scale-[1.02]">
            Start for free <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <Link href="#showcase" className="rounded-2xl border border-[#2a2c30] px-5 py-2.5 text-sm font-medium text-[#A7AAB0] transition-colors hover:bg-[#212327]">
            See demo
          </Link>
        </div>
      </div>

      {/* Devices illustration */}
      <HeroMockup />
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────
   HERO MOCKUP — iPhone 15 Pro + MacBook Pro
   Mobile: stacked, iPhone on top centered, MacBook below
   Desktop: side-by-side, iPhone left, MacBook right
───────────────────────────────────────────────────────────── */
function HeroMockup() {
  return (
    <div className="relative mx-auto mt-10 w-full max-w-5xl px-4 pb-0 sm:mt-16 sm:px-8">
      <style>{`
        /* ── glow backdrop ── */
        .hm-glow {
          position:absolute;
          inset:0;
          pointer-events:none;
          background: radial-gradient(ellipse 70% 50% at 55% 60%, rgba(124,111,245,0.13) 0%, transparent 70%),
                      radial-gradient(ellipse 40% 40% at 20% 70%, rgba(255,255,255,0.04) 0%, transparent 65%);
        }

        /* ── MacBook shell ── */
        .mac-shell {
          display:flex;
          flex-direction:column;
          filter: drop-shadow(0 32px 64px rgba(0,0,0,0.7));
        }
        .mac-lid {
          background: linear-gradient(160deg,#2c2c2e 0%,#1c1c1e 60%);
          border: 2px solid #3a3a3c;
          border-bottom: none;
          border-radius: 16px 16px 0 0;
          padding: 12px 12px 0;
          position: relative;
          box-shadow: 0 0 0 1px rgba(255,255,255,0.06) inset;
        }
        /* notch cutout */
        .mac-notch {
          position:absolute;
          top:-2px; left:50%; transform:translateX(-50%);
          width:88px; height:12px;
          background:#1c1c1e;
          border-radius:0 0 10px 10px;
          border:2px solid #3a3a3c;
          border-top:none;
          z-index:5;
        }
        /* FaceTime dot in notch */
        .mac-notch::after {
          content:'';
          position:absolute;
          top:4px; left:50%; transform:translateX(-50%);
          width:5px; height:5px;
          background:#2a2a2c;
          border-radius:50%;
          box-shadow:0 0 0 1px rgba(255,255,255,0.06);
        }
        .mac-screen {
          border-radius:8px;
          overflow:hidden;
          background:#111213;
          position:relative;
        }
        .mac-base {
          height:16px;
          background: linear-gradient(to bottom,#3a3a3c,#2a2a2c);
          border: 2px solid #3a3a3c;
          border-top: 1.5px solid #555;
          border-radius: 0 0 8px 8px;
          position:relative;
        }
        /* trackpad indent */
        .mac-base::after {
          content:'';
          position:absolute;
          top:4px; left:50%; transform:translateX(-50%);
          width:72px; height:6px;
          background:rgba(0,0,0,0.35);
          border-radius:4px;
        }
        /* hinge edge reflection */
        .mac-base::before {
          content:'';
          position:absolute;
          top:0; left:10%; right:10%; height:1px;
          background:rgba(255,255,255,0.09);
        }

        /* ── iPhone 15 Pro ── */
        .iphone-shell {
          background: linear-gradient(160deg,#3a3a3c 0%,#1c1c1e 70%);
          border-radius: 44px;
          position: relative;
          box-shadow:
            0 0 0 1.5px #555 inset,
            0 0 0 2.5px #1c1c1e inset,
            0 28px 72px rgba(0,0,0,0.75),
            0 8px 24px rgba(0,0,0,0.5);
        }
        /* dynamic island */
        .iphone-island {
          position:absolute;
          top:14px; left:50%; transform:translateX(-50%);
          width:72px; height:9px;
          background:#000;
          border-radius:8px;
          z-index:10;
          box-shadow:0 0 0 1px rgba(255,255,255,0.04);
        }
        /* front camera dot in island */
        .iphone-island::after {
          content:'';
          position:absolute;
          top:50%; right:10px; transform:translateY(-50%);
          width:5px; height:5px;
          background:#1a1a1c;
          border-radius:50%;
          box-shadow:0 0 0 1.5px rgba(255,255,255,0.04), inset 0 0 3px rgba(100,200,255,0.08);
        }
        /* volume buttons left */
        .iphone-btn-vol {
          position:absolute;
          left:-3.5px;
          top:88px;
          width:3.5px;
          height:26px;
          background: linear-gradient(to right,#2a2a2c,#444);
          border-radius:2px 0 0 2px;
          box-shadow:0 38px 0 #3a3a3c,0 68px 0 #3a3a3c;
        }
        /* power button right */
        .iphone-btn-pwr {
          position:absolute;
          right:-3.5px;
          top:104px;
          width:3.5px;
          height:36px;
          background: linear-gradient(to left,#2a2a2c,#444);
          border-radius:0 2px 2px 0;
        }
        .iphone-screen {
          margin: 12px 7px 10px;
          border-radius:34px;
          overflow:hidden;
          background:#111213;
          height:calc(100% - 22px);
          position:relative;
        }

        /* ── Mac inner UI ── */
        .mac-titlebar {
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:6px 10px;
          border-bottom:1px solid #2a2c30;
          background:#111213;
          flex-shrink:0;
        }
        .mac-traffic-dot {
          width:10px; height:10px;
          border-radius:50%;
          display:inline-block;
        }
        .mac-sidebar {
          width:100px;
          border-right:1px solid #1e2022;
          padding:10px 8px;
          flex-shrink:0;
          background:#0e0f10;
          overflow:hidden;
        }
        .mac-chat {
          flex:1;
          display:flex;
          flex-direction:column;
          overflow:hidden;
          background:#111213;
        }
        .mac-chat-messages {
          flex:1;
          padding:10px 12px;
          display:flex;
          flex-direction:column;
          gap:7px;
          overflow:hidden;
        }
        .mac-bubble {
          display:inline-block;
          max-width:80%;
          padding:6px 10px;
          border-radius:14px;
          font-size:7px;
          line-height:1.4;
          color:#A7AAB0;
          background:#1e2022;
        }
        .mac-bubble.user {
          align-self:flex-end;
          background:#7C6FF5;
          color:#fff;
        }
        .mac-inputbar {
          padding:8px 10px;
          border-top:1px solid #1e2022;
          display:flex;
          align-items:center;
          gap:6px;
          background:#0e0f10;
          flex-shrink:0;
        }
        .mac-inputfield {
          flex:1;
          border-radius:8px;
          border:1px solid #2a2c30;
          background:#18191B;
          padding:5px 8px;
          display:flex;
          align-items:center;
        }

        /* ── iPhone inner UI ── */
        .ip-statusbar {
          display:flex;
          align-items:center;
          justify-content:space-between;
          padding:6px 16px 2px;
          flex-shrink:0;
        }
        .ip-card {
          margin:6px 8px;
          border-radius:16px;
          border:1px solid #2a2c30;
          background:#18191B;
          padding:8px;
          overflow:hidden;
        }
        .ip-bubble {
          border-radius:12px;
          padding:5px 8px;
          font-size:6.5px;
          line-height:1.5;
          color:#A7AAB0;
          background:#1e2022;
          margin:4px 6px;
          display:inline-block;
          max-width:72%;
        }
        .ip-bubble.user {
          align-self:flex-end;
          background:#7C6FF5;
          color:#fff;
          margin-left:auto;
          display:block;
        }
        .ip-inputbar {
          position:absolute;
          bottom:0; left:0; right:0;
          padding:6px 8px 10px;
          border-top:1px solid #2a2c30;
          background:#111213;
          display:flex;
          align-items:center;
          gap:5px;
        }
        .ip-inputfield {
          flex:1;
          border-radius:20px;
          border:1px solid #2a2c30;
          background:#18191B;
          padding:4px 10px;
          display:flex;
          align-items:center;
        }

        /* ── Layout wrappers ── */
        /* Mobile: stacked */
        .hm-wrap {
          display:flex;
          flex-direction:column;
          align-items:center;
          gap:0;
        }
        /* Desktop: side by side, aligned at bottom */
        @media(min-width:640px) {
          .hm-wrap {
            flex-direction:row;
            align-items:flex-end;
            justify-content:center;
            gap:20px;
          }
        }

        /* iPhone sizing */
        .hm-iphone {
          width: clamp(148px, 34vw, 220px);
          flex-shrink:0;
          position:relative;
          z-index:2;
        }
        .hm-iphone-inner {
          aspect-ratio:9/19.5;
          position:relative;
        }
        /* on mobile, iPhone sits above and is a bit smaller */
        @media(max-width:639px) {
          .hm-iphone {
            width: clamp(120px, 42vw, 170px);
            margin-bottom: -16px;
            z-index:3;
          }
        }

        /* MacBook sizing */
        .hm-mac {
          flex:1;
          min-width:0;
          max-width: 640px;
        }
        @media(max-width:639px) {
          .hm-mac {
            width:100%;
            max-width:100%;
          }
        }

        /* bottom fade on mobile only */
        .hm-fade {
          display:none;
        }
        @media(max-width:639px) {
          .hm-fade {
            display:block;
            position:absolute;
            inset-x:0; bottom:0;
            height:80px;
            background:linear-gradient(to bottom, transparent 0%, #18191B 100%);
            pointer-events:none;
          }
        }
      `}</style>

      {/* Glow */}
      <div className="hm-glow" />

      <div className="hm-wrap relative">

        {/* ──────── iPhone 15 Pro ──────── */}
        <div className="hm-iphone">
          <div className="hm-iphone-inner">
            <div className="iphone-shell" style={{ width: "100%", height: "100%", position: "absolute", inset: 0 }}>
              {/* buttons */}
              <div className="iphone-btn-vol" />
              <div className="iphone-btn-pwr" />
              {/* screen */}
              <div className="iphone-screen" style={{ position: "absolute", inset: 0, margin: "10px 6px 8px" }}>
                {/* Dynamic island */}
                <div className="iphone-island" />
                {/* status bar */}
                <div className="ip-statusbar">
                  <span style={{ fontSize: 6, fontWeight: 600, color: "rgba(255,255,255,0.55)" }}>9:41</span>
                  <div style={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <div style={{ width: 10, height: 5, borderRadius: 2, background: "rgba(255,255,255,0.3)" }} />
                    <div style={{ width: 3, height: 5, borderRadius: 1, background: "rgba(255,255,255,0.25)" }} />
                    <div style={{ width: 4, height: 5, borderRadius: 1, background: "rgba(255,255,255,0.25)" }} />
                  </div>
                </div>
                {/* chat area */}
                <div style={{ flex: 1, overflow: "hidden", paddingTop: 18 }}>
                  <div className="ip-bubble">Hey! How can I help you today? 👋</div>
                  <div className="ip-bubble user">Build me a landing page</div>
                  <div className="ip-bubble" style={{ marginTop: 4 }}>
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ height: 1.5, width: 80, borderRadius: 2, background: "rgba(255,255,255,0.2)", marginBottom: 3 }} />
                      <div style={{ height: 1.5, width: 60, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
                    </div>
                    {["Hero section", "Features", "Pricing"].map(lbl => (
                      <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 4 }}>
                        <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7C6FF5", flexShrink: 0 }} />
                        <div style={{ height: 1.5, width: 40, borderRadius: 2, background: "rgba(255,255,255,0.2)" }} />
                      </div>
                    ))}
                  </div>
                </div>
                {/* bottom input */}
                <div className="ip-inputbar">
                  <div className="ip-inputfield">
                    <div style={{ height: 1.5, width: 50, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
                  </div>
                  <div style={{ width: 20, height: 20, borderRadius: 10, background: "#7C6FF5", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: "rgba(255,255,255,0.9)", clipPath: "polygon(0 100%, 50% 0, 100% 100%)" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ──────── MacBook Pro ──────── */}
        <div className="hm-mac">
          <div className="mac-shell">
            {/* Lid */}
            <div className="mac-lid">
              <div className="mac-notch" />
              {/* Screen */}
              <div className="mac-screen" style={{ aspectRatio: "16/10" }}>
                {/* Title bar */}
                <div className="mac-titlebar">
                  <div style={{ display: "flex", gap: 5 }}>
                    <div className="mac-traffic-dot" style={{ background: "#ff5f57" }} />
                    <div className="mac-traffic-dot" style={{ background: "#ffbd2e" }} />
                    <div className="mac-traffic-dot" style={{ background: "#28c840" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <Image src="/logo.png" alt="" width={12} height={12} style={{ opacity: 0.75 }} />
                    <span style={{ fontSize: 8, fontWeight: 600, color: "#fff" }}>Sycord</span>
                  </div>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#2a2c30" }} />
                </div>
                {/* App body */}
                <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
                  {/* Sidebar */}
                  <div className="mac-sidebar">
                    <div style={{ fontSize: 6, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#4B4F58", marginBottom: 8 }}>Platform</div>
                    {[
                      { label: "Dashboard", active: false },
                      { label: "Projects", active: true },
                      { label: "Domain" },
                      { label: "Pages" },
                      { label: "Syra", accent: true },
                      { label: "Settings" },
                    ].map(({ label, active, accent }) => (
                      <div
                        key={label}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "4px 6px",
                          borderRadius: 6,
                          marginBottom: 1,
                          background: active ? "rgba(255,255,255,0.06)" : "transparent",
                          fontSize: 7,
                          fontWeight: active ? 600 : 400,
                          color: active ? "#fff" : accent ? "#7C6FF5" : "#6B6F78",
                        }}
                      >
                        <div style={{ width: 7, height: 7, borderRadius: 2, background: active ? "rgba(255,255,255,0.18)" : "#2a2c30" }} />
                        {label}
                      </div>
                    ))}
                    {/* user chip */}
                    <div style={{ marginTop: 12, borderTop: "1px solid #1e2022", paddingTop: 8, display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 16, height: 16, borderRadius: 8, background: "#7C6FF5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 6, fontWeight: 700, color: "#fff", flexShrink: 0 }}>A</div>
                      <div>
                        <div style={{ height: 1.5, width: 36, borderRadius: 2, background: "rgba(255,255,255,0.3)", marginBottom: 3 }} />
                        <div style={{ height: 1.5, width: 24, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
                      </div>
                    </div>
                  </div>
                  {/* Chat */}
                  <div className="mac-chat">
                    <div className="mac-chat-messages">
                      <div className="mac-bubble">Hey! 👋 How can I help you today?</div>
                      <div className="mac-bubble user">Build me a landing page for Sycord</div>
                      <div className="mac-bubble">
                        Sure! Here&apos;s what I&apos;ll generate:
                        <div style={{ marginTop: 5 }}>
                          {["Hero section with CTA", "Features grid", "Pricing table", "FAQ accordion"].map(item => (
                            <div key={item} style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 3 }}>
                              <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#7C6FF5", flexShrink: 0 }} />
                              <span>{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mac-bubble user">Looks great, deploy it!</div>
                      <div className="mac-bubble" style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#28c840" }} />
                        Deployed to <span style={{ color: "#7C6FF5", marginLeft: 3 }}>mysycord.com</span>
                      </div>
                    </div>
                    {/* Input bar */}
                    <div className="mac-inputbar">
                      <div className="mac-inputfield">
                        <div style={{ height: 1.5, width: 80, borderRadius: 2, background: "rgba(255,255,255,0.1)" }} />
                        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
                          <div style={{ width: 14, height: 14, borderRadius: 4, background: "#1e2022" }} />
                          <div style={{ width: 14, height: 14, borderRadius: 4, background: "#7C6FF5" }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Base */}
            <div className="mac-base" />
          </div>
        </div>

      </div>

      {/* bottom fade mobile only */}
      <div className="hm-fade" />
    </div>
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
        {items.map(it=>(
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
    { n:"01", icon:<Wand2 className="h-5 w-5"/>, title:"Describe your site", body:"Tell Sycord what you need in plain language — purpose, style, content." },
    { n:"02", icon:<Sparkles className="h-5 w-5"/>, title:"AI builds it instantly", body:"Pages, sections, copy, and layout are generated and ready to edit." },
    { n:"03", icon:<Rocket className="h-5 w-5"/>, title:"Publish on fast hosting", body:"One click ships your site to a global CDN with SSL and your domain." },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="How it works" title="Launch in minutes" subtitle="Generate, customize, and publish your site with AI-powered hosting." />
      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        {steps.map(s=>(
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
    { icon:<LayoutTemplate className="h-5 w-5"/>, title:"AI-generated structure", body:"Pages, sections, and navigation built from your prompt." },
    { icon:<Sparkles className="h-5 w-5"/>, title:"AI-written copy", body:"On-brand headlines, body, and CTAs ready to go live." },
    { icon:<Palette className="h-5 w-5"/>, title:"Smart page sections", body:"Hero, features, pricing, FAQ — composed with intent." },
    { icon:<Smartphone className="h-5 w-5"/>, title:"Auto mobile optimization", body:"Every layout adapts to every screen, automatically." },
    { icon:<MousePointerClick className="h-5 w-5"/>, title:"Instant editing", body:"Click anything to refine text, layout, and styling." },
    { icon:<Star className="h-5 w-5"/>, title:"Templates powered by AI", body:"Start from a template — customize with prompts." },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="AI builder" title="Built for speed" subtitle="Everything you need to design, write, and publish — generated in seconds." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(f=><FeatureCard key={f.title} {...f}/>)}
      </div>
    </section>
  )
}

function HostingFeatures() {
  const features = [
    { icon:<Cloud className="h-5 w-5"/>, title:"Fast global hosting", body:"Edge-delivered from 120+ regions for low latency everywhere." },
    { icon:<Lock className="h-5 w-5"/>, title:"Free SSL certificates", body:"Automatic HTTPS for every domain, renewed for you." },
    { icon:<Globe className="h-5 w-5"/>, title:"Custom domains", body:"Connect your domain in seconds with guided DNS." },
    { icon:<Zap className="h-5 w-5"/>, title:"CDN delivery", body:"Static and dynamic assets cached close to your visitors." },
    { icon:<ShieldCheck className="h-5 w-5"/>, title:"Reliable uptime", body:"99.99% target backed by automated failover." },
    { icon:<Database className="h-5 w-5"/>, title:"Secure backups", body:"Daily snapshots with point-in-time restore." },
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Hosting" title="Hosting built in" subtitle="A production-grade platform under every site you ship." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(f=><FeatureCard key={f.title} {...f}/>)}
      </div>
    </section>
  )
}

function FeatureCard({icon,title,body}:{icon:React.ReactNode;title:string;body:string}) {
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
    {label:"Portfolio",icon:<User className="h-5 w-5"/>,hue:"from-zinc-400/10 to-zinc-700/10"},
    {label:"Startup",icon:<Rocket className="h-5 w-5"/>,hue:"from-indigo-400/10 to-indigo-700/10"},
    {label:"Business",icon:<Briefcase className="h-5 w-5"/>,hue:"from-emerald-400/10 to-emerald-700/10"},
    {label:"Landing page",icon:<LayoutTemplate className="h-5 w-5"/>,hue:"from-amber-400/10 to-amber-700/10"},
    {label:"Storefront",icon:<ShoppingBag className="h-5 w-5"/>,hue:"from-rose-400/10 to-rose-700/10"},
    {label:"Personal brand",icon:<Star className="h-5 w-5"/>,hue:"from-sky-400/10 to-sky-700/10"},
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Templates" title="Built for every kind of site" subtitle="Start from a template — Sycord tunes it to your brand." />
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map(t=>(
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
    {name:"Starter",price:"Free",tagline:"For trying things out",features:["10 AI generation credits","Hosting included","Free SSL","Sycord subdomain"],cta:"Start for free",highlighted:false},
    {name:"Pro",price:"$19",period:"/mo",tagline:"For makers and small teams",features:["200 AI generation credits","Custom domain","Free SSL","Analytics","Email support"],cta:"Start Pro",highlighted:true},
    {name:"Business",price:"$49",period:"/mo",tagline:"For growing companies",features:["Unlimited AI generations","Multiple custom domains","Free SSL","Advanced analytics","Priority support"],cta:"Start Business",highlighted:false},
  ]
  return (
    <section className="mx-auto w-full max-w-6xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="Pricing" title="Simple, transparent pricing" subtitle="Start free. Scale when you're ready." />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        {plans.map(p=>(
          <div key={p.name} className={`flex flex-col rounded-3xl border p-6 transition-colors ${p.highlighted?"border-white/20 bg-[#18191B] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.7)] lg:scale-[1.02]":"border-[#2a2c30] bg-[#18191B] hover:bg-[#212327]"}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-white">{p.name}</h3>
              {p.highlighted?<span className="rounded-full border border-[#2a2c30] bg-[#18191B] px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">Popular</span>:null}
            </div>
            <p className="mt-1 text-sm text-[#A7AAB0]">{p.tagline}</p>
            <div className="mt-5 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-white">{p.price}</span>
              {p.period?<span className="text-sm text-[#A7AAB0]">{p.period}</span>:null}
            </div>
            <ul className="mt-5 space-y-2 text-sm text-[#E5E7EB]">
              {p.features.map(f=>(
                <li key={f} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400"/><span>{f}</span>
                </li>
              ))}
            </ul>
            <Link href="/login" className={`mt-6 inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition-colors ${p.highlighted?"bg-white text-black hover:bg-white/90":"border border-[#2a2c30] bg-[#18191B] text-white hover:bg-[#212327]"}`}>{p.cta}</Link>
          </div>
        ))}
      </div>
    </section>
  )
}

function FAQ() {
  const faqs = [
    {q:"How fast can I launch?",a:"Most users go from prompt to live site in under a minute. Generation, editing, and publish are all in-app."},
    {q:"Is hosting included?",a:"Yes — every plan, including the free tier, ships with global hosting, free SSL, and a Sycord subdomain."},
    {q:"Can I connect my own domain?",a:"Pro and Business plans include custom domain support with guided DNS and automatic SSL."},
    {q:"Can I edit the AI-generated site?",a:"Absolutely. Click any section to refine text, layout, or style. You can also re-prompt sections."},
    {q:"Is it mobile responsive?",a:"Every site is responsive by default. Sycord auto-tunes layouts for mobile, tablet, and desktop."},
  ]
  return (
    <section className="mx-auto w-full max-w-3xl px-5 pt-24 sm:px-8 sm:pt-32">
      <SectionHeading eyebrow="FAQ" title="Frequently asked questions" subtitle="Everything you need to know to get started." />
      <div className="mt-8 rounded-3xl border border-[#2a2c30] bg-[#18191B]">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f,i)=>(
            <AccordionItem key={f.q} value={`item-${i}`} className={`border-[#2a2c30] px-5 ${i===faqs.length-1?"border-b-0":""}`}>
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
      <div className="overflow-hidden rounded-[36px] border border-[#2a2c30] bg-[#18191B] p-10 text-center sm:rounded-[55px] sm:p-16" style={{backgroundImage:"radial-gradient(rgba(255,255,255,0.05) 1.4px, transparent 1.4px)",backgroundSize:"26px 26px"}}>
        <h2 className="mx-auto max-w-2xl text-3xl font-extrabold tracking-tight text-white sm:text-5xl" style={{letterSpacing:"-0.02em",lineHeight:1.1}}>Launch your site with AI</h2>
        <p className="mx-auto mt-4 max-w-xl text-base text-[#A7AAB0] sm:text-lg">Build, host, and publish from one powerful platform.</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/login" className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-semibold text-black transition-transform hover:scale-[1.02]">Start for free <ArrowRight className="h-4 w-4"/></Link>
          <Link href="#showcase" className="inline-flex items-center gap-2 rounded-2xl border border-[#2a2c30] bg-[#18191B] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#212327]">See demo</Link>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const cols = [
    {title:"Product",links:[{label:"AI Builder",href:"#showcase"},{label:"Hosting",href:"#showcase"},{label:"Templates",href:"#"},{label:"Changelog",href:"/releases"}]},
    {title:"Pricing",links:[{label:"Plans",href:"#pricing"},{label:"Compare",href:"#pricing"},{label:"Enterprise",href:"/contact"}]},
    {title:"Docs",links:[{label:"Getting started",href:"#"},{label:"Custom domains",href:"#"},{label:"API",href:"#"}]},
    {title:"Support",links:[{label:"Help center",href:"/contact"},{label:"Contact",href:"/contact"},{label:"Status",href:"#"}]},
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
          {cols.map(c=>(
            <div key={c.title}>
              <div className="text-xs font-semibold uppercase tracking-wider text-[#A7AAB0]">{c.title}</div>
              <ul className="mt-4 space-y-2 text-sm">
                {c.links.map(l=>(<li key={l.label}><Link href={l.href} className="text-[#E5E7EB] transition-colors hover:text-white">{l.label}</Link></li>))}
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

function SectionHeading({eyebrow,title,subtitle}:{eyebrow:string;title:string;subtitle:string}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <span className="inline-flex items-center rounded-full border border-[#2a2c30] bg-[#18191B] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#A7AAB0]">{eyebrow}</span>
      <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{letterSpacing:"-0.02em",lineHeight:1.1}}>{title}</h2>
      <p className="mt-3 text-base text-[#A7AAB0]">{subtitle}</p>
    </div>
  )
}
