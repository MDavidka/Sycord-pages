import { NextResponse } from "next/server";
import clientPromise from "@/lib/mongodb";

export const dynamic = "force-dynamic"

const HISTORY_HOURS = 30

type HistoryPoint = {
  ts: number
  status: boolean | null
}

type CronitorMonitor = {
  key: string
  name?: string
  type?: string
  passing?: boolean
}

type CronitorMonitorsResponse = {
  monitors?: CronitorMonitor[]
}

type CronitorPingsResponse = {
  pings?: PingEntry[]
}

type PingEntry = {
  stamp?: number
  description?: string
  [key: string]: unknown
}

const eventToStatus = (event?: string | null) => {
  if (!event) return null
  const normalized = event.toLowerCase()

  if (["fail", "failed", "error", "timeout", "halt", "pause", "stopped", "alert", "down"].some((k) => normalized.includes(k))) {
    return false
  }

  if (["ok", "complete", "run", "ping", "start", "success", "up", "tick", "pass"].some((k) => normalized.includes(k))) {
    return true
  }

  return null
}

const normalizePings = (pings: PingEntry[]): HistoryPoint[] => {
  return pings
    .map((ping) => {
      const stamp = ping.stamp
      let status = eventToStatus(ping.description)
      if (stamp && !Number.isNaN(stamp)) {
        return { ts: stamp, status }
      }
      return null
    })
    .filter(Boolean) as HistoryPoint[]
}

const buildHistory = (events: HistoryPoint[], hours: number): (boolean | null)[] => {
  if (!events.length) {
    return Array(hours).fill(null)
  }

  const sorted = events.sort((a, b) => a.ts - b.ts)
  const nowSec = Date.now() / 1000
  const start = nowSec - hours * 3600
  const history: (boolean | null)[] = []

  let cursor = 0
  let lastStatus: boolean | null = null

  for (let i = 0; i < hours; i++) {
    const bucketEnd = start + (i + 1) * 3600
    while (cursor < sorted.length && sorted[cursor].ts <= bucketEnd) {
      lastStatus = sorted[cursor].status
      cursor++
    }
    history.push(lastStatus)
  }

  return history
}

const lastKnownStatus = (history: (boolean | null)[]) => {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i] !== null) return history[i]
  }
  return null
}

export async function GET() {
  try {
    const apiKey = process.env.CRONITOR_API

    if (!apiKey) {
      console.warn("Missing CRONITOR_API environment variable")
      return NextResponse.json({
        servers: [],
        globalStatus: "operational",
      })
    }

    const authHeader = {
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    }

    // Fetch all monitors directly from Cronitor API
    let monitors: CronitorMonitor[] = []
    try {
      const res = await fetch("https://cronitor.io/api/monitors", {
        cache: "no-store",
        headers: authHeader,
      })
      if (res.ok) {
        const data: CronitorMonitorsResponse = await res.json()
        monitors = data.monitors || []
      } else {
        console.error("Cronitor API error:", await res.text())
        return NextResponse.json({
          servers: [],
          globalStatus: "operational",
        })
      }
    } catch (e) {
      console.error("Failed to fetch from Cronitor:", e)
      return NextResponse.json({
        servers: [],
        globalStatus: "operational",
      })
    }

    // Fetch monitor customizations from MongoDB
    let monitorIcons: Record<string, { icon: string; iconType?: string }> = {}
    try {
      const client = await clientPromise
      const db = client.db()
      const storedMonitors = await db.collection("monitors").find({}).toArray()
      storedMonitors.forEach((m) => {
        if (m.id && m.icon) {
          monitorIcons[m.id] = { 
            icon: m.icon,
            iconType: m.iconType || 'preset'
          }
        }
      })
    } catch (e) {
      console.error("Failed to fetch monitor icons from DB:", e)
    }

    const servers = await Promise.all(
      monitors.map(async (monitor) => {
        const monitorKey = monitor.key
        let status: "up" | "down" | "unknown" = "unknown"
        let statusCode = 0
        let uptime: (boolean | null)[] = Array(HISTORY_HOURS).fill(null)

        // Get current status from monitor
        if (monitor.passing !== undefined) {
          status = monitor.passing ? "up" : "down"
          statusCode = monitor.passing ? 200 : 503
        }

        // Fetch ping history using pings endpoint (last 30 hours)
        try {
          const pingsRes = await fetch(
            `https://cronitor.io/api/monitors/${encodeURIComponent(monitorKey)}/pings?limit=500`,
            {
              cache: "no-store",
              headers: authHeader,
            },
          )

          if (pingsRes.ok) {
            const pingsData: CronitorPingsResponse = await pingsRes.json()
            const pings = pingsData.pings || []

            // Filter pings to last 30 hours
            const cutoffTime = (Date.now() / 1000) - (HISTORY_HOURS * 3600)
            const recentPings = pings.filter((p: PingEntry) => p.stamp && p.stamp >= cutoffTime)

            const events = normalizePings(recentPings)
            uptime = buildHistory(events, HISTORY_HOURS)
          } else {
            console.error("Cronitor pings error:", await pingsRes.text())
          }
        } catch (error) {
          console.error(`Error fetching pings for monitor ${monitorKey}:`, error)
        }

        // If no history, fill based on current status
        if (uptime.every((entry) => entry === null)) {
          // Fill all hours with current status when no historical data is available
          const statusValue = status === "up" ? true : status === "down" ? false : null
          uptime = Array(HISTORY_HOURS).fill(statusValue)
        }

        const lastPoint = lastKnownStatus(uptime)
        if (!statusCode && lastPoint !== null) {
          statusCode = lastPoint ? 200 : 503
          status = lastPoint ? "up" : "down"
        }

        // Use monitor properties from Cronitor API
        const monitorName = monitor.name || monitorKey
        const monitorType = monitor.type || "heartbeat"
        const customIconData = monitorIcons[monitorKey]
        const customIcon = customIconData?.icon || "Server"
        const customIconType = customIconData?.iconType || "preset"

        return {
          id: monitorKey,
          name: monitorName,
          provider: monitorType,
          providerIcon: customIcon,
          iconType: customIconType,
          status,
          statusCode,
          uptime,
        }
      }),
    )

    const anyDown = servers.some(
      (monitor) => monitor.status === "down" || monitor.uptime.some((point) => point === false),
    )
    const globalStatus = anyDown ? "outage" : "operational"

    return NextResponse.json({
      servers,
      globalStatus,
    })
  } catch (error) {
    console.error("Error in status API:", error)
    return new NextResponse("Internal Server Error", { status: 500 })
  }
}
