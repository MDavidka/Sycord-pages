// ── Step 14: Preview ────────────────────────────────────────────────
// Prepare the generated project for preview.

import type { GeneratedProject } from "./types"

export interface PreviewResult {
  available: boolean
  previewUrl?: string
  message: string
}

export function runPreviewStep(project: GeneratedProject): PreviewResult {
  // In the builder, preview is handled via iframe rendering the generated files.
  // This step validates that we have enough files for a preview.

  const hasLayout = project.files.some(f => f.path === "app/layout.tsx")
  const hasHomePage = project.files.some(f => f.path === "app/page.tsx")
  const hasStyles = project.files.some(f => f.path === "app/globals.css")

  if (!hasLayout || !hasHomePage || !hasStyles) {
    return {
      available: false,
      message: "Preview unavailable — missing essential files (layout, home page, or styles).",
    }
  }

  return {
    available: true,
    previewUrl: "/api/ai/preview",
    message: "Preview ready. Generated files can be viewed in the builder preview panel.",
  }
}
