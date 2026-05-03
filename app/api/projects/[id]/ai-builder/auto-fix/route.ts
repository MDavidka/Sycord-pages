import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"
import { autoFixGeneratedProject } from "@/lib/ai-website-builder/auto-fix"
import { runBuildValidation } from "@/lib/ai-website-builder/validate"

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  const { id } = await params
  if (!ObjectId.isValid(id)) return NextResponse.json({ message: "Invalid project id" }, { status: 400 })
  const body = await req.json().catch(() => ({})) as { logs?: string; source?: string }

  const db = (await clientPromise).db()
  const user = await db.collection("users").findOne({ id: session.user.id, "projects._id": new ObjectId(id) })
  const project = user?.projects?.find((p: any) => p._id?.toString() === id)
  if (!project) return NextResponse.json({ message: "Project not found" }, { status: 404 })

  const files = (project.pages ?? []).map((p: any) => ({ path: p.name, content: p.content }))
  const build = runBuildValidation(files, { needsDatabase: false, deploymentMode: "next-server" })
  const fix = await autoFixGeneratedProject({
    files,
    manifest: { ...(project.lastBuilderRun?.manifest ?? {}), deploymentMode: "next-server" },
    errors: build.errors,
    warnings: build.warnings,
    logs: body.logs ? [{ step: body.source ?? "manual", detail: body.logs }] : [],
    maxAttempts: 2,
  } as any)

  const updatedBuild = runBuildValidation(fix.files, { needsDatabase: false, deploymentMode: "next-server" })
  await db.collection("users").updateOne(
    { id: session.user.id, "projects._id": new ObjectId(id) },
    {
      $set: {
        "projects.$.pages": fix.files.map((f) => ({ name: f.path, content: f.content, usedFor: "ai-builder", updatedAt: new Date(), createdAt: new Date() })),
        "projects.$.lastBuilderRun.autoFix": {
          attempted: true,
          attempts: fix.attempts,
          fixed: fix.fixed,
          errorsBefore: fix.errorsBefore,
          errorsAfter: updatedBuild.errors,
          changedFiles: fix.changedFiles,
        },
        "projects.$.lastBuilderRun.events": fix.events,
      },
    },
  )

  return NextResponse.json({ success: true, autoFix: fix, build: updatedBuild, events: fix.events })
}
