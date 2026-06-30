/**
 * Build a compact project-context block injected into Syra's system prompt so the
 * model starts each turn with ground-truth state instead of guessing.
 */

type ProjectFiles = Record<string, { file: { contents: string } }>

const CONTEXT_FILES = [
  ".glovix/deep-memory.md",
  ".glovix/context.md",
  ".glovix/glovix.md",
] as const

const MAX_CONTEXT_CHARS = 12000
const MAX_FILE_CHARS = 4000

function listInstalledShadcnComponents(files: ProjectFiles): string[] {
  return Object.keys(files)
    .filter((p) => {
      const norm = p.replace(/\\/g, "/").toLowerCase()
      return norm.includes("components/ui/") && (norm.endsWith(".tsx") || norm.endsWith(".ts"))
    })
    .map((p) => p.replace(/\\/g, "/").split("/").pop()?.replace(/\.(tsx|ts)$/, "") ?? "")
    .filter(Boolean)
    .sort()
}

function truncate(text: string, max = MAX_FILE_CHARS): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n\n… [truncated ${text.length - max} chars]`
}

/** Build markdown context block for the system prompt. */
export function buildInjectedProjectContext(files: ProjectFiles): string {
  const sections: string[] = ["## 📌 AUTO-INJECTED PROJECT CONTEXT (ground truth — do not ignore)"]

  const installed = listInstalledShadcnComponents(files)
  if (installed.length > 0) {
    sections.push(
      "### Installed shadcn/ui components",
      installed.map((c) => `- ${c}`).join("\n"),
      "Only import components from this list. Install missing ones with addShadcnComponent before importing.",
    )
  } else {
    sections.push(
      "### Installed shadcn/ui components",
      "None yet. Call addShadcnComponent before writing any `@/components/ui/*` import.",
    )
  }

  for (const path of CONTEXT_FILES) {
    const content = files[path]?.file?.contents?.trim()
    if (content) {
      sections.push(`### ${path}`, truncate(content))
    }
  }

  const knowledgePaths = Object.keys(files)
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
