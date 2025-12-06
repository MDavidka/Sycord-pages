import { NextResponse } from "next/server"
import clientPromise from "@/lib/mongodb"

export async function GET(request: Request) {
  // Verify this is from a cron job
  const authHeader = request.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db()

    // Find deployments with no subdomain
    const deploymentsWithoutSubdomain = await db
      .collection("deployments")
      .find({
        $or: [{ subdomain: null }, { subdomain: "" }, { subdomain: undefined }],
      })
      .toArray()

    console.log("[v0] Found deployments without subdomain:", deploymentsWithoutSubdomain.length)

    // Delete them
    if (deploymentsWithoutSubdomain.length > 0) {
      const result = await db.collection("deployments").deleteMany({
        $or: [{ subdomain: null }, { subdomain: "" }, { subdomain: undefined }],
      })

      console.log("[v0] Deleted deployments:", result.deletedCount)

      return NextResponse.json({
        success: true,
        deletedCount: result.deletedCount,
      })
    }

    return NextResponse.json({
      success: true,
      deletedCount: 0,
      message: "No deployments to clean up",
    })
  } catch (error: any) {
    console.error("[v0] Cron cleanup error:", error)
    return NextResponse.json({ message: "Cleanup failed", error: error.message }, { status: 500 })
  }
}
