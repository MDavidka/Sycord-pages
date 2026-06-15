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
import { ObjectId } from "mongodb"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

/** Root directory under which every project's sandbox workspace lives. */
export const WORKSPACE_BASE = path.join(os.tmpdir(), "sycord-workspace")

export type WorkspaceFile = { name: string; content: string }

/** Resolve the authenticated user's id, or null when unauthenticated. */
export async function requireUserId(): Promise<string | null> {
  const session = await getServerSession(authOptions)
  return (session?.user as { id?: string } | undefined)?.id ?? null
}

/** A 24-char hex Mongo ObjectId string. */
export function isValidProjectId(projectId: string): boolean {
  return /^[a-f0-9]{24}$/i.test(projectId) && ObjectId.isValid(projectId)
}

/** Load a single project (with its pages) owned by the given user. */
export async function loadProject(userId: string, projectId: string): Promise<any | null> {
  if (!isValidProjectId(projectId)) return null
  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
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

// Directories whose contents must never be written back to Pages (build
// artifacts / dependencies / VCS) and per-file limits for the write-back.
const WRITEBACK_EXCLUDED_DIRS = new Set([
  "node_modules", ".next", ".git", "dist", "build", "out", ".cache", ".turbo", "coverage", ".vercel",
])
const WRITEBACK_MAX_FILES = 200
const WRITEBACK_MAX_FILE_BYTES = 256 * 1024

/** True for a source file we are willing to persist back into Pages. */
function isPersistableWorkspaceFile(rel: string): boolean {
  if (isDisallowedFile(rel)) return false
  if (rel.split("/").some((seg) => WRITEBACK_EXCLUDED_DIRS.has(seg))) return false
  // Page-name validation mirrors the /pages API.
  if (rel.includes("..") || rel.startsWith("/") || rel.includes("\0")) return false
  if (/[<>:"|?*]/.test(rel) || rel.length > 255) return false
  return true
}

/** Recursively collect persistable text files (name → content) under `root`. */
async function collectWorkspaceFiles(root: string): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  async function walk(dir: string): Promise<void> {
    if (out.size >= WRITEBACK_MAX_FILES) return
    let entries: any[]
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (out.size >= WRITEBACK_MAX_FILES) return
      const abs = path.join(dir, entry.name)
      const rel = path.relative(root, abs).split(path.sep).join("/")
      if (entry.isDirectory()) {
        if (WRITEBACK_EXCLUDED_DIRS.has(entry.name)) continue
        await walk(abs)
        continue
      }
      if (!entry.isFile()) continue
      if (!isPersistableWorkspaceFile(rel)) continue
      try {
        const stat = await fs.stat(abs)
        if (stat.size > WRITEBACK_MAX_FILE_BYTES) continue
        const buf = await fs.readFile(abs)
        if (buf.includes(0)) continue // skip binary files
        out.set(rel, buf.toString("utf8"))
      } catch {
        /* unreadable — skip */
      }
    }
  }
  await walk(root)
  return out
}

/**
 * After a command runs in the VM, persist any NEW or CHANGED source files back
 * into the project's Pages (MongoDB) so generated code (e.g. shadcn components,
 * codegen output) is durable — the VM workspace itself is ephemeral. Build
 * artifacts and dependencies are excluded. Returns the changed file names.
 */
export async function persistWorkspaceChanges(
  userId: string,
  projectId: string,
  root: string,
  originalFiles: WorkspaceFile[],
): Promise<string[]> {
  if (!isValidProjectId(projectId)) return []
  const original = new Map(originalFiles.map((f) => [f.name.replace(/^\/+/, ""), f.content]))
  const current = await collectWorkspaceFiles(root)

  const changed: Array<{ name: string; content: string }> = []
  for (const [name, content] of current) {
    if (original.get(name) !== content) changed.push({ name, content })
  }
  if (changed.length === 0) return []

  const client = await clientPromise
  const db = client.db()
  const user = await db.collection("users").findOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    { projection: { "projects.$": 1 } },
  )
  const project = user?.projects?.[0]
  if (!project) return []

  const pages: any[] = Array.isArray(project.pages) ? project.pages : []
  const byName = new Map(pages.map((p: any) => [p.name, p]))
  const now = new Date()
  for (const { name, content } of changed) {
    const existing = byName.get(name)
    if (existing) {
      existing.content = content
      existing.updatedAt = now
    } else {
      const page = { name, content, usedFor: "VM", createdAt: now, updatedAt: now }
      pages.push(page)
      byName.set(name, page)
    }
  }

  await db.collection("users").updateOne(
    { id: userId, "projects._id": new ObjectId(projectId) },
    { $set: { "projects.$.pages": pages } },
  )

  return changed.map((c) => c.name)
}

/**
 * Commands that must never run in the sandbox, regardless of who asks. The VM
 * is for building Next.js apps only — destructive, privilege-escalating,
 * remote-code-execution and credential-exfiltration commands are rejected so a
 * generated (or prompt-injected) script can never harm the host or leak data.
 */
const DANGEROUS_PATTERNS: RegExp[] = [
  // Filesystem destruction
  /rm\s+-[a-z]*r[a-z]*f?\s+(\/|~|\$HOME|\.\.|\*)/i,
  /\bmkfs\b/i,
  /\bdd\s+if=/i,
  /\b(shred|wipefs)\b/i,
  />\s*\/dev\/(sd|nvme|disk|null\/)/i,
  // Fork bomb
  /:\s*\(\s*\)\s*\{[^}]*:\s*\|\s*:/,
  /\.\s*\(\s*\)\s*\{.*\}\s*;/,
  // Power / process control
  /\b(shutdown|reboot|halt|poweroff|init\s+0|telinit)\b/i,
  /\bkillall\b|\bkill\s+-9\s+-1\b/i,
  // Privilege escalation
  /\b(sudo|su\s+-|doas)\b/i,
  /\bchmod\s+-?R?\s*777\s+\//i,
  /\bchown\s+-R\s+\w+\s+\//i,
  // Remote code execution: pipe a download straight into a shell
  /\b(curl|wget|fetch)\b[^|]*\|\s*(sudo\s+)?(ba|z|da|c)?sh\b/i,
  /\b(curl|wget)\b[^|]*\|\s*(python|node|perl|ruby|php)\b/i,
  // Reverse shells
  /\bnc\b.*\s-e\b|\bncat\b.*\s-e\b/i,
  /bash\s+-i\s+>\s*&?\s*\/dev\/tcp\//i,
  /\/dev\/tcp\//i,
  // Credential / secret exfiltration
  /\b(cat|less|head|tail|cp|scp|curl|tar)\b[^\n]*(\/etc\/(passwd|shadow|sudoers)|\.ssh\/|id_rsa|\.aws\/credentials|\.npmrc)/i,
  /\b(printenv|env)\b[^|\n]*\|\s*(curl|wget|nc)\b/i,
  // Supply-chain / publishing from the sandbox
  /\bnpm\s+(publish|adduser|login|token)\b/i,
  /\b(pnpm|yarn)\s+publish\b/i,
  // Crypto miners
  /\b(xmrig|minerd|cgminer|ethminer|cpuminer)\b/i,
]

export function isDangerousCommand(command: string): boolean {
  return DANGEROUS_PATTERNS.some((p) => p.test(command))
}

/** A short, AI-readable explanation for why a command was rejected. */
export function dangerousCommandReason(command: string): string {
  if (/\b(sudo|su\s+-|doas)\b/i.test(command)) return "privilege escalation (sudo/su) is not allowed in the VM"
  if (/\b(curl|wget|fetch)\b[^|]*\|\s*\w+sh\b/i.test(command) || /\/dev\/tcp\//i.test(command))
    return "piping remote scripts into a shell / opening network shells is blocked"
  if (/rm\s+-[a-z]*r/i.test(command) || /\bmkfs\b|\bdd\s+if=/i.test(command))
    return "destructive filesystem commands are blocked"
  if (/passwd|shadow|id_rsa|\.aws|\.npmrc|\.ssh/i.test(command))
    return "reading/exfiltrating credentials is blocked"
  if (/\bnpm\s+(publish|adduser|login)\b/i.test(command)) return "publishing/login from the VM is blocked"
  return "this command is not permitted in the build VM"
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
  if (!pkgFile) {
    problems.push('Missing "package.json" — a Next.js project needs one with a "build" script.')
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

  return problems
}
