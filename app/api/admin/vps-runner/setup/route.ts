import { NextResponse } from "next/server"
import { buildAdminStatus, probeParentVps } from "@/lib/admin/workspace-provision"
import { parseVpsOverrides, requireAdminResponse } from "../_shared"

// GET: report current host setup status.
export async function GET() {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  try {
    const status = await buildAdminStatus()
    return NextResponse.json(status, { status: status.success ? 200 : 503 })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, online: false, error: error?.message || "Host unreachable" },
      { status: 503 },
    )
  }
}

// POST: lightweight SSH connectivity test to the parent VPS (used by the
// "Test SSH" button). The heavy host bootstrap runs via /setup/stream.
export async function POST(request: Request) {
  const unauthorized = await requireAdminResponse()
  if (unauthorized) return unauthorized

  const body = await request.json().catch(() => ({}))
  const overrides = parseVpsOverrides(body)

  const probe = await probeParentVps(overrides)
  if (!probe.reachable) {
    return NextResponse.json(
      {
        success: false,
        error: overrides
          ? "SSH login failed. Check VM IP and root password."
          : "Parent VPS SSH login failed. Check VPS_HOST and VPS_ROOT_PSW.",
        phase: "ssh-login",
        debug: { sshReachable: false, sshError: probe.error },
      },
      { status: 500 },
    )
  }

  return NextResponse.json({
    success: true,
    message: "SSH connection to parent VPS successful",
    debug: { sshReachable: true, sshError: null },
  })
}
