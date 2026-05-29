import type { ParsedFileChangeSet, Diagnostic } from "./types"
import { validatePath, isUnsafePath, normalizePath } from "./path-safety"

function stripMarkdownFences(content: string): string {
  let out = content.trim()
  out = out.replace(/^```[a-zA-Z0-9]*\s*\n?/gm, "")
  out = out.replace(/\n?```\s*$/gm, "")
  return out.trim()
}

function stripProseArtifacts(code: string): string {
  let out = code
  out = out.replace(/\[\s*\/?\s*(?:code|CODE|file|FILE|usedfor|usedFor|USEDFOR|component|COMPONENT|page|PAGE|name|NAME)\s*\]/gi, "")
  out = out.replace(/^###\s*FILE:.*$/gm, "")
  out = out.replace(/^(?:Here is|This is|Below is|Following is|This will|I have|I've|I will|The code|The file)\s.{0,200}$/gm, "")
  out = out.replace(/^[a-zA-Z0-9_\/-]+\.(?:tsx?|jsx?|css|json)[\s]+[A-Z][a-z].*$/gm, "")
  out = out.replace(/^[a-zA-Z0-9_\/-]+\.(?:tsx?|jsx?|css|json)\s*$/gm, "")
  return out.trim()
}

function tryJsonParse(content: string): unknown | null {
  try {
    return JSON.parse(content.trim())
  } catch {
    // try fixing trailing commas
    const fixed = content.trim().replace(/,(\s*[}\]])/g, "$1")
    try {
      return JSON.parse(fixed)
    } catch {
      return null
    }
  }
}

function extractJsonFromFence(content: string): unknown | null {
  const fenceMatch = content.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/i)
  if (fenceMatch?.[1]) {
    const extracted = fenceMatch[1].trim()
    const parsed = tryJsonParse(extracted)
    if (parsed) return parsed
    if (extracted.startsWith("[")) {
      try { return JSON.parse(extracted + "]") } catch {}
    }
  }
  return null
}

function extractOutermostJson(content: string): unknown | null {
  const trimmed = content.trim()
  const firstArray = trimmed.indexOf("[")
  const firstObject = trimmed.indexOf("{")
  const startChar = firstArray >= 0 && (firstArray < firstObject || firstObject < 0) ? "[" : "{"
  if (startChar === "[" && firstArray < 0) return null
  if (startChar === "{" && firstObject < 0) return null

  const startIdx = startChar === "[" ? firstArray : firstObject
  const closeChar = startChar === "[" ? "]" : "}"
  let depth = 0
  let inString = false
  let escaped = false

  for (let i = startIdx; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (escaped) { escaped = false; continue }
    if (ch === "\\" && inString) { escaped = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === startChar) depth++
    else if (ch === closeChar) {
      depth--
      if (depth === 0) {
        const jsonStr = trimmed.slice(startIdx, i + 1)
        const parsed = tryJsonParse(jsonStr)
        if (parsed) return parsed
        break
      }
    }
  }

  return null
}

interface RawFileObject {
  name?: string
  action?: string
  usedFor?: string
  content?: string
  code?: string
  target?: string
}

interface RawCodeOutput {
  files?: RawFileObject[]
  delete?: string[]
  move?: Array<{ from: string; to: string }>
  notes?: string[]
}

export function parseCodeOutput(content: string): { result: ParsedFileChangeSet | null; warnings: string[] } {
  const warnings: string[] = []

  if (!content || content.length < 3) {
    warnings.push("Empty response from model")
    return { result: null, warnings }
  }

  const trimmed = content.trim()

  let parsed: RawCodeOutput | null = null

  // Try strict JSON parse
  const strictParsed = tryJsonParse(trimmed)
  if (strictParsed && typeof strictParsed === "object" && (strictParsed as RawCodeOutput).files) {
    parsed = strictParsed as RawCodeOutput
  }

  // Try extracting from code fence
  if (!parsed) {
    const fencedParsed = extractJsonFromFence(trimmed)
    if (fencedParsed && typeof fencedParsed === "object" && (fencedParsed as RawCodeOutput).files) {
      parsed = fencedParsed as RawCodeOutput
      warnings.push("Model returned markdown fences; stripped before validation.")
    }
  }

  // Try outermost JSON
  if (!parsed) {
    const outermostParsed = extractOutermostJson(trimmed)
    if (outermostParsed && typeof outermostParsed === "object" && (outermostParsed as RawCodeOutput).files) {
      parsed = outermostParsed as RawCodeOutput
      warnings.push("Model returned prose around JSON; extracted outer JSON block.")
    }
  }

  // Try legacy ### FILE: blocks
  if (!parsed) {
    const legacyResult = parseLegacyFileBlocks(trimmed)
    if (legacyResult) {
      return { result: legacyResult, warnings: [...warnings, "Used legacy ### FILE: block parsing."] }
    }
  }

  if (!parsed || !parsed.files || !Array.isArray(parsed.files)) {
    return { result: null, warnings: [...warnings, "Could not parse model output into file changes."] }
  }

  const upserts: Array<{ name: string; content: string; usedFor: string }> = []
  const deletes: string[] = []
  const moves: Array<{ from: string; to: string }> = []

  for (const file of parsed.files) {
    if (!file.name) continue

    const validation = validatePath(file.name)
    if (!validation.valid || !validation.normalized) {
      warnings.push(`Invalid path skipped: ${file.name} (${validation.reason})`)
      continue
    }

    if (isUnsafePath(validation.normalized)) {
      warnings.push(`Unsafe path skipped: ${validation.normalized}`)
      continue
    }

    const action = file.action?.toLowerCase()

    if (action === "delete") {
      deletes.push(validation.normalized)
      continue
    }

    const fileContent = file.content ?? file.code ?? ""

    if (!fileContent || fileContent.length < 3) {
      warnings.push(`Empty content for ${validation.normalized}, skipped.`)
      continue
    }

    const normalized = normalizePath(validation.normalized)

    const cleanContent = stripProseArtifacts(stripMarkdownFences(fileContent))

    if (cleanContent && cleanContent.length >= 3) {
      upserts.push({
        name: normalized,
        content: cleanContent,
        usedFor: file.usedFor ?? "",
      })
    } else {
      warnings.push(`Content too short after cleaning for ${normalized}, skipped.`)
    }
  }

  // Add explicit deletes from parsed.delete
  if (parsed.delete && Array.isArray(parsed.delete)) {
    for (const d of parsed.delete) {
      if (typeof d === "string") {
        const validation = validatePath(d)
        if (validation.valid && !isUnsafePath(d)) {
          deletes.push(normalizePath(d))
        }
      }
    }
  }

  // Add explicit moves from parsed.move
  if (parsed.move && Array.isArray(parsed.move)) {
    for (const m of parsed.move) {
      if (m.from && m.to) {
        const fromValid = validatePath(m.from)
        const toValid = validatePath(m.to)
        if (fromValid.valid && toValid.valid && !isUnsafePath(m.from) && !isUnsafePath(m.to)) {
          moves.push({ from: normalizePath(m.from), to: normalizePath(m.to) })
        }
      }
    }
  }

  return {
    result: { upserts, deletes, moves, parserWarnings: warnings },
    warnings,
  }
}

function parseLegacyFileBlocks(content: string): ParsedFileChangeSet | null {
  const blocks = content.split(/^###\s*FILE:\s*/gm)
  const upserts: Array<{ name: string; content: string; usedFor: string }> = []
  const deletes: string[] = []
  const moves: Array<{ from: string; to: string }> = []

  for (const block of blocks) {
    const t = block.trim()
    if (!t) continue

    const nl = t.indexOf("\n")
    const name = (nl > 0 ? t.slice(0, nl) : t).trim()
    const body = nl > 0 ? t.slice(nl + 1).trim() : ""

    if (!name) continue

    const validation = validatePath(name)
    if (!validation.valid || !validation.normalized) continue
    if (isUnsafePath(validation.normalized)) continue

    const normalized = normalizePath(validation.normalized)

    if (body === "DELETE") {
      deletes.push(normalized)
    } else if (body.startsWith("MOVE_TO:")) {
      const target = body.slice(8).trim()
      if (target && validatePath(target).valid) {
        moves.push({ from: normalized, to: normalizePath(target) })
      }
    } else if (body) {
      const clean = stripProseArtifacts(stripMarkdownFences(body))
      if (clean && clean.length >= 3) {
        upserts.push({ name: normalized, content: clean, usedFor: "" })
      }
    }
  }

  if (upserts.length === 0 && deletes.length === 0 && moves.length === 0) {
    return null
  }

  return { upserts, deletes, moves, parserWarnings: [] }
}

export function parsePlanOutput(
  content: string,
): { plan: unknown | null; warnings: string[] } {
  const warnings: string[] = []
  if (!content) return { plan: null, warnings: ["Empty plan response"] }

  const strictParsed = tryJsonParse(content.trim())
  if (strictParsed && typeof strictParsed === "object") {
    return { plan: strictParsed, warnings }
  }

  const fencedParsed = extractJsonFromFence(content.trim())
  if (fencedParsed && typeof fencedParsed === "object") {
    warnings.push("Plan was returned inside markdown fences; extracted.")
    return { plan: fencedParsed, warnings }
  }

  const outermostParsed = extractOutermostJson(content.trim())
  if (outermostParsed && typeof outermostParsed === "object") {
    warnings.push("Plan was returned with prose around JSON; extracted.")
    return { plan: outermostParsed, warnings }
  }

  return { plan: null, warnings: ["Could not parse plan JSON"] }
}

export function parseRepairOutput(
  content: string,
): { result: ParsedFileChangeSet | null; fixedDiagnostics: unknown[]; warnings: string[] } {
  const warnings: string[] = []
  const fixedDiagnostics: unknown[] = []

  if (!content) return { result: null, fixedDiagnostics, warnings: ["Empty repair response"] }

  let parsed: { files?: unknown; delete?: unknown; move?: unknown; fixedDiagnostics?: unknown; notes?: unknown } | null = null

  const strictParsed = tryJsonParse(content.trim())
  if (strictParsed && typeof strictParsed === "object") {
    parsed = strictParsed as Record<string, unknown>
  } else {
    const fencedParsed = extractJsonFromFence(content.trim())
    if (fencedParsed && typeof fencedParsed === "object") {
      parsed = fencedParsed as Record<string, unknown>
      warnings.push("Repair output in markdown fences; extracted.")
    }
  }

  if (!parsed) {
    return { result: null, fixedDiagnostics, warnings: [...warnings, "Could not parse repair output"] }
  }

  if (Array.isArray(parsed.fixedDiagnostics)) {
    fixedDiagnostics.push(...parsed.fixedDiagnostics)
  }

  if (parsed.files && Array.isArray(parsed.files)) {
    const codeResult = parseCodeOutput(JSON.stringify(parsed))
    return {
      result: codeResult.result,
      fixedDiagnostics,
      warnings: [...warnings, ...codeResult.warnings],
    }
  }

  return { result: null, fixedDiagnostics, warnings: [...warnings, "Repair output missing file changes"] }
}
