import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"], weight: ['400', '500', '600', '700'] })

const BG = "#181818"
const BORDER = "#2a2c30"
const MUTED = "#A7AAB0"
const TEXT = "#E5E7EB"

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

export const metadata = {
  title: "Uptime & Status — Sycord",
  description: "View Sycord service uptime and status for USA-Texas data center.",
}

export default async function UptimePage() {
  const { servers, globalStatus } = await getServerStatus()
  const isOperational = globalStatus !== "outage"

  const totalUptime = servers.reduce((acc, s) => {
    const valid = s.uptime.filter((u): u is boolean => u !== null)
    const up = valid.filter(Boolean).length
    return acc + (valid.length > 0 ? up / valid.length : 0)
  }, 0)
  const avgUptime = servers.length > 0 ? Math.round((totalUptime / servers.length) * 100) : 0

  return (
    <div className={`min-h-screen bg-[#1a1a1a] ${inter.className}`}>
      <header className="px-6 py-6">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="Sycord logo" width={32} height={32} className="h-8 w-8" priority />
            <span className="text-lg font-semibold text-white">Sycord Status</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm sm:flex" style={{ color: MUTED }}>
            <Link href="/" className="transition-colors hover:text-white">Home</Link>
            <Link href="/servers" className="transition-colors hover:text-white">Servers</Link>
            <Link href="/uptime" className="transition-colors hover:text-white">Uptime</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-16">
        <div className="rounded-3xl border p-6 sm:p-8" style={{ borderColor: BORDER, backgroundColor: BG }}>
          <div className="flex flex-col items-center text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
            <div>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">Service Status</h1>
              <p className="mt-1 text-sm" style={{ color: MUTED }}>Real-time uptime and location information</p>
            </div>
            <div className="mt-4 flex items-center gap-2 sm:mt-0">
              <div className={`w-3 h-3 rounded-full ${isOperational ? "bg-emerald-500" : "bg-red-500"}`} />
              <span className={`text-sm font-medium ${isOperational ? "text-emerald-400" : "text-red-400"}`}>
                {isOperational ? "All systems operational" : "Service disruption detected"}
              </span>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, backgroundColor: "#111213" }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Uptime (30d)</div>
              <div className="mt-2 text-3xl font-bold text-white">{avgUptime}%</div>
              <div className="mt-1 text-xs" style={{ color: MUTED }}>across all services</div>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, backgroundColor: "#111213" }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Location</div>
              <div className="mt-2 text-3xl font-bold text-white">USA</div>
              <div className="mt-1 text-xs" style={{ color: MUTED }}>Texas — Dallas-Fort Worth</div>
            </div>
            <div className="rounded-2xl border p-4" style={{ borderColor: BORDER, backgroundColor: "#111213" }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: MUTED }}>Global Status</div>
              <div className={`mt-2 text-3xl font-bold ${isOperational ? "text-emerald-400" : "text-red-400"}`}>{globalStatus === "operational" ? "Operational" : "Degraded"}</div>
              <div className="mt-1 text-xs" style={{ color: MUTED }}>{servers.length} monitors active</div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-base font-semibold text-white">Server Details</h2>
            <div className="mt-4 space-y-3">
              {servers.length === 0 ? (
                <div className="text-sm" style={{ color: MUTED }}>No monitors configured yet.</div>
              ) : (
                servers.map((server) => {
                  const isUp = server.statusCode === 200
                  const valid = server.uptime.filter((u): u is boolean => u !== null)
                  const up = valid.filter(Boolean).length
                  const pct = valid.length > 0 ? Math.round((up / valid.length) * 100) : 0

                  return (
                    <div key={server.id} className="flex flex-col rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: BORDER, backgroundColor: BG }}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2.5 h-2.5 rounded-full ${isUp ? "bg-emerald-500" : "bg-red-500"}`} />
                        <div>
                          <div className="text-sm font-medium text-white">{server.name}</div>
                          <div className="text-xs" style={{ color: MUTED }}>{server.provider}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-3 sm:mt-0">
                        <div className="flex gap-1">
                          {server.uptime.slice(-24).map((val, i) => (
                            <div key={i} className={`h-6 w-1.5 rounded-sm ${val === null ? "bg-[#4a4a4a]" : val ? "bg-emerald-500" : "bg-red-500"}`} />
                          ))}
                        </div>
                        <span className={`text-xs font-medium ${isUp ? "text-emerald-400" : "text-red-400"}`}>{pct}%</span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#333333] px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-3 text-xs sm:flex-row sm:justify-between" style={{ color: MUTED }}>
          <span>© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          <div className="flex items-center gap-4">
            <Link href="/" className="transition-colors hover:text-white">Home</Link>
            <Link href="/servers" className="transition-colors hover:text-white">Servers</Link>
            <Link href="/uptime" className="transition-colors hover:text-white">Uptime</Link>
            <Link href="/tos" className="transition-colors hover:text-white">Terms</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}