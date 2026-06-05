// System + planning prompts for the Syra agent.

import type { ProjectFramework, SyraPlan } from "./types"

export const SYRA_SYSTEM = `You are Syra, an expert AI website engineer that builds and edits real Next.js projects.

You work through tool calls against the user's actual project files. NEVER assume the
codebase — always rely on the provided project context and tools to inspect it.

Core rules:
- Respect the detected router. App Router pages live in app/ (or src/app/), Pages Router
  pages live in pages/ (or src/pages/). Put the home page at the detected entry file.
- Reuse the detected styling system (e.g. Tailwind CSS) and existing UI components.
- Write COMPLETE, production-ready files. No placeholders, no "// TODO", no truncation.
- For App Router client interactivity, add "use client" at the top of the file.
- Use lucide-react for icons (it is available). Use semantic, accessible markup.
- Prefer write_files to create a page plus its components in a single call (token-efficient).
- Keep imports valid and self-consistent across the files you write.
- Do not write secrets or .env files.

When you are completely finished, reply with a short plain-text summary (no tool call)
describing what you built and which files changed.`

export function buildPlanPrompt(prompt: string, fw: ProjectFramework): string {
  return `The user wants you to build/modify their website.

USER REQUEST:
"""${prompt}"""

DETECTED PROJECT:
- Framework: ${fw.framework}
- Router: ${fw.router}
- Language: ${fw.language}
- Styling: ${fw.styling}
- Entry/home file: ${fw.entryFile}
- Components directory: ${fw.componentsDir}
${fw.isEmpty ? "- This is an EMPTY project; you will scaffold the necessary files." : ""}

Produce a concise implementation plan as JSON with this exact shape:
{
  "summary": "one sentence describing what will be built",
  "steps": ["short actionable step", "..."],
  "files": [{ "path": "app/page.tsx", "purpose": "what this file is for" }]
}

Rules for the plan:
- Use correct paths for the detected router (home page MUST be "${fw.entryFile}").
- Place shared components under "${fw.componentsDir}".
- 3-7 steps, 1-8 files. Be realistic and specific to the request.
- Respond with ONLY the JSON object, no markdown fences.`
}

export function buildGeneratePrompt(prompt: string, plan: SyraPlan, fw: ProjectFramework): string {
  return `Now implement the plan using tools (write_files / write_file / edit_file).

USER REQUEST:
"""${prompt}"""

APPROVED PLAN:
${JSON.stringify(plan, null, 2)}

Implementation requirements:
- Home page path MUST be "${fw.entryFile}".
- Shared components under "${fw.componentsDir}".
- Styling: ${fw.styling}. Language: ${fw.language}.
- Write every file listed in the plan with full, working content.
- Call read_file first if you need to edit an existing file precisely.
- Use get_icon_suggestions / generate_color_palette if helpful.
- After all files are written, stop calling tools and reply with a short summary.`
}

/** Defensive JSON extraction for the plan response. */
export function parsePlan(text: string): SyraPlan {
  let raw = (text || "").trim()
  // Strip markdown fences if the model added them.
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) raw = fence[1].trim()
  // Grab the outermost JSON object.
  const start = raw.indexOf("{")
  const end = raw.lastIndexOf("}")
  if (start !== -1 && end !== -1) raw = raw.slice(start, end + 1)

  try {
    const obj = JSON.parse(raw)
    const steps = Array.isArray(obj.steps) ? obj.steps.map(String) : []
    const files = Array.isArray(obj.files)
      ? obj.files
          .map((f: any) => ({ path: String(f?.path || "").trim(), purpose: String(f?.purpose || "").trim() }))
          .filter((f: any) => f.path)
      : []
    return {
      summary: String(obj.summary || "Build the requested website").trim(),
      steps: steps.length ? steps : ["Generate the requested files"],
      files,
    }
  } catch {
    return {
      summary: "Build the requested website",
      steps: ["Inspect the project", "Generate the requested files", "Validate output"],
      files: [],
    }
  }
}
