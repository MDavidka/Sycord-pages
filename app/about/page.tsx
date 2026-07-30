"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Sparkles, Globe, Palette, Rocket, Cpu, Shield, Code, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

const features = [
  {
    icon: Sparkles,
    title: "AI Website Builder",
    description:
      "Generate beautiful websites from a simple text prompt using Google Gemini and DeepSeek AI models.",
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
  },
  {
    icon: Code,
    title: "No-Code Editor",
    description:
      "Visual drag-and-drop editing powered by a real-time preview — no coding skills required.",
    color: "text-blue-400",
    bg: "bg-blue-400/10",
  },
  {
    icon: Globe,
    title: "Instant Hosting",
    description:
      "Every site gets a *.sycord.com subdomain with one-click publishing. Custom domains available on paid plans.",
    color: "text-green-400",
    bg: "bg-green-400/10",
  },
  {
    icon: Rocket,
    title: "GitHub Deployment",
    description:
      "Source code is automatically deployed to GitHub repositories with CI/CD pipelines built in.",
    color: "text-purple-400",
    bg: "bg-purple-400/10",
  },
  {
    icon: Cpu,
    title: "Firebase Sync",
    description:
      "Real-time data synchronisation via Firebase ensures instant updates across all devices.",
    color: "text-orange-400",
    bg: "bg-orange-400/10",
  },
  {
    icon: Shield,
    title: "Content Moderation",
    description:
      "Automatic content filtering keeps the platform safe and protects all users.",
    color: "text-red-400",
    bg: "bg-red-400/10",
  },
]

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#18191B] flex flex-col items-center font-sans">
      {/* Header */}
      <header className="w-full px-4 md:px-8 py-4 md:py-6 flex items-center justify-between sticky top-0 bg-[#18191B]/95 backdrop-blur-sm border-b border-white/5 z-20">
        <Link href="/" className="flex items-center gap-2 md:gap-3">
          <Image src="/logo.png" alt="Sycord Logo" width={28} height={28} className="opacity-90" />
          <span className="text-base md:text-xl font-bold text-white tracking-tight">Sycord</span>
        </Link>
        <Link href="/">
          <Button variant="ghost" className="gap-2 text-white/70 hover:text-white hover:bg-white/5 rounded-full text-sm">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </Link>
      </header>

      <main className="w-full max-w-5xl mx-auto px-4 md:px-8 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center mb-16 md:mb-20">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">About Sycord</h1>
          <p className="text-[#8A8E91] text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            Sycord is an AI-powered website builder that lets anyone create and publish a professional website in under 5 minutes — no coding required. We combine cutting-edge artificial intelligence with an intuitive visual editor so you can focus on your ideas while we handle the technology.
          </p>
        </div>

        {/* Illustration */}
        <div className="flex justify-center mb-16 md:mb-20">
          <svg viewBox="0 0 600 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-lg">
            {/* Central platform bar */}
            <rect x="100" y="80" width="400" height="40" rx="20" fill="#252527" stroke="#3A3B3D" strokeWidth="1"/>
            {/* Nodes */}
            <circle cx="150" cy="100" r="16" fill="#EAB308" opacity="0.15" stroke="#EAB308" strokeWidth="1" strokeOpacity="0.3"/>
            <circle cx="250" cy="100" r="16" fill="#3B82F6" opacity="0.15" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.3"/>
            <circle cx="350" cy="100" r="16" fill="#22C55E" opacity="0.15" stroke="#22C55E" strokeWidth="1" strokeOpacity="0.3"/>
            <circle cx="450" cy="100" r="16" fill="#A855F7" opacity="0.15" stroke="#A855F7" strokeWidth="1" strokeOpacity="0.3"/>
            {/* Icons inside nodes */}
            <text x="150" y="105" textAnchor="middle" fill="#EAB308" fontSize="14">✦</text>
            <text x="250" y="105" textAnchor="middle" fill="#3B82F6" fontSize="14">⌨</text>
            <text x="350" y="105" textAnchor="middle" fill="#22C55E" fontSize="14">◎</text>
            <text x="450" y="105" textAnchor="middle" fill="#A855F7" fontSize="14">⚡</text>
            {/* Connecting dotted lines to top and bottom labels */}
            <line x1="150" y1="80" x2="150" y2="50" stroke="#EAB308" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 3"/>
            <line x1="250" y1="80" x2="250" y2="50" stroke="#3B82F6" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 3"/>
            <line x1="350" y1="120" x2="350" y2="150" stroke="#22C55E" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 3"/>
            <line x1="450" y1="120" x2="450" y2="150" stroke="#A855F7" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="3 3"/>
            {/* Labels */}
            <text x="150" y="42" textAnchor="middle" fill="#8A8E91" fontSize="10" fontFamily="system-ui">AI Engine</text>
            <text x="250" y="42" textAnchor="middle" fill="#8A8E91" fontSize="10" fontFamily="system-ui">Editor</text>
            <text x="350" y="164" textAnchor="middle" fill="#8A8E91" fontSize="10" fontFamily="system-ui">Hosting</text>
            <text x="450" y="164" textAnchor="middle" fill="#8A8E91" fontSize="10" fontFamily="system-ui">Deploy</text>
            {/* Sycord label */}
            <text x="300" y="104" textAnchor="middle" fill="white" fontSize="11" fontWeight="600" fontFamily="system-ui" opacity="0.5">SYCORD</text>
          </svg>
        </div>

        {/* What We Do heading */}
        <h2 className="text-xl md:text-3xl font-bold text-white text-center mb-4">What We Do</h2>
        <p className="text-[#8A8E91] text-sm md:text-base text-center mb-10 md:mb-12 max-w-xl mx-auto">
          Everything you need to go from idea to live website — powered by AI.
        </p>

        {/* Feature Cards */}
        <div className="grid gap-4 md:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="bg-[#252527] rounded-2xl p-6 border border-white/[0.08] hover:border-white/20 transition-all duration-300"
            >
              <div className={`w-12 h-12 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                <f.icon className={`w-6 h-6 ${f.color}`} />
              </div>
              <h3 className="text-white font-semibold text-base mb-2">{f.title}</h3>
              <p className="text-[#8A8E91] text-sm leading-relaxed">{f.description}</p>
            </div>
          ))}
        </div>

        {/* Mission */}
        <div className="mt-16 md:mt-20 bg-[#252527] rounded-2xl p-8 md:p-10 border border-white/[0.08] text-center">
          <Zap className="w-8 h-8 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-xl md:text-2xl font-bold text-white mb-3">Our Mission</h2>
          <p className="text-[#8A8E91] text-sm md:text-base max-w-2xl mx-auto leading-relaxed">
            We believe everyone deserves a fast, beautiful website — regardless of technical skill. Sycord removes the barriers between an idea and a live website by harnessing AI to automate code generation, design, and deployment so you can focus on what matters most: your content and your audience.
          </p>
        </div>

        {/* CTA */}
        <div className="mt-12 md:mt-16 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button asChild className="bg-white text-[#18191B] hover:bg-white/90 font-semibold px-8 h-11 rounded-full">
            <Link href="/login">Get Started Free</Link>
          </Button>
          <Button asChild variant="outline" className="border-white/20 text-white hover:bg-white/5 font-medium px-8 h-11 rounded-full">
            <Link href="/contact">Contact Us</Link>
          </Button>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-6 mt-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[#8A8E91] text-[11px]">© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/tos" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">Terms</Link>
            <Link href="/pap" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">Privacy</Link>
            <Link href="/contact" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">Contact</Link>
            <Link href="/business-report" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">Business Report</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
