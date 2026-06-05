// Virtual filesystem for Syra.
//
// Backed by the project's `pages` array. All Syra tools operate on an instance
// of this class in memory; once the pipeline finishes, `changes()` produces the
// diff that the API route persists back to MongoDB.

import type { FileChange, SyraFile } from "./types"

function normalizePath(input: string): string {
  let p = (input || "").trim().replace(/\\/g, "/")
  // strip leading "./" and any leading slashes
  p = p.replace(/^\.\//, "").replace(/^\/+/, "")
  // collapse duplicate slashes
  p = p.replace(/\/{2,}/g, "/")
  return p
}

/** Reject paths that would escape the project or write secrets. */
export function isUnsafePath(path: string): string | null {
  const p = normalizePath(path)
  if (!p) return "empty path"
  if (p.includes("..")) return "path traversal is not allowed"
  if (p.includes("\0")) return "null byte in path"
  if (/(^|\/)\.env(\.|$)/.test(p)) return "env files cannot be written"
  if (p.length > 255) return "path too long"
  if (/[<>:"|?*]/.test(p)) return "invalid characters in path"
  return null
}

export class VirtualFs {
  private files = new Map<string, string>()
  private original = new Map<string, string>()

  constructor(initial: SyraFile[] = []) {
    for (const f of initial) {
      const p = normalizePath(f.path)
      if (!p) continue
      this.files.set(p, f.content ?? "")
      this.original.set(p, f.content ?? "")
    }
  }

  get size(): number {
    return this.files.size
  }

  exists(path: string): boolean {
    return this.files.has(normalizePath(path))
  }

  /** List file paths, optionally under a directory prefix. Returns sorted paths. */
  list(prefix = ""): string[] {
    const norm = normalizePath(prefix)
    const all = [...this.files.keys()]
    const filtered = norm ? all.filter((p) => p === norm || p.startsWith(norm.endsWith("/") ? norm : norm + "/")) : all
    return filtered.sort()
  }

  read(path: string): string | null {
    const p = normalizePath(path)
    return this.files.has(p) ? (this.files.get(p) as string) : null
  }

  readMany(paths: string[]): { path: string; content: string | null }[] {
    return paths.map((path) => ({ path: normalizePath(path), content: this.read(path) }))
  }

  write(path: string, content: string): { path: string; created: boolean } {
    const reason = isUnsafePath(path)
    if (reason) throw new Error(`Refused to write "${path}": ${reason}`)
    const p = normalizePath(path)
    const created = !this.files.has(p)
    this.files.set(p, content ?? "")
    return { path: p, created }
  }

  edit(path: string, oldText: string, newText: string): { path: string; replacements: number } {
    const p = normalizePath(path)
    const current = this.files.get(p)
    if (current === undefined) throw new Error(`Cannot edit missing file "${p}"`)
    if (!oldText) throw new Error("old_text must not be empty")
    if (!current.includes(oldText)) {
      throw new Error(`old_text not found in "${p}" — read the file again before editing`)
    }
    // Replace only the first occurrence to mirror a safe, targeted edit.
    const next = current.replace(oldText, newText)
    this.files.set(p, next)
    return { path: p, replacements: 1 }
  }

  delete(path: string): boolean {
    const p = normalizePath(path)
    return this.files.delete(p)
  }

  rename(from: string, to: string): { from: string; to: string } {
    const src = normalizePath(from)
    const dst = normalizePath(to)
    const reason = isUnsafePath(dst)
    if (reason) throw new Error(`Refused to move to "${to}": ${reason}`)
    const content = this.files.get(src)
    if (content === undefined) throw new Error(`Cannot move missing file "${src}"`)
    this.files.delete(src)
    this.files.set(dst, content)
    return { from: src, to: dst }
  }

  /** Build an indented tree string of the current files for prompts/UI. */
  tree(): string {
    const paths = this.list()
    if (!paths.length) return "(empty project)"
    type Node = { children: Map<string, Node>; file: boolean }
    const root: Node = { children: new Map(), file: false }
    for (const path of paths) {
      const parts = path.split("/")
      let node = root
      parts.forEach((part, i) => {
        if (!node.children.has(part)) {
          node.children.set(part, { children: new Map(), file: i === parts.length - 1 })
        }
        node = node.children.get(part) as Node
      })
    }
    const lines: string[] = []
    const walk = (node: Node, depth: number) => {
      const entries = [...node.children.entries()].sort((a, b) => {
        // directories first, then files, alphabetical
        if (a[1].file !== b[1].file) return a[1].file ? 1 : -1
        return a[0].localeCompare(b[0])
      })
      for (const [name, child] of entries) {
        lines.push(`${"  ".repeat(depth)}${child.file ? "" : ""}${name}${child.file ? "" : "/"}`)
        if (!child.file) walk(child, depth + 1)
      }
    }
    walk(root, 0)
    return lines.join("\n")
  }

  /** Snapshot of current files. */
  snapshot(): SyraFile[] {
    return [...this.files.entries()].map(([path, content]) => ({ path, content }))
  }

  /** Diff between the initial state and now. */
  changes(): FileChange[] {
    const changes: FileChange[] = []
    // created or modified
    for (const [path, content] of this.files.entries()) {
      if (!this.original.has(path)) {
        changes.push({ path, kind: "created", content })
      } else if (this.original.get(path) !== content) {
        changes.push({ path, kind: "modified", content, previous: this.original.get(path) })
      }
    }
    // deleted
    for (const [path, content] of this.original.entries()) {
      if (!this.files.has(path)) {
        changes.push({ path, kind: "deleted", content: "", previous: content })
      }
    }
    return changes.sort((a, b) => a.path.localeCompare(b.path))
  }
}
