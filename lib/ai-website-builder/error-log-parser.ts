import type { PipelineLog } from "./types"

export type ParsedBuildError = {
  kind:
    | "typescript"
    | "missing-import"
    | "missing-file"
    | "invalid-next-image"
    | "invalid-config"
    | "missing-dependency"
    | "unsafe-env-file"
    | "layout-class"
    | "unknown"
  file?: string
  line?: number
  column?: number
  message: string
  raw: string
}

export function parseBuildErrors(input: { errors?: string[]; warnings?: string[]; logs?: PipelineLog[] }): ParsedBuildError[] {
  const lines = [...(input.errors ?? []), ...(input.warnings ?? []), ...((input.logs ?? []).map((l) => `${l.step}: ${l.detail}`))]
  return lines.map((raw) => {
    const line = raw.toLowerCase()
    if (line.includes("must not be generated") && line.includes(".env")) return { kind: "unsafe-env-file", message: raw, raw }
    if (line.includes("missing @libsql/client") || line.includes("missing dependency")) return { kind: "missing-dependency", message: raw, raw }
    if (line.includes("imports @/components/ui/") || line.includes("missing required file")) return { kind: "missing-file", message: raw, raw }
    if (line.includes("missing default export") || line.includes("route file")) return { kind: "missing-import", message: raw, raw }
    if (line.includes("output: \"export\"") || line.includes("deploymentmode")) return { kind: "invalid-config", message: raw, raw }
    if (line.includes("image") && (line.includes("width") || line.includes("height") || line.includes("next/image"))) return { kind: "invalid-next-image", message: raw, raw }
    if (line.includes("grid-cols") || line.includes("flex-col")) return { kind: "layout-class", message: raw, raw }
    if (line.includes("type") || line.includes("typescript") || /\.[tj]sx?/.test(raw)) return { kind: "typescript", message: raw, raw }
    return { kind: "unknown", message: raw, raw }
  })
}
