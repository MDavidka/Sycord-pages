import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import { Inter } from "next/font/google"
import { ServerStatusCard } from "@/components/server-status-card"
import { AgentPromptCycler } from "@/components/agent-prompt-cycler"

const inter = Inter({ subsets: ["latin"], weight: ['400', '500', '600', '700'] })

type ServerStatus = {
  id: string
  name: string
  provider: string
  providerIcon?: string
  iconType?: string
  statusCode: number
  uptime: (boolean | null)[]
}

async function getServerStatus(): Promise<{ servers: ServerStatus[]; globalStatus: string }> {
  const headerList = await headers()
  const host = headerList.get("host")
  const protocol = process.env.NODE_ENV === "production" ? "https" : "http"
  const baseUrl = host ? `${protocol}://${host}` : process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || "http://localhost:3000"
  const endpoint = `${baseUrl}/api/servers/status`

  try {
    const response = await fetch(endpoint, { cache: "no-store" })
    if (!response.ok) throw new Error("Failed to fetch status")
    return await response.json()
  } catch (error) {
    console.error("Unable to load server status:", error)
    return { servers: [], globalStatus: "operational" }
  }
}

export default async function ServersPage() {
  const { servers, globalStatus } = await getServerStatus()
  const isOperational = globalStatus !== "outage"

  return (
    <div className={`min-h-screen bg-[#1a1a1a] ${inter.className}`}>
      {/* Header */}
      <header className="px-6 py-6">
        <div className="flex items-center gap-3">
          <Image
            src="/logo.png"
            alt="Sycord logo"
            width={40}
            height={40}
            className="h-10 w-10"
            priority
          />
          <h1 className="text-2xl font-semibold text-white">Servers</h1>
        </div>
      </header>

      {/* Global Infrastructure */}
      <section className="px-6">
        <div className="mx-auto max-w-4xl text-center">
          <span className="inline-flex items-center rounded-full border border-[#2a2c30] bg-[#181818] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#A7AAB0]">
            Global Infrastructure
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Deploy worldwide
          </h2>
          <p className="mt-3 text-base text-[#A7AAB0]">
            Three server locations across the globe for low-latency hosting.
          </p>
        </div>
        <div className="mt-8 overflow-hidden rounded-3xl border border-[#2a2c30] bg-[#181818] p-6 sm:p-10 space-y-8">
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

      {/* Status Indicator */}
      <div className="px-6 py-6 mt-8">
        <div className="flex items-center gap-3">
          <div className={`w-6 h-4 rounded-full ${isOperational ? "bg-emerald-500" : "bg-red-500"}`} />
          <p className="text-lg font-medium text-white">
            {isOperational ? (
              <>
                All system is <span className="text-emerald-500">operational</span>!
              </>
            ) : (
              <>
                Systems <span className="text-red-500">degraded</span>
              </>
            )}
          </p>
        </div>
      </div>

      {/* Server Cards */}
      <div className="px-6 pb-8 space-y-8">
        {servers.length === 0 ? (
          <div className="text-[#888888] text-sm">No monitors configured yet.</div>
        ) : (
          servers.map((server) => (
            <ServerStatusCard
              key={server.id}
              name={server.name}
              status={server.statusCode}
              provider={server.provider}
              providerIcon={server.providerIcon}
              iconType={server.iconType}
              uptime={server.uptime}
            />
          ))
        )}
      </div>

      {/* AI Agent */}
      <section className="mx-auto w-full max-w-4xl px-6 pb-16 pt-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center rounded-full border border-[#2a2c30] bg-[#181818] px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-[#A7AAB0]">
            One Agent
          </span>
          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            One agent for all needs
          </h2>
          <p className="mt-3 text-base text-[#A7AAB0]">
            From productivity to gaming — a single AI agent that adapts to your workflow.
          </p>
        </div>
        <div className="mt-8 flex justify-center">
          <AgentPromptCycler />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#333333] px-6 py-8">
        <div className="flex flex-col items-center gap-4">
          {/* Status */}
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full ${isOperational ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-sm text-[#888888]">
              {isOperational ? "All service is operational" : "Service disruption detected"}
            </span>
          </div>

          {/* Logo and Copyright */}
          <div className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="Sycord logo"
              width={20}
              height={20}
              className="h-5 w-5"
              priority
            />
            <span className="text-sm text-[#888888]">© 2025 Sycord. Minden jog fenntartva.</span>
          </div>

          {/* Social Links */}
          <div className="flex items-center gap-6">
            <Link href="#" className="text-sm text-[#888888] hover:text-white transition-colors">
              Twitter
            </Link>
            <Link href="#" className="text-sm text-[#888888] hover:text-white transition-colors">
              GitHub
            </Link>
            <Link href="#" className="text-sm text-[#888888] hover:text-white transition-colors">
              Discord
            </Link>
          </div>
        </div>
      </footer>
    </div>
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
