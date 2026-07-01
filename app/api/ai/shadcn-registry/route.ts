// POST /api/ai/shadcn-registry
// Fetches shadcn/ui component source from the official registry (no CLI required).
// Body: { component?: string, components?: string[] }

import { normalizeComponentName, resolveShadcnComponents } from "@/lib/shadcn-registry-server"
import { normalizeShadcnImportPaths } from "@/lib/shadcn-shared"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

export async function POST(req: Request): Promise<Response> {
  let body: { component?: string; components?: string[] }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const single = typeof body.component === "string" ? normalizeComponentName(body.component) : ""
  const many = Array.isArray(body.components) ? body.components.map(normalizeComponentName) : []
  const names = [...new Set([...(single ? [single] : []), ...many].filter(Boolean))]

  if (names.length === 0) {
    return Response.json({ error: "Missing component name(s)" }, { status: 400 })
  }

  try {
    const resolved = await resolveShadcnComponents(names)

    const filesMap = new Map<string, string>()
    const dependencies: Record<string, string> = {}
    const installed = new Set<string>()
    let source: "registry" | "local" = "registry"

    for (const entry of resolved) {
      if (entry.source === "local") source = "local"
      for (const file of entry.files) {
        const normalized = normalizeShadcnImportPaths(file.content)
        filesMap.set(file.path, normalized.content)
      }
      Object.assign(dependencies, entry.dependencies)
      for (const name of entry.installed) installed.add(name)
    }

    return Response.json({
      components: names,
      files: Array.from(filesMap.entries()).map(([path, content]) => ({ path, content })),
      dependencies,
      installed: Array.from(installed).sort(),
      source,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to resolve shadcn component"
    return Response.json({ error: message }, { status: 404 })
  }
}
