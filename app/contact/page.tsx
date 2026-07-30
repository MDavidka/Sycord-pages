"use client"

import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Mail, Phone, User, Shield, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ContactPage() {
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

      <main className="w-full max-w-4xl mx-auto px-4 md:px-8 py-12 md:py-20">
        {/* Hero */}
        <div className="text-center mb-12 md:mb-16">
          <h1 className="text-3xl md:text-5xl font-bold text-white tracking-tight mb-4">Get in Touch</h1>
          <p className="text-[#8A8E91] text-sm md:text-base max-w-md mx-auto">
            Have questions or want to work with us? Reach out through any of the channels below.
          </p>
        </div>

        {/* Contact Cards */}
        <div className="grid gap-4 md:gap-6 md:grid-cols-2">
          {/* Founder Card */}
          <div className="bg-[#252527] rounded-2xl p-6 border border-white/[0.08] hover:border-white/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
              <User className="w-6 h-6 text-white/70" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-1">Founder</h2>
            <p className="text-white/90 text-base font-medium">Dávid Márton</p>
            <p className="text-[#8A8E91] text-sm mt-1">Project Lead &amp; Developer</p>
          </div>

          {/* Phone Card */}
          <div className="bg-[#252527] rounded-2xl p-6 border border-white/[0.08] hover:border-white/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
              <Phone className="w-6 h-6 text-white/70" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-1">Phone</h2>
            <a href="tel:0751544882" className="text-white/90 text-base font-medium hover:text-white transition-colors">
              0751 544 882
            </a>
            <p className="text-[#8A8E91] text-sm mt-1">Mon – Fri, 9:00 – 18:00</p>
          </div>

          {/* Admin Email Card */}
          <div className="bg-[#252527] rounded-2xl p-6 border border-white/[0.08] hover:border-white/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
              <Shield className="w-6 h-6 text-white/70" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-1">Administrator</h2>
            <a href="mailto:admin@sycord.com" className="text-white/90 text-base font-medium hover:text-white transition-colors">
              admin@sycord.com
            </a>
            <p className="text-[#8A8E91] text-sm mt-1">Official support &amp; administration</p>
          </div>

          {/* General Contact Email Card */}
          <div className="bg-[#252527] rounded-2xl p-6 border border-white/[0.08] hover:border-white/20 transition-all duration-300 group">
            <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-4">
              <Mail className="w-6 h-6 text-white/70" />
            </div>
            <h2 className="text-white font-semibold text-lg mb-1">Email</h2>
            <a href="mailto:dmarton336@gmail.com" className="text-white/90 text-base font-medium hover:text-white transition-colors">
              dmarton336@gmail.com
            </a>
            <p className="text-[#8A8E91] text-sm mt-1">Freelancer &amp; business inquiries</p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 md:mt-16 text-center">
          <div className="bg-[#252527] rounded-2xl p-8 md:p-10 border border-white/[0.08]">
            <h2 className="text-xl md:text-2xl font-bold text-white mb-3">Ready to build your website?</h2>
            <p className="text-[#8A8E91] text-sm mb-6 max-w-md mx-auto">
              Sign up for free and create your first website in under 5 minutes.
            </p>
            <Button asChild className="bg-white text-[#18191B] hover:bg-white/90 font-semibold px-8 h-11 rounded-full">
              <Link href="/login">Get Started Free</Link>
            </Button>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/5 py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 md:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span className="text-[#8A8E91] text-[11px]">© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/tos" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">Terms</Link>
            <Link href="/pap" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">Privacy</Link>
            <Link href="/about" className="text-[#8A8E91] hover:text-white text-[11px] transition-colors">About</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
