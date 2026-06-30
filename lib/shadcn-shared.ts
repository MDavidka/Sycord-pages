const COMPONENT_ALIASES: Record<string, string> = {
  dropdown: "dropdown-menu",
  alertdialog: "alert-dialog",
  contextmenu: "context-menu",
  hovercard: "hover-card",
  inputotp: "input-otp",
  navigationmenu: "navigation-menu",
  radiogroup: "radio-group",
  scrollarea: "scroll-area",
  togglegroup: "toggle-group",
  datatable: "data-table",
  datepicker: "date-picker",
}

export function normalizeComponentName(raw: string): string {
  const trimmed = raw.trim().toLowerCase().replace(/^@\/components\/ui\//, "").replace(/\.tsx$/, "")
  return COMPONENT_ALIASES[trimmed] ?? trimmed
}

function fileBaseName(name: string): string {
  const parts = name.replace(/\\/g, "/").split("/")
  return parts[parts.length - 1] ?? name
}

/** Scan project source for imports of missing @/components/ui/* modules. */
export function scanMissingShadcnImports(
  files: Array<{ name: string; content: string }>,
): Array<{ file: string; line: number; message: string }> {
  const existing = new Set(
    files
      .filter((f) => f.name.replace(/\\/g, "/").includes("components/ui/"))
      .map((f) => fileBaseName(f.name).replace(/\.(tsx|ts)$/, "").toLowerCase()),
  )

  const errors: Array<{ file: string; line: number; message: string }> = []
  const importRe = /import\s+(?:type\s+)?(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]@\/components\/ui\/([^'"]+)['"]/g

  for (const file of files) {
    if (!/\.(tsx?|jsx?)$/.test(file.name)) continue
    const lines = file.content.split("\n")
    for (let i = 0; i < lines.length; i++) {
      importRe.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = importRe.exec(lines[i]))) {
        const component = normalizeComponentName(match[1])
        if (!existing.has(component)) {
          errors.push({
            file: file.name.replace(/\\/g, "/"),
            line: i + 1,
            message: `Cannot find module '@/components/ui/${component}' — call addShadcnComponent({ component: "${component}" }) before importing it`,
          })
        }
      }
    }
  }

  return errors
}
