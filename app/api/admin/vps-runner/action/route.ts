import { NextResponse } from "next/server"
import { assertAdmin, proxyRunner } from "../_shared"

export async function POST(request: Request) {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await request.text()
  return proxyRunner("/api/action", { method: "POST", body })
}
