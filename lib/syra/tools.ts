// Syra tools.
//
// Maps the tool kit described in `tools.md` to (a) Gemini function declarations
// the model can call, and (b) real executors that operate on the in-memory
// VirtualFs. Tools are intentionally side-effect-local: they mutate the VFS,
// the design helpers are deterministic, and nothing here touches the network so
// generation stays fast and predictable. The pipeline persists the resulting
// diff to MongoDB after the run.

import { Type, type FunctionDeclaration } from "@google/genai"
import type { ProjectFramework } from "./types"
import { detectFramework } from "./detect"
import type { VirtualFs } from "./vfs"
import { isUnsafePath } from "./vfs"

export interface ToolContext {
  vfs: VirtualFs
  framework: ProjectFramework
  /** Lightweight key/value memory shared across the run (Gemini-cache style). */
  memory: Map<string, unknown>
  /** Called whenever a file is created/modified/deleted so the UI can stream it. */
  onFileChange?: (path: string, kind: "created" | "modified" | "deleted") => void
  /** Called for human-readable agent log lines. */
  onLog?: (message: string) => void
}

export interface ToolResult {
  /** Short label shown in the progress UI next to the tool icon. */
  label: string
  /** JSON-serialisable payload returned to the model as the functionResponse. */
  data: unknown
}

/* ------------------------------------------------------------------ */
/* Gemini function declarations                                        */
/* ------------------------------------------------------------------ */

const STRING = Type.STRING
const OBJECT = Type.OBJECT
const ARRAY = Type.ARRAY

export const FUNCTION_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "list_files",
    description: "List files and folders in the project, optionally under a directory path.",
    parameters: {
      type: OBJECT,
      properties: { path: { type: STRING, description: "Relative directory path. Empty for project root." } },
      required: [],
    },
  },
  {
    name: "read_file",
    description: "Read the full contents of a single file.",
    parameters: {
      type: OBJECT,
      properties: { path: { type: STRING, description: "Path of the file to read." } },
      required: ["path"],
    },
  },
  {
    name: "read_files",
    description: "Read several files at once. Prefer this over multiple read_file calls.",
    parameters: {
      type: OBJECT,
      properties: {
        paths: { type: ARRAY, items: { type: STRING }, description: "List of file paths to read." },
      },
      required: ["paths"],
    },
  },
  {
    name: "write_file",
    description:
      "Create a new file or completely overwrite an existing one with full content. Use correct paths for the detected router (e.g. app/page.tsx).",
    parameters: {
      type: OBJECT,
      properties: {
        path: { type: STRING, description: "Target file path." },
        content: { type: STRING, description: "The complete new file content." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "write_files",
    description:
      "Create or overwrite multiple files in one call. Ideal for generating a complete page plus its components. Token-efficient.",
    parameters: {
      type: OBJECT,
      properties: {
        files: {
          type: ARRAY,
          description: "Array of files to write.",
          items: {
            type: OBJECT,
            properties: {
              path: { type: STRING, description: "Target file path." },
              content: { type: STRING, description: "Complete file content." },
            },
            required: ["path", "content"],
          },
        },
      },
      required: ["files"],
    },
  },
  {
    name: "edit_file",
    description:
      "Make a targeted edit by replacing an exact snippet (old_text) with new_text. Read the file first so old_text matches exactly.",
    parameters: {
      type: OBJECT,
      properties: {
        path: { type: STRING, description: "File to edit." },
        old_text: { type: STRING, description: "Exact existing snippet to replace." },
        new_text: { type: STRING, description: "Replacement snippet." },
      },
      required: ["path", "old_text", "new_text"],
    },
  },
  {
    name: "delete_file",
    description: "Permanently delete a file from the project.",
    parameters: {
      type: OBJECT,
      properties: { path: { type: STRING, description: "Path of the file to delete." } },
      required: ["path"],
    },
  },
  {
    name: "detect_framework",
    description: "Return the detected framework, router, language, styling and key paths for this project.",
    parameters: { type: OBJECT, properties: {}, required: [] },
  },
  {
    name: "get_project_structure",
    description: "Return the full project file tree as an indented string.",
    parameters: { type: OBJECT, properties: {}, required: [] },
  },
  {
    name: "get_package_info",
    description: "Return parsed package.json info: name, scripts and dependency list.",
    parameters: { type: OBJECT, properties: {}, required: [] },
  },
  {
    name: "get_icon_suggestions",
    description: "Suggest relevant lucide-react icon names for a section or feature.",
    parameters: {
      type: OBJECT,
      properties: { section: { type: STRING, description: "Section or feature, e.g. 'features', 'contact'." } },
      required: ["section"],
    },
  },
  {
    name: "generate_color_palette",
    description: "Generate an accessible color palette (hex codes) for a given style.",
    parameters: {
      type: OBJECT,
      properties: { style: { type: STRING, description: "Design style, e.g. 'modern dark SaaS'." } },
      required: ["style"],
    },
  },
  {
    name: "log_action",
    description: "Record a short human-readable note about what you are doing, shown to the user.",
    parameters: {
      type: OBJECT,
      properties: { action: { type: STRING, description: "Short description of the action." } },
      required: ["action"],
    },
  },
]

/* ------------------------------------------------------------------ */
/* Deterministic design helpers                                        */
/* ------------------------------------------------------------------ */

function colorPalette(style: string) {
  const s = (style || "").toLowerCase()
  const dark = /dark|night|noir|black/.test(s)
  const luxury = /luxur|premium|elegant|gold/.test(s)
  const playful = /playful|fun|vibrant|kids|colou?rful/.test(s)
  if (luxury) {
    return { background: "#0B0B0F", surface: "#15151D", primary: "#C9A227", secondary: "#E7E3D8", accent: "#8A6D1F", text: "#F5F3EC", muted: "#9A958A" }
  }
  if (playful) {
    return { background: "#FFFDF7", surface: "#FFFFFF", primary: "#FF5C8A", secondary: "#5C7CFF", accent: "#FFC75C", text: "#1B1B2F", muted: "#6B6B7B" }
  }
  if (dark) {
    return { background: "#0A0A0B", surface: "#141416", primary: "#6366F1", secondary: "#22D3EE", accent: "#A855F7", text: "#FAFAFA", muted: "#A1A1AA" }
  }
  return { background: "#FFFFFF", surface: "#F8FAFC", primary: "#4F46E5", secondary: "#0EA5E9", accent: "#F59E0B", text: "#0F172A", muted: "#64748B" }
}

const ICON_MAP: Record<string, string[]> = {
  features: ["Zap", "Sparkles", "Rocket", "Shield", "Layers", "Gauge"],
  pricing: ["Check", "BadgeCheck", "Crown", "Tag", "Wallet", "TrendingUp"],
  contact: ["Mail", "Phone", "MapPin", "MessageSquare", "Send", "Globe"],
  testimonials: ["Quote", "Star", "Heart", "ThumbsUp", "Users", "Smile"],
  hero: ["ArrowRight", "Play", "Sparkles", "Rocket", "Star"],
  footer: ["Github", "Twitter", "Linkedin", "Mail", "Globe", "Heart"],
  analytics: ["BarChart3", "LineChart", "PieChart", "TrendingUp", "Activity", "Gauge"],
  security: ["Shield", "Lock", "Key", "Fingerprint", "ShieldCheck", "Eye"],
}

function iconSuggestions(section: string): string[] {
  const key = Object.keys(ICON_MAP).find((k) => section.toLowerCase().includes(k))
  return key ? ICON_MAP[key] : ["Sparkles", "Star", "Circle", "Square", "Zap", "ArrowRight"]
}

/* ------------------------------------------------------------------ */
/* Executor                                                            */
/* ------------------------------------------------------------------ */

export async function executeTool(name: string, rawArgs: any, ctx: ToolContext): Promise<ToolResult> {
  const args = rawArgs || {}
  switch (name) {
    case "list_files": {
      const files = ctx.vfs.list(args.path || "")
      return { label: `Listed ${files.length} file${files.length === 1 ? "" : "s"}${args.path ? ` in ${args.path}` : ""}`, data: { files, count: files.length } }
    }

    case "read_file": {
      const content = ctx.vfs.read(args.path)
      if (content == null) return { label: `Missing ${args.path}`, data: { path: args.path, found: false } }
      return { label: `Read ${args.path}`, data: { path: args.path, found: true, content } }
    }

    case "read_files": {
      const paths: string[] = Array.isArray(args.paths) ? args.paths : []
      const results = ctx.vfs.readMany(paths)
      return { label: `Read ${results.filter((r) => r.content != null).length}/${paths.length} files`, data: { files: results } }
    }

    case "write_file": {
      const { path, created } = ctx.vfs.write(args.path, args.content ?? "")
      ctx.onFileChange?.(path, created ? "created" : "modified")
      return { label: `${created ? "Created" : "Updated"} ${path}`, data: { path, created, ok: true } }
    }

    case "write_files": {
      const files: { path: string; content: string }[] = Array.isArray(args.files) ? args.files : []
      const written: { path: string; created: boolean }[] = []
      const errors: { path: string; error: string }[] = []
      for (const f of files) {
        try {
          const { path, created } = ctx.vfs.write(f.path, f.content ?? "")
          ctx.onFileChange?.(path, created ? "created" : "modified")
          written.push({ path, created })
        } catch (e: any) {
          errors.push({ path: f?.path, error: e?.message || "write failed" })
        }
      }
      return {
        label: `Wrote ${written.length} file${written.length === 1 ? "" : "s"}${errors.length ? `, ${errors.length} failed` : ""}`,
        data: { written, errors, ok: errors.length === 0 },
      }
    }

    case "edit_file": {
      const res = ctx.vfs.edit(args.path, args.old_text ?? "", args.new_text ?? "")
      ctx.onFileChange?.(res.path, "modified")
      return { label: `Edited ${res.path}`, data: { ...res, ok: true } }
    }

    case "delete_file": {
      const removed = ctx.vfs.delete(args.path)
      if (removed) ctx.onFileChange?.(args.path, "deleted")
      return { label: removed ? `Deleted ${args.path}` : `Nothing to delete at ${args.path}`, data: { path: args.path, deleted: removed } }
    }

    case "detect_framework": {
      const fw = ctx.framework
      return { label: `${fw.framework} · ${fw.router} router`, data: fw }
    }

    case "get_project_structure": {
      return { label: "Read project structure", data: { tree: ctx.vfs.tree(), files: ctx.vfs.list() } }
    }

    case "get_package_info": {
      const raw = ctx.vfs.read("package.json")
      if (!raw) return { label: "No package.json", data: { found: false } }
      try {
        const pkg = JSON.parse(raw)
        return {
          label: "Read package.json",
          data: {
            found: true,
            name: pkg.name,
            scripts: pkg.scripts || {},
            dependencies: Object.keys(pkg.dependencies || {}),
            devDependencies: Object.keys(pkg.devDependencies || {}),
          },
        }
      } catch {
        return { label: "Invalid package.json", data: { found: true, parseError: true } }
      }
    }

    case "get_icon_suggestions": {
      const icons = iconSuggestions(args.section || "")
      return { label: `Suggested icons for ${args.section}`, data: { section: args.section, icons } }
    }

    case "generate_color_palette": {
      const palette = colorPalette(args.style || "")
      return { label: `Palette for "${args.style}"`, data: { style: args.style, palette } }
    }

    case "log_action": {
      ctx.onLog?.(String(args.action || ""))
      return { label: String(args.action || "Logged"), data: { ok: true } }
    }

    default:
      return { label: `Unknown tool ${name}`, data: { error: `Unknown tool: ${name}` } }
  }
}

/** Re-export so the pipeline can re-detect after writes if needed. */
export { detectFramework, isUnsafePath }
