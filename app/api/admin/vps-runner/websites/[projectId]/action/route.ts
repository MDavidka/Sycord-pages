import { NextResponse } from "next/server"
import { proxyRunner, requireAdminResponse } from "../../../_shared"

const ACTION_PATHS: Record<string, (projectId: string) => string> = {
  start: (projectId) => `/api/websites/${projectId}/start`,
  stop: (projectId) => `/api/websites/${projectId}/stop`,
  restart: (projectId) => `/api/websites/${projectId}/restart`,
  health: (projectId) => `/api/websites/${projectId}/health`,
  destroy: (projectId) => `/api/websites/${projectId}`,
}

export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const { projectId } = await params
  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }
  const action = typeof body.action === "string" ? body.action : ""
  const pathFactory = ACTION_PATHS[action]
  if (!pathFactory) {
    return NextResponse.json({ success: false, error: "Invalid website action" }, { status: 400 })
  }

  return proxyRunner(pathFactory(projectId), {
    method: action === "destroy" ? "DELETE" : "POST",
  })
}
