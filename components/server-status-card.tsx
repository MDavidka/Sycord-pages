"use client"

import { Activity, Cloud, Cpu, Database, Globe2, HardDrive, Lock, Network, Server, Shield, Wifi, type LucideIcon } from "lucide-react"
import { useState, useEffect } from "react"

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
  if (!icon) return false
  return icon.startsWith('data:image/') && icon.includes(';base64,')
}

export function ServerStatusCard({ name, status, provider, providerIcon, iconType, uptime }: ServerStatusCardProps) {
  const isOperational = status === 200
  const iconKey = providerIcon?.toLowerCase() ?? ""
  const IconComponent = iconMap[iconKey] ?? Server
  const isCustomIcon = iconType === 'custom'
  const [imageLoadError, setImageLoadError] = useState(false)
  
  // Reset error state when providerIcon changes
  useEffect(() => {
    setImageLoadError(false)
  }, [providerIcon])
  
  // Validate custom icon is a safe data URL with proper format
  const isValidCustomIcon = isCustomIcon && 
    validateCustomIcon(providerIcon) &&
    !imageLoadError

  return (
    <div className="space-y-3">
      {/* Header Row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-[#e5e5e5]">{name}</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#e5e5e5]">{status}</span>
          <div 
            className={`w-3 h-3 rounded-full ${
              isOperational ? 'bg-emerald-500' : 'bg-red-500'
            }`} 
          />
        </div>
      </div>

      <div className="flex gap-1">
        {uptime.map((isUp, index) => (
          <div
            key={index}
            className={`h-12 w-4 rounded-md ${
              isUp === null 
                ? 'bg-[#4a4a4a]' 
                : isUp 
                  ? 'bg-emerald-500' 
                  : 'bg-red-500'
            }`}
          />
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="w-6 h-6 flex items-center justify-center text-[#b3b3b3]">
          {isValidCustomIcon ? (
            <img 
              src={providerIcon} 
              alt={`Custom icon for ${name}`}
              className="w-4 h-4 object-contain"
              onError={() => setImageLoadError(true)}
            />
          ) : (
            <IconComponent className="w-4 h-4" />
          )}
        </div>
        <span className="text-sm text-[#888888]">{provider}</span>
      </div>
    </div>
  )
}
