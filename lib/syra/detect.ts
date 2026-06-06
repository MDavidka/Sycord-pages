// Framework / project-structure detection for Syra.
//
// Syra never assumes the codebase. This module inspects the virtual filesystem
// to decide whether the project is Next.js App Router, Next.js Pages Router, or
// an empty scaffold, and where new files should live. The result feeds both the
// stable Gemini context and the generation plan.

import type { ProjectFramework } from "./types"
import type { VirtualFs } from "./vfs"

function safeJson<T = any>(raw: string | null): T | null {
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function detectFramework(vfs: VirtualFs): ProjectFramework {
  const paths = vfs.list()
  const has = (p: string) => vfs.exists(p)
  const hasPrefix = (prefix: string) => paths.some((p) => p === prefix || p.startsWith(prefix))

  const pkg = safeJson<{ dependencies?: Record<string, string>; devDependencies?: Record<string, string> }>(
    vfs.read("package.json"),
  )
  const deps = { ...(pkg?.dependencies || {}), ...(pkg?.devDependencies || {}) }

  const notes: string[] = []
  const isEmpty = paths.length === 0

  // Language
  const language: ProjectFramework["language"] = paths.some((p) => /\.tsx?$/.test(p)) || has("tsconfig.json")
    ? "typescript"
    : paths.some((p) => /\.jsx?$/.test(p))
    ? "javascript"
    : isEmpty
    ? "typescript"
    : "unknown"

  // Package manager
  let packageManager: ProjectFramework["packageManager"] = "unknown"
  if (has("pnpm-lock.yaml")) packageManager = "pnpm"
  else if (has("yarn.lock")) packageManager = "yarn"
  else if (has("bun.lockb")) packageManager = "bun"
  else if (has("package-lock.json")) packageManager = "npm"
  else packageManager = "npm"

  // Router detection
  let router: ProjectFramework["router"] = "unknown"
  let entryFile = ""
  let componentsDir = "components"

  const isNext = !!deps.next || has("next.config.js") || has("next.config.mjs") || has("next.config.ts")

  // Prefer the entry file that actually exists; otherwise synthesise a default
  // using the project's language.
  const ext = language === "javascript" ? "jsx" : "tsx"
  const pickEntry = (candidates: string[], fallback: string) => candidates.find((c) => has(c)) || fallback

  if (hasPrefix("src/app/")) {
    router = "src-app"
    componentsDir = "src/components"
    entryFile = pickEntry(["src/app/page.tsx", "src/app/page.jsx", "src/app/page.js"], `src/app/page.${ext}`)
  } else if (hasPrefix("app/")) {
    router = "app"
    componentsDir = "components"
    entryFile = pickEntry(["app/page.tsx", "app/page.jsx", "app/page.js"], `app/page.${ext}`)
  } else if (hasPrefix("src/pages/")) {
    router = "pages"
    componentsDir = "src/components"
    entryFile = pickEntry(["src/pages/index.tsx", "src/pages/index.jsx", "src/pages/index.js"], `src/pages/index.${ext}`)
  } else if (hasPrefix("pages/")) {
    router = "pages"
    componentsDir = "components"
    entryFile = pickEntry(["pages/index.tsx", "pages/index.jsx", "pages/index.js"], `pages/index.${ext}`)
  }

  // Decide framework label + sensible defaults for empty/unknown projects.
  let framework = "Unknown"
  if (isNext || router !== "unknown") {
    framework = "Next.js"
    if (router === "unknown") {
      // Next project without routed files yet — default to App Router.
      router = "app"
      entryFile = "app/page.tsx"
      componentsDir = "components"
      notes.push("Next.js detected but no routed pages found — defaulting to the App Router.")
    }
  } else if (deps.vite || has("vite.config.ts") || has("vite.config.js")) {
    framework = "React (Vite)"
    entryFile = has("src/App.tsx") ? "src/App.tsx" : "src/App.jsx"
    componentsDir = "src/components"
    router = "unknown"
  } else if (isEmpty) {
    // Fresh scaffold — Syra builds a Next.js App Router site by default.
    framework = "Next.js"
    router = "app"
    entryFile = "app/page.tsx"
    componentsDir = "components"
    notes.push("Empty project — Syra will scaffold a Next.js App Router site with Tailwind CSS.")
  } else {
    notes.push("Could not confidently detect a framework; defaulting to Next.js App Router conventions.")
    router = "app"
    entryFile = "app/page.tsx"
  }

  const adjust = language === "javascript"
  if (adjust) {
    entryFile = entryFile.replace(/\.tsx?$/, (m) => (m === ".tsx" ? ".jsx" : ".js"))
  }

  // Styling detection
  const hasTailwindCfg =
    has("tailwind.config.js") ||
    has("tailwind.config.ts") ||
    has("tailwind.config.mjs") ||
    has("tailwind.config.cjs")
  const hasTailwindDep = !!deps.tailwindcss
  let styling = "plain CSS"
  if (hasTailwindCfg || hasTailwindDep) {
    styling = "Tailwind CSS"
    if (!hasTailwindCfg && hasTailwindDep) notes.push("tailwindcss is a dependency but no tailwind config file was found.")
  } else if (Object.keys(deps).some((d) => d.includes("styled-components"))) {
    styling = "styled-components"
  } else if (isEmpty) {
    styling = "Tailwind CSS"
  }

  if (deps["@radix-ui/react-slot"] || has("components.json")) {
    notes.push("shadcn/ui-style components detected — reuse the existing UI primitives where possible.")
  }

  return {
    framework,
    router,
    language,
    styling,
    packageManager,
    entryFile,
    componentsDir,
    isEmpty,
    notes,
  }
}

/**
 * Pick the files most worth reading before planning. We keep this list small to
 * stay token-efficient and only include files that actually exist.
 */
export function importantFilesToRead(vfs: VirtualFs, fw: ProjectFramework): string[] {
  const candidates = [
    "package.json",
    "tailwind.config.ts",
    "tailwind.config.js",
    "tsconfig.json",
    "tsconfig.json",
    "next.config.mjs",
    "next.config.js",
    fw.entryFile,
    "app/layout.tsx",
    "src/app/layout.tsx",
    "app/globals.css",
    "src/app/globals.css",
    "styles/globals.css",
    "pages/_app.tsx",
    "src/pages/_app.tsx",
  ]
  const existing = candidates.filter((p) => vfs.exists(p))
  // Add up to a few existing component files for style reference.
  const componentFiles = vfs
    .list(fw.componentsDir)
    .filter((p) => /\.(tsx|jsx)$/.test(p))
    .slice(0, 3)
  return [...new Set([...existing, ...componentFiles])]
}

/** Build the static project context (framework, design system) for caching. */
export function buildStaticContext(fw: ProjectFramework): string {
  return [
    "# PROJECT CONTEXT (static)",
    "",
    "## Detected stack",
    `- Framework: ${fw.framework}`,
    `- Router: ${fw.router}`,
    `- Language: ${fw.language}`,
    `- Styling: ${fw.styling}`,
    `- Package manager: ${fw.packageManager}`,
    `- Home/entry file: ${fw.entryFile}`,
    `- Components directory: ${fw.componentsDir}`,
    fw.notes.length ? `- Notes:\n${fw.notes.map((n) => `  - ${n}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

/** Build the dynamic project context (file tree, key files) for each round. */
export function buildDynamicContext(vfs: VirtualFs, readFiles: string[]): string {
  const tree = vfs.tree()
  const fileBlocks = readFiles
    .map((path) => {
      const content = vfs.read(path)
      if (content == null) return null
      const capped = content.length > 6000 ? content.slice(0, 6000) + "\n/* …truncated… */" : content
      return `FILE: ${path}\n\`\`\`\n${capped}\n\`\`\``
    })
    .filter(Boolean)
    .join("\n\n")

  return [
    "## File tree (current)",
    "```",
    tree,
    "```",
    "",
    fileBlocks ? "## Key files\n\n" + fileBlocks : "## Key files\n(none read)",
  ]
    .filter(Boolean)
    .join("\n")
}
