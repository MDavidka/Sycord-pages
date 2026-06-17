import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { probeSshConnection, getVpsDiagnostics, getVpsDebugInfo } from "@/lib/deploy/ssh-deploy"
import clientPromise from "@/lib/mongodb"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [sshProbe, vpsDiag] = await Promise.all([
    probeSshConnection(),
    getVpsDiagnostics(),
  ])

  let containerCount = 0
  try {
    const client = await clientPromise
    const db = client.db()
    containerCount = await db.collection("containers").countDocuments()
  } catch {}

  return NextResponse.json({
    timestamp: new Date().toISOString(),
    vps: {
      config: getVpsDebugInfo(),
      sshReachable: sshProbe.reachable,
      sshError: sshProbe.error || null,
      diagnostics: vpsDiag,
    },
    containers: {
      total: containerCount,
    },
    env: {
      VPS_HOST_set: !!process.env.VPS_HOST,
      VPS_USERNAME_set: !!process.env.VPS_USERNAME,
      VPS_ROOT_PSW_set: !!process.env.VPS_ROOT_PSW,
    },
  })
}
