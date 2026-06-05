// Syra tools.
//
// A lean, file-focused tool kit: the model inspects the project and then freely
// writes complete files (preferring write_files for many files at once). Tools
// operate on the in-memory VirtualFs and never touch the network, so generation
// stays fast and predictable. The pipeline persists the resulting diff to
// MongoDB after the run.

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
]

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

    default:
      return { label: `Unknown tool ${name}`, data: { error: `Unknown tool: ${name}` } }
  }
}

/** Re-export so the pipeline can re-detect after writes if needed. */
export { detectFramework, isUnsafePath }
