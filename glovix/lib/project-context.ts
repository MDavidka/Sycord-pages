/**
 * Build a compact project-context block injected into Syra's system prompt so the
 * model starts each turn with ground-truth state instead of guessing.
 *
 * Vite + React SPA baseline (no shadcn) — this stays framework-agnostic and just
 * summarizes the current files plus any persisted notes/knowledge.
 */

type ProjectFiles = Record<string, { file: { contents: string } }>

const CONTEXT_FILES = [
  ".glovix/deep-memory.md",
  ".glovix/context.md",
  ".glovix/glovix.md",
] as const

const MAX_CONTEXT_CHARS = 14000
const MAX_FILE_CHARS = 4000

function truncate(text: string, max = MAX_FILE_CHARS): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n… [truncated ${text.length - max} chars]`
}

/** Build markdown context block for the system prompt. */
export function buildInjectedProjectContext(files: ProjectFiles): string {
  const sections: string[] = ["## 📌 AUTO-INJECTED PROJECT CONTEXT (ground truth — do not ignore)"]

  const paths = Object.keys(files)
  const sourcePaths = paths.filter((p) => /\.(tsx?|jsx?)$/.test(p))
  sections.push(
    "### Project snapshot",
    `- ${paths.length} tracked files (${sourcePaths.length} source files)`,
    `- Vite + React + Tailwind SPA — routes under \`src/pages/\`, shared UI under \`src/components/\``,
    `- Use \`grep({ pattern })\` to locate strings/imports before editing`,
    `- Use \`write_file({ path, content, startLine, endLine })\` for line-range patches after grep`,
  )

  const routePaths = paths.filter((p) => /^src\/pages\/.+\.(tsx|jsx)$/.test(p)).sort()
  if (routePaths.length > 0) {
    sections.push("### Pages", routePaths.map((p) => `- ${p}`).join("\n"))
  }

  const componentPaths = paths.filter((p) => /^src\/components\/.+\.(tsx|jsx)$/.test(p)).sort()
  if (componentPaths.length > 0) {
    sections.push("### Components", componentPaths.map((p) => `- ${p}`).join("\n"))
  }

  for (const path of CONTEXT_FILES) {
    const content = files[path]?.file?.contents?.trim()
    if (content) {
      sections.push(`### ${path}`, truncate(content))
    }
  }

  const knowledgePaths = paths
    .filter((p) => p.startsWith(".glovix/knowledge/") && p.endsWith(".md"))
    .sort()

  if (knowledgePaths.length > 0) {
    sections.push("### Knowledge blocks", knowledgePaths.map((p) => `- ${p}`).join("\n"))
  }

  let block = sections.join("\n\n")
  if (block.length > MAX_CONTEXT_CHARS) {
    block = `${block.slice(0, MAX_CONTEXT_CHARS)}\n\n… [context truncated]`
  }

  return block
}
