import { authOptions } from '@/lib/auth'
import { getAgentActivityForProject } from '@/lib/continue-agent'
import { isValidProjectId } from '@/lib/workspace/sandbox'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get('projectId') || '').trim()
  const sinceId = Number(searchParams.get('since_id') || '0')
  const assistantText = searchParams.get('assistantText') || ''

  if (!isValidProjectId(projectId)) {
    return Response.json({ error: 'Invalid project ID' }, { status: 400 })
  }

  try {
    const activity = await getAgentActivityForProject(
      userId,
      projectId,
      Number.isFinite(sinceId) ? sinceId : 0,
      assistantText,
    )

    return Response.json({
      ok: true,
      projectId,
      uuid: activity.uuid,
      sinceId: activity.sinceId,
      processing: activity.processing,
      terminal: activity.terminal,
      assistantText: activity.assistantText,
      events: activity.events,
      agent: activity.agent,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Activity fetch failed'
    return Response.json({ ok: false, error: message }, { status: 502 })
  }
}
