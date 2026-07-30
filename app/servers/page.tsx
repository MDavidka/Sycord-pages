import Image from "next/image"
import Link from "next/link"
import { headers } from "next/headers"
import { Inter } from "next/font/google"
import { ServerStatusCard } from "@/components/server-status-card"

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

      <div className="px-6 py-4">
        <div className="relative w-full flex items-center justify-center">
          <Image 
            src="/b2adf1e2-fe2d-479c-ad8a.png"
            alt="Sycord hero graphic"
            width={640}
            height={313}
            className="opacity-50"
            style={{ filter: "invert(1) brightness(0.4)" }}
            priority
          />
        </div>
      </div>

      {/* Status Indicator */}
      <div className="px-6 py-6">
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
