// ── Step 11: Project Assembly ────────────────────────────────────────
// Combine all generated files into one project. No AI call.

import type { GeneratedFile, GeneratedProject, ProjectManifest } from "./types"

export function assembleGeneratedProject(
  manifest: ProjectManifest,
  scaffoldFiles: GeneratedFile[],
  pageFiles: GeneratedFile[],
  logicFiles: GeneratedFile[],
): GeneratedProject {
  const allFiles = [...scaffoldFiles, ...pageFiles, ...logicFiles]

  // Deduplicate by path (later files win)
  const fileMap = new Map<string, GeneratedFile>()
  for (const f of allFiles) {
    fileMap.set(f.path, f)
  }

  // Verify every planned route has a page file
  for (const page of manifest.pages) {
    if (!fileMap.has(page.filePath)) {
      // Generate a minimal stub
      fileMap.set(page.filePath, {
        path: page.filePath,
        content: `export default function ${page.componentName}() {
  return (
    <main className="container px-4 py-16">
      <h1 className="text-3xl font-bold">${page.title}</h1>
      <p className="mt-4 text-muted-foreground">${page.description}</p>
    </main>
  )
}
`,
        kind: "page",
        status: "warning",
        warnings: ["Generated as stub — AI generation failed for this page"],
      })
    }
  }

  return {
    name: manifest.projectName,
    manifest,
    files: [...fileMap.values()],
  }
}
