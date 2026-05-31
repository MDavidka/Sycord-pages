import { NextRequest } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import { callModel, extractJson, type ChatMessage } from "@/lib/ai-provider"
import { readFileSync } from "fs"
import { join } from "path"
import clientPromise from "@/lib/mongodb"
import { ObjectId } from "mongodb"

function loadPrompt(name: string): string {
  try {
    return readFileSync(join(process.cwd(), "prompts", "builder", name), "utf-8")
  } catch {
    return ""
  }
}

interface ConversationState {
  phase: "idle" | "asking" | "planning" | "generating" | "done"
  state: number | null
  questions: string[]
  answers: string[]
  askedCount: number
  plan: string[]
  currentStepIndex: number
  generatedFiles: Array<{ name: string; code: string; usedFor: string }>
  originalRequest: string
}

function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
}

function extractPlanSteps(content: string): string[] {
  const steps: string[] = []
  const lines = content.split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    const match = trimmed.match(/^(\d+)\.\s+(.+)/)
    if (match) {
      steps.push(match[2].trim())
    }
  }
  return steps
}

function extractQuestion(content: string): { text: string; number: number } | null {
  const match = content.match(/\[ask3\/([123])\]\s*(.+?)\s*\[\/ask3\/\1\]/is)
  if (match) {
    return { text: match[2].trim(), number: parseInt(match[1]) }
  }
  return null
}

function extractAskMarker(content: string): string | null {
  const match = content.match(/\[ask\]\s*(.+?)\s*\[\/ask\]/is)
  if (match) {
    return match[1].trim()
  }
  return null
}

function extractCodeBlock(content: string): { code: string } | null {
  const match = content.match(/\[code\]\s*([\s\S]*?)\s*\[\/code\]/i)
  if (match) {
    return { code: match[1].trim() }
  }
  return null
}

function extractFilename(stepDescription: string): string | null {
  const match = stepDescription.match(/%([^%]+)%/)
  if (match) {
    return match[1].trim()
  }
  return null
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  const enc = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(ctrl) {
      const push = (ev: string, d: unknown) => {
        if (closed) return
        try { ctrl.enqueue(enc.encode(sseEvent(ev, d))) } catch { closed = true }
      }
      const done = () => {
        if (closed) return
        try { ctrl.enqueue(enc.encode("event: done\ndata: {}\n\n")); ctrl.close() } catch {}
        closed = true
      }

      try {
        const body = await request.json().catch(() => ({}))
        const prompt = String(body.prompt ?? "").trim()
        const pid = String(body.projectId ?? "")
        const model = {
          id: String(body.modelId ?? "deepseek-v4-pro"),
          provider: String(body.provider ?? "DeepSeek"),
        }
        const conv: ConversationState = body.conversationState || {
          phase: "idle",
          state: null,
          questions: [],
          answers: [],
          askedCount: 0,
          plan: [],
          currentStepIndex: 0,
          generatedFiles: [],
          originalRequest: "",
        }

        if (!prompt || !pid) {
          push("error", { message: "prompt and projectId required" })
          done()
          return
        }

        const identifyPrompt = loadPrompt("identify-state.md")
        const planPrompt = loadPrompt("make-plan.md")
        const codePrompt = loadPrompt("generate-code.md")

        // ──────── PHASE: IDLE → Identify state ────────
        if (conv.phase === "idle") {
          conv.originalRequest = prompt

          push("step", { title: "Analyzing request", detail: "Determining what you need...", status: "running" })

          const stateMsgs: ChatMessage[] = [
            { role: "system", content: identifyPrompt },
            { role: "user", content: prompt },
          ]

          const stateRes = await callModel({ model, messages: stateMsgs, temperature: 0.1 })

          if (!stateRes.ok) {
            push("error", { message: `AI error: ${stateRes.message}` })
            done()
            return
          }

          const parsed = extractJson<{ state: number; reason: string }>(stateRes.content)

          if (!parsed || typeof parsed.state !== "number") {
            push("error", { message: "Failed to determine request type. Please try again." })
            done()
            return
          }

          conv.state = parsed.state
          push("state", { state: parsed.state, reason: parsed.reason })

          // States 2 and 3 not yet implemented
          if (parsed.state !== 1) {
            const messages: Record<number, string> = {
              2: "Bug fix is not yet implemented. Use the Pages tab to manually edit files.",
              3: "Site changes are not yet implemented. Use the Pages tab to manually edit files.",
            }
            push("step", {
              title: `State ${parsed.state}`,
              detail: messages[parsed.state] || `State ${parsed.state} not yet implemented`,
              status: "done",
            })
            done()
            return
          }

          // State 1: Check if enough info → ask question or make plan
          push("step", { title: "Planning", detail: "Checking if I have enough information...", status: "running" })

          const planMsgs: ChatMessage[] = [
            { role: "system", content: planPrompt },
            { role: "user", content: prompt },
          ]

          const planRes = await callModel({ model, messages: planMsgs, temperature: 0.3 })

          if (!planRes.ok) {
            push("error", { message: `AI error: ${planRes.message}` })
            done()
            return
          }

          // Check if the AI asked a question
          const question = extractQuestion(planRes.content)

          if (question) {
            conv.phase = "asking"
            conv.questions.push(question.text)
            conv.askedCount = question.number
            push("question", { text: question.text, number: question.number, max: 3 })
            push("state_update", conv)
            done()
            return
          }

          // Extract plan steps
          const steps = extractPlanSteps(planRes.content)
          if (steps.length === 0) {
            push("error", { message: "Failed to generate a build plan. Please try with more detail." })
            done()
            return
          }

          conv.phase = "planning"
          conv.plan = steps
          conv.currentStepIndex = 0
          push("plan", { steps })
          push("state_update", conv)

          // Immediately start generating the first step
          await generateNextStep(ctrl, push, conv, model, codePrompt, planPrompt, pid, session.user.id)
          done()
          return
        }

        // ──────── PHASE: ASKING → Process answer → next question or plan ────────
        if (conv.phase === "asking") {
          conv.answers.push(prompt)

          push("step", { title: "Processing answer", detail: "Got it! Let me update the plan...", status: "running" })

          const context = buildAskingContext(conv)
          const planMsgs: ChatMessage[] = [
            { role: "system", content: planPrompt },
            { role: "user", content: conv.originalRequest },
            { role: "assistant", content: conv.questions.map((q, i) => `[ask3/${i + 1}] ${q} [/ask3/${i + 1}]`).join("\n\n") },
            ...conv.answers.map((a, i) => ({ role: "user" as const, content: a })),
            { role: "user", content: "Based on the above, produce the build plan now. If you still need more information, ask ONE more question." },
          ]

          const planRes = await callModel({ model, messages: planMsgs, temperature: 0.3 })

          if (!planRes.ok) {
            push("error", { message: `AI error: ${planRes.message}` })
            done()
            return
          }

          const question = extractQuestion(planRes.content)

          if (question && conv.askedCount < 3) {
            conv.questions.push(question.text)
            conv.askedCount = question.number
            push("question", { text: question.text, number: question.number, max: 3 })
            push("state_update", conv)
            done()
            return
          }

          const steps = extractPlanSteps(planRes.content)
          if (steps.length === 0) {
            // Try asking one more time if we got no steps
            if (conv.askedCount < 3) {
              const fallbackQ: ChatMessage[] = [
                { role: "system", content: planPrompt },
                { role: "user", content: conv.originalRequest },
                { role: "user", content: "I need you to produce the numbered plan now. List each file with %filename% markers." },
              ]
              const fallbackRes = await callModel({ model, messages: fallbackQ, temperature: 0.3 })
              if (fallbackRes.ok) {
                const fallbackSteps = extractPlanSteps(fallbackRes.content)
                if (fallbackSteps.length > 0) {
                  conv.plan = fallbackSteps
                } else {
                  push("error", { message: "Could not generate a build plan." })
                  done()
                  return
                }
              } else {
                push("error", { message: `AI error: ${fallbackRes.message}` })
                done()
                return
              }
            } else {
              push("error", { message: "Could not generate a build plan after 3 questions." })
              done()
              return
            }
          } else {
            conv.plan = steps
          }

          conv.phase = "planning"
          conv.currentStepIndex = 0
          push("plan", { steps: conv.plan })
          push("state_update", conv)

          await generateNextStep(ctrl, push, conv, model, codePrompt, planPrompt, pid, session.user.id)
          done()
          return
        }

        // ──────── PHASE: GENERATING → Answer to step question → continue generation ────────
        if (conv.phase === "generating") {
          conv.answers.push(prompt)
          await generateNextStep(ctrl, push, conv, model, codePrompt, planPrompt, pid, session.user.id)
          done()
          return
        }

        // Fallback
        push("error", { message: "Unknown conversation phase." })
        done()
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error"
        push("error", { message: `Crash: ${message}` })
        done()
      }
    },
    cancel() { closed = true },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

function buildAskingContext(conv: ConversationState): string {
  let ctx = `Original request: ${conv.originalRequest}\n\n`
  for (let i = 0; i < conv.questions.length; i++) {
    ctx += `Q${i + 1}: ${conv.questions[i]}\n`
    if (conv.answers[i]) {
      ctx += `A${i + 1}: ${conv.answers[i]}\n`
    }
  }
  return ctx
}

async function saveFileToDb(
  projectId: string,
  userId: string,
  file: { name: string; code: string; usedFor: string },
) {
  if (!ObjectId.isValid(projectId)) return
  try {
    const client = await clientPromise
    const db = client.db()
    const result = await db.collection("users").updateOne(
      {
        id: userId,
        projects: { $elemMatch: { _id: new ObjectId(projectId), "pages.name": file.name } },
      },
      {
        $set: {
          "projects.$[proj].pages.$[pg].content": file.code,
          "projects.$[proj].pages.$[pg].usedFor": file.usedFor,
          "projects.$[proj].pages.$[pg].updatedAt": new Date(),
        },
      },
      {
        arrayFilters: [
          { "proj._id": new ObjectId(projectId) },
          { "pg.name": file.name },
        ],
      },
    )
    if (result.matchedCount === 0) {
      await db.collection("users").updateOne(
        { id: userId, "projects._id": new ObjectId(projectId) },
        {
          $push: {
            "projects.$.pages": {
              name: file.name,
              content: file.code,
              usedFor: file.usedFor,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          },
        },
      )
    }
  } catch (e) {
    console.error("Failed to save file to DB:", e)
  }
}

async function saveAllFilesToDb(
  projectId: string,
  userId: string,
  files: Array<{ name: string; code: string; usedFor: string }>,
) {
  if (!ObjectId.isValid(projectId) || files.length === 0) return
  try {
    const client = await clientPromise
    const db = client.db()
    for (const file of files) {
      const result = await db.collection("users").updateOne(
        {
          id: userId,
          projects: { $elemMatch: { _id: new ObjectId(projectId), "pages.name": file.name } },
        },
        {
          $set: {
            "projects.$[proj].pages.$[pg].content": file.code,
            "projects.$[proj].pages.$[pg].usedFor": file.usedFor,
            "projects.$[proj].pages.$[pg].updatedAt": new Date(),
          },
        },
        {
          arrayFilters: [
            { "proj._id": new ObjectId(projectId) },
            { "pg.name": file.name },
          ],
        },
      )
      if (result.matchedCount === 0) {
        await db.collection("users").updateOne(
          { id: userId, "projects._id": new ObjectId(projectId) },
          {
            $push: {
              "projects.$.pages": {
                name: file.name,
                content: file.code,
                usedFor: file.usedFor,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            },
          },
        )
      }
    }
  } catch (e) {
    console.error("Failed to save files to DB:", e)
  }
}

async function generateNextStep(
  ctrl: ReadableStreamDefaultController,
  push: (ev: string, d: unknown) => void,
  conv: ConversationState,
  model: { id: string; provider: string },
  codePrompt: string,
  planPrompt: string,
  projectId: string,
  userId: string,
) {
  if (conv.currentStepIndex >= conv.plan.length) {
    conv.phase = "done"
    push("done", { files: conv.generatedFiles })
    push("step", { title: "Saving files", detail: `Saving ${conv.generatedFiles.length} files to database...`, status: "running" })
    await saveAllFilesToDb(projectId, userId, conv.generatedFiles)
    push("step", { title: "Saved", detail: `${conv.generatedFiles.length} files saved to Pages tab.`, status: "done" })
    return
  }

  conv.phase = "generating"
  const step = conv.plan[conv.currentStepIndex]
  const filename = extractFilename(step)

  if (!filename) {
    push("step", {
      title: `Step ${conv.currentStepIndex + 1}/${conv.plan.length}`,
      detail: `Skipping: ${step} (no filename marker)`,
      status: "done",
    })
    conv.currentStepIndex++
    push("state_update", conv)
    await generateNextStep(ctrl, push, conv, model, codePrompt, planPrompt)
    return
  }

  push("step", {
    title: `Generating ${filename}`,
    detail: `Step ${conv.currentStepIndex + 1}/${conv.plan.length}: ${step}`,
    status: "running",
  })

  const planText = conv.plan.map((s, i) => `${i + 1}. ${s}${i === conv.currentStepIndex ? "  ← CURRENT" : ""}`).join("\n")

  const prevFiles = conv.generatedFiles
    .map((f) => `--- ${f.name} ---\n${f.code}`)
    .join("\n\n")

  const msgs: ChatMessage[] = [
    { role: "system", content: codePrompt },
    { role: "user", content: [
      `USER REQUEST: ${conv.originalRequest}`,
      `BUILD PLAN:`,
      planText,
      prevFiles ? `PREVIOUS FILES:\n${prevFiles}` : "",
      `Now generate COMPLETE code for: ${step}`,
      `Wrap your code in [code]...[/code] markers. If you need clarification, use [ask]...[/ask].`,
    ].filter(Boolean).join("\n\n")},
  ]

  const res = await callModel({ model, messages: msgs, temperature: 0.2 })

  if (!res.ok) {
    push("error", { message: `AI error generating ${filename}: ${res.message}` })
    return
  }

  // Check for ask marker
  const askQuestion = extractAskMarker(res.content)
  if (askQuestion) {
    push("question", { text: askQuestion, number: 0, max: 0 })
    return
  }

  // Extract code from [code] block
  const codeBlock = extractCodeBlock(res.content)

  if (codeBlock && codeBlock.code.length > 10) {
    conv.generatedFiles.push({
      name: filename,
      code: codeBlock.code,
      usedFor: step,
    })

    push("code", {
      filename,
      code: codeBlock.code,
      usedFor: step,
      index: conv.currentStepIndex,
      total: conv.plan.length,
    })

    push("step", {
      title: `Generated ${filename}`,
      detail: `${codeBlock.code.length.toLocaleString()} chars — Step ${conv.currentStepIndex + 1}/${conv.plan.length}`,
      status: "done",
    })

    saveFileToDb(projectId, userId, { name: filename, code: codeBlock.code, usedFor: step }).catch(() => {})
  } else {
    // Fallback: try to use raw content as code
    const fallbackCode = res.content.trim()
    if (fallbackCode.length > 10) {
      conv.generatedFiles.push({
        name: filename,
        code: fallbackCode,
        usedFor: step,
      })
      push("code", {
        filename,
        code: fallbackCode,
        usedFor: step,
        index: conv.currentStepIndex,
        total: conv.plan.length,
      })
    }

    push("step", {
      title: `Generated ${filename}`,
      detail: `${fallbackCode.length.toLocaleString()} chars (raw) — Step ${conv.currentStepIndex + 1}/${conv.plan.length}`,
      status: "done",
    })
    saveFileToDb(projectId, userId, { name: filename, code: fallbackCode, usedFor: step }).catch(() => {})
  }

  conv.currentStepIndex++
  push("state_update", conv)

  await generateNextStep(ctrl, push, conv, model, codePrompt, planPrompt, projectId, userId)
}
