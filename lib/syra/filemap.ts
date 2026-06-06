// Compressed project "see file" for Syra.
//
// Reading every file into the prompt each round is expensive and pushes the
// model toward hallucinating imports. Instead Syra maintains a compact manifest:
// for each source file, its path + the exact symbols it exports (and line count).
// This is re-sent every round and is also available on demand via the
// get_file_map tool, so the model always knows precisely what it can import and
// from where (correct path + capitalization) without re-reading file bodies.

import type { VirtualFs } from "./vfs"

/** Extract exported symbol names from a TS/JS source file. */
export function extractExports(src: string): string[] {
  const names = new Set<string>()
  if (/export\s+default\b/.test(src)) names.add("default")

  const re1 = /export\s+(?:async\s+)?(?:const|function|class|let|var)\s+([A-Za-z0-9_$]+)/g
  const re2 = /export\s*\{([^}]*)\}/g
  const re3 = /export\s+(?:type|interface)\s+([A-Za-z0-9_$]+)/g

  let m: RegExpExecArray | null
  while ((m = re1.exec(src))) names.add(m[1])
  while ((m = re3.exec(src))) names.add(m[1])
  while ((m = re2.exec(src))) {
    for (const part of m[1].split(",")) {
      const t = part.trim().replace(/^type\s+/, "")
      if (!t) continue
      const exported = t.split(/\s+as\s+/).pop()!.trim()
      if (exported) names.add(exported)
    }
  }
  return [...names]
}

/**
 * Build the compressed file map. Source files show their exports; other files
 * (css/json/svg/etc.) are listed by path only.
 */
export function buildFileMap(vfs: VirtualFs): string {
  const paths = vfs.list()
  if (!paths.length) return "(empty project)"
  const lines = paths.map((path) => {
    if (!/\.(tsx|ts|jsx|js|mjs|cjs)$/.test(path)) return path
    const src = vfs.read(path) || ""
    const exps = extractExports(src)
    const loc = src ? src.split("\n").length : 0
    return `${path} [${loc}L]${exps.length ? ` -> exports: ${exps.join(", ")}` : ""}`
  })
  return lines.join("\n")
}

/** Header + map, ready to drop into a prompt turn. */
export function fileMapMessage(vfs: VirtualFs): string {
  const files = vfs.list()
  return [
    `Current project files (${files.length}). Import ONLY these, using the EXACT path and`,
    "capitalization shown, and only the exact exported symbols listed:",
    buildFileMap(vfs),
  ].join("\n")
}
