const SAFE_FILENAME = /^[a-zA-Z0-9._\-\\/()[\]{}+,@!#$%^&=~]+$/
const NEXTJS_EXTENSIONS = /\.(tsx?|jsx?|css|json|md|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|eot|map)$/i
const MAX_PATH_LENGTH = 255

export function validatePath(name: string): string | null {
  if (!name || name.trim().length === 0) return "Empty file name"
  if (name.length > MAX_PATH_LENGTH) return `Path too long (${name.length} > ${MAX_PATH_LENGTH})`
  if (name.includes("..")) return "Directory traversal not allowed"
  if (name.startsWith("/") || name.startsWith("\\")) return "Absolute paths not allowed"
  if (name.includes("\0")) return "Null bytes not allowed"
  if (!SAFE_FILENAME.test(name)) return "Invalid characters in file name"
  if (/^\.env(\.|$)/i.test(name) || /\/\.env(\.|$)/i.test(name)) return "Env files must not be generated"
  if (/node_modules\//i.test(name)) return "node_modules paths not allowed"
  if (/\.git\//i.test(name)) return ".git paths not allowed"
  return null
}

export function isNextJsAppFile(name: string): boolean {
  return name.startsWith("app/") || name.startsWith("components/") || name.startsWith("lib/") || name.startsWith("public/")
}

export function hasValidExtension(name: string): boolean {
  return NEXTJS_EXTENSIONS.test(name) || !name.includes(".")
}

export function normalizePath(name: string): string {
  return name.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\.?\//, "")
}

export function validateAllPaths(names: string[]): Array<{ name: string; error: string }> {
  const errors: Array<{ name: string; error: string }> = []
  for (const name of names) {
    const normalized = normalizePath(name)
    const err = validatePath(normalized)
    if (err) errors.push({ name, error: err })
  }
  return errors
}
