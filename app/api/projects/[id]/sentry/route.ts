import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { classifySentryLog } from "@/lib/sentry-ai"
import { hashLog, isLikelyFailureLog, redactSecrets, type SentrySource } from "@/lib/sentry-log-parser"

type SentryIssue = {
  id: string
  projectId: string
  source: SentrySource
  deploymentId?: string
  rawLog: string
  logHash: string
  status: "new" | "skipped" | "marked" | "fixed"
  aiDecision?: "skip" | "mark"
  errorName?: string
  description?: string
  fixSuggestion?: string
  affectedFile?: string
  createdAt: Date
  updatedAt: Date
}

async function getProject(db: any, userId: string, projectId: string) {
  const user = await db.collection("users").findOne({ id: userId, "projects._id": new ObjectId(projectId) }, { projection: { projects: 1 } })
  return user?.projects?.find((p: any) => p._id.toString() === projectId) ?? null
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 })
  const db = (await clientPromise).db()
  const project = await getProject(db, session.user.id, params.id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })
  return NextResponse.json({ issues: project.sentryIssues ?? [] })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!ObjectId.isValid(params.id)) return NextResponse.json({ error: "Invalid project id" }, { status: 400 })

  const body = await req.json().catch(() => ({})) as { sources?: Array<{ source: SentrySource, rawLog: string, deploymentId?: string }> }
  const db = (await clientPromise).db()
  const project = await getProject(db, session.user.id, params.id)
  if (!project) return NextResponse.json({ error: "Project not found" }, { status: 404 })

  const existing: SentryIssue[] = Array.isArray(project.sentryIssues) ? project.sentryIssues : []
  const existingByHash = new Map(existing.map((i) => [i.logHash, i]))
  const incoming = Array.isArray(body.sources) ? body.sources : []
  const created: SentryIssue[] = []

  for (const sourceLog of incoming) {
    if (!sourceLog?.rawLog || !isLikelyFailureLog(sourceLog.rawLog)) continue
    const logHash = hashLog(sourceLog.source, sourceLog.rawLog, sourceLog.deploymentId)
    if (existingByHash.has(logHash)) continue
    const ai = await classifySentryLog(sourceLog.rawLog)
    const now = new Date()
    created.push({
      id: new ObjectId().toString(),
      projectId: params.id,
      source: sourceLog.source,
      deploymentId: sourceLog.deploymentId,
      rawLog: redactSecrets(sourceLog.rawLog),
      logHash,
      status: ai.decision === "mark" ? "marked" : "skipped",
      aiDecision: ai.decision,
      errorName: ai.errorName,
      description: ai.description,
      fixSuggestion: ai.fixSuggestion,
      affectedFile: ai.affectedFile,
      createdAt: now,
      updatedAt: now,
    })
  }

  if (created.length > 0) {
    await db.collection("users").updateOne(
      { id: session.user.id, "projects._id": new ObjectId(params.id) },
      { $push: { "projects.$.sentryIssues": { $each: created } }, $set: { "projects.$.updatedAt": new Date() } },
    )
  }

  return NextResponse.json({ created: created.length, issues: [...existing, ...created] })
}
