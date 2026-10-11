import { NextResponse } from "next/server"
import { proxyRunner, requireAdminResponse } from "../_shared"
import { probeDeployVmSsh } from "@/lib/admin/vm-ssh"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export interface VmMetricsResponse {
  available: boolean
  error?: string
  cpu?: {
    loadAvg: number
    cores?: number
    usagePercent?: number
  }
  memory?: {
    totalBytes: number
    freeBytes: number
    usedBytes: number
    usagePercent: number
  }
  disk?: {
    usagePercent: number | null
    raw?: string
  }
  bandwidth?: {
    status: string
    rxBytes?: number
    txBytes?: number
  }
  timestamp: string
}

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  // First try direct proxy to VM Runner
  try {
    const upstream = await proxyRunner("/api/status")
    if (upstream.status === 200) {
      const data = await upstream.json()
      if (data && data.online) {
        const totalMem = data.mem?.total || 0
        const freeMem = data.mem?.free || 0
        const usedMem = Math.max(0, totalMem - freeMem)
        const memPercent = data.mem?.percent ?? (totalMem > 0 ? Math.round((usedMem / totalMem) * 100) : null)

        let diskPercent: number | null = null
        if (typeof data.disk?.percent === "string") {
          const parsed = parseInt(data.disk.percent.replace("%", ""), 10)
          if (!isNaN(parsed)) diskPercent = parsed
        } else if (typeof data.disk?.percent === "number") {
          diskPercent = data.disk.percent
        }

        return NextResponse.json({
          available: true,
          cpu: {
            loadAvg: typeof data.cpu === "number" ? data.cpu : 0,
            usagePercent: typeof data.cpu === "number" ? Math.min(100, Math.round(data.cpu * 25)) : null,
          },
          memory: {
            totalBytes: totalMem,
            freeBytes: freeMem,
            usedBytes: usedMem,
            usagePercent: memPercent ?? 0,
          },
          disk: {
            usagePercent: diskPercent,
            raw: String(data.disk?.percent || ""),
          },
          bandwidth: {
            status: "active",
          },
          timestamp: new Date().toISOString(),
        })
      }
    }
  } catch {
    // Continue to SSH probe
  }

  // Fallback probe via SSH
  const ssh = await probeDeployVmSsh().catch(() => ({ reachable: false, error: "SSH unreachable" }))
  if (ssh.reachable) {
    return NextResponse.json({
      available: true,
      cpu: {
        loadAvg: 0,
        usagePercent: null,
      },
      memory: {
        totalBytes: 0,
        freeBytes: 0,
        usedBytes: 0,
        usagePercent: 0,
      },
      disk: {
        usagePercent: null,
      },
      bandwidth: {
        status: "ssh-only",
      },
      timestamp: new Date().toISOString(),
    })
  }

  // VM is not accessible - Return truthful unavailable payload without fake numbers
  return NextResponse.json({
    available: false,
    error: "Host telemetry unavailable. The VM runner service or SSH endpoint is currently offline.",
    timestamp: new Date().toISOString(),
  })
}
