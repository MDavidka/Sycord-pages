import { NextResponse } from "next/server"
import { requireModerator } from "@/lib/moderator-types"
import { executeAstroTask, ASTRO_ALLOWLISTED_TASKS } from "@/lib/admin/astro-tasks"
import clientPromise from "@/lib/torso"

export const dynamic = "force-dynamic"

const BENCHMARK_PROFILES = [
  {
    id: "synthetic_cpu_burst",
    name: "CPU Compute Burst",
    profile: "synthetic_cpu_burst" as const,
    description: "5-second single-core SHA-256 compute burst measuring raw hashing operations/sec.",
    target: "CPU",
    expectedDuration: "~5-7s",
  },
  {
    id: "io_throughput_probe",
    name: "Disk I/O Sequential Write Probe",
    profile: "io_throughput_probe" as const,
    description: "64MB sequential direct block write with fdatasync barrier to measure disk latency and bandwidth.",
    target: "Disk Storage",
    expectedDuration: "~3-6s",
  },
  {
    id: "runner_latency_ping",
    name: "Runner Endpoint Latency Ping",
    profile: "runner_latency_ping" as const,
    description: "10 consecutive HTTP roundtrips to http://127.0.0.1:5050/api/status to measure response jitter and min/avg/max latency.",
    target: "Network / Loopback",
    expectedDuration: "~2-5s",
  },
]

export async function GET() {
  try {
    await requireModerator()

    let history: any[] = []
    try {
      const client = await clientPromise
      const db = client.db()
      history = await db
        .collection("moderation_benchmarks")
        .find({})
        .sort({ executedAt: -1 })
        .limit(20)
        .toArray()
    } catch {
      // In case database is not available
    }

    return NextResponse.json({
      ok: true,
      profiles: BENCHMARK_PROFILES,
      history,
    })
  } catch (err: any) {
    const status = err?.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ ok: false, error: err?.message || "Failed to retrieve benchmarks" }, { status })
  }
}

export async function POST(request: Request) {
  try {
    const mod = await requireModerator()
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
    }

    const { profile } = body || {}
    const profileDef = BENCHMARK_PROFILES.find((p) => p.id === profile)
    if (!profileDef) {
      return NextResponse.json(
        {
          ok: false,
          error: `Invalid benchmark profile. Allowed profiles: ${BENCHMARK_PROFILES.map((p) => p.id).join(", ")}`,
        },
        { status: 400 },
      )
    }

    const taskDef = ASTRO_ALLOWLISTED_TASKS[profileDef.id]
    if (!taskDef) {
      return NextResponse.json({ ok: false, error: "Benchmark task definition not found" }, { status: 404 })
    }

    const taskResult = await executeAstroTask(profileDef.id, {
      moderatorEmail: mod.email,
      approved: true,
      reason: `Moderator initiated performance benchmark: ${profileDef.name}`,
    })

    // Extract score from logs
    let score: string | null = null
    if (taskResult.success) {
      if (profile === "synthetic_cpu_burst") {
        const match = taskResult.stdout.match(/(\d[\d,]*\s+iter\/sec)/)
        score = match ? match[1] : `${taskResult.durationMs}ms`
      } else if (profile === "io_throughput_probe") {
        const match = taskResult.stdout.match(/(\d+(?:\.\d+)?\s*(?:MB|GB|kB)\/s)/i)
        score = match ? match[1] : `${taskResult.durationMs}ms`
      } else if (profile === "runner_latency_ping") {
        const match = taskResult.stdout.match(/(avg=[\d.]+ms)/)
        score = match ? match[1] : `${taskResult.durationMs}ms`
      }
    }

    const benchmarkEntry = {
      id: `bench_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      profile: profileDef.id,
      name: profileDef.name,
      status: taskResult.success ? ("completed" as const) : ("failed" as const),
      score,
      durationMs: taskResult.durationMs,
      executedAt: taskResult.executedAt,
      moderatorEmail: mod.email,
      logs: taskResult.stdout || taskResult.stderr,
      error: taskResult.error || null,
    }

    try {
      const client = await clientPromise
      const db = client.db()
      await db.collection("moderation_benchmarks").insertOne(benchmarkEntry)
    } catch {
      // Storage failure must not block the response
    }

    return NextResponse.json({
      ok: taskResult.success,
      benchmark: benchmarkEntry,
    })
  } catch (err: any) {
    const status = err?.message?.includes("Unauthorized") ? 401 : 500
    return NextResponse.json({ ok: false, error: err?.message || "Benchmark failed" }, { status })
  }
}
