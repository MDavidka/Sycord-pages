// ── Step 12: Build Validation ───────────────────────────────────────
// Static analysis of generated files. No actual build run in-browser.
// Checks imports, component references, and common issues.

import type { GeneratedProject, BuildResult, BuildIssue } from "./types"

const KNOWN_IMPORTS: Record<string, string[]> = {
  "@/components/ui/button": ["Button", "buttonVariants"],
  "@/components/ui/card": ["Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"],
  "@/components/ui/badge": ["Badge", "badgeVariants"],
  "@/components/ui/input": ["Input"],
  "@/components/ui/textarea": ["Textarea"],
  "@/components/ui/separator": ["Separator"],
  "@/components/ui/accordion": ["Accordion", "AccordionItem", "AccordionTrigger", "AccordionContent"],
  "@/components/ui/tabs": ["Tabs", "TabsList", "TabsTrigger", "TabsContent"],
  "@/components/motion/fade-in": ["FadeIn"],
  "@/components/motion/stagger": ["Stagger", "StaggerItem"],
  "@/components/motion/motion-card": ["MotionCard"],
  "@/lib/utils": ["cn"],
  "next/link": ["Link"],
  "next/image": ["Image"],
  "lucide-react": [],
}

export function runBuildValidation(project: GeneratedProject): BuildResult {
  const issues: BuildIssue[] = []
  const logs: string[] = []
  const allPaths = new Set(project.files.map(f => f.path))

  for (const file of project.files) {
    if (!file.path.endsWith(".ts") && !file.path.endsWith(".tsx")) continue

    const lines = file.content.split("\n")

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lineNum = i + 1

      // Check for broken imports
      const importMatch = line.match(/from\s+["']([^"']+)["']/)
      if (importMatch) {
        const importPath = importMatch[1]

        // Check relative imports resolve
        if (importPath.startsWith("@/")) {
          const resolved = importPath.replace("@/", "")
          const candidates = [
            `${resolved}.ts`,
            `${resolved}.tsx`,
            `${resolved}/index.ts`,
            `${resolved}/index.tsx`,
          ]
          const exists = candidates.some(c => allPaths.has(c))
          if (!exists && !KNOWN_IMPORTS[importPath]) {
            issues.push({
              file: file.path,
              line: lineNum,
              message: `Unresolved import: ${importPath}`,
              category: "missing-import",
            })
          }
        }
      }

      // Check for "use client" placement
      if (line.includes('"use client"') && lineNum > 1 && lines[0].trim() !== '"use client"') {
        issues.push({
          file: file.path,
          line: lineNum,
          message: '"use client" must be at the top of the file',
          category: "nextjs",
        })
      }
    }

    // Check that "use client" is present when framer-motion is imported
    if (file.content.includes("framer-motion") && !file.content.includes('"use client"')) {
      issues.push({
        file: file.path,
        message: 'framer-motion requires "use client" directive',
        category: "nextjs",
      })
    }

    // Check that motion wrappers have "use client"
    if (
      (file.content.includes("<FadeIn") || file.content.includes("<Stagger") || file.content.includes("<MotionCard")) &&
      !file.content.includes('"use client"')
    ) {
      issues.push({
        file: file.path,
        message: 'Motion wrapper usage requires "use client" directive',
        category: "nextjs",
      })
    }
  }

  logs.push(`Validated ${project.files.length} files`)
  logs.push(`Found ${issues.length} issue(s)`)

  return {
    ok: issues.length === 0,
    logs,
    issues,
  }
}
