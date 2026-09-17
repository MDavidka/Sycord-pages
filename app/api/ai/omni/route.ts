import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { syteGetOmniModels, syteSelectOmniModel } from "@/lib/deploy/syte-client"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const projectId = searchParams.get("project_id") || "global"

  const result = await syteGetOmniModels(projectId)
  if (!result.ok || !result.data) {
    return NextResponse.json({ ok: false, error: result.error || "Failed to fetch Omni models" }, { status: result.status || 500 })
  }

  return NextResponse.json(result.data)
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { model_id, project_id, provider } = body

    if (!model_id) {
      return NextResponse.json({ ok: false, error: "model_id is required" }, { status: 400 })
    }

    const result = await syteSelectOmniModel(model_id, project_id || "global", provider)
    if (!result.ok || !result.data) {
      return NextResponse.json({ ok: false, error: result.error || "Failed to select model" }, { status: result.status || 500 })
    }

    return NextResponse.json(result.data)
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err?.message || "Invalid JSON payload" }, { status: 400 })
  }
}
