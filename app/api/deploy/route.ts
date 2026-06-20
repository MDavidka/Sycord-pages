import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "SSH-based deployment has been replaced by Dokploy. Use /api/workspace/deploy instead.",
    },
    { status: 410 },
  )
}

export async function GET() {
  return NextResponse.json(
    {
      success: false,
      error: "SSH-based deployment has been replaced by Dokploy. Use /api/deploy/dokploy to manage containers.",
    },
    { status: 410 },
  )
}
