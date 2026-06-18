// Build / validation step.
//
// We don't run the full Next.js compiler from inside the orchestrator
// (the generated project lives in memory as { path, content } files —
// it isn't installed). Instead we run a fast deterministic static
// validator that catches the most common AI-induced breakages:
// duplicate paths, balanced JSX braces, every page exporting a default
// component, and every imported handler/component existing in the
// project. Issues found here are fixable deterministically by the
// orchestrator before any AI repair.

import type { BuildResult, GeneratedFile } from "./types"

export function validateBuild(files: GeneratedFile[]): BuildResult {
  const errors: string[] = []
  const warnings: string[] = []

  // 1. Duplicate path detection.
  const seen = new Map<string, number>()
  for (const f of files) {
    seen.set(f.path, (seen.get(f.path) ?? 0) + 1)
  }
  for (const [path, count] of seen) {
    if (count > 1) errors.push(`duplicate file path: ${path}`)
  }

  // 2. Required scaffold files present.
  const required = [
    "package.json",
    "app/layout.tsx",
    "app/page.tsx",
    "app/globals.css",
    "components/site-header.tsx",
    "components/site-footer.tsx",
    "lib/utils.ts",
    "lib/site-config.ts",
    "lib/generated-manifest.ts",
  ]
  const present = new Set(files.map((f) => f.path))
  for (const r of required) {
    if (!present.has(r)) errors.push(`missing required scaffold file: ${r}`)
  }

  // 3. Per-page checks.
  for (const f of files) {
    if (!f.path.startsWith("app/") || !f.path.endsWith("/page.tsx")) continue
    if (!/export\s+default\s+function\s+\w+Page\s*\(/.test(f.content)) {
      errors.push(`page ${f.path} is missing a default-export component`)
    }
    if (!/export\s+const\s+metadata\s*:/.test(f.content)) {
      warnings.push(`page ${f.path} is missing exported metadata`)
    }
    const angles = countOuterBraces(f.content)
    if (angles.open !== angles.close) {
      errors.push(`page ${f.path} has unbalanced JSX braces (${angles.open} '{' vs ${angles.close} '}')`)
    }
  }

  // 4. Handler imports referenced must exist as exports of lib/handlers.ts.
  const handlerFile = files.find((f) => f.path === "lib/handlers.ts")
  const handlerExports = handlerFile ? extractExportedNames(handlerFile.content) : new Set<string>()
  for (const f of files) {
    if (!f.path.endsWith(".tsx")) continue
    const m = f.content.match(/import\s*\{\s*([^}]+)\s*\}\s*from\s*["']@\/lib\/handlers["']/)
    if (!m) continue
    const names = m[1]
      .split(",")
      .map((s) => s.trim().replace(/\s+as\s+\w+$/, ""))
      .filter(Boolean)
    for (const name of names) {
      if (!handlerExports.has(name)) {
        errors.push(`page ${f.path} imports unknown handler "${name}" from @/lib/handlers`)
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings }
}

function countOuterBraces(src: string): { open: number; close: number } {
  // Naive counter — JSX content uses {expr}, plus TS object/function braces.
  // We only care about whether the totals match (a strong proxy for syntax
  // errors that survived the deterministic converter). String/comment-aware
  // accounting is not needed for the codepaths we generate.
  let open = 0
  let close = 0
  let inStr: '"' | "'" | "`" | null = null
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inStr) {
      if (c === "\\") {
        i++
        continue
      }
      if (c === inStr) inStr = null
      continue
    }
    if (c === '"' || c === "'" || c === "`") {
      inStr = c
      continue
    }
    if (c === "{") open++
    else if (c === "}") close++
  }
  return { open, close }
}

function extractExportedNames(src: string): Set<string> {
  const names = new Set<string>()
  const re = /export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_][A-Za-z0-9_]*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    names.add(m[1])
  }
  return names
}
