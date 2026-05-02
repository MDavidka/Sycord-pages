import { NextResponse } from "next/server"
import { ensureAdmin, requestRunner } from "../_utils"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const normalizeStatus = (status: any) => {
  if (typeof status === "string") return status
  if (typeof status === "boolean") return status ? "running" : "stopped"
  if (status?.running === true) return "running"
  if (status?.running === false) return "stopped"
  return undefined
}

const normalizeHealth = (health: any) => {
  if (typeof health === "string") return health
  if (typeof health === "boolean") return health ? "healthy" : "unhealthy"
  if (typeof health?.ok === "boolean") return health.ok ? "healthy" : "unhealthy"
  if (typeof health?.healthy === "boolean") return health.healthy ? "healthy" : "unhealthy"
  return undefined
}

const normalizeWebsite = (raw: any) => {
  const idValue = raw?.id ?? raw?.projectId ?? raw?.slug ?? raw?.name ?? raw?.subdomain ?? raw?.domain
  const id = idValue != null ? String(idValue) : undefined
  const domain = raw?.domain ?? raw?.url ?? (raw?.subdomain ? `${raw.subdomain}.sycord.site` : undefined)
  const status = normalizeStatus(raw?.status ?? raw?.state ?? raw?.running)
  const health = normalizeHealth(raw?.health ?? raw?.health_ok ?? raw?.healthOk)

  return {
    id,
    projectId: raw?.projectId != null ? String(raw.projectId) : id,
    name: raw?.name ?? raw?.projectName ?? raw?.businessName ?? raw?.subdomain ?? id,
    domain,
    port: raw?.port ?? raw?.assignedPort,
    processName: raw?.processName ?? raw?.pm2Name ?? raw?.process,
    status,
    health,
    cpu: raw?.cpu ?? raw?.cpuPercent,
    memory: raw?.memory ?? raw?.mem,
    restartCount: raw?.restartCount ?? raw?.restarts,
    lastDeploy: raw?.lastDeploy ?? raw?.lastDeployedAt,
    lastHealthCheck: raw?.lastHealthCheck ?? raw?.lastHealthAt,
    lastError: raw?.lastError ?? raw?.error,
  }
}

export async function GET() {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const result = await requestRunner("websites")

  if (!result.ok) {
    return NextResponse.json(
      { success: false, websites: [], error: result.data?.error || "Runner offline" },
      { status: result.status },
    )
  }

  const list = Array.isArray(result.data)
    ? result.data
    : Array.isArray(result.data?.websites)
      ? result.data.websites
      : []

  const websites = list.map(normalizeWebsite).filter((site) => site.id)

  return NextResponse.json({ success: true, websites })
}
