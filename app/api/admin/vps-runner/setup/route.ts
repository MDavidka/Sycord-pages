import { NextResponse } from "next/server"
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { assertAdmin, proxyRunner } from "../_shared"

const execFileAsync = promisify(execFile)

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return proxyRunner("/api/setup/status")
}

export async function POST() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const upstream = await proxyRunner("/api/setup", { method: "POST" })
  if (upstream.status !== 503) return upstream

  try {
    const scriptPath = path.join(process.cwd(), "scripts", "runner-auto-setup.sh")
    const { stdout, stderr } = await execFileAsync("bash", [scriptPath], { timeout: 120000 })
    return NextResponse.json({ success: true, message: "Runner auto-setup completed.", logs: `${stdout}
${stderr}`.trim() })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: "Auto-setup failed", details: error?.stderr || error?.message || "unknown error" }, { status: 500 })
  }
}
