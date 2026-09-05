import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-chat-session"
import { requireSyteWorkspaceUuid } from "@/lib/deploy/syte-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DEFAULT_SYCORD_BASE = "https://sycord.site"

type SycordModel = {
  id?: unknown
  profile?: unknown
  name?: unknown
  enabled?: unknown
}

type SycordModelsResponse = {
  ok?: unknown
  models?: unknown
  available_models?: unknown
  current_model?: unknown
  provider?: unknown
  count?: unknown
}

function getSycordModelsUrl(projectUuid: string): string {
  const configuredBase = (process.env.DEPLOYER_API_URL || DEFAULT_SYCORD_BASE).replace(/\/+$/, "")
  const base = configuredBase.replace(/\/api\/?$/, "")
  return `${base}/api/projects/${encodeURIComponent(projectUuid)}/ai/models`
}

function normalizeModels(payload: SycordModelsResponse): Array<{ id: string; profile: string; name: string }> {
  // Sycord's documented response is { ok, provider, current_model, models }.
  // Keep the legacy field only as a compatibility fallback.
  const source = Array.isArray(payload.models)
    ? payload.models
    : Array.isArray(payload.available_models)
      ? payload.available_models
      : []

  const seen = new Set<string>()
  const models: Array<{ id: string; profile: string; name: string }> = []

  for (const candidate of source as SycordModel[]) {
    if (!candidate || candidate.enabled === false) continue

    // The current API returns { id, name } and does not include the legacy
    // `profile` field. Use the model id as the stream model/profile fallback.
    const id = typeof candidate.id === "string" ? candidate.id.trim() : ""
    const profile = typeof candidate.profile === "string"
      ? candidate.profile.trim()
      : id
    const name = typeof candidate.name === "string"
      ? candidate.name.trim()
      : id
    if (!profile || !name || !id || seen.has(profile)) continue

    seen.add(profile)
    models.push({ id, profile, name })
  }

  return models
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams
  const projectId = searchParams.get("project_id")?.trim()
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (!projectId) {
    console.error('[v0] models: missing project_id')
    return Response.json({ message: "A project ID is required." }, { status: 400 })
  }

  // Always resolve the Sycord UUID from the authenticated project settings.
  // The browser may send the local project id, but it must not choose an
  // arbitrary Sycord workspace UUID for model discovery.
  let projectUuid = ""
  if (projectId) {
    const client = await clientPromise
    const project = await getOwnedProject(client.db(), session.user.id, projectId)
    if (!project) return Response.json({ message: "Project not found" }, { status: 404 })
    const workspace = await requireSyteWorkspaceUuid(project, projectId)
    if ("error" in workspace) {
      return Response.json({ message: workspace.error, needsCreate: true }, { status: 409 })
    }
    projectUuid = workspace.uuid
  }

  console.log('[v0] models: server request', {
    projectId,
    projectUuid,
    resolvedFromProjectSettings: Boolean(projectId),
    hasApiKey: Boolean(process.env.DEPLOYER_API_KEY),
  })

  const apiKey = process.env.DEPLOYER_API_KEY || ""
  const headers: Record<string, string> = { Accept: "application/json" }
  if (apiKey) {
    headers["X-API-Key"] = apiKey
    headers.Authorization = `Bearer ${apiKey}`
  }

  try {
    const response = await fetch(getSycordModelsUrl(projectUuid), {
      method: "GET",
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    })

    const payload = (await response.json().catch(() => null)) as SycordModelsResponse | null
    console.log('[v0] models: Sycord response', {
      projectUuid,
      status: response.status,
      ok: response.ok,
      payload,
    })
    if (!response.ok || !payload) {
      console.error('[v0] models: Sycord request failed', { projectUuid, status: response.status, payload })
      return Response.json(
        { message: `Sycord model API returned ${response.status || 502}.` },
        { status: response.status >= 400 && response.status < 600 ? response.status : 502 },
      )
    }

    return Response.json({ models: normalizeModels(payload) })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reach Sycord model API."
    return Response.json({ message }, { status: 502 })
  }
}
