import { NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "SSH-based deployment streaming has been replaced by Dokploy. Use /api/workspace/deploy for Dokploy deployments.",
    },
    { status: 410 },
  )
}
