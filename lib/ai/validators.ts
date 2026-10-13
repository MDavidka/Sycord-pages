import { Diagnostic, ParsedFileChangeSet } from "./types";
import { isSafePath } from "./path-safety";

export function validateChangeset(changeset: ParsedFileChangeSet, existingFiles: any[]): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  for (const upsert of changeset.upserts) {
    if (!isSafePath(upsert.name)) {
      diagnostics.push({ file: upsert.name, severity: "error", code: "UNSAFE_PATH", message: "Path is unsafe or forbidden." });
    }

    if (upsert.content.includes("```ts") || upsert.content.includes("```tsx")) {
        diagnostics.push({ file: upsert.name, severity: "warning", code: "MARKDOWN_ARTIFACTS", message: "File contains markdown fences inside content." });
    }

    if (upsert.name.endsWith(".json")) {
        try {
            JSON.parse(upsert.content);
        } catch (e) {
            diagnostics.push({ file: upsert.name, severity: "error", code: "INVALID_JSON", message: "Failed to parse JSON." });
        }
    }

    if (upsert.name.endsWith(".tsx") || upsert.name.endsWith(".ts") || upsert.name.endsWith(".jsx") || upsert.name.endsWith(".js")) {
      const match = upsert.content.match(/import\s+(?:[\w{},*\s]+)\s+from\s+['"]([^'"]+)['"]/g);
      if (match) {
        for (const m of match) {
          const mPath = m.match(/from\s+['"]([^'"]+)['"]/);
          if (mPath && mPath[1]) {
            const importPath = mPath[1];
            if (importPath.startsWith("@/components/ui/")) {
                const componentName = importPath.replace("@/components/ui/", "");
                // Relaxed for now
            }
          }
        }
      }

      if (upsert.content.includes("useState") || upsert.content.includes("useEffect") || upsert.content.includes("onClick")) {
        if (!upsert.content.includes("\"use client\"") && !upsert.content.includes("'use client'")) {
            diagnostics.push({ file: upsert.name, severity: "error", code: "MISSING_USE_CLIENT", message: "Component uses hooks or events but missing 'use client' directive." });
        }
      }
    }
  }

  for (const del of changeset.deletes) {
    if (!isSafePath(del)) {
        diagnostics.push({ file: del, severity: "error", code: "UNSAFE_PATH", message: "Path to delete is unsafe." });
    }
  }

  return diagnostics;
}
