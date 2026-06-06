// Deployable-project scaffolding for Syra.
//
// After the model generates the requested pages/components, this module fills in
// every file a Next.js project needs to actually `npm install && next build &&
// next start` on the deploy runner — WITHOUT overwriting anything the model
// already wrote. It also injects the full shadcn/ui design system (theme tokens,
// tailwind config and component primitives) so every generated site shares a
// consistent, production-grade component library.
//
// Build-critical tooling (typescript, types, tailwind, postcss) is placed in
// `dependencies` (not devDependencies) because the runner may install with
// NODE_ENV=production, which would otherwise skip devDependencies.

import type { ProjectFramework } from "./types"
import type { VirtualFs } from "./vfs"
import {
  SHADCN_DEPS,
  SHADCN_GLOBALS_CSS,
  shadcnComponentFiles,
  shadcnTailwindConfig,
} from "./shadcn"

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
  "tailwindcss-animate": "1.0.7",
  "lucide-react": "0.454.0",
  "framer-motion": "11.11.9",
  clsx: "2.1.1",
  "tailwind-merge": "2.5.4",
  "class-variance-authority": "0.7.0",
  zod: "3.23.8",
  "date-fns": "4.1.0",
  "next-themes": "0.3.0",
  sonner: "1.5.0",
  "react-hook-form": "7.53.0",
  "@hookform/resolvers": "3.9.0",
  // Radix primitives used by the shadcn component set (React 18 compatible)
  "@radix-ui/react-slot": "1.1.0",
  "@radix-ui/react-label": "2.1.0",
  "@radix-ui/react-separator": "1.1.0",
  "@radix-ui/react-avatar": "1.1.1",
  "@radix-ui/react-accordion": "1.2.1",
  "@radix-ui/react-dialog": "1.1.2",
  "@radix-ui/react-alert-dialog": "1.1.2",
  "@radix-ui/react-dropdown-menu": "2.1.2",
  "@radix-ui/react-tabs": "1.1.1",
  "@radix-ui/react-select": "2.1.2",
  "@radix-ui/react-checkbox": "1.1.2",
  "@radix-ui/react-switch": "1.1.1",
  "@radix-ui/react-toast": "1.2.2",
  "@radix-ui/react-tooltip": "1.1.3",
  "@radix-ui/react-popover": "1.1.2",
  "@radix-ui/react-scroll-area": "1.2.0",
  "@radix-ui/react-progress": "1.1.0",
  "@radix-ui/react-radio-group": "1.2.1",
  "@radix-ui/react-aspect-ratio": "1.1.0",
  "@radix-ui/react-collapsible": "1.1.1",
}

const SKIP_PKGS = new Set(["next", "react", "react-dom"])
const NODE_BUILTINS = new Set([
  "fs", "path", "os", "crypto", "http", "https", "stream", "util", "events",
  "child_process", "url", "querystring", "zlib", "buffer", "process", "net", "dns",
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
  const isAppRouter = fw.router === "app" || fw.router === "src-app"
  const isPagesRouter = fw.router === "pages"
  // shadcn/ui is the design system for every TypeScript Next.js project (the default).
  const isNextish = fw.router !== "unknown" || /next/i.test(fw.framework)
  const useShadcn = isTs && isNextish
  // Tailwind underpins shadcn, so it is always on for shadcn projects.
  const usesTailwind = useShadcn || /tailwind/i.test(fw.styling) || fw.isEmpty
  const appDir = appBaseDir(fw)

  const has = (p: string) => vfs.exists(p)
  const hasAny = (paths: string[]) => paths.some((p) => vfs.exists(p))
  const add = (path: string, content: string) => {
    if (vfs.exists(path)) return false
    vfs.write(path, content)
    changed.push(path)
    return true
  }

  // Does any code use the "@/" path alias?
  const usesAlias =
    useShadcn || vfs.list().some((p) => /\.(tsx|ts|jsx|js)$/.test(p) && /["']@\//.test(vfs.read(p) || ""))

  /* ---------------- shadcn/ui design system + Tailwind theme ---------------- */
  // Idempotent — this normally already ran BEFORE generation (so the model could
  // see and import the primitives). Re-running here only fills remaining gaps.
  {
    const ds = injectDesignSystem(vfs, fw)
    for (const c of ds.changed) if (!changed.includes(c)) changed.push(c)
    for (const n of ds.notes) notes.push(n)
  }
  const globalsPath = resolveGlobalsPath(vfs, fw)

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

  /* ---------------- Layout (App Router) ---------------- */
  if (isAppRouter) {
    const hasLayout = hasAny([`${appDir}/layout.tsx`, `${appDir}/layout.jsx`, `${appDir}/layout.js`])
    if (!hasLayout) {
      const importPath = globalsPath.startsWith(appDir) ? "./" + globalsPath.slice(appDir.length + 1) : `@/${globalsPath}`
      const bodyClass = useShadcn ? "min-h-screen bg-background text-foreground antialiased" : ""
      const toasterImport = useShadcn ? `import { Toaster } from "@/components/ui/sonner"\n` : ""
      const toasterEl = useShadcn ? "\n        <Toaster />" : ""
      add(
        `${appDir}/layout.${ext}`,
        `${isTs ? `import type { Metadata } from "next"\n` : ""}import "${importPath}"
${toasterImport}
${isTs ? "export const metadata: Metadata = {" : "export const metadata = {"}
  title: "Built with Syra",
  description: "Generated by Syra, the AI website builder.",
}

export default function RootLayout({ children }${isTs ? ": { children: React.ReactNode }" : ""}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body${bodyClass ? ` className="${bodyClass}"` : ""}>
        {children}${toasterEl}
      </body>
    </html>
  )
}
`,
      )
      notes.push(`Added ${appDir}/layout.${ext}.`)
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
  const features = [
    { title: "Fast", description: "Built on Next.js for instant loads and great SEO." },
    { title: "Beautiful", description: "A polished, responsive design out of the box." },
    { title: "Yours", description: "Fully editable — describe a change and Syra builds it." },
  ]
  return (
    <main className="flex min-h-screen flex-col">
      <section className="flex flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <span className="rounded-full border px-4 py-1 text-sm text-muted-foreground">Powered by Syra</span>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl">
          Your new website is ready to build
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Describe what you want and Syra will generate the pages, content and functionality for you.
        </p>
        <div className="flex gap-3">
          <a href="#features" className="rounded-md bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">
            Explore features
          </a>
          <a href="/contact" className="rounded-md border px-6 py-3 text-sm font-medium">
            Get in touch
          </a>
        </div>
      </section>
      <section id="features" className="border-t px-6 py-20">
        <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="rounded-lg border bg-card p-6 text-card-foreground">
              <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.description}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mt-auto border-t px-6 py-8 text-center text-sm text-muted-foreground">
        &copy; {new Date().getFullYear()} — built with Syra
      </footer>
    </main>
  )
}
`,
    )
    notes.push(`Added a starter home page at ${homePath}.`)
  }

  /* ---------------- public assets ---------------- */
  if (!has("public/robots.txt")) {
    add("public/robots.txt", `User-agent: *\nAllow: /\n`)
    notes.push("Added public/robots.txt.")
  }
  // App Router uses app/icon.svg as the favicon automatically.
  if (isAppRouter && !hasAny([`${appDir}/icon.svg`, `${appDir}/favicon.ico`, "public/favicon.ico", "public/icon.svg"])) {
    add(`${appDir}/icon.svg`, faviconSvg())
    notes.push(`Added ${appDir}/icon.svg favicon.`)
  } else if (isPagesRouter && !hasAny(["public/favicon.ico", "public/icon.svg"])) {
    add("public/icon.svg", faviconSvg())
    notes.push("Added public/icon.svg favicon.")
  }

  /* ---------------- package.json (LAST, so it sees every import) ---------------- */
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

    // Everything the generated + scaffolded code imports
    for (const p of collectExternalImports(vfs)) dep(p)

    // shadcn essentials (some, like the tailwind plugin, aren't import-discoverable)
    if (useShadcn) for (const p of SHADCN_DEPS) dep(p)

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
      dep("tailwindcss-animate")
    }

    const next = JSON.stringify(pkg, null, 2) + "\n"
    if (next !== raw) {
      vfs.write("package.json", next)
      changed.push("package.json")
      notes.push(existed ? "Patched package.json (scripts + dependencies)." : "Created package.json with build/start scripts.")
    }
  }

  return { changed: [...new Set(changed)], notes }
}

/** The globals.css path Syra uses for this project (existing one, else the default). */
function resolveGlobalsPath(vfs: VirtualFs, fw: ProjectFramework): string {
  const isAppRouter = fw.router === "app" || fw.router === "src-app"
  const appDir = appBaseDir(fw)
  const candidates = isAppRouter
    ? [`${appDir}/globals.css`, "styles/globals.css"]
    : ["styles/globals.css", `${pagesBaseDir(fw, vfs)}/globals.css`]
  return candidates.find((p) => vfs.exists(p)) || (isAppRouter ? `${appDir}/globals.css` : "styles/globals.css")
}

/**
 * Inject the shadcn/ui design system (component primitives, theme tokens,
 * tailwind/postcss config, cn helper) without overwriting existing files. This
 * is run BEFORE generation so the model can see and import the primitives, and
 * again (idempotently) during ensureDeployable. Returns the files it created.
 */
export function injectDesignSystem(vfs: VirtualFs, fw: ProjectFramework): ScaffoldResult {
  const changed: string[] = []
  const notes: string[] = []
  const isTs = fw.language !== "javascript"
  const isNextish = fw.router !== "unknown" || /next/i.test(fw.framework)
  const useShadcn = isTs && isNextish
  const usesTailwind = useShadcn || /tailwind/i.test(fw.styling) || fw.isEmpty

  const has = (p: string) => vfs.exists(p)
  const hasAny = (paths: string[]) => paths.some((p) => vfs.exists(p))
  const add = (path: string, content: string) => {
    if (vfs.exists(path)) return
    vfs.write(path, content)
    changed.push(path)
  }

  if (useShadcn) {
    for (const [path, content] of Object.entries(shadcnComponentFiles())) add(path, content)
    notes.push("Injected shadcn/ui design system (components/ui/*, lib/utils, theme).")
  }

  // globals.css
  const globalsPath = resolveGlobalsPath(vfs, fw)
  if (!has(globalsPath)) {
    const base = useShadcn
      ? SHADCN_GLOBALS_CSS
      : usesTailwind
      ? `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n`
      : `:root { color-scheme: light dark; }\n* { box-sizing: border-box; }\nhtml, body { margin: 0; padding: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }\n`
    add(globalsPath, base)
    notes.push(`Added ${globalsPath}.`)
  }

  // Tailwind + PostCSS config
  if (usesTailwind) {
    if (!hasAny(["tailwind.config.js", "tailwind.config.ts", "tailwind.config.mjs", "tailwind.config.cjs"])) {
      add(
        "tailwind.config.js",
        useShadcn
          ? shadcnTailwindConfig()
          : `/** @type {import('tailwindcss').Config} */
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

  return { changed, notes }
}

function faviconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0A0A0B"/><path d="M40 22c0-3-3-5-8-5s-9 2-9 6c0 9 18 5 18 14 0 4-4 6-9 6s-9-2-9-6" fill="none" stroke="#6366F1" stroke-width="4" stroke-linecap="round"/></svg>\n`
}
