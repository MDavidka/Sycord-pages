import type { ModelType } from '@/glovix/lib/ai'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { getContinueAgentDebugLogs, streamContinueAgentMessage } from '@/lib/continue-agent'
import { isValidProjectId } from '@/lib/workspace/sandbox'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function sse(data: unknown): string {
  return `data: ${JSON.stringify(data)}\n\n`
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { projectId?: string; message?: string; model?: ModelType }
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const projectId = String(body.projectId || '').trim()
  const message = String(body.message || '').trim()
  const model = (body.model || 'mimo-v2-flash') as ModelType
  if (!isValidProjectId(projectId)) {
    return new Response(JSON.stringify({ error: 'Invalid project ID' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }
  if (!message) {
    return new Response(JSON.stringify({ error: 'Missing message' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const encoder = new TextEncoder()
  const abort = new AbortController()
  req.signal.addEventListener('abort', () => abort.abort(), { once: true })

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of streamContinueAgentMessage(userId, projectId, model, message, abort.signal)) {
          controller.enqueue(encoder.encode(sse(event)))
          if (event.type === 'done' || event.type === 'error') break
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Agent failed'
        if ((err as { name?: string })?.name !== 'AbortError') {
          let detail = msg
          try {
            const logs = await getContinueAgentDebugLogs(userId, projectId, 80)
            if (logs && !/project not found/i.test(logs)) {
              detail = `${msg}

Syte agent logs:
${logs.slice(0, 4000)}`
            }
          } catch {
            // keep original error only
          }
          controller.enqueue(encoder.encode(sse({ type: 'error', message: detail })))
        }
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
