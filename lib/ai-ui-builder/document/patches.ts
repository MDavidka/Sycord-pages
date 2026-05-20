import { z } from "zod"
import type { BuilderDocument } from "./types"

export type BuilderPatch =
  | { op: "add"; path: string; value: unknown }
  | { op: "replace"; path: string; value: unknown }
  | { op: "remove"; path: string }

export const builderPatchSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("add"), path: z.string(), value: z.unknown() }).strict(),
  z.object({ op: z.literal("replace"), path: z.string(), value: z.unknown() }).strict(),
  z.object({ op: z.literal("remove"), path: z.string() }).strict(),
])

export interface PatchResult {
  ok: boolean
  document: BuilderDocument
  error?: string
}

function cloneDocument(doc: BuilderDocument): BuilderDocument {
  if (typeof structuredClone === "function") {
    return structuredClone(doc)
  }
  const serialized = JSON.stringify(doc)
  if (!serialized) {
    throw new Error("BuilderDocument must be JSON-serializable")
  }
  return JSON.parse(serialized) as BuilderDocument
}

function decodePointer(segment: string): string {
  return segment.replace(/~1/g, "/").replace(/~0/g, "~")
}

function parsePointer(path: string): string[] {
  if (path === "" || path === "/") return []
  if (!path.startsWith("/")) throw new Error(`Invalid JSON pointer: ${path}`)
  return path
    .slice(1)
    .split("/")
    .map((segment) => decodePointer(segment))
}

function applyOperation(target: unknown, path: string[], patch: BuilderPatch): unknown {
  if (path.length === 0) {
    if (patch.op === "remove") return null
    return patch.value
  }
  const fullPath = `/${path.join("/")}`
  const last = path[path.length - 1]
  const parentPath = path.slice(0, -1)
  let parent: unknown = target
  for (const segment of parentPath) {
    if (parent == null || typeof parent !== "object") {
      throw new Error(`Invalid path segment "${segment}" in ${fullPath}`)
    }
    parent = (parent as Record<string, unknown>)[segment]
  }
  if (Array.isArray(parent)) {
    if (last === "-") {
      if (patch.op === "add") {
        parent.push(patch.value)
        return target
      }
      throw new Error("Cannot replace/remove '-' array index")
    }
    const index = Number.parseInt(last, 10)
    if (!Number.isFinite(index)) throw new Error(`Invalid array index "${last}" in ${fullPath}`)
    if (patch.op === "add") {
      parent.splice(index, 0, patch.value)
    } else if (patch.op === "replace") {
      parent[index] = patch.value
    } else if (patch.op === "remove") {
      parent.splice(index, 1)
    }
    return target
  }
  if (parent && typeof parent === "object") {
    const record = parent as Record<string, unknown>
    if (patch.op === "remove") {
      delete record[last]
    } else {
      record[last] = patch.value
    }
    return target
  }
  throw new Error(`Cannot apply patch at ${path.join("/")}`)
}

export function applyBuilderPatch(document: BuilderDocument, patch: BuilderPatch): PatchResult {
  const validation = builderPatchSchema.safeParse(patch)
  if (!validation.success) {
    return { ok: false, document, error: validation.error.message }
  }
  try {
    const clone = cloneDocument(document)
    const pointer = parsePointer(patch.path)
    const updated = applyOperation(clone, pointer, patch) as BuilderDocument
    if (!updated) {
      return { ok: false, document, error: "Patch resulted in empty document" }
    }
    return { ok: true, document: updated }
  } catch (error) {
    return { ok: false, document, error: error instanceof Error ? error.message : String(error) }
  }
}

export function applyBuilderPatches(document: BuilderDocument, patches: BuilderPatch[]): PatchResult {
  let current = document
  for (const patch of patches) {
    const result = applyBuilderPatch(current, patch)
    if (!result.ok) return result
    current = result.document
  }
  return { ok: true, document: current }
}
