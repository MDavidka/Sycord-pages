import type { BuilderDocument, BuilderPatch } from "./types"

function ptrSegments(path: string) {
  return path.split("/").slice(1).map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"))
}

export function applyBuilderPatch(document: BuilderDocument, patch: BuilderPatch): BuilderDocument {
  const next = structuredClone(document)
  const segments = ptrSegments(patch.path)
  const last = segments.pop()
  if (!last) return next

  let target: any = next
  for (const segment of segments) {
    target = target?.[segment]
    if (target === undefined) return next
  }

  if (patch.op === "remove") {
    if (Array.isArray(target)) target.splice(Number(last), 1)
    else delete target[last]
  } else if (patch.op === "replace") {
    target[last] = patch.value
  } else if (patch.op === "add") {
    if (Array.isArray(target)) target.splice(Number(last), 0, patch.value)
    else target[last] = patch.value
  }

  next.history.push(patch)
  return next
}
