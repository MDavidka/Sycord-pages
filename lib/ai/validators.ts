import type { GeneratedFile, ValidationError } from "@/lib/ai/types"
import { validatePath, normalizePath } from "@/lib/ai/path-safety"

const MANDATORY_FILES = [
  "package.json",
  "tsconfig.json",
  "app/globals.css",
  "app/layout.tsx",
  "app/page.tsx",
  "lib/utils.ts",
]

function checkJsonParse(name: string, content: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (name.endsWith(".json")) {
    try {
      JSON.parse(content)
    } catch (e: any) {
      errors.push({ file: name, type: "json-parse", message: e.message || "Invalid JSON", severity: "error" })
    }
  }
  return errors
}

function checkBraceBalance(name: string, content: string): ValidationError[] {
  const errors: ValidationError[] = []
  const ext = name.split(".").pop()?.toLowerCase() || ""
  if (ext === "css") {
    const opens = (content.match(/\{/g) || []).length
    const closes = (content.match(/\}/g) || []).length
    if (opens !== closes) {
      errors.push({ file: name, type: "css-braces", message: `${opens} open vs ${closes} close braces`, severity: "error" })
    }
  }
  if (["ts", "tsx", "js", "jsx"].includes(ext)) {
    const stripped = content
      .replace(/"((?:[^"\\]|\\.)*)"/g, "")
      .replace(/'((?:[^'\\]|\\.)*)'/g, "")
      .replace(/`((?:[^`\\]|\\.)*)`/g, "")
      .replace(/\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "")
    const pairs: Record<string, string> = { "{": "}", "(": ")", "[": "]" }
    const stack: string[] = []
    for (let i = 0; i < stripped.length; i++) {
      const ch = stripped[i]
      if (ch === "{" || ch === "(" || ch === "[") stack.push(ch)
      else if (ch === "}" || ch === ")" || ch === "]") {
        if (!stack.length) {
          errors.push({ file: name, type: "syntax", message: `Unexpected ${ch} at position ${i}`, severity: "error" })
          break
        }
        const last = stack.pop()!
        if (pairs[last] !== ch) {
          errors.push({ file: name, type: "syntax", message: `Mismatched ${last} with ${ch}`, severity: "error" })
          break
        }
      }
    }
    if (stack.length && errors.length === 0) {
      errors.push({ file: name, type: "syntax", message: `${stack.length} unclosed bracket(s)`, severity: "error" })
    }
  }
  return errors
}

function checkDefaultExport(name: string, content: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (name === "app/layout.tsx" || name === "app/page.tsx") {
    if (!/export\s+default\s/.test(content)) {
      errors.push({ file: name, type: "missing-export", message: `Missing default export in ${name}`, severity: "error" })
    }
  }
  return errors
}

function checkClientDirective(content: string, name: string): ValidationError[] {
  const errors: ValidationError[] = []
  const hasHooks = /\buseState\b|\buseEffect\b|\buseRef\b|\buseCallback\b|\buseMemo\b|\buseRouter\b/.test(content)
  const hasClientEvents = /\bonClick\b|\bonChange\b|\bonSubmit\b|\bonKeyDown\b|\bonMouse\b/.test(content)
  const hasBrowserApi = /\bwindow\b|\bdocument\b|\bnavigator\b|\blocalStorage\b|\bsessionStorage\b/.test(content)
  const hasUseClient = content.startsWith('"use client"')
  if ((hasHooks || hasClientEvents || hasBrowserApi) && !hasUseClient) {
    errors.push({ file: name, type: "missing-use-client", message: "Uses hooks/events/browser APIs but missing 'use client' directive", severity: "error" })
  }
  return errors
}

function checkImports(files: GeneratedFile[], content: string, fileName: string): ValidationError[] {
  const errors: ValidationError[] = []
  const fileNames = new Set(files.filter(f => f.action !== "delete").map(f => f.name))
  const importMatches = content.matchAll(/from\s+["'](@\/[^"']+)["']/g)
  for (const match of importMatches) {
    const importPath = match[1]
    if (importPath.startsWith("@/components/ui/")) {
      const compName = importPath.replace("@/components/ui/", "")
      const exists = fileNames.has(`components/ui/${compName}.tsx`)
      if (!exists) {
        errors.push({ file: fileName, type: "missing-ui-component", message: `UI component ${compName} not found in generated files`, severity: "warning" })
      }
    } else if (importPath.startsWith("@/")) {
      const localPath = importPath.replace("@/", "")
      const possiblePaths = [
        localPath,
        `${localPath}.ts`,
        `${localPath}.tsx`,
        `${localPath}/index.ts`,
        `${localPath}/index.tsx`,
      ]
      const found = possiblePaths.some(p => fileNames.has(p))
      if (!found) {
        errors.push({ file: fileName, type: "missing-import", message: `Import ${importPath} does not target an existing generated file`, severity: "warning" })
      }
    }
  }
  return errors
}

function checkMandatoryFiles(files: GeneratedFile[]): ValidationError[] {
  const errors: ValidationError[] = []
  const fileNames = new Set(files.filter(f => f.action !== "delete").map(f => f.name))
  for (const mandatory of MANDATORY_FILES) {
    if (!fileNames.has(mandatory)) {
      errors.push({ file: mandatory, type: "missing-mandatory", message: `Mandatory file ${mandatory} is missing`, severity: "error" })
    }
  }
  return errors
}

function checkMarkdownArtifacts(content: string, name: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (/^```/m.test(content) && content.split("\n").filter(l => l.startsWith("```")).length > 0) {
    const lines = content.split("\n")
    const fenceCount = lines.filter(l => /^\s*```\s*$/.test(l)).length
    if (fenceCount > 0) {
      errors.push({ file: name, type: "markdown-fence", message: "Contains markdown fence markers in code content", severity: "warning" })
    }
  }
  if (/^(Here is|This is|Below is|Following is|I have|I've|Let me)/im.test(content.trim())) {
    errors.push({ file: name, type: "prose-prefix", message: "Content starts with prose explanation", severity: "warning" })
  }
  return errors
}

function checkEnvSecrets(content: string, name: string): ValidationError[] {
  const errors: ValidationError[] = []
  if (/(MONGO_URI|DATABASE_URL|API_KEY|SECRET|PASSWORD|TOKEN)\s*[:=]\s*\S+/i.test(content)) {
    errors.push({ file: name, type: "secret-leak", message: "Potential secret or API key detected in generated content", severity: "error" })
  }
  return errors
}

export function validateFiles(files: GeneratedFile[], existingFiles: GeneratedFile[] = []): ValidationError[] {
  const errors: ValidationError[] = []
  const allFiles = [...existingFiles, ...files.filter(f => f.action !== "delete")]

  for (const file of files) {
    if (file.action === "delete") continue
    const normalizedName = normalizePath(file.name)
    const pathError = validatePath(normalizedName)
    if (pathError) {
      errors.push({ file: file.name, type: "path-safety", message: pathError, severity: "error" })
      continue
    }
    errors.push(...checkJsonParse(file.name, file.content))
    errors.push(...checkBraceBalance(file.name, file.content))
    errors.push(...checkDefaultExport(file.name, file.content))
    errors.push(...checkClientDirective(file.content, file.name))
    errors.push(...checkImports(allFiles, file.content, file.name))
    errors.push(...checkMarkdownArtifacts(file.content, file.name))
    errors.push(...checkEnvSecrets(file.content, file.name))
  }

  errors.push(...checkMandatoryFiles(allFiles))
  return errors
}
