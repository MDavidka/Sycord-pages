import { extractJson } from "@/lib/ai-provider"
import type { SyraOutput, GeneratedFile } from "@/lib/ai/types"
import { SyraOutputSchema } from "@/lib/ai/types"

export function parseSyraJson(content: string): SyraOutput | null {
  const parsed = extractJson<unknown>(content)
  if (!parsed) return null
  try {
    return SyraOutputSchema.parse(parsed)
  } catch {
    return null
  }
}

function stripFences(code: string): string {
  return code.replace(/^```[a-zA-Z0-9]*\s*\n?([\s\S]*?)\n?```$/gm, "$1").trim()
}

function stripProse(code: string): string {
  const lines = code.split("\n")
  const codeStart = lines.findIndex(line => {
    const t = line.trim()
    if (!t) return false
    if (/^(import|export|const|let|var|function|class|interface|type|enum|return|"use client|"use strict)/i.test(t)) return true
    if (/^[{}();=<>\[\]&|]/.test(t)) return true
    if (/^@(tailwind|layer|apply)/.test(t)) return true
    if (/^<(\w+)/.test(t)) return true
    return false
  })
  if (codeStart > 0) return lines.slice(codeStart).join("\n")
  return code
}

export function parseLegacyFileBlocks(content: string): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const blocks = content.split(/^###\s*FILE:\s*/gm)
  for (const block of blocks) {
    const trimmed = block.trim()
    if (!trimmed) continue
    const nl = trimmed.indexOf("\n")
    if (nl < 0) continue
    const name = trimmed.slice(0, nl).trim()
    let body = trimmed.slice(nl + 1).trim()
    if (body === "DELETE") {
      files.push({ name, content: "", usedFor: "deleted", action: "delete" })
    } else if (body.startsWith("MOVE_TO:")) {
      const target = body.slice(8).trim()
      files.push({ name, content: target, usedFor: "moved", action: "move" })
    } else {
      body = stripFences(body)
      body = stripProse(body)
      if (name && body) {
        files.push({ name, content: body, usedFor: "", action: "upsert" })
      }
    }
  }
  return files
}

export function parseSyraOutput(content: string): { files: GeneratedFile[]; deleteFiles: string[]; moveFiles: Array<{ from: string; to: string }>; notes: string[] } {
  const jsonResult = parseSyraJson(content)
  if (jsonResult) {
    const files: GeneratedFile[] = jsonResult.files.map(f => ({
      name: f.name,
      content: f.content,
      usedFor: f.usedFor,
      action: f.action,
    }))
    return {
      files,
      deleteFiles: jsonResult.delete,
      moveFiles: jsonResult.move,
      notes: jsonResult.notes,
    }
  }
  const legacyFiles = parseLegacyFileBlocks(content)
  return {
    files: legacyFiles,
    deleteFiles: [],
    moveFiles: [],
    notes: [],
  }
}
