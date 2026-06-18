import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/is-admin"

const VPS_SERVER_URL = process.env.VPS_SERVER_URL || "http://127.0.0.1:5051"

export async function assertAdmin() {
  return isAdmin()
}

export function runnerHeaders(extra?: HeadersInit) {
  const headers = new Headers(extra)
  headers.set("Content-Type", "application/json")
  if (process.env.VPS_RUNNER_TOKEN) {
    headers.set("Authorization", `Bearer ${process.env.VPS_RUNNER_TOKEN}`)
  }
  return headers
}

export async function proxyRunner(path: string, init?: RequestInit) {
  try {
    const response = await fetch(`${VPS_SERVER_URL}${path}`, {
      ...init,
      headers: runnerHeaders(init?.headers),
    })

    const text = await response.text()
    return new Response(text || JSON.stringify({ success: response.ok }), {
      status: response.status,
      headers: {
        "Content-Type": response.headers.get("content-type") || "application/json",
      },
    })
  } catch {
    return NextResponse.json(
      {
        success: false,
        online: false,
        error: "Runner API is unavailable",
      },
      { status: 503 },
    )
  }
}

export async function requireAdminResponse() {
  if (!(await assertAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  return null
}
