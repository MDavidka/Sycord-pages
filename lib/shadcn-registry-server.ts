import fs from "node:fs/promises"
import path from "node:path"
import { normalizeComponentName, normalizeShadcnImportPaths, scanMissingShadcnImports } from "@/lib/shadcn-shared"

export { normalizeComponentName, scanMissingShadcnImports }

const REGISTRY_BASE = "https://ui.shadcn.com/r/styles/new-york"
const WORKSPACE_ROOT = process.cwd()

export type RegistryFile = {
  path: string
  content: string
}

export type ResolveShadcnResult = {
  component: string
  files: RegistryFile[]
  dependencies: Record<string, string>
  source: "registry" | "local"
  installed: string[]
}

type RegistryItem = {
  name?: string
  type?: string
  dependencies?: string[]
  registryDependencies?: string[]
  files?: Array<{ path: string; content: string; type?: string }>
}

/** Default npm versions for packages referenced by shadcn/ui components. */
export const SHADCN_PACKAGE_VERSIONS: Record<string, string> = {
  "@radix-ui/react-accordion": "1.2.2",
  "@radix-ui/react-alert-dialog": "1.1.4",
  "@radix-ui/react-aspect-ratio": "1.1.1",
  "@radix-ui/react-avatar": "1.1.2",
  "@radix-ui/react-checkbox": "1.1.3",
  "@radix-ui/react-collapsible": "1.1.2",
  "@radix-ui/react-context-menu": "2.2.4",
  "@radix-ui/react-dialog": "1.1.6",
  "@radix-ui/react-dropdown-menu": "2.1.6",
  "@radix-ui/react-hover-card": "1.1.4",
  "@radix-ui/react-label": "2.1.2",
  "@radix-ui/react-menubar": "1.1.4",
  "@radix-ui/react-navigation-menu": "1.2.3",
  "@radix-ui/react-popover": "1.1.4",
  "@radix-ui/react-progress": "1.1.1",
  "@radix-ui/react-radio-group": "1.2.2",
  "@radix-ui/react-scroll-area": "1.2.2",
  "@radix-ui/react-select": "2.1.6",
  "@radix-ui/react-separator": "1.1.1",
  "@radix-ui/react-slider": "1.2.2",
  "@radix-ui/react-slot": "1.1.2",
  "@radix-ui/react-switch": "1.1.3",
  "@radix-ui/react-tabs": "1.1.3",
  "@radix-ui/react-toast": "1.2.4",
  "@radix-ui/react-toggle": "1.1.1",
  "@radix-ui/react-toggle-group": "1.1.1",
  "@radix-ui/react-tooltip": "1.1.6",
  "@hookform/resolvers": "^3.9.0",
  "class-variance-authority": "^0.7.1",
  "cmdk": "^1.0.4",
  "date-fns": "^3.6.0",
  "embla-carousel-react": "^8.5.1",
  "input-otp": "^1.4.1",
  "react-day-picker": "^8.10.1",
  "react-hook-form": "^7.54.0",
  "recharts": "^2.15.0",
  "sonner": "^1.7.1",
  "tailwindcss-animate": "^1.0.7",
  "vaul": "^1.1.2",
  "zod": "^3.24.1",
  "@tanstack/react-table": "^8.20.5",
}


function normalizeRegistryPath(registryPath: string): string {
  const cleaned = registryPath.replace(/^\/+/, "")
  if (cleaned.startsWith("components/")) return cleaned
  if (cleaned.startsWith("lib/")) return cleaned
  if (cleaned.startsWith("ui/")) return `components/${cleaned}`
  return cleaned
}

function versionForPackage(pkg: string): string {
  return SHADCN_PACKAGE_VERSIONS[pkg] ?? "^1.0.0"
}

function collectDependencies(items: string[] | undefined): Record<string, string> {
  const out: Record<string, string> = {}
  for (const pkg of items ?? []) {
    out[pkg] = versionForPackage(pkg)
  }
  return out
}

async function fetchRegistryItem(component: string): Promise<RegistryItem | null> {
  const url = `${REGISTRY_BASE}/${encodeURIComponent(component)}.json`
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "Syra-AI/1.0 (shadcn-registry)" },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) return null
    return (await res.json()) as RegistryItem
  } catch {
    return null
  }
}

async function readLocalComponent(component: string): Promise<RegistryItem | null> {
  const localPath = path.join(WORKSPACE_ROOT, "components", "ui", `${component}.tsx`)
  try {
    const content = await fs.readFile(localPath, "utf8")
    const deps = new Set<string>()
    const importRe = /from ["']([^"']+)["']/g
    let match: RegExpExecArray | null
    while ((match = importRe.exec(content))) {
      const mod = match[1]
      if (
        mod.startsWith("@radix-ui/") ||
        mod === "class-variance-authority" ||
        mod === "cmdk" ||
        mod === "vaul" ||
        mod === "embla-carousel-react" ||
        mod === "react-hook-form" ||
        mod === "@hookform/resolvers/zod" ||
        mod.startsWith("@hookform/") ||
        mod === "zod" ||
        mod === "input-otp" ||
        mod === "sonner" ||
        mod === "recharts" ||
        mod === "react-day-picker" ||
        mod === "date-fns" ||
        mod.startsWith("@tanstack/")
      ) {
        deps.add(mod.replace(/\/zod$/, "").replace(/\/react-table$/, "@tanstack/react-table"))
      }
    }
    return {
      name: component,
      type: "registry:ui",
      dependencies: Array.from(deps),
      files: [{ path: `components/ui/${component}.tsx`, content, type: "registry:ui" }],
    }
  } catch {
    return null
  }
}

async function loadRegistryItem(component: string): Promise<{ item: RegistryItem; source: "registry" | "local" } | null> {
  const registryItem = await fetchRegistryItem(component)
  if (registryItem?.files?.length) {
    return { item: registryItem, source: "registry" }
  }
  const localItem = await readLocalComponent(component)
  if (localItem?.files?.length) {
    return { item: localItem, source: "local" }
  }
  return null
}

type ResolveState = {
  files: Map<string, string>
  dependencies: Record<string, string>
  installed: string[]
  visiting: Set<string>
}

async function resolveComponentTree(component: string, state: ResolveState): Promise<void> {
  if (state.visiting.has(component)) return
  state.visiting.add(component)

  const loaded = await loadRegistryItem(component)
  if (!loaded) {
    throw new Error(`Component "${component}" not found in shadcn registry or local fallback`)
  }

  for (const dep of loaded.item.registryDependencies ?? []) {
    const depName = normalizeComponentName(dep)
    await resolveComponentTree(depName, state)
  }

  for (const file of loaded.item.files ?? []) {
    const projectPath = normalizeRegistryPath(file.path)
    const normalized = normalizeShadcnImportPaths(file.content)
    state.files.set(projectPath, normalized.content)
    if (projectPath.startsWith("components/ui/")) {
      const name = path.basename(projectPath).replace(/\.(tsx|ts)$/, "")
      if (!state.installed.includes(name)) state.installed.push(name)
    }
  }

  Object.assign(state.dependencies, collectDependencies(loaded.item.dependencies))
  if (!state.installed.includes(component)) state.installed.push(component)
}

/** Resolve one or more shadcn components with registry + dependency tree expansion. */
export async function resolveShadcnComponents(names: string[]): Promise<ResolveShadcnResult[]> {
  const normalized = [...new Set(names.map(normalizeComponentName).filter(Boolean))]
  const results: ResolveShadcnResult[] = []

  for (const component of normalized) {
    const state: ResolveState = {
      files: new Map(),
      dependencies: {},
      installed: [],
      visiting: new Set(),
    }

    await resolveComponentTree(component, state)

    const loaded = await loadRegistryItem(component)
    results.push({
      component,
      files: Array.from(state.files.entries()).map(([path, content]) => ({ path, content })),
      dependencies: state.dependencies,
      source: loaded?.source ?? "registry",
      installed: state.installed.sort(),
    })
  }

  return results
}
