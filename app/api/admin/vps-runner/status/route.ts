import { proxyRunner, requireAdminResponse } from "../_shared"

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized
  return proxyRunner("/api/status")
}
