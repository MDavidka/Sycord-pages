/**
 * Lightweight post-generation linter for the Sycord Design Contract.
 * Results are injected into Syra's project context each turn.
 */

export type DesignContractIssue = {
  file: string
  line: number
  rule: string
  message: string
}

const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{200D}]/u

export function scanDesignContractViolations(
  files: Array<{ name: string; content: string }>,
): DesignContractIssue[] {
  const issues: DesignContractIssue[] = []

  for (const file of files) {
    const norm = file.name.replace(/\\/g, "/")
    if (!/\.(tsx?|jsx?|css)$/.test(norm)) continue
    const lines = file.content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNo = i + 1

      if (/--font-geist-sans|--font-geist-mono/.test(line)) {
        issues.push({
          file: norm,
          line: lineNo,
          rule: "fonts",
          message: "Use --font-sans (Inter), not Geist variable names",
        })
      }

      if (EMOJI_RE.test(line) && /\.(tsx|jsx)$/.test(norm)) {
        issues.push({
          file: norm,
          line: lineNo,
          rule: "icons",
          message: "No emoji as icons — use lucide-react",
        })
      }

      if (/rounded-full.*bg-(primary|blue|green|orange|rose|violet|red|emerald)/.test(line.replace(/\s+/g, " "))) {
        if (/lucide|Icon|from ['"]lucide-react['"]/.test(lines.slice(Math.max(0, i - 2), i + 3).join("\n"))) {
          issues.push({
            file: norm,
            line: lineNo,
            rule: "icons",
            message: "Icon in colored circle — use plain Lucide icon at h-4/h-5/h-6 without filled background",
          })
        }
      }

      if (/from ['"]@\/registry\//.test(line)) {
        issues.push({
          file: norm,
          line: lineNo,
          rule: "imports",
          message: "Invalid registry import — use @/components/ui/*",
        })
      }

      if (/<button[^>]*className=/.test(line) && !/from ['"]@\/components\/ui\/button['"]/.test(file.content)) {
        issues.push({
          file: norm,
          line: lineNo,
          rule: "components",
          message: "Raw <button> — use shadcn Button from @/components/ui/button",
        })
      }
    }

    if (norm.endsWith("app/layout.tsx") || norm.endsWith("app/page.tsx")) {
      if (!/ThemeProvider|ModeToggle|theme-toggle|dark.*toggle/i.test(file.content)) {
        issues.push({
          file: norm,
          line: 1,
          rule: "dark-mode",
          message: "Landing/app layout should include a functional dark mode toggle",
        })
      }
    }

    if (norm.endsWith("app/page.tsx") && !/radial-gradient|gradient/.test(file.content)) {
      issues.push({
        file: norm,
        line: 1,
        rule: "hero-gradient",
        message: "Landing page missing hero gradient transition below hero section",
      })
    }

    if (norm.endsWith("app/globals.css")) {
      if (!/--font-sans/.test(file.content) && /font-family/.test(file.content)) {
        issues.push({
          file: norm,
          line: 1,
          rule: "fonts",
          message: "globals.css should define --font-sans and apply it to body",
        })
      }
    }
  }

  return issues
}
