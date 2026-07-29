import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import { ArrowLeft, CheckCircle2, MapPin } from "lucide-react"
import { Inter } from "next/font/google"
import { ServerStatusCard } from "@/components/server-status-card"

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] })

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
    <div className={`min-h-screen bg-[#181818] text-white ${inter.className}`}>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5 sm:px-8 sm:py-7">
        <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
          <Image src="/logo.png" alt="Sycord logo" width={32} height={32} className="h-8 w-8" priority />
          <span className="text-lg font-semibold tracking-tight">Sycord status</span>
        </Link>
        <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3.5 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/5 hover:text-white">
          <ArrowLeft className="h-3.5 w-3.5" /> Back home
        </Link>
      </header>

      <main className="mx-auto w-full max-w-5xl px-5 pb-10 sm:px-8 sm:pb-14">
        <section className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-3xl border border-white/10 bg-[#1d1d1f] p-5 sm:p-7">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
              <span className={`h-2 w-2 rounded-full ${isOperational ? "bg-emerald-400" : "bg-red-400"}`} /> Live status
            </div>
            <h1 className="mt-5 max-w-md text-3xl font-semibold tracking-tight sm:text-4xl">All systems, clearly accounted for.</h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/55">A compact view of Sycord service health, response history, and the region currently serving your sites.</p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3.5 py-2 text-sm text-emerald-300">
              <CheckCircle2 className="h-4 w-4" /> {isOperational ? "All services operational" : "Service disruption detected"}
            </div>
          </div>

          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-[#202022] p-5 sm:p-7">
            <div className="relative z-10 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/45">
                  <MapPin className="h-3.5 w-3.5" /> Primary location
                </div>
                <p className="mt-4 text-2xl font-semibold tracking-tight">USA · Texas</p>
                <p className="mt-1 text-sm text-white/50">Current service region</p>
              </div>
              <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-white/45">US-Central</span>
            </div>
            <Image
              src="/b2adf1e2-fe2d-479c-ad8a.png"
              alt="Stylized map showing service coverage"
              width={640}
              height={313}
              className="pointer-events-none absolute -bottom-5 -right-8 w-[72%] opacity-25"
              style={{ filter: "invert(1) brightness(0.55)" }}
              priority
            />
          </div>
        </section>

        <section className="mt-4 rounded-3xl border border-white/10 bg-[#1d1d1f] p-5 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/45">Services</p>
              <h2 className="mt-2 text-xl font-semibold">Uptime over the last 30 hours</h2>
            </div>
            <p className="text-xs text-white/40">Updates automatically from the monitor feed</p>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {servers.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 px-4 py-6 text-sm text-white/45 sm:col-span-2">No monitors configured yet.</div>
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
        </section>
      </main>

      <footer className="border-t border-white/10 px-5 py-6 sm:px-8">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Sycord. Service status for sycord.com.</span>
          <Link href="/contact" className="transition-colors hover:text-white">Need help? Contact us</Link>
        </div>
      </footer>
    </div>
  )
}
