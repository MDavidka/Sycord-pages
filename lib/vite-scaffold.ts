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

/**
 * Full list of shadcn/ui components vendored into the generated Vite project.
 * Must be kept in sync with SUPPORTED_COMPONENTS in sample-conveter.ts —
 * every file here corresponds to 1+ supported component names.
 */
const VENDORED_UI_FILES: string[] = [
  "alert-dialog.tsx",
  "alert.tsx",
  "avatar.tsx",
  "badge.tsx",
  "button.tsx",
  "card.tsx",
  "dialog.tsx",
  "dropdown-menu.tsx",
  "input.tsx",
  "label.tsx",
  "progress.tsx",
  "sheet.tsx",
  "skeleton.tsx",
  "switch.tsx",
  "textarea.tsx",
]

// ---------------------------------------------------------------------------
// package.json
// ---------------------------------------------------------------------------

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
    "@radix-ui/react-alert-dialog": "^1.1.4",
    "@radix-ui/react-avatar": "^1.1.1",
    "@radix-ui/react-dialog": "^1.1.4",
    "@radix-ui/react-dropdown-menu": "^2.1.4",
    "@radix-ui/react-label": "^2.1.1",
    "@radix-ui/react-progress": "^1.1.1",
    "@radix-ui/react-slot": "^1.1.1",
    "@radix-ui/react-switch": "^1.1.2",
    "class-variance-authority": "^0.7.1",
    clsx: "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "lucide-react": "^0.454.0",
  },
  devDependencies: {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    autoprefixer: "^10.4.20",
    postcss: "^8.4.49",
    tailwindcss: "^3.4.16",
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
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
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

const INDEX_CSS = `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 46.1%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
}
`

const MAIN_TSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import './index.css'

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
  for (const name of VENDORED_UI_FILES) {
    const code = readVendoredUIFile(name)
    if (code) {
      files.push({ name: `src/components/ui/${name}`, code, timestamp })
    }
  }
  return files
}

// ---------------------------------------------------------------------------
// Dynamic files (depend on the plan)
// ---------------------------------------------------------------------------

function buildAppTsx(routes: ScaffoldRoute[]): string {
  const imports = routes
    .map((r) => `import { ${r.componentName} } from '${r.importPath}'`)
    .join("\n")

  // React Router route entries. The plan's "/" becomes the index route, others
  // become their own <Route path="..." />.
  const routeEntries = routes
    .map((r) => {
      const routePath = r.path === "/" ? "/" : r.path
      return `      <Route path="${routePath}" element={<${r.componentName} />} />`
    })
    .join("\n")

  const fallback = routes.length > 0
    ? `      <Route path="*" element={<${routes[0].componentName} />} />`
    : `      <Route path="*" element={<div className="p-8 text-center">Not found</div>} />`

  return `import { Routes, Route } from 'react-router-dom'
${imports}

export default function App() {
  return (
    <Routes>
${routeEntries}
${fallback}
    </Routes>
  )
}
`
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
    { name: "src/lib/utils.ts", code: LIB_UTILS_TS, timestamp: now },
    ...vendorShadcnFiles(now),
  ]
}
