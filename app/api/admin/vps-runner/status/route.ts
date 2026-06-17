import { NextResponse } from "next/server"
import { buildAdminStatus } from "@/lib/admin/workspace-provision"
import { requireAdminResponse } from "../_shared"

export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  try {
    const status = await buildAdminStatus()
    return NextResponse.json(status, { status: status.success ? 200 : 503 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, online: false, apiOnline: false, error: error?.message || "Host unreachable" },
      { status: 503 },
    )
  }
}
