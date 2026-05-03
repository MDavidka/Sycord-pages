import { proxyRunner, requireAdminResponse } from "../../../_shared"

export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const { projectId } = await params
  const { searchParams } = new URL(request.url)
  const type = searchParams.get("type") || "runtime"
  const limit = searchParams.get("limit") || "200"

  return proxyRunner(
    `/api/websites/${projectId}/logs?type=${encodeURIComponent(type)}&limit=${encodeURIComponent(limit)}`,
  )
}
