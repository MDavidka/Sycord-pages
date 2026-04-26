// ── Step 15: Export / Deploy ─────────────────────────────────────────
// Package the generated project for download.

import type { GeneratedProject, DeployResult } from "./types"

export function runExportStep(project: GeneratedProject): DeployResult {
  // In a full implementation this would create a ZIP and optionally deploy.
  // For now, mark files as ready for download via the API.

  const fileCount = project.files.length
  const hasPackageJson = project.files.some(f => f.path === "package.json")

  if (!hasPackageJson) {
    return {
      ok: false,
      logs: ["Missing package.json — project cannot be exported."],
    }
  }

  return {
    ok: true,
    logs: [
      `Project "${project.name}" ready for export.`,
      `${fileCount} files generated.`,
      "Download as ZIP or deploy to hosting provider.",
    ],
  }
}
