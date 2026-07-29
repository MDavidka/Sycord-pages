"use client"

import { Activity, Cloud, Cpu, Database, Globe2, HardDrive, Lock, Network, Server, Shield, Wifi, type LucideIcon } from "lucide-react"
import { useEffect, useState } from "react"

interface ServerStatusCardProps {
  name: string
  status: number
  provider: string
  providerIcon?: string
  iconType?: string
  uptime: (boolean | null)[]
}

const iconMap: Record<string, LucideIcon> = {
  server: Server,
  cloud: Cloud,
  globe: Globe2,
  database: Database,
  network: Network,
  storage: HardDrive,
  cpu: Cpu,
  wifi: Wifi,
  shield: Shield,
  lock: Lock,
  activity: Activity,
}

function validateCustomIcon(icon: string | undefined): boolean {
  return Boolean(icon?.startsWith("data:image/") && icon.includes(";base64,"))
}

export function ServerStatusCard({ name, status, provider, providerIcon, iconType, uptime }: ServerStatusCardProps) {
  const isOperational = status === 200
  const IconComponent = iconMap[providerIcon?.toLowerCase() ?? ""] ?? Server
  const [imageLoadError, setImageLoadError] = useState(false)
  const isValidCustomIcon = iconType === "custom" && validateCustomIcon(providerIcon) && !imageLoadError

  useEffect(() => {
    setImageLoadError(false)
  }, [providerIcon])

  return (
    <article className="rounded-2xl border border-white/10 bg-[#222224] p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/65">
            {isValidCustomIcon ? (
              <img src={providerIcon} alt={`${name} provider icon`} className="h-4 w-4 object-contain" onError={() => setImageLoadError(true)} />
            ) : (
              <IconComponent className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-white">{name}</h3>
            <p className="mt-0.5 truncate text-xs text-white/40">{provider}</p>
          </div>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${isOperational ? "bg-emerald-400/10 text-emerald-300" : "bg-red-400/10 text-red-300"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${isOperational ? "bg-emerald-400" : "bg-red-400"}`} />
          {isOperational ? "Operational" : status === 0 ? "Checking" : "Degraded"}
        </span>
      </div>

      <div className="mt-5 flex items-center gap-1" role="img" aria-label="30-hour uptime history">
        {uptime.map((isUp, index) => (
          <span
            key={index}
            className={`h-2 min-w-0 flex-1 rounded-full ${isUp === null ? "bg-white/10" : isUp ? "bg-emerald-400" : "bg-red-400"}`}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[10px] text-white/35">
        <span>30h ago</span>
        <span>Now</span>
      </div>
    </article>
  )
}
