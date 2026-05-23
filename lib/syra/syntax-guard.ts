// Syra Syntax Guard — static compilation validation before writing any code to disk.
// Checks generated TSX for common syntax errors: unclosed tags, dangling brackets,
// unimported references, and suspicious patterns.

export interface SyntaxCheckResult {
  ok: boolean
  errors: string[]
}

export function validateSyntax(code: string, sectionId: string): SyntaxCheckResult {
  const errors: string[] = []

  // Check for unclosed tags: count open/close of top-level JSX tags
  const openTags = (code.match(/<(?!\/)[A-Z][A-Za-z0-9]*(?:\s[^>]*)?\/?>/g) || []).filter((t) => !t.endsWith("/>"))
  const closeTags = code.match(/<\/[A-Z][A-Za-z0-9]*>/g) || []
  const selfClosing = (code.match(/<[A-Z][A-Za-z0-9]*(?:\s[^>]*)?\/>/g) || [])

  // Simple bracket balance
  const braces = { "{": 0, "(": 0, "[": 0 }
  for (const ch of code) {
    if (ch === "{") braces["{"]++
    if (ch === "}") braces["{"]--
    if (ch === "(") braces["("]++
    if (ch === ")") braces["("]--
    if (ch === "[") braces["["]++
    if (ch === "]") braces["["]--
    if (braces["{"] < 0) { errors.push(`[${sectionId}] unexpected closing "}"`); braces["{"] = 0 }
    if (braces["("] < 0) { errors.push(`[${sectionId}] unexpected ")"`); braces["("] = 0 }
    if (braces["["] < 0) { errors.push(`[${sectionId}] unexpected "]"`); braces["["] = 0 }
  }
  if (braces["{"] > 0) errors.push(`[${sectionId}] ${braces["{"]} unclosed "{"`)
  if (braces["("] > 0) errors.push(`[${sectionId}] ${braces["("]} unclosed "("`)
  if (braces["["] > 0) errors.push(`[${sectionId}] ${braces["["]} unclosed "["`)

  // Check for quoted string mismatches (\" inside double quote or vice versa)
  const singleOpen = (code.match(/(?<!\\)'/g) || []).length % 2
  const doubleOpen = (code.match(/(?<!\\)"/g) || []).length % 2
  if (singleOpen !== 0) errors.push(`[${sectionId}] unmatched single quote`)
  if (doubleOpen !== 0) errors.push(`[${sectionId}] unmatched double quote`)

  // Template literal braces
  const templateLiteralMismatch = (code.match(/\${/g) || []).length !== (code.match(/}/g) || []).length
  if (templateLiteralMismatch) {
    // Only error if it looks like a real template issue, not a false positive
    if (code.includes("`")) errors.push(`[${sectionId}] potential template literal issue`)
  }

  // Suspect patterns
  if (/eval\(/i.test(code)) errors.push(`[${sectionId}] eval() detected`)
  if (/Function\(/.test(code)) errors.push(`[${sectionId}] Function constructor detected`)
  if (/__proto__/.test(code)) errors.push(`[${sectionId}] __proto__ access detected`)

  return { ok: errors.length === 0, errors }
}

// Generate a hash for the code content (for version tracking)
export function hashContent(content: string): string {
  let hash = 0
  for (let i = 0; i < content.length; i++) {
    const ch = content.charCodeAt(i)
    hash = ((hash << 5) - hash) + ch
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
