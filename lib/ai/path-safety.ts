const FORBIDDEN_NAMES = new Set([
  ".env",
  ".env.local",
  ".env.development",
  ".env.production",
  ".env.test",
])

const INVALID_CHARS_RE = /[<>:"|?*\x00]/g

let _projectRoot: string | null = null

function getProjectRoot(): string {
  if (_projectRoot) return _projectRoot
  _projectRoot = process.cwd()
  return _projectRoot!
}

export interface PathValidationResult {
  valid: boolean
  reason?: string
  normalized?: string
}

export function validatePath(name: string): PathValidationResult {
  if (!name || typeof name !== "string") {
    return { valid: false, reason: "Path is empty or not a string" }
  }

  let decoded: string
  try {
    decoded = decodeURIComponent(name)
  } catch {
    return { valid: false, reason: "Path contains invalid URL-encoded characters" }
  }

  if (decoded.includes("..")) {
    return { valid: false, reason: "Directory traversal not allowed (..)" }
  }

  if (decoded.startsWith("/") || decoded.startsWith("\\")) {
    return { valid: false, reason: "Absolute paths not allowed" }
  }

  if (decoded.includes("\0")) {
    return { valid: false, reason: "Null bytes not allowed" }
  }

  if (INVALID_CHARS_RE.test(decoded)) {
    return { valid: false, reason: "Path contains invalid filename characters" }
  }

  if (decoded.length > 255) {
    return { valid: false, reason: "Path exceeds 255 characters" }
  }

  if (decoded.length === 0) {
    return { valid: false, reason: "Path is empty after decoding" }
  }

  const parts = decoded.split("/")
  for (const part of parts) {
    if (part === "." || part === ".." || part.length === 0) {
      return { valid: false, reason: `Invalid path segment: "${part}"` }
    }
    if (part.length > 100) {
      return { valid: false, reason: `Filename too long: "${part}"` }
    }
  }

  const clean = decoded.replace(/\\/g, "/").replace(/\/{2,}/g, "/")
  const normalized = clean.endsWith("/") ? clean.slice(0, -1) : clean

  return { valid: true, normalized }
}

export function isEnvFile(name: string): boolean {
  const basename = name.split("/").pop() ?? name
  return FORBIDDEN_NAMES.has(basename) || basename.startsWith(".env")
}

export function isUnsafePath(name: string): boolean {
  const result = validatePath(name)
  if (!result.valid) return true
  return isEnvFile(name)
}

export function normalizePath(name: string): string {
  const result = validatePath(name)
  return result.normalized ?? name.replace(/\\/g, "/").replace(/\/{2,}/g, "/")
}

export function isAllowedFileType(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase()
  const allowed = new Set([
    "ts", "tsx", "js", "jsx", "css", "json",
    "md", "mdx", "svg", "txt", "csv",
  ])
  return allowed.has(ext ?? "")
}

export function pathInDirectory(path: string, dir: string): boolean {
  const normalized = path.replace(/\\/g, "/")
  return normalized.startsWith(dir + "/") || normalized === dir
}

export const SAFE_PATTERNS = {
  allowedExtensions: ["ts", "tsx", "js", "jsx", "css", "json", "svg", "md", "mdx"],
  mandatoryFiles: [
    "package.json",
    "tsconfig.json",
    "app/globals.css",
    "app/layout.tsx",
    "app/page.tsx",
    "lib/utils.ts",
  ],
}
