import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { ObjectId } from "mongodb"
import clientPromise from "@/lib/mongodb"
import { runSyraPipeline } from "@/lib/ai/pipeline"
import type { Intent, ModelSelection } from "@/lib/ai/types"

const HISTORY_MAX = 50

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  const url = new URL(request.url)
  const pid = url.searchParams.get("projectId") || ""
  const file = url.searchParams.get("file") || ""
  const hist = url.searchParams.get("history") === "1"
  if (!pid || !ObjectId.isValid(pid)) return NextResponse.json({ error: "Invalid projectId" }, { status: 400 })
  try {
    const c = await clientPromise
    const db = c.db()
    const u = await db.collection("users").findOne({ id: session.user.id, projects: { $elemMatch: { _id: new ObjectId(pid) } } }, { projection: { "projects.$": 1 } })
    if (!u?.projects?.[0]) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const proj = u.projects[0]
    const pages = (proj.pages || []).map((p: any) => ({ name: p.name, usedFor: p.usedFor || "", code: p.content || p.code || "", updatedAt: p.updatedAt }))
    const history = proj.buildHistory || []
    if (hist) return NextResponse.json({ history: history.slice(0, HISTORY_MAX) })
    if (file) {
      const pg = pages.find((p: any) => p.name === file)
      return pg ? NextResponse.json({ file: pg }) : NextResponse.json({ error: "File not found" }, { status: 404 })
    }
    return NextResponse.json({ pages, history: history.slice(0, HISTORY_MAX) })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return new Response("Unauthorized", { status: 401 })
  const enc = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(ctrl) {
      const push = (ev: string, d: unknown) => {
        if (closed) return
        try { ctrl.enqueue(enc.encode(`event: ${ev}\ndata: ${JSON.stringify(d)}\n\n`)) } catch { closed = true }
      }
      const finish = () => {
        if (closed) return
        try { ctrl.enqueue(enc.encode("event: done\ndata: {}\n\n")); ctrl.close() } catch {}
        closed = true
      }

      try {
        const body = await request.json().catch(() => ({}))
        const prompt = String(body.prompt ?? "").trim()
        const pid = String(body.projectId ?? "")
        const requestedMode = String(body.mode ?? "") as Intent | undefined
        const model: ModelSelection = {
          id: String(body.modelId ?? "deepseek-v4-pro"),
          provider: String(body.provider ?? "DeepSeek"),
        }

        if (!prompt || !pid) {
          push("error", { message: "prompt + projectId required" })
          finish()
          return
        }

        push("stage", { id: "step-1", stage: "input", status: "running", message: `"${prompt}"\nModel: ${model.provider} \u00B7 ${model.id}` })

        const result = await runSyraPipeline({
          userId: session.user.id,
          projectId: pid,
          prompt,
          model,
          requestedMode,
          temperature: 0.2,
          maxRepairPasses: 2,
          onEvent: (event, data) => {
            if (event === "file" && data.name) {
              push("page", { name: data.name, code: (data as any).content ?? "", usedFor: (data as any).usedFor ?? "", timestamp: Date.now() })
            }
            push(event, data)
          },
        })

        push("stage", { id: "step-done", stage: "complete", status: "done", message: `${result.pages.length} files saved.` })
        finish()
      } catch (err: any) {
        push("error", { message: `Pipeline error: ${err.message}` })
        finish()
      }
    },
    cancel() {
      closed = true
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
