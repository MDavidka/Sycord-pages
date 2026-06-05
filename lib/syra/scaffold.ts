// Deployable-project scaffolding for Syra.
//
// After the model generates the requested pages/components, this module fills in
// every file a Next.js project needs to actually `npm install && next build &&
// next start` on the deploy runner — WITHOUT overwriting anything the model
// already wrote. It:
//
//   - creates/patches package.json (correct scripts + all imported deps)
//   - adds next.config.mjs, tsconfig.json/jsconfig.json, next-env.d.ts
//   - adds the App-Router layout + globals.css (or Pages-Router _app) if missing
//   - wires up Tailwind (config + postcss + directives) when that's the styling
//   - adds public/robots.txt and a favicon
//   - guarantees a home page exists so the build never fails on an empty route
//
// Build-critical tooling (typescript, types, tailwind, postcss) is placed in
// `dependencies` (not devDependencies) because the runner may install with
// NODE_ENV=production, which would otherwise skip devDependencies.

import type { ProjectFramework } from "./types"
import type { VirtualFs } from "./vfs"

export interface ScaffoldResult {
  changed: string[]
  notes: string[]
}

/** Pinned, mutually-compatible versions for a reliable `next build`. */
const VERSIONS: Record<string, string> = {
  next: "14.2.15",
  react: "18.3.1",
  "react-dom": "18.3.1",
  typescript: "5.6.3",
  "@types/node": "20.16.11",
  "@types/react": "18.3.11",
  "@types/react-dom": "18.3.0",
  tailwindcss: "3.4.14",
  postcss: "8.4.47",
  autoprefixer: "10.4.20",
  "lucide-react": "0.454.0",
  "framer-motion": "11.11.9",
  clsx: "2.1.1",
  "tailwind-merge": "2.5.4",
  "class-variance-authority": "0.7.0",
  zod: "3.23.8",
  "date-fns": "4.1.0",
  "next-themes": "0.3.0",
  sonner: "1.5.0",
}

const SKIP_PKGS = new Set(["next", "react", "react-dom"])
const NODE_BUILTINS = new Set([
  "fs", "path", "os", "crypto", "http", "https", "stream", "util", "events",
  "child_process", "url", "querystring", "zlib", "buffer", "process",
])

/** Root package name for an import specifier, or null for local/aliased imports. */
function packageRoot(spec: string): string | null {
  if (!spec) return null
  if (spec.startsWith(".") || spec.startsWith("/") || spec.startsWith("@/") || spec.startsWith("~")) return null
  if (spec.startsWith("node:")) return null
  if (NODE_BUILTINS.has(spec)) return null
  if (spec.startsWith("@")) {
    const [scope, name] = spec.split("/")
    return name ? `${scope}/${name}` : null
  }
  return spec.split("/")[0]
}

/** Scan all source files and collect external npm packages they import. */
export function collectExternalImports(vfs: VirtualFs): Set<string> {
  const pkgs = new Set<string>()
  const patterns = [
    /(?:import|export)[\s\S]*?from\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
    /(?:require|import)\(\s*["']([^"']+)["']\s*\)/g,
  ]
  for (const path of vfs.list()) {
    if (!/\.(tsx|ts|jsx|js|mjs|cjs)$/.test(path)) continue
    const src = vfs.read(path) || ""
    for (const re of patterns) {
      re.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = re.exec(src))) {
        const root = packageRoot(m[1])
        if (root && !SKIP_PKGS.has(root) && !root.startsWith("next/") && !root.startsWith("react/")) {
          pkgs.add(root)
        }
      }
    }
  }
  return pkgs
}

function versionFor(pkg: string): string {
  return VERSIONS[pkg] || "latest"
}

function appBaseDir(fw: ProjectFramework): string {
  if (fw.router === "src-app") return "src/app"
  return "app"
}

function pagesBaseDir(_fw: ProjectFramework, vfs: VirtualFs): string {
  return vfs.list("src/pages").length ? "src/pages" : "pages"
}

export function ensureDeployable(vfs: VirtualFs, fw: ProjectFramework): ScaffoldResult {
  const changed: string[] = []
  const notes: string[] = []
  const isTs = fw.language !== "javascript"
  const ext = isTs ? "tsx" : "jsx"
  const usesTailwind = /tailwind/i.test(fw.styling)
  const isAppRouter = fw.router === "app" || fw.router === "src-app"
  const isPagesRouter = fw.router === "pages"
  const appDir = appBaseDir(fw)

  const has = (p: string) => vfs.exists(p)
  const hasAny = (paths: string[]) => paths.some((p) => vfs.exists(p))
  const add = (path: string, content: string) => {
    if (vfs.exists(path)) return
    vfs.write(path, content)
    changed.push(path)
  }

  // Does any code use the "@/" path alias?
  const usesAlias = vfs.list().some((p) => /\.(tsx|ts|jsx|js)$/.test(p) && /["']@\//.test(vfs.read(p) || ""))

  /* ---------------- package.json ---------------- */
  {
    const raw = vfs.read("package.json")
    let pkg: any = {}
    let existed = false
    if (raw) {
      try {
        pkg = JSON.parse(raw)
        existed = true
      } catch {
        pkg = {}
      }
    }

    pkg.name = pkg.name || "syra-site"
    pkg.version = pkg.version || "0.1.0"
    pkg.private = pkg.private ?? true

    pkg.scripts = pkg.scripts || {}
    pkg.scripts.dev = pkg.scripts.dev || "next dev"
    pkg.scripts.build = pkg.scripts.build || "next build"
    pkg.scripts.start = pkg.scripts.start || "next start"
    pkg.scripts.lint = pkg.scripts.lint || "next lint"

    pkg.dependencies = pkg.dependencies || {}
    const dep = (name: string) => {
      if (!pkg.dependencies[name] && !(pkg.devDependencies && pkg.devDependencies[name])) {
        pkg.dependencies[name] = versionFor(name)
      }
    }

    // Core runtime
    dep("next")
    dep("react")
    dep("react-dom")

    // Everything the generated code imports
    for (const p of collectExternalImports(vfs)) dep(p)

    // Build tooling in dependencies (survives a production install)
    if (isTs) {
      dep("typescript")
      dep("@types/node")
      dep("@types/react")
      dep("@types/react-dom")
    }
    if (usesTailwind) {
      dep("tailwindcss")
      dep("postcss")
      dep("autoprefixer")
    }

    const next = JSON.stringify(pkg, null, 2) + "\n"
    if (next !== raw) {
      vfs.write("package.json", next)
      changed.push("package.json")
      notes.push(existed ? "Patched package.json (scripts + dependencies)." : "Created package.json with build/start scripts.")
    }
  }

  /* ---------------- next.config ---------------- */
  if (!hasAny(["next.config.js", "next.config.mjs", "next.config.ts", "next.config.cjs"])) {
    add(
      "next.config.mjs",
      `/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
};

export default nextConfig;
`,
    )
    notes.push("Added next.config.mjs.")
  }

  /* ---------------- tsconfig / jsconfig / next-env ---------------- */
  if (isTs) {
    if (!has("tsconfig.json")) {
      add(
        "tsconfig.json",
        JSON.stringify(
          {
            compilerOptions: {
              target: "ES2017",
              lib: ["dom", "dom.iterable", "esnext"],
              allowJs: true,
              skipLibCheck: true,
              strict: true,
              noEmit: true,
              esModuleInterop: true,
              module: "esnext",
              moduleResolution: "bundler",
              resolveJsonModule: true,
              isolatedModules: true,
              jsx: "preserve",
              incremental: true,
              plugins: [{ name: "next" }],
              paths: { "@/*": ["./*"] },
            },
            include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
            exclude: ["node_modules"],
          },
          null,
          2,
        ) + "\n",
      )
      notes.push("Added tsconfig.json.")
    }
    if (!has("next-env.d.ts")) {
      add(
        "next-env.d.ts",
        `/// <reference types="next" />
/// <reference types="next/image-types/global" />

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
      )
    }
  } else if (usesAlias && !has("jsconfig.json") && !has("tsconfig.json")) {
    add(
      "jsconfig.json",
      JSON.stringify({ compilerOptions: { baseUrl: ".", paths: { "@/*": ["./*"] } } }, null, 2) + "\n",
    )
    notes.push("Added jsconfig.json for the @/ path alias.")
  }

  /* ---------------- Tailwind ---------------- */
  if (usesTailwind) {
    if (!hasAny(["tailwind.config.js", "tailwind.config.ts", "tailwind.config.mjs", "tailwind.config.cjs"])) {
      add(
        "tailwind.config.js",
        `/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: { extend: {} },
  plugins: [],
};
`,
      )
      notes.push("Added tailwind.config.js.")
    }
    if (!hasAny(["postcss.config.js", "postcss.config.mjs", "postcss.config.cjs"])) {
      add(
        "postcss.config.js",
        `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
`,
      )
      notes.push("Added postcss.config.js.")
    }
  }

  /* ---------------- globals.css ---------------- */
  const globalsCandidates = isAppRouter
    ? [`${appDir}/globals.css`, "styles/globals.css"]
    : ["styles/globals.css", `${pagesBaseDir(fw, vfs)}/globals.css`]
  let globalsPath = globalsCandidates.find((p) => has(p)) || null
  if (!globalsPath) {
    globalsPath = isAppRouter ? `${appDir}/globals.css` : "styles/globals.css"
    const base = usesTailwind
      ? `@tailwind base;
@tailwind components;
@tailwind utilities;
`
      : `:root { color-scheme: light dark; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }
`
    add(globalsPath, base)
    notes.push(`Added ${globalsPath}.`)
  }

  /* ---------------- Layout (App Router) ---------------- */
  if (isAppRouter) {
    const layoutPath = `${appDir}/layout.${ext}`
    const hasLayout = hasAny([`${appDir}/layout.tsx`, `${appDir}/layout.jsx`, `${appDir}/layout.js`])
    if (!hasLayout) {
      const importPath = globalsPath.startsWith(appDir) ? "./" + globalsPath.slice(appDir.length + 1) : `@/${globalsPath}`
      add(
        layoutPath,
        `${isTs ? `import type { Metadata } from "next"\n` : ""}import "${importPath}"

${isTs ? "export const metadata: Metadata = {" : "export const metadata = {"}
  title: "Built with Syra",
  description: "Generated by Syra, the AI website builder.",
}

export default function RootLayout({ children }${isTs ? ": { children: React.ReactNode }" : ""}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
`,
      )
      notes.push(`Added ${layoutPath}.`)
    }
  }

  /* ---------------- Pages Router _app ---------------- */
  if (isPagesRouter) {
    const pdir = pagesBaseDir(fw, vfs)
    const hasApp = hasAny([`${pdir}/_app.tsx`, `${pdir}/_app.jsx`, `${pdir}/_app.js`])
    if (!hasApp) {
      const importPath = globalsPath.startsWith(pdir) ? "./" + globalsPath.slice(pdir.length + 1) : `@/${globalsPath}`
      add(
        `${pdir}/_app.${ext}`,
        `import "${importPath}"
${isTs ? `import type { AppProps } from "next/app"\n` : ""}
export default function App({ Component, pageProps }${isTs ? ": AppProps" : ""}) {
  return <Component {...pageProps} />
}
`,
      )
      notes.push(`Added ${pdir}/_app.${ext}.`)
    }
  }

  /* ---------------- Home page guarantee ---------------- */
  const homeExists = isAppRouter
    ? hasAny([`${appDir}/page.tsx`, `${appDir}/page.jsx`, `${appDir}/page.js`])
    : (() => {
        const pdir = pagesBaseDir(fw, vfs)
        return hasAny([`${pdir}/index.tsx`, `${pdir}/index.jsx`, `${pdir}/index.js`])
      })()
  if (!homeExists) {
    const homePath = isAppRouter ? `${appDir}/page.${ext}` : `${pagesBaseDir(fw, vfs)}/index.${ext}`
    add(
      homePath,
      `export default function Home() {
  return (
    <main style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", fontFamily: "system-ui" }}>
      <h1>Built with Syra</h1>
    </main>
  )
}
`,
    )
    notes.push(`Added a placeholder home page at ${homePath}.`)
  }

  /* ---------------- public assets ---------------- */
  if (!has("public/robots.txt")) {
    add("public/robots.txt", `User-agent: *\nAllow: /\n`)
    notes.push("Added public/robots.txt.")
  }
  // App Router uses app/icon.svg as the favicon automatically.
  if (isAppRouter && !hasAny([`${appDir}/icon.svg`, `${appDir}/favicon.ico`, "public/favicon.ico", "public/icon.svg"])) {
    add(
      `${appDir}/icon.svg`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="14" fill="#0A0A0B"/>
  <path d="M40 22c0-3-3-5-8-5s-9 2-9 6c0 9 18 5 18 14 0 4-4 6-9 6s-9-2-9-6" fill="none" stroke="#6366F1" stroke-width="4" stroke-linecap="round"/>
</svg>
`,
    )
    notes.push(`Added ${appDir}/icon.svg favicon.`)
  } else if (isPagesRouter && !hasAny(["public/favicon.ico", "public/icon.svg"])) {
    add(
      "public/icon.svg",
      `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0A0A0B"/><path d="M40 22c0-3-3-5-8-5s-9 2-9 6c0 9 18 5 18 14 0 4-4 6-9 6s-9-2-9-6" fill="none" stroke="#6366F1" stroke-width="4" stroke-linecap="round"/></svg>\n`,
    )
    notes.push("Added public/icon.svg favicon.")
  }

  return { changed: [...new Set(changed)], notes }
}
