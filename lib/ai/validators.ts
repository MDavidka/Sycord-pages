import { existsSync, readFileSync } from "fs"
import { join } from "path"
import type { Diagnostic, GeneratedFile } from "./types"
import { validatePath, isUnsafePath } from "./path-safety"

export function validateAllFiles(files: GeneratedFile[], existingFiles: GeneratedFile[] = []): Diagnostic[] {
  const diagnostics: Diagnostic[] = []

  for (const file of files) {
    // Path safety
    const pathResult = validatePath(file.name)
    if (!pathResult.valid) {
      diagnostics.push({
        file: file.name,
        severity: "error",
        code: "PATH_INVALID",
        message: pathResult.reason ?? "Invalid path",
      })
      continue
    }

    if (isUnsafePath(file.name)) {
      diagnostics.push({
        file: file.name,
        severity: "error",
        code: "PATH_UNSAFE",
        message: ".env files and secrets cannot be saved",
      })
      continue
    }

    // Content validation by file type
    const ext = file.name.split(".").pop()?.toLowerCase() ?? ""

    if (ext === "json") {
      try {
        JSON.parse(file.content)
      } catch (e: any) {
        const msg = e.message || ""
        diagnostics.push({
          file: file.name,
          severity: "error",
          code: "JSON_PARSE",
          message: `Invalid JSON: ${msg.slice(0, 100)}`,
        })
      }
    }

    if (ext === "css") {
      const opens = (file.content.match(/\{/g) || []).length
      const closes = (file.content.match(/\}/g) || []).length
      if (opens !== closes) {
        diagnostics.push({
          file: file.name,
          severity: "error",
          code: "CSS_BRACE_MISMATCH",
          message: `CSS: ${opens} open vs ${closes} close braces`,
        })
      }
      // Check for markdown in CSS
      if (file.content.includes("```")) {
        diagnostics.push({
          file: file.name,
          severity: "warning",
          code: "CSS_MARKDOWN",
          message: "CSS contains markdown fences",
        })
      }
    }

    if (ext === "ts" || ext === "tsx" || ext === "js" || ext === "jsx") {
      // Check for markdown fences
      if (file.content.includes("```")) {
        diagnostics.push({
          file: file.name,
          severity: "error",
          code: "MARKDOWN_FENCE",
          message: "Code contains markdown fences — must be raw source code",
        })
      }

      // Check for bracket artifact tags
      if (file.content.match(/\[(?:code|CODE|file|FILE|usedfor|usedFor|component|COMPONENT)\]/)) {
        diagnostics.push({
          file: file.name,
          severity: "warning",
          code: "ARTIFACT_TAGS",
          message: "Code contains [code]/[file]/[usedFor] artifact tags — clean before saving",
        })
      }

      // Check prose artifacts
      if (file.content.match(/^(Here is|This is|Below is|I have|I've)/m)) {
        diagnostics.push({
          file: file.name,
          severity: "warning",
          code: "PROSE_ARTIFACT",
          message: "Code starts with prose-like sentence, may need cleaning",
        })
      }

      // Check balanced brackets
      const bracketDiag = checkBracketBalance(file)
      if (bracketDiag) diagnostics.push(bracketDiag)

      // Check for "use client" requirement
      const needsUseClient = file.content.includes("useState(") ||
        file.content.includes("useEffect(") ||
        file.content.includes("useRef(") ||
        file.content.includes("onClick") ||
        file.content.includes("window.") ||
        file.content.includes("document.") ||
        file.content.includes("addEventListener") ||
        file.content.includes("localStorage")

      if (needsUseClient && !file.content.startsWith('"use client"') && !file.content.startsWith("'use client'")) {
        diagnostics.push({
          file: file.name,
          severity: "warning",
          code: "NEEDS_USE_CLIENT",
          message: "File uses hooks/browser APIs but is missing 'use client' directive",
        })
      }

      // Check server components using browser APIs
      if (file.content.startsWith('"use server"') || file.content.startsWith("'use server'")) {
        if (file.content.includes("window.") || file.content.includes("document.")) {
          diagnostics.push({
            file: file.name,
            severity: "error",
            code: "SERVER_COMPONENT_BROWSER",
            message: "Server component uses browser APIs (window/document)",
          })
        }
      }
    }

    // Check for SEO metadata on layout
    if (file.name === "app/layout.tsx" && !file.content.includes("metadata")) {
      diagnostics.push({
        file: file.name,
        severity: "warning",
        code: "MISSING_METADATA",
        message: "Root layout should export metadata for SEO",
      })
    }

    // Check default export on pages
    if (file.name === "app/page.tsx" && !file.content.includes("export default")) {
      diagnostics.push({
        file: file.name,
        severity: "error",
        code: "MISSING_DEFAULT_EXPORT",
        message: "Page component must have a default export",
      })
    }
  }

  // Check mandatory files for new projects
  const fileNames = new Set(files.map((f) => f.name))
  const mandatoryFiles = ["package.json", "tsconfig.json", "app/globals.css", "app/layout.tsx", "app/page.tsx", "lib/utils.ts"]

  for (const mandatory of mandatoryFiles) {
    if (!fileNames.has(mandatory)) {
      if (files.length >= 5) {
        diagnostics.push({
          file: mandatory,
          severity: "warning",
          code: "MISSING_MANDATORY",
          message: `Mandatory file "${mandatory}" is missing from generated output`,
        })
      }
    }
  }

  // Validate imports
  const allFileNames = new Set(files.map((f) => f.name))
  allFileNames.add("lib/utils") // Common import

  for (const file of files) {
    if (file.name.endsWith(".tsx") || file.name.endsWith(".ts") || file.name.endsWith(".jsx") || file.name.endsWith(".js")) {
      const localImports = [...file.content.matchAll(/from\s+["'](\.\/[^"']+|\.\.\/[^"']+|@\/[^"']+)["']/g)]
      for (const match of localImports) {
        let importPath = match[1]

        if (importPath.startsWith("@/")) {
          importPath = importPath.slice(2)
        } else if (importPath.startsWith("./") || importPath.startsWith("../")) {
          const dir = file.name.split("/").slice(0, -1).join("/")
          const resolved = join(dir, importPath).replace(/\\/g, "/")
          importPath = resolved.replace(/\/\//g, "/")
        }

        // Skip style imports and type imports in checks
        if (importPath.endsWith(".css")) continue

        const possiblePaths = [
          importPath,
          importPath + ".ts",
          importPath + ".tsx",
          importPath + ".js",
          importPath + ".jsx",
          importPath + "/index.ts",
          importPath + "/index.tsx",
        ]

        const resolved = possiblePaths.some((p) => allFileNames.has(p))

        if (!resolved) {
          const existingFile = existingFiles.find((f) =>
            possiblePaths.some((p) => f.name === p)
          )
          if (!existingFile) {
            diagnostics.push({
              file: file.name,
              severity: "warning",
              code: "IMPORT_NOT_FOUND",
              message: `Import "${match[1]}" does not resolve to any known file`,
              suggestedFix: `Create the file or correct the import path`,
            })
          }
        }
      }
    }
  }

  return diagnostics
}

function checkBracketBalance(file: GeneratedFile): Diagnostic | null {
  const code = file.content
    .replace(/"(?:[^"\\]|\\.)*"/g, "")
    .replace(/'(?:[^'\\]|\\.)*'/g, "")
    .replace(/`(?:[^`\\]|\\.)*`/g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")

  const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" }
  const stack: string[] = []
  const lines = code.split("\n")

  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    for (let col = 0; col < lines[lineNum].length; col++) {
      const ch = lines[lineNum][col]
      if (ch === "{" || ch === "(" || ch === "[") {
        stack.push(ch)
      } else if (ch === "}" || ch === ")" || ch === "]") {
        if (!stack.length) {
          return {
            file: file.name,
            severity: "error",
            code: "BRACKET_BALANCE",
            message: `Unexpected ${ch} at line ${lineNum + 1}, column ${col + 1}`,
            line: lineNum + 1,
            column: col + 1,
          }
        }
        const last = stack.pop()!
        if (pairs[last] !== ch) {
          return {
            file: file.name,
            severity: "error",
            code: "BRACKET_MISMATCH",
            message: `Mismatched ${last} with ${ch} at line ${lineNum + 1}, column ${col + 1}`,
            line: lineNum + 1,
            column: col + 1,
          }
        }
      }
    }
  }

  if (stack.length > 0) {
    const unmatched = stack.map((c) => pairs[c])
    return {
      file: file.name,
      severity: "error",
      code: "BRACKET_UNCLOSED",
      message: `Missing ${unmatched.join(", ")} (${stack.length} unclosed)`,
    }
  }

  return null
}

export function validatePackageJson(content: string): { valid: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []

  try {
    const pkg = JSON.parse(content)

    const required = ["next", "react", "react-dom"]
    const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }

    for (const dep of required) {
      if (!deps[dep]) {
        diagnostics.push({
          file: "package.json",
          severity: "warning",
          code: "MISSING_CORE_DEP",
          message: `Missing required dependency: ${dep}`,
        })
      }
    }

    if (!pkg.scripts?.dev || !pkg.scripts?.build) {
      diagnostics.push({
        file: "package.json",
        severity: "warning",
        code: "MISSING_SCRIPTS",
        message: "Missing dev and/or build scripts",
      })
    }
  } catch (e: any) {
    diagnostics.push({
      file: "package.json",
      severity: "error",
      code: "PKG_JSON_PARSE",
      message: `package.json is not valid JSON: ${e.message?.slice(0, 80)}`,
    })
  }

  return { valid: diagnostics.every((d) => d.severity !== "error"), diagnostics }
}

export function validateTsconfig(content: string): { valid: boolean; diagnostics: Diagnostic[] } {
  const diagnostics: Diagnostic[] = []

  try {
    const tsconfig = JSON.parse(content)

    if (!tsconfig.compilerOptions) {
      diagnostics.push({
        file: "tsconfig.json",
        severity: "warning",
        code: "MISSING_COMPILER_OPTIONS",
        message: "tsconfig.json is missing compilerOptions",
      })
    }

    if (tsconfig.compilerOptions && !tsconfig.compilerOptions.jsx) {
      diagnostics.push({
        file: "tsconfig.json",
        severity: "warning",
        code: "MISSING_JSX",
        message: "tsconfig.json should specify jsx compiler option",
      })
    }
  } catch {
    diagnostics.push({
      file: "tsconfig.json",
      severity: "error",
      code: "TSCONFIG_PARSE",
      message: "tsconfig.json is not valid JSON",
    })
  }

  return { valid: diagnostics.every((d) => d.severity !== "error"), diagnostics }
}

export function hasValidationErrors(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "error")
}

export function hasValidationWarnings(diagnostics: Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === "warning")
}
