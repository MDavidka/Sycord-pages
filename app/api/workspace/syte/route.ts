import { NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"
import { getOwnedProject } from "@/lib/project-id"
import {
  syteExecuteCommand,
  syteGetLogs,
  syteIssueDeploy,
  syteListFiles,
  syteReadFile,
  syteSetEnv,
  syteSyncProjectFiles,
  syteWriteFile,
  syteWorkspaceGet,
  useSyteWorkspace,
} from "@/lib/deploy/syte-client"
import { ensureSyteLivePreview, setSyteProjectDomain } from "@/lib/deploy/syte-preview"
import {
  createSyteWorkspaceForProject,
  getStoredSyteUuid,
  requireSyteWorkspaceUuid,
} from "@/lib/deploy/syte-workspace"
import { getProjectEnvVars } from "@/lib/deploy/runner-client"
import { isValidProjectId, projectFiles } from "@/lib/workspace/sandbox"
import { checkRateLimit } from "@/lib/security/rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 300

type SyteAction =
  | "create_project"
  | "execute_command"
  | "read_file"
  | "write_file"
  | "list_files"
  | "sync_files"
  | "issue_deploy"
  | "get_logs"
  | "workspace_get"
  | "set_domain"
  | "start_preview"
  | "preview_status"

async function resolveProject(userId: string, projectId: string) {
  const client = await clientPromise
  const db = client.db()
  const project = await getOwnedProject(db, userId, projectId)
  return { db, project }
}

function needsCreateResponse(message: string) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      needsCreate: true,
      hint: "Call createWorkspace() first — POST /api/create_project returns the workspace uuid.",
    },
    { status: 409 },
  )
}

export async function POST(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const rate = checkRateLimit(`workspace-action:${userId}`, { limit: 100, windowMs: 60_000 })
  if (!rate.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many requests. Please wait and try again." },
      {
        status: 429,
        headers: { "Retry-After": String(rate.retryAfterSec) },
      }
    )
  }

  if (!useSyteWorkspace()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Syte workspace is not configured. Set DEPLOYER_API_URL=https://sycord.site and DEPLOYER_API_KEY (syte_ token).",
      },
      { status: 503 },
    )
  }

  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const projectId = String(body?.projectId || "").trim()
  const action = String(body?.action || "").trim() as SyteAction

  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid project ID" }, { status: 400 })
  }
  if (!action) {
    return NextResponse.json({ ok: false, error: "Missing action" }, { status: 400 })
  }

  const { db, project } = await resolveProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  if (action === "create_project") {
    const domain =
      typeof body.domain === "string" && body.domain.trim()
        ? body.domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")
        : undefined

    const result = await createSyteWorkspaceForProject(db, userId, projectId, project, {
      domain,
    })
    if (!result.ok || !result.data) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "create_project failed",
          endpoint: result.endpoint,
        },
        { status: result.status || 502 },
      )
    }

    return NextResponse.json({
      ok: true,
      action: "create_project",
      uuid: result.data.uuid,
      status: result.data.status,
      execute_command: result.data.executeCommandBody,
      issue_deploy: result.data.issueDeployBody,
      next_steps: result.data.nextSteps,
      paths: result.data.paths,
      message:
        result.data.status === "created"
          ? `[SYSTEM] ✅ Syte workspace created. UUID: ${result.data.uuid}. Use this uuid for all execute_command calls. Next: executeCommand with the returned execute_command body or "npx shadcn@latest init -y".`
          : `[SYSTEM] ✅ Syte workspace already exists. UUID: ${result.data.uuid}.`,
    })
  }

  const resolved = await requireSyteWorkspaceUuid(project, projectId)
  if ("error" in resolved) {
    return needsCreateResponse(resolved.error)
  }

  const uuid = resolved.uuid

  switch (action) {
    case "workspace_get": {
      const info = await syteWorkspaceGet(uuid)
      if (!info.ok) {
        return NextResponse.json({ ok: false, error: info.error }, { status: info.status || 502 })
      }
      return NextResponse.json({ ok: true, uuid, workspace: info.data })
    }

    case "sync_files": {
      const files = projectFiles(project)
      const sync = await syteSyncProjectFiles(uuid, files)
      return NextResponse.json({ ok: sync.errors.length === 0, uuid, ...sync })
    }

    case "execute_command": {
      const command = typeof body.command === "string" ? body.command.trim() : ""
      if (!command) {
        return NextResponse.json({ ok: false, error: "Missing command" }, { status: 400 })
      }

      if (body.sync !== false) {
        const files = projectFiles(project)
        await syteSyncProjectFiles(uuid, files)
      }

      const envVars = getProjectEnvVars(project)
      if (Object.keys(envVars).length > 0) {
        await syteSetEnv(uuid, envVars, true)
      }

      const result = await syteExecuteCommand(uuid, command, {
        cwd: typeof body.cwd === "string" ? body.cwd : "app",
        timeout: typeof body.timeout === "number" ? body.timeout : 300,
        env: typeof body.env === "object" ? body.env : undefined,
      })

      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, uuid },
          { status: result.status || 502 },
        )
      }

      const data = result.data as any
      return NextResponse.json({
        ok: true,
        uuid,
        exit_code: data?.exit_code ?? data?.exitCode ?? 1,
        output: data?.output ?? "",
        command: data?.command ?? command,
      })
    }

    case "read_file": {
      const path = typeof body.path === "string" ? body.path : ""
      if (!path) {
        return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 })
      }
      if (path.includes("..") || path.startsWith("/")) {
        return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })
      }
      const result = await syteReadFile(uuid, path)
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 })
      }
      return NextResponse.json({ ok: true, uuid, ...(result.data as object) })
    }

    case "write_file": {
      const path = typeof body.path === "string" ? body.path : ""
      const content = typeof body.content === "string" ? body.content : ""
      if (!path) {
        return NextResponse.json({ ok: false, error: "Missing path" }, { status: 400 })
      }
      if (path.includes("..") || path.startsWith("/")) {
        return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })
      }
      const result = await syteWriteFile(uuid, path, content)
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 })
      }
      return NextResponse.json({ ok: true, uuid, path })
    }

    case "list_files": {
      const path = typeof body.path === "string" ? body.path : ""
      if (path.includes("..") || path.startsWith("/")) {
        return NextResponse.json({ ok: false, error: "Invalid path" }, { status: 400 })
      }
      const result = await syteListFiles(uuid, path)
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 })
      }
      return NextResponse.json({ ok: true, uuid, ...(result.data as object) })
    }

    case "issue_deploy": {
      const files = projectFiles(project)
      const sync = await syteSyncProjectFiles(uuid, files)
      if (sync.errors.length > 0) {
        return NextResponse.json(
          { ok: false, error: `File sync failed: ${sync.errors.slice(0, 3).join("; ")}`, sync },
          { status: 502 },
        )
      }

      const envVars = getProjectEnvVars(project)
      if (Object.keys(envVars).length > 0) {
        await syteSetEnv(uuid, envVars, true)
      }

      const deploy = await syteIssueDeploy(uuid)
      if (!deploy.ok) {
        return NextResponse.json(
          { ok: false, error: deploy.error || "Deploy failed" },
          { status: deploy.status || 502 },
        )
      }

      const logs = await syteGetLogs(uuid, 300)
      const workspace = await syteWorkspaceGet(uuid)

      const logText =
        typeof logs.data === "object" && logs.data
          ? JSON.stringify(logs.data).slice(0, 8000)
          : String(logs.data || "")

      const url =
        (workspace.data as any)?.url ||
        (workspace.data as any)?.domain ||
        `https://${uuid}.sycord.site`

      return NextResponse.json({
        ok: true,
        status: "success",
        uuid,
        url: typeof url === "string" && url.startsWith("http") ? url : `https://${url}`,
        logsTail: logText,
        synced: sync.synced,
      })
    }

    case "get_logs": {
      const lines = typeof body.lines === "number" ? body.lines : 200
      const result = await syteGetLogs(uuid, lines)
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: result.status || 502 })
      }
      return NextResponse.json({ ok: true, uuid, logs: result.data })
    }

    case "set_domain": {
      const domain = typeof body.domain === "string" ? body.domain.trim() : ""
      if (!domain) {
        return NextResponse.json({ ok: false, error: "Missing domain" }, { status: 400 })
      }
      const result = await setSyteProjectDomain(db, userId, project, domain, projectId)
      if (!result.ok) {
        return NextResponse.json({ ok: false, error: result.error }, { status: 502 })
      }
      return NextResponse.json({ ok: true, uuid: result.uuid, domain })
    }

    case "start_preview": {
      const result = await ensureSyteLivePreview(db, userId, projectId, project, {
        syncFiles: body.sync !== false,
        issueDomain: body.issueDomain !== false,
        domain: typeof body.domain === "string" ? body.domain : project?.domain,
      })
      if (!result.ok) {
        return NextResponse.json(
          { ok: false, error: result.error, uuid: result.uuid, previewUrl: result.previewUrl },
          { status: 502 },
        )
      }
      return NextResponse.json({
        ok: true,
        uuid: result.uuid,
        previewUrl: result.previewUrl,
        previewReady: result.previewReady,
        domainIssued: result.domainIssued,
        status: result.status,
      })
    }

    case "preview_status": {
      const { sytePreviewStatus, pickSytePreviewUrl } = await import("@/lib/deploy/syte-client")
      const status = await sytePreviewStatus(uuid)
      if (!status.ok) {
        return NextResponse.json({ ok: false, error: status.error }, { status: status.status || 502 })
      }
      return NextResponse.json({
        ok: true,
        uuid,
        previewUrl: pickSytePreviewUrl(status.data || undefined),
        status: status.data,
      })
    }

    default:
      return NextResponse.json({ ok: false, error: `Unknown action: ${action}` }, { status: 400 })
  }
}

export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions)
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const projectId = (searchParams.get("projectId") || "").trim()
  if (!isValidProjectId(projectId)) {
    return NextResponse.json({ ok: false, error: "Invalid project ID" }, { status: 400 })
  }

  const { project } = await resolveProject(userId, projectId)
  if (!project) {
    return NextResponse.json({ ok: false, error: "Project not found" }, { status: 404 })
  }

  const uuid = getStoredSyteUuid(project)
  if (!uuid) {
    return NextResponse.json({
      ok: false,
      configured: useSyteWorkspace(),
      needsCreate: true,
      error: "No workspace UUID — call createWorkspace() first (POST /api/create_project).",
    })
  }

  const info = await syteWorkspaceGet(uuid)

  return NextResponse.json({
    ok: info.ok,
    configured: useSyteWorkspace(),
    uuid,
    workspace: info.data,
    error: info.error,
  })
}
