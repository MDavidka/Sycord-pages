import { NextResponse } from "next/server"
import { ensureAdmin, requestRunner } from "../_utils"

async function proxyRequest(request: Request, path: string[]) {
  if (!(await ensureAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const search = new URL(request.url).search
  const targetPath = `${path.join("/")}${search}`

  let body = undefined
  if (request.method !== "GET" && request.method !== "HEAD") {
    const clone = request.clone()
    body = await clone.text()
  }

  const result = await requestRunner(targetPath, {
    method: request.method,
    body: body || undefined,
  })

  return NextResponse.json(result.data ?? {}, { status: result.ok ? 200 : result.status })
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
