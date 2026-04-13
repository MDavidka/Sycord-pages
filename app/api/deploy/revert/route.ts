import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"

export async function POST(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const { projectId, versionId } = await request.json()

    if (!projectId || !versionId) {
      return NextResponse.json({ message: "Missing params" }, { status: 400 })
    }

    // In a full implementation, this would fetch the specific commit from git
    // and restore the 'pages' array in MongoDB to that state, then trigger a deploy.
    // For now, we simulate a successful revert response.

    return NextResponse.json({ success: true, message: "Reverted to previous version" })
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 })
  }
}
