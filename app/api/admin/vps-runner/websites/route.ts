import { NextResponse } from "next/server"
import { assertAdmin, proxyRunner } from "../_shared"

export async function GET() {
  if (!(await assertAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return proxyRunner("/api/websites")
}
