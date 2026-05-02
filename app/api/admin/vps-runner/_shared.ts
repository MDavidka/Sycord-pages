import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const VPS_SERVER_URL = process.env.VPS_SERVER_URL || ""
const VPS_RUNNER_TOKEN = process.env.VPS_RUNNER_TOKEN || ""

export async function assertAdmin() {
  const session = await getServerSession(authOptions)
  const email = session?.user?.email
  const allowed = email && (email === process.env.ADMIN_EMAIL || email === "dmarton336@gmail.com")
  return Boolean(allowed)
}

export async function proxyRunner(path: string, init?: RequestInit) {
  if (!VPS_SERVER_URL || !VPS_RUNNER_TOKEN) {
    return new Response(JSON.stringify({ success: false, error: "Runner is not configured" }), { status: 500 })
  }

  try {
    const res = await fetch(`${VPS_SERVER_URL}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VPS_RUNNER_TOKEN}`,
        ...(init?.headers || {}),
      },
    })

    const data = await res.json().catch(() => ({ success: false, error: "Invalid runner response" }))
    return new Response(JSON.stringify(data), { status: res.status, headers: { "Content-Type": "application/json" } })
  } catch {
    return new Response(JSON.stringify({ success: false, online: false, error: "Runner VM appears offline" }), { status: 503, headers: { "Content-Type": "application/json" } })
  }
}
