import Link from "next/link"
import Image from "next/image"
import { headers } from "next/headers"
import { Inter } from "next/font/google"

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

export default async function CompactServersPage() {
  const { servers, globalStatus } = await getServerStatus()
  const isOperational = globalStatus !== "outage"

  return (
    <div className={`min-h-screen bg-[#1a1a1a] ${inter.className}`}>
      <header className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Sycord logo" width={24} height={24} className="h-6 w-6" priority />
            <span className="text-base font-semibold text-white">Servers</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isOperational ? "bg-emerald-500" : "bg-red-500"}`} />
            <span className="text-xs text-[#888888]">{isOperational ? "Operational" : "Degraded"}</span>
          </div>
        </div>
      </header>

      <div className="px-4 pb-4">
        {servers.length === 0 ? (
          <div className="text-[#888888] text-sm">No monitors configured yet.</div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {servers.map((server) => {
              const isUp = server.statusCode === 200
              const uptimePercent = server.uptime.filter((u): u is boolean => u !== null).filter(Boolean).length
              const total = server.uptime.filter((u): u is boolean => u !== null).length
              const pct = total > 0 ? Math.round((uptimePercent / total) * 100) : 0

              return (
                <div key={server.id} className="rounded-xl border p-3 transition-colors" style={{ borderColor: BORDER, backgroundColor: BG }}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{server.name}</span>
                    <div className={`w-2 h-2 rounded-full ${isUp ? "bg-emerald-500" : "bg-red-500"}`} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs" style={{ color: MUTED }}>
                    <span>{server.provider}</span>
                    <span className={isUp ? "text-emerald-400" : "text-red-400"}>{pct}% uptime</span>
                  </div>
                  <div className="mt-2 flex gap-1">
                    {server.uptime.slice(-24).map((val, i) => (
                      <div key={i} className={`h-8 flex-1 rounded ${val === null ? "bg-[#4a4a4a]" : val ? "bg-emerald-500" : "bg-red-500"}`} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <footer className="border-t border-[#333333] px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[#888888]">© 2025 Sycord. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/servers" className="text-xs text-[#888888] hover:text-white transition-colors">Full view</Link>
            <Link href="#" className="text-xs text-[#888888] hover:text-white transition-colors">Twitter</Link>
            <Link href="#" className="text-xs text-[#888888] hover:text-white transition-colors">GitHub</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

const BG = "#181818"
const BORDER = "#2a2c30"
const MUTED = "#A7AAB0"