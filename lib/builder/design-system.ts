// ── Step 4: Design System ───────────────────────────────────────────
// Deterministic design system selection. No AI call.

import type { ProjectManifest } from "./types"

export function runDesignSystemStep(manifest: ProjectManifest): ProjectManifest {
  const { brief, theme, chrome, design } = manifest

  // Refine theme based on style hints
  const updated = { ...manifest }

  if (brief.styleHints.includes("premium")) {
    updated.theme = { ...theme, primarySat: 70, radius: "0.75rem" }
    updated.design = { ...design, cardTreatment: "elevated", sectionRhythm: "spacious" }
  }

  if (brief.styleHints.includes("minimal")) {
    updated.theme = { ...theme, primarySat: 60, radius: "0.375rem" }
    updated.design = { ...design, cardTreatment: "flat", sectionRhythm: "balanced" }
  }

  if (brief.styleHints.includes("playful")) {
    updated.theme = { ...theme, primaryHue: 280, primarySat: 90, radius: "1rem" }
    updated.design = { ...design, motionLevel: "polished" }
  }

  if (brief.styleHints.includes("editorial")) {
    updated.design = { ...design, visualStyle: "editorial", typographyScale: "standard", sectionRhythm: "spacious" }
  }

  // Ensure brand name from chrome is reasonable
  if (chrome.brandName.length < 2) {
    updated.chrome = { ...chrome, brandName: "My Site" }
  }

  return updated
}
