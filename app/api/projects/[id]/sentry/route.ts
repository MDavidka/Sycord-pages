import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"
import { classifySentryIssuesSequentially } from "@/lib/sentry-ai"
import {
  createUnclassifiedSentryIssue,
  extractVmDeploymentIssue,
  normalizeVmLogInput,
  type SentryIssue,
} from "@/lib/sentry-log-parser"

type ProjectDoc = {
  _id: ObjectId
  githubRepoId?: string | number
  sentryIssues?: SentryIssue[]
  websiteRuntimeLogs?: string[]
}

async function loadOwnedProject(userId: string, projectId: string) {
  if (!ObjectId.isValid(projectId)) return null
  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    { projection: { "projects.$": 1 } },
  )
  const project = Array.isArray(user?.projects) ? user.projects[0] as ProjectDoc | undefined : undefined
  if (!project) return null
  return { db, project }
}

function serializeIssue(issue: SentryIssue) {
  return {
    ...issue,
    createdAt: issue.createdAt instanceof Date ? issue.createdAt.toISOString() : issue.createdAt,
    updatedAt: issue.updatedAt instanceof Date ? issue.updatedAt.toISOString() : issue.updatedAt,
  }
}

async function fetchVmLogs(repoId?: string | number) {
  if (!repoId) return []
  try {
    const response = await fetch(`https://micro1.sycord.com/api/logs?project_id=${repoId}&limit=200`, {
      cache: "no-store",
    })
    if (!response.ok) return []
    const data = await response.json().catch(() => null) as { success?: boolean; logs?: unknown } | null
    if (!data?.success) return []
    return normalizeVmLogInput(data.logs)
  } catch {
    return []
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const owned = await loadOwnedProject(session.user.id, id)
  if (!owned) {
    return NextResponse.json({ message: "Project not found" }, { status: ObjectId.isValid(id) ? 404 : 400 })
  }

  const issues = Array.isArray(owned.project.sentryIssues) ? owned.project.sentryIssues : []
  return NextResponse.json({
    issues: issues.map(serializeIssue),
    actionableCount: issues.filter((issue) => issue.status === "marked" || issue.aiDecision === "mark").length,
  })
}

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const owned = await loadOwnedProject(session.user.id, id)
  if (!owned) {
    return NextResponse.json({ message: "Project not found" }, { status: ObjectId.isValid(id) ? 404 : 400 })
  }

  const existing = Array.isArray(owned.project.sentryIssues) ? owned.project.sentryIssues : []
  const existingHashes = new Set(existing.map((issue) => issue.logHash))
  const newIssues: SentryIssue[] = []

  const vmLogs = await fetchVmLogs(owned.project.githubRepoId)
  const vmIssue = extractVmDeploymentIssue({
    projectId: id,
    logs: vmLogs,
    source: "vm-deploy",
    deploymentId: owned.project.githubRepoId ? String(owned.project.githubRepoId) : undefined,
  })
  if (vmIssue && !existingHashes.has(vmIssue.logHash)) {
    newIssues.push(createUnclassifiedSentryIssue({ projectId: id, ...vmIssue }))
  }

  const runtimeLogs = normalizeVmLogInput(owned.project.websiteRuntimeLogs)
  const runtimeIssue = extractVmDeploymentIssue({
    projectId: id,
    logs: runtimeLogs,
    source: "website-runtime",
  })
  if (runtimeIssue && !existingHashes.has(runtimeIssue.logHash)) {
    newIssues.push(createUnclassifiedSentryIssue({ projectId: id, ...runtimeIssue }))
  }

  const classifiedNewIssues = await classifySentryIssuesSequentially(newIssues)
  if (classifiedNewIssues.length > 0) {
    await owned.db.collection("users").updateOne(
      { id: session.user.id, "projects._id": new ObjectId(id) },
      {
        $push: {
          "projects.$.sentryIssues": { $each: classifiedNewIssues },
        },
        $set: {
          "projects.$.updatedAt": new Date(),
        },
      } as any,
    )
  }

  const issues = [...existing, ...classifiedNewIssues]
  return NextResponse.json({
    issues: issues.map(serializeIssue),
    newIssues: classifiedNewIssues.length,
    actionableCount: issues.filter((issue) => issue.status === "marked" || issue.aiDecision === "mark").length,
  })
}
