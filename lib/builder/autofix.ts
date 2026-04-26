// ── Step 13: Auto-fix ───────────────────────────────────────────────
// Deterministic fixes for common build issues. AI repair only as fallback.

import type { GeneratedProject, BuildResult, BuildIssue } from "./types"

export function runAutoFixStep(
  project: GeneratedProject,
  buildResult: BuildResult,
): GeneratedProject {
  if (buildResult.ok) return project

  const files = new Map(project.files.map(f => [f.path, { ...f }]))

  for (const issue of buildResult.issues) {
    const file = files.get(issue.file)
    if (!file) continue

    switch (issue.category) {
      case "missing-import":
        file.content = fixMissingImport(file.content, issue)
        break
      case "nextjs":
        file.content = fixNextjsIssue(file.content, issue)
        break
      case "invalid-component":
        file.content = fixInvalidComponent(file.content, issue)
        break
      case "invalid-motion-wrapper":
        file.content = fixInvalidMotion(file.content, issue)
        break
      case "invalid-icon":
        file.content = fixInvalidIcon(file.content, issue)
        break
      default:
        break
    }

    files.set(issue.file, file)
  }

  return {
    ...project,
    files: [...files.values()],
  }
}

function fixMissingImport(content: string, issue: BuildIssue): string {
  // If it's a known component import that's missing, try to add it
  const match = issue.message.match(/Unresolved import: (.+)/)
  if (!match) return content

  // Just remove the broken import line
  const importPath = match[1]
  return content
    .split("\n")
    .filter(line => !line.includes(`from "${importPath}"`))
    .join("\n")
}

function fixNextjsIssue(content: string, issue: BuildIssue): string {
  if (issue.message.includes('"use client"')) {
    // Add "use client" at top if missing
    if (!content.startsWith('"use client"')) {
      return `"use client"\n\n${content}`
    }
    // Move "use client" to top
    const withoutDirective = content.replace(/["']use client["']\s*/g, "")
    return `"use client"\n\n${withoutDirective}`
  }
  return content
}

function fixInvalidComponent(content: string, _issue: BuildIssue): string {
  // Replace unknown components with div
  return content
    .replace(/<UnknownComponent/g, "<div")
    .replace(/<\/UnknownComponent>/g, "</div>")
}

function fixInvalidMotion(content: string, _issue: BuildIssue): string {
  // Replace invalid motion wrappers with FadeIn
  return content
    .replace(/<MotionWrapper/g, "<FadeIn")
    .replace(/<\/MotionWrapper>/g, "</FadeIn>")
    .replace(/<AnimateIn/g, "<FadeIn")
    .replace(/<\/AnimateIn>/g, "</FadeIn>")
}

function fixInvalidIcon(content: string, _issue: BuildIssue): string {
  // Replace unknown icons with a safe fallback
  return content
    .replace(/<UnknownIcon/g, "<Star")
    .replace(/<\/UnknownIcon>/g, "</Star>")
}
