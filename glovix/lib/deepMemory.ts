import type { DeepMemoryProfile, DeepMemoryEntry, DeepMemoryEntryKind } from "@/lib/types"

export type { DeepMemoryProfile, DeepMemoryEntry, DeepMemoryEntryKind }

/**
 * Fetch the current user's Deep Memory profile from the Sycord backend.
 * Returns null when not embedded in a Sycord project or when the request fails.
 */
export async function fetchDeepMemory(): Promise<DeepMemoryProfile | null> {
  try {
    const res = await fetch("/api/user/deep-memory", {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    if (!res.ok) return null
    const data = await res.json()
    return data?.deepMemory || null
  } catch (err) {
    console.error("[DeepMemory] Failed to fetch:", err)
    return null
  }
}

/**
 * Format a Deep Memory profile into a compact string suitable for injection
 * into the AI system prompt. Limits entries to the most relevant ones to
 * stay within context budgets.
 */
export function formatDeepMemoryForPrompt(profile: DeepMemoryProfile | null, maxEntries = 20): string {
  if (!profile) return ""

  const parts: string[] = []
  parts.push("## 🧠 ACTIVE DEEP MEMORY")

  if (profile.summary?.trim()) {
    parts.push(`### Project Summary\n${profile.summary.trim()}`)
  }

  if (profile.architectureNotes?.trim()) {
    parts.push(`### Architecture Notes\n${profile.architectureNotes.trim()}`)
  }

  if (profile.recurringIssues?.length) {
    parts.push(
      `### Recurring Issues to Avoid\n${profile.recurringIssues
        .filter((i) => typeof i === "string" && i.trim())
        .map((i) => `- ${i.trim()}`)
        .join("\n")}`,
    )
  }

  if (profile.trustedPatterns?.length) {
    parts.push(
      `### Trusted Patterns\n${profile.trustedPatterns
        .filter((p) => typeof p === "string" && p.trim())
        .map((p) => `- ${p.trim()}`)
        .join("\n")}`,
    )
  }

  const entries = (profile.entries || [])
    .filter((e) => e?.title?.trim() && e?.content?.trim())
    .slice(0, maxEntries)

  if (entries.length) {
    parts.push(
      `### Recent Memory Entries\n${entries
        .map(
          (e) =>
            `- [${e.kind}] ${e.title}${e.projectName ? ` (${e.projectName})` : ""}: ${e.content.replace(/\n/g, " ")}`,
        )
        .join("\n")}`,
    )
  }

  if (parts.length === 1) return ""
  return parts.join("\n\n")
}

/**
 * Record a new Deep Memory entry via the API. Best-effort — does not throw.
 */
export async function recordDeepMemoryEntry(entry: {
  kind: DeepMemoryProfile["entries"][number]["kind"]
  title: string
  content: string
  projectId?: string
  projectName?: string
  tags?: string[]
}): Promise<void> {
  try {
    await fetch("/api/user/deep-memory/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...entry,
        createdAt: new Date().toISOString(),
      }),
    })
  } catch (err) {
    console.error("[DeepMemory] Failed to record entry:", err)
  }
}

/**
 * Extract a concise root-cause summary from a build/deploy error string.
 */
export function summarizeError(error: string): { title: string; content: string; tags: string[] } {
  const normalized = (error || "").slice(0, 2000)
  const lines = normalized.split("\n").filter((l) => l.trim())

  // Try to find the most specific error line.
  const importError = lines.find((l) => /module not found|cannot find module|can't resolve/i.test(l))
  const typeError = lines.find((l) => /type error|ts\(|typescript/i.test(l))
  const dockerError = lines.find((l) => /docker|dockerfile|npm err/i.test(l))

  if (importError) {
    const match = importError.match(/['"]([^'"]+)['"]/)
    const moduleName = match ? match[1] : "unknown module"
    return {
      title: `Import error: ${moduleName}`,
      content: `Build failed because "${moduleName}" could not be resolved. Before importing it, verify the module is installed in package.json or the component exists in components/ui/. Fix: install missing dependency or call addShadcnComponent() before writing the import.`,
      tags: ["imports", "build"],
    }
  }

  if (typeError) {
    return {
      title: "TypeScript build error",
      content: `TypeScript error during build: ${typeError.trim()}. Fix: run typeCheck(), read the affected file, and resolve the type mismatch before save/deploy.`,
      tags: ["typescript", "build"],
    }
  }

  if (dockerError) {
    return {
      title: "Docker/Dokploy build error",
      content: `Deployment build failed in Docker: ${dockerError.trim()}. Fix: ensure package.json has a valid build script, Dockerfile exists, and all imports resolve before calling deploy().`,
      tags: ["docker", "deployment"],
    }
  }

  return {
    title: "Build or deployment failure",
    content: `Failure summary: ${lines.slice(0, 3).join("; ")}. Fix: run getErrors(), identify the root cause, fix the affected files, run typeCheck(), then retry save/deploy.`,
    tags: ["build", "deployment"],
  }
}
