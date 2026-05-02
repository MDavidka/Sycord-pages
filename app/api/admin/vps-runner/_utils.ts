import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const VPS_SERVER_URL = process.env.VPS_SERVER_URL || "http://127.0.0.1:5000"
const VPS_RUNNER_TOKEN = process.env.VPS_RUNNER_TOKEN || ""

export async function ensureAdmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.email === "dmarton336@gmail.com"
}

export async function requestRunner(path: string, init: RequestInit = {}) {
  const sanitizedPath = path.replace(/^\/+/, "")
  const url = new URL(`/api/${sanitizedPath}`, VPS_SERVER_URL)

  try {
    const response = await fetch(url.toString(), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${VPS_RUNNER_TOKEN}`,
        ...(init.headers || {}),
      },
    })

    const data = await response.json().catch(() => ({}))

    return {
      ok: response.ok,
      status: response.status,
      data,
    }
  } catch (error) {
    return {
      ok: false,
      status: 503,
      data: { error: "Runner offline" },
      error,
    }
  }
}
