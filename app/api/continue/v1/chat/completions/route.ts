import { isConfigured, streamOpenAICompatible } from '@/lib/glovix-gemini'
import { isDeepSeekConfigured, streamDeepSeekCompatible } from '@/lib/glovix-deepseek'
import { resolveContinueInternalKey } from '@/lib/continue-agent/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

function isDeepSeekModel(model: string | undefined): boolean {
  return !!model && model.toLowerCase().startsWith('deepseek')
}

function isAuthorized(req: Request): boolean {
  const expected = resolveContinueInternalKey()
  const actual = req.headers.get('x-syra-agent-key')?.trim()
  return !expected || actual === expected
}

export async function POST(req: Request): Promise<Response> {
  if (!isAuthorized(req)) {
    return new Response(JSON.stringify({ error: 'Unauthorized Continue agent bridge' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const messages = Array.isArray(body?.messages) ? body.messages : null
  if (!messages) {
    return new Response(JSON.stringify({ error: "Missing 'messages' array" }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const model = typeof body?.model === 'string' ? body.model : undefined
  if (isDeepSeekModel(model)) {
    if (!isDeepSeekConfigured()) {
      return new Response(JSON.stringify({ error: 'DeepSeek is not configured. Set DEEPSEEK_API_KEY.' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      })
    }
    return streamDeepSeekCompatible({
      messages,
      tools: body?.tools,
      temperature: typeof body?.temperature === 'number' ? body.temperature : undefined,
      maxOutputTokens: typeof body?.max_tokens === 'number' ? body.max_tokens : undefined,
      model,
    })
  }

  if (!isConfigured()) {
    return new Response(JSON.stringify({
      error: 'Gemini is not configured. Set GOOGLE_VERTEX_PROJECT or GOOGLE_AIAGENT_API.',
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return streamOpenAICompatible({
    messages,
    tools: body?.tools,
    temperature: typeof body?.temperature === 'number' ? body.temperature : undefined,
    maxOutputTokens: typeof body?.max_tokens === 'number' ? body.max_tokens : undefined,
    model,
  })
}
