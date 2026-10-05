import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import {
  getSyteConfig,
  syteGetLogs,
  sytePreviewStatus,
  pickSytePreviewUrl,
  useSyteWorkspace,
} from "@/lib/deploy/syte-client"
import { getStoredSyteUuid } from "@/lib/deploy/syte-workspace"
import { isValidProjectId } from "@/lib/workspace/sandbox"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 180

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").trim()
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ ok: false, error: "Missing or invalid project ID" }, { status: 400 })
  }

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const uuid = getStoredSyteUuid(project) || projectId

  // 1. Deployment Logs
  let deploymentLogs = ""
  try {
    const logsRes = await syteGetLogs(uuid, 200)
    if (logsRes.ok && logsRes.data) {
      deploymentLogs = typeof logsRes.data === "string" ? logsRes.data : JSON.stringify(logsRes.data, null, 2)
    }
  } catch (err: any) {
    deploymentLogs = `Could not fetch deployment logs: ${err?.message || err}`
  }

  // 2. Preview Server Status & URL
  let previewRunning = false
  let previewReady = false
  let previewUrl: string | null = null
  let devServerLogs = ""

  try {
    const statusRes = await sytePreviewStatus(uuid)
    if (statusRes.ok && statusRes.data) {
      const pData = statusRes.data as any
      previewRunning = Boolean(pData.preview_running)
      previewReady = Boolean(pData.preview_ready)
      previewUrl = pickSytePreviewUrl(pData)
    }
  } catch {
    // preview status non-fatal
  }

  // 3. Browser Logs & Screenshot via Syte preview access
  let browserLogs: any[] = []
  let browserErrors: any[] = []
  let screenshotAvailable = false
  let screenshotUrl: string | null = null

  if (useSyteWorkspace() && previewUrl) {
    try {
      const config = getSyteConfig()
      const accessRes = await fetch(`${config.baseUrl}/api/projects/${encodeURIComponent(uuid)}/agent/access`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": config.apiKey,
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          action: "console",
          url: previewUrl,
          include_screenshot: false,
        }),
      })
      if (accessRes.ok) {
        const accessData = await accessRes.json().catch(() => ({}))
        browserLogs = Array.isArray(accessData?.console) ? accessData.console : []
        browserErrors = Array.isArray(accessData?.errors) ? accessData.errors : []
      }
    } catch {
      // browser console non-fatal
    }
  }

  // Build the complete Action Box environment JSON
  const actionBox = {
    ok: true,
    projectId,
    uuid,
    timestamp: new Date().toISOString(),
    deployment: {
      status: project.status || "deployed",
      domain: project.domain || null,
      cloudflareUrl: project.cloudflareUrl || null,
      lastDeployedAt: project.deploymentRuntime?.lastDeployedAt || project.updatedAt || null,
      logs: deploymentLogs,
    },
    preview: {
      running: previewRunning,
      ready: previewReady,
      url: previewUrl,
      logs: devServerLogs,
    },
    browser: {
      chromiumReady: true,
      previewUrl,
      consoleLogs: browserLogs,
      errors: browserErrors,
      screenshotAvailable,
      screenshotUrl,
    },
    environment: {
      nodeEnv: process.env.NODE_ENV || "production",
      configured: useSyteWorkspace(),
    },
  }

  return NextResponse.json(actionBox, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  })
}
