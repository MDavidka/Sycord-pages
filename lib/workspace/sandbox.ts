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
import { getOwnedProject } from "@/lib/project-id"

/** Root directory under which every project's sandbox workspace lives. */
export const WORKSPACE_BASE = path.join(os.tmpdir(), "sycord-workspace")

export type WorkspaceFile = { name: string; content: string }

/** Resolve the authenticated user's id, or null when unauthenticated. */
export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

/**
 * Validate that a path is safe for reading or writing within the sandbox.
 * Rejects paths containing '..' or starting with '/'.
 */
export function validateSafePath(path: string): boolean {
  if (!path || typeof path !== 'string') return false;
  if (path.includes('..') || path.includes('\0') || path.startsWith('/')) {
    return false;
  }
  return true;
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
  return getOwnedProject(db, userId, projectId)
}

/** Convert a project's stored `pages` into a clean list of workspace files. */
export function projectFiles(project: any): WorkspaceFile[] {
  const pages = Array.isArray(project?.pages) ? project.pages : []
  return pages
    .filter((p: any) => typeof p?.name === "string" && typeof p?.content === "string")
    .map((p: any) => ({ name: String(p.name).replace(/^\/+/, ""), content: p.content }))
}

/** Convert a Glovix in-memory files map into workspace files for Syte sync. */
export function glovixFilesToWorkspaceFiles(
  files: Record<string, { file?: { contents?: string } }> | null | undefined,
): WorkspaceFile[] {
  if (!files || typeof files !== "object") return []
  return Object.entries(files)
    .filter(([name]) => {
      if (!name || name.startsWith(".glovix/") || name === "glovix-picker.js") return false
      if (/^\.env(?:\.|$)/.test(name) || /\/\.env(?:\.|$)/.test(name)) return false
      return true
    })
    .map(([name, entry]) => ({
      name: name.replace(/^\/+/, ""),
      content: typeof entry?.file?.contents === "string" ? entry.file.contents : "",
    }))
}

/** Parse client POST body files (Glovix map or WorkspaceFile[]). */
export function parseClientWorkspaceFiles(body: unknown): WorkspaceFile[] | null {
  if (!body || typeof body !== "object") return null
  const raw = (body as { files?: unknown }).files
  if (!raw) return null

  if (Array.isArray(raw)) {
    const parsed = raw
      .filter((f) => f && typeof f === "object" && typeof (f as any).name === "string")
      .map((f) => ({
        name: String((f as any).name).replace(/^\/+/, ""),
        content: typeof (f as any).content === "string" ? (f as any).content : "",
      }))
    return parsed.length > 0 ? parsed : null
  }

  if (typeof raw === "object") {
    const parsed = glovixFilesToWorkspaceFiles(raw as Record<string, { file?: { contents?: string } }>)
    return parsed.length > 0 ? parsed : null
  }

  return null
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
  /rm\s+-rf?\s*[./~\s]/i,
  /rm\s+-rf?\s+(\/|~|\$HOME|\*)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /:\s*\(\s*\)\s*\{/, // fork bomb
  />\s*\/dev\/(sd|nvme|disk)/i,
  /\bshutdown\b|\breboot\b|\bhalt\b/i,
  /\bcurl\b.*\|\s*(ba)?sh\b/i,
  /\bwget\b.*\|\s*(ba)?sh\b/i,
  /\bchmod\s+[0-7]*[67][0-7]*\s/i,
  /\bchown\b.*\sroot\b/i,
  /\bsudo\b/i,
  /\bnc\s+-e\b|\bncat\s+-e\b/i,
  /\bpython[0-9.]*\s+-c\b.*socket/i,
  /\bbase64\s+-d\b.*\|\s*(ba)?sh\b/i,
  /\/etc\/(passwd|shadow|sudoers)/i,
  /\.ssh\//i,
]

/** First token allowlist for interactive sandbox commands (defense in depth). */
const ALLOWED_BINARIES = new Set([
  "npm", "npx", "node", "pnpm", "yarn", "bun",
  "tsc", "tsx", "vite", "next", "eslint", "prettier",
  "cat", "ls", "pwd", "echo", "mkdir", "touch", "cp", "mv", "rm",
  "head", "tail", "grep", "find", "wc", "sort", "uniq", "sed", "awk",
  "git", "curl", "wget", "which", "env", "printenv", "true", "false",
  "cd", "test", "[", "[[",
])

export function isDangerousCommand(command: string): boolean {
  if (!command || typeof command !== "string") return true
  if (DANGEROUS_PATTERNS.some((p) => p.test(command))) return true

  // Block shell command substitution / expansion vectors even for allowlisted binaries.
  if (/`/.test(command) || /\$\(|\$\{/.test(command)) return true

  // Split on shell operators and validate the leading binary of each segment
  const segments = command.split(/&&|\|\||;|\n|\|/).map((s) => s.trim()).filter(Boolean)
  for (const segment of segments) {
    // Skip leading ENV=value assignments: FOO=1 BAR=2 npm run build
    const tokens = segment.replace(/^[0-9<>&\s]+/, "").split(/\s+/).filter(Boolean)
    let idx = 0
    while (idx < tokens.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(tokens[idx])) idx++
    const first = tokens[idx]
    if (!first) continue
    const binary = first.replace(/^.*\//, "").toLowerCase()
    if (!ALLOWED_BINARIES.has(binary)) return true
  }
  return false
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

  let isVite = false
  let isNext = false

  // 1. package.json must exist, be valid JSON, and expose a `build` script.
  const pkgFile = byName.get("package.json")
  if (!pkgFile) {
    problems.push('Missing "package.json" — the project needs one with a "build" script.')
  } else {
    let pkg: any
    try {
      pkg = JSON.parse(pkgFile.content)
    } catch {
      problems.push('"package.json" is not valid JSON and cannot be built.')
    }
    if (pkg) {
      const buildScript = pkg?.scripts?.build
      if (typeof buildScript !== "string" || buildScript.trim().length === 0) {
        problems.push('"package.json" has no "scripts.build" command (expected e.g. "vite build" or "next build").')
      }
      const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }
      isVite = !!deps.vite
      isNext = !!deps.next
      if (!isVite && !isNext) {
        problems.push('Neither "vite" nor "next" is listed in package.json — add the build tool so the app can build.')
      }
    }
  }

  // 2. There must be an entry the build can compile.
  if (isNext && !isVite) {
    const hasAppEntry = names.some((n) => /^app\/(.*\/)?(page|layout)\.(tsx|ts|jsx|js)$/.test(n))
    const hasPagesEntry = names.some((n) => /^pages\/.+\.(tsx|ts|jsx|js)$/.test(n))
    if (!hasAppEntry && !hasPagesEntry) {
      problems.push('No Next.js route entry found — add "app/page.tsx" and "app/layout.tsx" or a "pages/" file.')
    }
  } else {
    // Vite SPA — needs an HTML entry and a JS/TS entry module.
    const hasHtml = names.some((n) => /(^|\/)index\.html$/.test(n))
    const hasEntry = names.some((n) => /^src\/main\.(tsx|ts|jsx|js)$/.test(n) || /^src\/index\.(tsx|ts|jsx|js)$/.test(n))
    if (!hasHtml) {
      problems.push('No "index.html" found — a Vite app needs an index.html entry.')
    }
    if (!hasEntry) {
      problems.push('No entry module found — add "src/main.tsx" (or src/index.tsx).')
    }
  }

  return problems
}
