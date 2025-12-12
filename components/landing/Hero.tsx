"use client"

import { motion } from "framer-motion"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight } from "lucide-react"
import { Countdown } from "@/components/countdown"

export function Hero() {
  return (
    <section className="relative pt-24 pb-12 md:pt-36 md:pb-24 overflow-hidden min-h-[85vh] flex items-center bg-[#0F1012]">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-500/10 rounded-full blur-[100px] animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[100px] animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 relative z-20 flex flex-col md:flex-row items-center gap-12">

        {/* Text Content */}
        <div className="flex-1 text-center md:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-block mb-6 px-4 py-1.5 rounded-full border border-white/10 text-xs font-medium text-purple-200 bg-white/5 backdrop-blur-md shadow-inner"
          >
            🚀 Most Bétában
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-[1.1] tracking-tight drop-shadow-2xl"
          >
            Építse <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-blue-400">Jövőjét</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-lg md:text-xl text-gray-400 mb-8 max-w-2xl mx-auto md:mx-0 leading-relaxed"
          >
            A Sycord a modern fejlesztők választása. Biztonságos, villámgyors és készen áll a skálázásra bármely méretben.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center gap-4 justify-center md:justify-start mb-12"
          >
             <Link href="/login" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white border-0 h-14 px-8 text-base rounded-2xl shadow-lg shadow-purple-500/25 transition-all hover:scale-105">
                Kezdés Ingyen
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
             <Link href="#features" className="w-full sm:w-auto">
              <Button variant="outline" size="lg" className="w-full sm:w-auto h-14 px-8 text-base rounded-2xl border-white/10 text-white bg-white/5 hover:bg-white/10 backdrop-blur-sm transition-all hover:scale-105">
                Tudjon meg többet
              </Button>
            </Link>
          </motion.div>

          <motion.div
             initial={{ opacity: 0 }}
             animate={{ opacity: 1 }}
             transition={{ duration: 0.5, delay: 0.4 }}
          >
             <Countdown targetDate={new Date("2026-01-16T00:00:00")} />
          </motion.div>
        </div>

        {/* Hero Image / Illustration */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="flex-1 relative w-full h-[400px] md:h-[600px] flex items-center justify-center"
        >
          {/* Abstract blobs/shapes behind image */}
          <div className="absolute inset-0 flex items-center justify-center">
             <div className="w-[80%] h-[80%] bg-gradient-to-tr from-purple-500/20 to-blue-500/20 rounded-full blur-[60px] animate-pulse-slow" />
          </div>

          <div className="relative z-10 w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-[#0F1012]/50 backdrop-blur-xl group hover:scale-[1.02] transition-transform duration-500">
            {/* Using the provided hero image but styling it nicely */}
             <Image
                src="/hero-image.jpg"
                alt="Platform Preview"
                fill
                className="object-cover object-top opacity-90 group-hover:opacity-100 transition-opacity duration-500"
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
              />
              {/* Overlay gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-[#0F1012] via-transparent to-transparent opacity-80" />
          </div>

           {/* Floating elements (simulated UI cards) */}
           <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
              className="absolute -bottom-6 -left-6 md:bottom-10 md:-left-10 bg-[#1A1B1E] p-4 rounded-2xl border border-white/10 shadow-xl max-w-[200px] hidden md:block"
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-green-400">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Status</div>
                  <div className="text-sm font-bold text-white">Online</div>
                </div>
              </div>
              <div className="h-1 w-full bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 w-full" />
              </div>
           </motion.div>
        </motion.div>

      </div>
    </section>
  )
}
