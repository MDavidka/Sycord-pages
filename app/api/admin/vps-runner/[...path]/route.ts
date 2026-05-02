import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

const VPS_SERVER_URL = process.env.VPS_SERVER_URL || "http://127.0.0.1:5000"
const VPS_RUNNER_TOKEN = process.env.VPS_RUNNER_TOKEN || ""

async function proxyRequest(request: Request, path: string[]) {
  try {
    const session = await getServerSession(authOptions)
    // Basic admin check
    if (!session?.user?.email || session.user.email !== process.env.ADMIN_EMAIL && session.user.email !== "dmarton336@gmail.com") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = `${VPS_SERVER_URL}/api/${path.join("/")}`
    
    let body = undefined
    if (request.method !== "GET" && request.method !== "HEAD") {
      const clone = request.clone()
      body = await clone.text()
    }

    const response = await fetch(url, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${VPS_RUNNER_TOKEN}`,
      },
      body: body ? body : undefined,
    })

    const data = await response.json().catch(() => ({}))
    
    return NextResponse.json(data, { status: response.status })
  } catch (error: any) {
    console.error("[VPS Proxy] Error:", error)
    return NextResponse.json({ error: "Failed to connect to VPS" }, { status: 500 })
  }
}

export async function GET(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path)
}

export async function POST(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path)
}

export async function DELETE(request: Request, { params }: { params: { path: string[] } }) {
  return proxyRequest(request, params.path)
}
