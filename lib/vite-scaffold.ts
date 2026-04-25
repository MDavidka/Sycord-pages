import fs from "fs"
import path from "path"

// A single file emitted into the generated project.
export interface ScaffoldFile {
  name: string
  code: string
  timestamp: number
}

// A page's route metadata (used to build the React Router config in App.tsx).
export interface ScaffoldRoute {
  path: string
  importPath: string // e.g. "./pages/index" (no extension)
  componentName: string
}

// The scaffold ships EVERY .tsx file from this repo's `components/ui/`
// directory — see discoverVendoredUIFiles(). Kept in sync with the full
// shadcn/ui set (45+ components). The `sample-conveter.ts` SUPPORTED_COMPONENTS
// and IMPORT_MAP must cover the same list so the AI Style stage can pick any
// of them without falling back to <div>.
function discoverVendoredUIFiles(): string[] {
  const dir = path.join(process.cwd(), "components", "ui")
  try {
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith(".tsx"))
      .sort()
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

// Generated Vite project's package.json. Deps cover all 45+ vendored shadcn
// components — picking a lower-common-denominator is easier than trying to
// prune per-site, and the whole thing tree-shakes at build time anyway.
const PACKAGE_JSON = {
  name: "generated-site",
  private: true,
  version: "0.0.1",
  type: "module",
  scripts: {
    dev: "vite",
    build: "vite build",
    preview: "vite preview",
  },
  dependencies: {
    react: "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    // Radix primitives powering the shadcn components.
    "@radix-ui/react-accordion": "^1.2.2",
    "@radix-ui/react-alert-dialog": "^1.1.4",
    "@radix-ui/react-aspect-ratio": "^1.1.1",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-checkbox": "^1.1.3",
    "@radix-ui/react-collapsible": "^1.1.2",
    "@radix-ui/react-context-menu": "^2.2.4",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-hover-card": "^1.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-menubar": "^1.1.4",
    "@radix-ui/react-navigation-menu": "^1.2.3",
    "@radix-ui/react-popover": "^1.1.4",
    "@radix-ui/react-progress": "^1.1.1",
    "@radix-ui/react-radio-group": "^1.2.2",
    "@radix-ui/react-scroll-area": "^1.2.2",
    "@radix-ui/react-select": "^2.1.4",
    "@radix-ui/react-separator": "^1.1.1",
    "@radix-ui/react-slider": "^1.2.2",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-switch": "^1.1.2",
    "@radix-ui/react-tabs": "^1.1.2",
    "@radix-ui/react-toggle": "^1.1.1",
    "@radix-ui/react-toggle-group": "^1.1.1",
    "@radix-ui/react-tooltip": "^1.1.6",
    // Other shadcn-component deps.
    "@hookform/resolvers": "^3.9.1",
    cmdk: "^1.0.4",
    "date-fns": "^4.1.0",
    "embla-carousel-react": "^8.5.1",
    "input-otp": "^1.4.1",
    "react-day-picker": "^9.4.1",
    "react-hook-form": "^7.54.0",
    "react-resizable-panels": "^2.1.7",
    sonner: "^1.7.1",
    vaul: "^1.1.2",
    zod: "^3.24.1",
    // Styling utilities.
    "class-variance-authority": "^0.7.1",
    clsx: "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.454.0",
    // HeroIcons — the only icon set the AI is allowed to use. No emoji icons.
    "@heroicons/react": "^2.2.0",
    // recharts powers the shadcn Chart component (registry entry "chart").
    recharts: "^2.13.3",
  },
  devDependencies: {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    autoprefixer: "^10.4.20",
    postcss: "^8.4.49",
    tailwindcss: "^3.4.16",
    "tailwindcss-animate": "^1.0.7",
    typescript: "^5.6.3",
    vite: "^5.4.10",
  },
}

// ---------------------------------------------------------------------------
// Static files (do not change per-generation)
// ---------------------------------------------------------------------------

const VITE_CONFIG_TS = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
`

const TSCONFIG_JSON = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
`

const TSCONFIG_NODE_JSON = `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
`

const TAILWIND_CONFIG_TS = `import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // Sidebar-scoped tokens used by components/ui/sidebar.tsx.
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
`

const POSTCSS_CONFIG_JS = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`

// Locked theme: pure white background + #101010 (HSL 0 0% 6.3%) for dark.
// The AI pipeline never emits custom colour tokens — this ensures every
// generated site matches the Sycord UI (either full-white or #101010 dark).
const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Pure white theme */
    --background: 0 0% 100%;                 /* #ffffff */
    --foreground: 0 0% 6.3%;                 /* #101010 text on white */
    --card: 0 0% 100%;
    --card-foreground: 0 0% 6.3%;
    --popover: 0 0% 100%;
    --popover-foreground: 0 0% 6.3%;
    --primary: 0 0% 6.3%;                    /* #101010 */
    --primary-foreground: 0 0% 100%;         /* white on #101010 */
    --secondary: 0 0% 96%;                   /* very light grey */
    --secondary-foreground: 0 0% 6.3%;
    --muted: 0 0% 96%;
    --muted-foreground: 0 0% 40%;
    --accent: 0 0% 96%;
    --accent-foreground: 0 0% 6.3%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 0 0% 90%;
    --input: 0 0% 90%;
    --ring: 0 0% 6.3%;
    --radius: 0.5rem;
    --sidebar-background: 0 0% 100%;
    --sidebar-foreground: 0 0% 6.3%;
    --sidebar-primary: 0 0% 6.3%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 0 0% 96%;
    --sidebar-accent-foreground: 0 0% 6.3%;
    --sidebar-border: 0 0% 90%;
    --sidebar-ring: 0 0% 6.3%;
    --chart-1: 0 0% 6.3%;
    --chart-2: 0 0% 40%;
    --chart-3: 0 0% 60%;
    --chart-4: 0 0% 80%;
    --chart-5: 0 0% 90%;
  }

  .dark {
    /* #101010 dark theme */
    --background: 0 0% 6.3%;                 /* #101010 */
    --foreground: 0 0% 98%;                  /* near-white */
    --card: 0 0% 6.3%;
    --card-foreground: 0 0% 98%;
    --popover: 0 0% 6.3%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;                     /* light on dark */
    --primary-foreground: 0 0% 6.3%;
    --secondary: 0 0% 12%;
    --secondary-foreground: 0 0% 98%;
    --muted: 0 0% 12%;
    --muted-foreground: 0 0% 65%;
    --accent: 0 0% 12%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 63% 30%;
    --destructive-foreground: 0 0% 98%;
    --border: 0 0% 16%;
    --input: 0 0% 16%;
    --ring: 0 0% 83%;
    --sidebar-background: 0 0% 6.3%;
    --sidebar-foreground: 0 0% 98%;
    --sidebar-primary: 0 0% 98%;
    --sidebar-primary-foreground: 0 0% 6.3%;
    --sidebar-accent: 0 0% 12%;
    --sidebar-accent-foreground: 0 0% 98%;
    --sidebar-border: 0 0% 16%;
    --sidebar-ring: 0 0% 83%;
    --chart-1: 0 0% 98%;
    --chart-2: 0 0% 65%;
    --chart-3: 0 0% 45%;
    --chart-4: 0 0% 30%;
    --chart-5: 0 0% 16%;
  }
}

@layer base {
  * { @apply border-border; }
  html, body { @apply bg-background text-foreground; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    min-height: 100vh;
  }
}
`

// Default to the dark theme so the generated site matches the Sycord UI.
// Users can toggle via `document.documentElement.classList.toggle('dark')`.
const MAIN_TSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

if (typeof document !== 'undefined') {
  document.documentElement.classList.add('dark')
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
)
`

const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated Site</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`

const LIB_UTILS_TS = `import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`

// ---------------------------------------------------------------------------
// Vendored shadcn/ui — read from this repo's own components/ui at request
// time so we don't have to duplicate hundreds of lines of source here.
// ---------------------------------------------------------------------------

function readVendoredUIFile(fileName: string): string | null {
  const source = path.join(process.cwd(), "components", "ui", fileName)
  try {
    const raw = fs.readFileSync(source, "utf-8")
    // shadcn files emitted by Next.js often start with `"use client"` — that's
    // harmless in Vite but adds noise. Strip the directive so the file is
    // obviously a plain module.
    return raw.replace(/^(?:['"]use client['"];?\s*\n)+/, "")
  } catch {
    return null
  }
}

function vendorShadcnFiles(timestamp: number): ScaffoldFile[] {
  const files: ScaffoldFile[] = []
  for (const name of discoverVendoredUIFiles()) {
    const code = readVendoredUIFile(name)
    if (code) {
      files.push({ name: `src/components/ui/${name}`, code, timestamp })
    }
  }
  return files
}

// The sidebar component imports `@/hooks/use-mobile`. We vendor it from the
// repo so the generated project is fully self-contained.
function vendorHooks(timestamp: number): ScaffoldFile[] {
  const src = path.join(process.cwd(), "hooks", "use-mobile.ts")
  try {
    const code = fs.readFileSync(src, "utf-8")
    return [{ name: "src/hooks/use-mobile.ts", code, timestamp }]
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Dynamic files (depend on the plan)
// ---------------------------------------------------------------------------

function buildAppTsx(routes: ScaffoldRoute[]): string {
  const imports = routes
    .map((r) => `import { ${r.componentName} } from '${r.importPath}'`)
    .join("\n")

  const routeEntries = routes
    .map((r) => `        <Route path="${r.path}" element={<${r.componentName} />} />`)
    .join("\n")

  const fallback = routes.length > 0
    ? `        <Route path="*" element={<${routes[0].componentName} />} />`
    : `        <Route path="*" element={<div className="p-8 text-center">Not found</div>} />`

  return `import { Routes, Route } from 'react-router-dom'
import { SiteNav } from './components/site-nav'
${imports}

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <SiteNav />
      <main className="flex-1">
        <Routes>
${routeEntries}
${fallback}
        </Routes>
      </main>
    </div>
  )
}
`
}

// A responsive top-of-page nav linking every planned route.
// Desktop: inline shadcn Buttons. Mobile: Sheet with a Bars3Icon trigger.
function buildSiteNavTsx(routes: ScaffoldRoute[]): string {
  const items = routes
    .map(
      (r) =>
        `  { to: '${r.path}', label: '${escapeJsxText(r.componentName).replace(/'/g, "\\'")}' }`,
    )
    .join(",\n")
  return `import { Link, useLocation } from 'react-router-dom'
import { Bars3Icon } from '@heroicons/react/24/outline'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet'

const NAV_ITEMS = [
${items},
]

export function SiteNav() {
  const { pathname } = useLocation()
  return (
    <nav className="w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="font-semibold tracking-tight">
          {NAV_ITEMS[0]?.label ?? 'Home'}
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to}>
              <Button
                variant={pathname === item.to ? 'secondary' : 'ghost'}
                size="sm"
              >
                {item.label}
              </Button>
            </Link>
          ))}
        </div>
        <div className="md:hidden">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Bars3Icon className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-64">
              <SheetTitle className="mb-4">Menu</SheetTitle>
              <div className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <Link key={item.to} to={item.to}>
                    <Button
                      variant={pathname === item.to ? 'secondary' : 'ghost'}
                      className="w-full justify-start"
                    >
                      {item.label}
                    </Button>
                  </Link>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </nav>
  )
}
`
}

function escapeJsxText(s: string): string {
  return s.replace(/[{}]/g, "")
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Produce every non-page, non-logic file that the generated Vite project
 * needs: package.json, vite.config, tsconfig, tailwind config, index.html,
 * src/main.tsx, src/App.tsx (routed), src/index.css, src/lib/utils.ts and
 * the vendored shadcn UI files.
 *
 * Pages and logic files come from the Style / Logic / Converter stages and
 * are merged in by the orchestrator.
 */
export function buildViteScaffold(routes: ScaffoldRoute[]): ScaffoldFile[] {
  const now = Date.now()
  return [
    { name: "package.json", code: JSON.stringify(PACKAGE_JSON, null, 2) + "\n", timestamp: now },
    { name: "vite.config.ts", code: VITE_CONFIG_TS, timestamp: now },
    { name: "tsconfig.json", code: TSCONFIG_JSON, timestamp: now },
    { name: "tsconfig.node.json", code: TSCONFIG_NODE_JSON, timestamp: now },
    { name: "tailwind.config.ts", code: TAILWIND_CONFIG_TS, timestamp: now },
    { name: "postcss.config.js", code: POSTCSS_CONFIG_JS, timestamp: now },
    { name: "index.html", code: INDEX_HTML, timestamp: now },
    { name: "src/index.css", code: INDEX_CSS, timestamp: now },
    { name: "src/main.tsx", code: MAIN_TSX, timestamp: now },
    { name: "src/App.tsx", code: buildAppTsx(routes), timestamp: now },
    { name: "src/components/site-nav.tsx", code: buildSiteNavTsx(routes), timestamp: now },
    { name: "src/lib/utils.ts", code: LIB_UTILS_TS, timestamp: now },
    ...vendorHooks(now),
    ...vendorShadcnFiles(now),
  ]
}
