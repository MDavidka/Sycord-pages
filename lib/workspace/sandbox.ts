// Shared helpers for the server-side Syra "workspace" endpoints
// (/api/workspace/execute, /diagnostics, /deploy).
//
// These endpoints give the AI builder a real, sandboxed Node.js workspace on
// the server instead of the in-browser WebContainer — so commands, type
// diagnostics and deploys never crash with browser serialization / "object can
// not be cloned" / "not a valid workspace" errors.
//
// The source of truth for a project's file base is the `pages` array stored on
// the user's project document in MongoDB (see /api/projects/[id]/pages). Each
// request materializes those files into an isolated temp directory scoped to
// the project id and runs the operation there.

import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/torso"

/** Root directory under which every project's sandbox workspace lives. */
export const WORKSPACE_BASE = path.join(os.tmpdir(), "sycord-workspace")

export type WorkspaceFile = { name: string; content: string }

/** Resolve the authenticated user's id, or null when unauthenticated. */
export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

/** A non-empty string id used as project identifier in Torso. */
export function isValidProjectId(projectId: string): boolean {
  return Boolean(projectId && typeof projectId === "string" && projectId.trim().length > 0)
}

/** Load a single project (with its pages) owned by the given user. */
export async function loadProject(userId: string, projectId: string): Promise<any | null> {
  if (!isValidProjectId(projectId)) return null
  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne<{ projects?: any[] }>(
    { id: userId, "projects._id": projectId },
    { projection: { "projects.$": 1 } },
  )
  return user?.projects?.[0] ?? null
}

/** Convert a project's stored `pages` into a clean list of workspace files. */
export function projectFiles(project: any): WorkspaceFile[] {
  const pages = Array.isArray(project?.pages) ? project.pages : []
  return pages
    .filter((p: any) => typeof p?.name === "string" && typeof p?.content === "string")
    .map((p: any) => ({ name: String(p.name).replace(/^\/+/, ""), content: p.content }))
}

/** Join `rel` under `root`, throwing if it would escape the root directory. */
export function safeJoin(root: string, rel: string): string {
  const target = path.resolve(root, rel)
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error(`Unsafe path outside workspace: ${rel}`)
  }
  return target
}

/** True for files that must never be written into / read from the sandbox. */
function isDisallowedFile(name: string): boolean {
  if (!name) return true
  if (name.includes("..") || name.includes("\0")) return true
  if (path.isAbsolute(name)) return true
  if (/^\.env(?:\.|$)/.test(name) || /\/\.env(?:\.|$)/.test(name)) return true
  return false
}

/**
 * Write the given files into an isolated per-project workspace directory and
 * return its absolute path. The directory is reset on every call so the
 * sandbox always reflects the current saved file base.
 */
export async function materializeWorkspace(projectId: string, files: WorkspaceFile[]): Promise<string> {
  if (!isValidProjectId(projectId)) throw new Error("Invalid project id")
  const root = path.join(WORKSPACE_BASE, projectId)
  await fs.rm(root, { recursive: true, force: true })
  await fs.mkdir(root, { recursive: true })

  for (const file of files) {
    if (isDisallowedFile(file.name)) continue
    const out = safeJoin(root, file.name)
    await fs.mkdir(path.dirname(out), { recursive: true })
    await fs.writeFile(out, file.content ?? "")
  }

  return root
}

/** Resolve a (possibly "/"-prefixed) cwd against the workspace root, safely. */
export function resolveCwd(root: string, cwd?: string): string {
  const rel = (cwd || "/").replace(/^\/+/, "")
  return safeJoin(root, rel.length > 0 ? rel : ".")
}

/** Commands that must never run in the sandbox, regardless of who asks. */
const DANGEROUS_PATTERNS: RegExp[] = [
  /rm\s+-rf?\s+(\/|~|\$HOME)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:\s*\(\s*\)\s*\{/, // fork bomb
  />\s*\/dev\/(sd|nvme|disk)/i,
  /\bshutdown\b|\breboot\b|\bhalt\b/i,
]

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command))
}

/**
 * Extract every local alias import (`@/...`) and bare module import from a
 * TypeScript/JSX source string. Used to detect imports that may fail at build
 * time because the target file or dependency is missing.
 */
export function extractImports(source: string): { local: string[]; modules: string[] } {
  const local: string[] = []
  const modules: string[] = []
  // Match both single and double quotes, static paths only.
  const importRegex = /import\s+(?:(?:[^'"]*?)\s+from\s+)?['"]([^'"]+)['"];?/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(source)) !== null) {
    const spec = match[1]
    if (spec.startsWith("@/")) {
      local.push(spec)
    } else if (!spec.startsWith(".") && !spec.startsWith("/")) {
      modules.push(spec)
    }
  }
  return { local, modules }
}

/**
 * Validate that a project's files form a *buildable* Next.js app before we
 * attempt to deploy them. This catches AI output that is missing the pieces a
 * `npm run build` needs, surfacing a clear, actionable message instead of a
 * cryptic downstream build failure.
 *
 * Returns an array of human-readable problems (empty when the project looks
 * buildable).
 */
export function validateNextBuildable(files: WorkspaceFile[]): string[] {
  const problems: string[] = []
  const byName = new Map(files.map((f) => [f.name.replace(/^\/+/, ""), f]))
  const names = Array.from(byName.keys())

  // 1. package.json must exist, be valid JSON, and expose a `build` script.
  const pkgFile = byName.get("package.json")
  let pkg: any
  if (!pkgFile) {
    problems.push('Missing "package.json" — a Next.js project needs one with a "build" script.')
  } else {
    try {
      pkg = JSON.parse(pkgFile.content)
    } catch {
      problems.push('"package.json" is not valid JSON and cannot be built.')
    }
    if (pkg) {
      const buildScript = pkg?.scripts?.build
      if (typeof buildScript !== "string" || buildScript.trim().length === 0) {
        problems.push('"package.json" has no "scripts.build" command (expected e.g. "next build").')
      }
      const hasNextDep = !!(pkg?.dependencies?.next || pkg?.devDependencies?.next)
      if (!hasNextDep) {
        problems.push('"next" is not listed in package.json dependencies — add it so the app can build.')
      }
    }
  }

  // 2. There must be at least one route entry the build can compile.
  const hasAppEntry = names.some((n) => /^app\/(.*\/)?(page|layout)\.(tsx|ts|jsx|js)$/.test(n))
  const hasPagesEntry = names.some((n) => /^pages\/.+\.(tsx|ts|jsx|js)$/.test(n))
  if (!hasAppEntry && !hasPagesEntry) {
    problems.push(
      'No route entry found — add an App Router entry (e.g. "app/page.tsx" and "app/layout.tsx") or a "pages/" file.',
    )
  }

  // 3. Dockerfile sanity: if a Dockerfile is present, ensure it is not empty
  // and appears to be for a Node-based project.
  const dockerfile = byName.get("Dockerfile")
  if (dockerfile) {
    const df = dockerfile.content.trim()
    if (df.length === 0) {
      problems.push('"Dockerfile" exists but is empty — it will break the Dokploy build.')
    } else if (!/FROM node:/i.test(df)) {
      problems.push('"Dockerfile" does not use a Node base image — the Next.js build will fail.')
    }
  }

  // 4. Catch missing local imports and undeclared dependencies early.
  const allDeps = new Set<string>([
    ...(Object.keys(pkg?.dependencies ?? {})),
    ...(Object.keys(pkg?.devDependencies ?? {})),
  ])
  const missingLocalImports = new Set<string>()
  const missingModules = new Set<string>()

  for (const file of files) {
    if (!/\.(tsx|ts|jsx|js)$/.test(file.name)) continue
    const { local, modules } = extractImports(file.content)

    for (const spec of local) {
      const target = spec.replace(/^@\//, "")
      // The import may resolve to a .tsx, .ts, .jsx, .js file or a directory
      // with an index file. We also accept CSS/scss imports.
      const hasTarget =
        byName.has(target) ||
        byName.has(`${target}.tsx`) ||
        byName.has(`${target}.ts`) ||
        byName.has(`${target}.jsx`) ||
        byName.has(`${target}.js`) ||
        byName.has(`${target}/index.tsx`) ||
        byName.has(`${target}/index.ts`) ||
        byName.has(`${target}/index.jsx`) ||
        byName.has(`${target}/index.js`) ||
        /\.(css|scss|sass|less|styl)$/i.test(target)
      if (!hasTarget) {
        missingLocalImports.add(`${spec} (from ${file.name})`)
      }
    }

    for (const spec of modules) {
      // Scoped packages and subpath imports both resolve from the root package.
      const packageName = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]
      if (!packageName) continue
      if (!allDeps.has(packageName)) {
        missingModules.add(`${packageName} (imported in ${file.name})`)
      }
    }
  }

  if (missingLocalImports.size > 0) {
    problems.push(
      `Missing local import target(s): ${Array.from(missingLocalImports).join(", ")}. ` +
        `Create the missing file or remove the import before deploying.`,
    )
  }

  if (missingModules.size > 0) {
    problems.push(
      `Missing npm dependency(ies): ${Array.from(missingModules).join(", ")}. ` +
        `Add them to package.json before deploying.`,
    )
  }

  return problems
}
