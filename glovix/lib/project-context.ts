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

/** Summarize how a section component should be used (props vs lib/data). */
function summarizeSectionApi(path: string, content: string): string {
  const name =
    content.match(/export function (\w+)/)?.[1] ??
    path.replace(/\\/g, "/").split("/").pop()?.replace(/\.(tsx|ts)$/, "") ??
    path

  const usesSiteData =
    /from ['"]@\/lib\/data['"]/.test(content) ||
    /from ['"]\.\.\/\.\.\/lib\/data['"]/.test(content) ||
    /siteConfig/.test(content)

  const hasPropsParam = /export function \w+\(\{/.test(content)
  const noArgExport = /export function \w+\(\s*\)/.test(content)

  if (usesSiteData && !hasPropsParam) {
    return `- **${name}** (\`${path}\`) — self-contained, reads \`lib/data.ts\` → use **without props**`
  }
  if (noArgExport) {
    return `- **${name}** (\`${path}\`) — no props → \`<${name} />\``
  }
  if (hasPropsParam) {
    const iface = content.match(/interface (\w+Props)/)?.[1]
    return `- **${name}** (\`${path}\`) — accepts props${iface ? ` (\`${iface}\`)` : ""} → readFile before passing data`
  }
  return `- **${name}** (\`${path}\`) — readFile to confirm API before use`
}

function listSectionComponents(files: ProjectFiles): string[] {
  return Object.keys(files)
    .filter((p) => {
      const norm = p.replace(/\\/g, "/")
      return norm.startsWith("components/sections/") && /\.(tsx|ts)$/.test(norm)
    })
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

  const sectionPaths = listSectionComponents(files)
  if (sectionPaths.length > 0) {
    sections.push(
      "### Section components (readFile before use — API may differ from preset docs)",
      ...sectionPaths.map((p) => {
        const content = files[p]?.file?.contents ?? ""
        return summarizeSectionApi(p, content)
      }),
      "Always readFile a section before importing it. Do not pass props unless its source defines a props interface.",
    )
  }

  if (files["lib/data.ts"]?.file?.contents?.trim()) {
    sections.push(
      "### lib/data.ts",
      "Present — some section components may read siteConfig/data from here internally instead of taking props.",
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
