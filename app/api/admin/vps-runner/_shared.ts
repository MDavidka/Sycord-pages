import { NextResponse } from "next/server"
import { isAdmin } from "@/lib/is-admin"
import clientPromise from "@/lib/mongodb"

const VPS_SERVER_URL = process.env.VPS_SERVER_URL || "http://127.0.0.1:5050"

export async function assertAdmin() {
  return isAdmin()
}

/**
 * Resolve the runner bearer token from a single source of truth so the proxy
 * always presents the SAME token that was installed on the VM runner service.
 * Preference order: VPS_RUNNER_TOKEN env -> persisted token in `deployer_config`.
 * Without this, the runner returns 401 "Unauthorized" whenever the installed
 * token differs from what the server sends (the cause of false "unauthenticated").
 */
export async function resolveRunnerToken(): Promise<string | null> {
  if (process.env.VPS_RUNNER_TOKEN) return process.env.VPS_RUNNER_TOKEN
  try {
    const client = await clientPromise
    const db = client.db()
    const doc = await db.collection("deployer_config").findOne({ key: "vm_runner" })
    return (doc?.token as string) || null
  } catch {
    return null
  }
}

export function runnerHeaders(extra?: HeadersInit, token?: string | null) {
  const headers = new Headers(extra)
  headers.set("Content-Type", "application/json")
  const bearer = token ?? process.env.VPS_RUNNER_TOKEN
  if (bearer) {
    headers.set("Authorization", `Bearer ${bearer}`)
  }
  return headers
}

export async function proxyRunner(path: string, init?: RequestInit) {
  try {
    const token = await resolveRunnerToken()
    const response = await fetch(`${VPS_SERVER_URL}${path}`, {
      ...init,
      headers: runnerHeaders(init?.headers, token),
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
