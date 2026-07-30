import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { syteAgentScreenshotImage } from "@/lib/deploy/syte-client"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * GET /api/projects/[id]/agent/screenshots/[shotId]?variant=thumb|full
 *
 * Proxies Syte screenshot PNGs so the browser never needs DEPLOYER_API_KEY.
 * Docs: https://sycord.site/api/#agent
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; shotId: string }> },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id: projectId, shotId } = await params
  if (!projectId || !shotId) {
    return Response.json({ message: "Project ID and screenshot id are required." }, { status: 400 })
  }

  const { searchParams } = new URL(request.url)
  const variant = searchParams.get("variant") === "thumb" ? "thumb" : "full"

  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, session.user.id, projectId)
  if (!project) {
    return Response.json({ message: "Project not found" }, { status: 404 })
  }

  const workspace = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in workspace) {
    return Response.json({ message: workspace.error, needsCreate: true }, { status: 409 })
  }

  const image = await syteAgentScreenshotImage(workspace.uuid, shotId, variant)
  if (!image.ok || !image.data) {
    return Response.json(
      { message: image.error || "Screenshot not found." },
      { status: image.status || 404 },
    )
  }

  return new Response(image.data, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=300",
    },
  })
}
