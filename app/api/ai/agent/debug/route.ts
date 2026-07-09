import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import {
  getSyteInternalSecret,
  syteAgentLogs,
  syteAgentStatus,
  syteAgentTest,
  syteInternalAgentStatus,
  syteInternalAgentTest,
} from '@/lib/deploy/syte-client'
import { requireSyteWorkspaceUuid } from '@/lib/deploy/syte-workspace'
import { isValidProjectId, loadProject } from '@/lib/workspace/sandbox'

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
  const runTest = searchParams.get('test') === '1'

  if (!isValidProjectId(projectId)) {
    return Response.json({ error: 'Invalid project ID' }, { status: 400 })
  }

  const project = await loadProject(userId, projectId)
  if (!project) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ('error' in resolved) {
    return Response.json({ ok: false, needsCreate: true, error: resolved.error }, { status: 409 })
  }

  const uuid = resolved.uuid
  const hasInternalSecret = Boolean(getSyteInternalSecret())

  const [status, internalStatus, logs] = await Promise.all([
    syteAgentStatus(uuid),
    hasInternalSecret ? syteInternalAgentStatus(uuid) : Promise.resolve(null),
    syteAgentLogs(uuid, 120),
  ])

  let testResult = null
  if (runTest) {
    testResult = hasInternalSecret
      ? await syteInternalAgentTest(uuid)
      : await syteAgentTest(uuid)
  }

  return Response.json({
    ok: status.ok,
    uuid,
    hasInternalSecret,
    agent: status.data,
    internalAgent: internalStatus?.data ?? null,
    internalError: internalStatus && !internalStatus.ok ? internalStatus.error : null,
    logs:
      logs.ok && logs.data
        ? (logs.data as { logs?: string; output?: string }).logs ||
          (logs.data as { logs?: string; output?: string }).output ||
          logs.data
        : logs.error,
    test: testResult
      ? {
          ok: testResult.ok,
          data: testResult.data,
          error: testResult.error,
        }
      : null,
  })
}
