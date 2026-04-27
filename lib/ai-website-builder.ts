import { promises as fs } from "node:fs"
import path from "node:path"
import { z } from "zod"

import { callModel, extractJson, type ChatMessage, type ModelSelection } from "@/lib/ai-provider"

export interface GeneratedFile {
  path: string
  content: string
}

export interface AIWebsiteBuilderResult {
  files: GeneratedFile[]
  build: {
    status: "passed" | "failed" | "skipped"
    logs: string[]
  }
  logs: string[]
  previewUrl: string | null
}

interface ComponentsCatalog {
  components: Array<{
    name: string
    import_path: string
    exports: string[]
  }>
}

const PLAN_SCHEMA = z.object({
  projectName: z.string().min(2),
  siteType: z.enum(["commerce", "saas", "portfolio", "dashboard", "blog", "docs", "agency", "other"]),
  targetAudience: z.string().min(2),
  brandStyle: z.string().min(2),
  pages: z.array(z.object({
    path: z.string().min(1),
    title: z.string().min(1),
    purpose: z.string().min(1),
    sections: z.array(z.string().min(1)).min(1),
    features: z.array(z.string().min(1)).min(1),
    primaryAction: z.string().min(1),
    layoutHint: z.string().min(1),
    componentsNeeded: z.array(z.string().min(1)).min(1),
  })).min(1),
})

type AIPlan = z.infer<typeof PLAN_SCHEMA>

type UIJsonNode = {
  name: string
  props?: Record<string, unknown>
  children?: Array<UIJsonNode | string>
}

type PageUITree = {
  type: "ui-tree"
  version: string
  component: UIJsonNode
}

interface ManifestPage {
  route: string
  filePath: string
  componentName: string
  metadataTitle: string
  metadataDescription: string
  purpose: string
  sections: string[]
  features: string[]
  primaryAction: string
  layoutHint: string
  allowedComponents: string[]
}

interface ProjectManifest {
  projectName: string
  siteType: AIPlan["siteType"]
  brandStyle: string
  targetAudience: string
  navStyle: string
  footerStyle: string
  motionStyle: string
  routes: ManifestPage[]
}

const PLANNER_SYSTEM_PROMPT = `You are the planning brain of a v0-style AI website builder. Analyze the user request deeply and create a real multi-page website plan. Do not guess generic pages. Decide the pages, sections, components, layout direction, and interactions based on the user prompt.

Return strict JSON only.`

const PAGE_SYSTEM_PROMPT = `You are the page JSON generator of a v0-style AI website builder.

Generate only JSON for the current page body.

Rules:
- output JSON only
- no TSX
- no markdown
- no imports
- no global header/footer
- mobile-first
- use only verified shadcn components from components.json
- use Framer Motion wrappers only when useful
- include all planned sections and features`

const COMPONENT_SUPPORT_RULES: Record<string, string[]> = {
  Card: ["CardHeader", "CardTitle", "CardContent"],
  Accordion: ["AccordionItem", "AccordionTrigger", "AccordionContent"],
  Tabs: ["TabsList", "TabsTrigger", "TabsContent"],
  Table: ["TableHeader", "TableBody", "TableRow", "TableHead", "TableCell"],
  Dialog: ["DialogTrigger", "DialogContent", "DialogHeader", "DialogTitle", "DialogFooter"],
}

const DEFAULT_GOOGLE_MODEL: ModelSelection = {
  id: "gemini-3.1-pro-preview",
  provider: "Google",
  name: "Gemini 3.1 Pro Preview",
}

export async function runAIWebsiteBuilder(userPrompt: string): Promise<AIWebsiteBuilderResult> {
  const logs: string[] = []
  logs.push("Starting AI website builder pipeline.")

  const componentsCatalog = await loadComponentsCatalog()
  logs.push(`Loaded components.json (${componentsCatalog.components.length} shadcn entries).`)

  const plan = await buildPlan(userPrompt)
  const manifest = buildManifest(plan)
  logs.push(`Built manifest with ${manifest.routes.length} routes.`)

  const routeComponents = buildRouteComponents(plan, manifest, componentsCatalog)

  const files = scaffoldProjectFiles(manifest)

  for (const page of manifest.routes) {
    const pagePlan = plan.pages.find((p) => normalizeRoute(p.path) === page.route)
    if (!pagePlan) continue

    const allowedComponents = routeComponents.get(page.route) ?? []
    logs.push(`Generating JSON UI tree for ${page.route} using ${allowedComponents.length} allowed components.`)

    let uiTree = await generatePageUIJson({
      userPrompt,
      page,
      manifest,
      pagePlan,
      allowedComponents,
    })

    const validation = validatePageTree({ uiTree, page, componentsCatalog, pagePlan })
    if (!validation.valid) {
      logs.push(`Initial page JSON validation failed for ${page.route}: ${validation.reasons.join(" | ")}`)
      uiTree = await repairPageUIJson({
        userPrompt,
        page,
        manifest,
        pagePlan,
        allowedComponents,
        uiTree,
        reasons: validation.reasons,
      })

      const secondPass = validatePageTree({ uiTree, page, componentsCatalog, pagePlan })
      if (!secondPass.valid) {
        logs.push(`Repair failed for ${page.route}, using safe fallback layout.`)
        uiTree = buildSafeFallbackTree(page)
      }
    }

    const pageFile = convertUIJsonToPageFile({
      page,
      uiTree,
      componentsCatalog,
    })

    files.push({ path: page.filePath, content: pageFile })
  }

  files.push({ path: "lib/generated-manifest.ts", content: generateManifestFile(manifest) })

  const build = {
    status: "skipped" as const,
    logs: [
      "Build was not executed by this function.",
      "Generated output is intended for a Next.js app-router project scaffold.",
    ],
  }

  return {
    files,
    build,
    logs,
    previewUrl: null,
  }
}

async function loadComponentsCatalog(): Promise<ComponentsCatalog> {
  const raw = await fs.readFile(path.join(process.cwd(), "components.json"), "utf8")
  const parsed = JSON.parse(raw) as ComponentsCatalog
  return {
    components: parsed.components ?? [],
  }
}

function parseRequestedPageCount(prompt: string): number | null {
  const singlePage = /\b(single page|one page|1 page|landing page only)\b/i.test(prompt)
  if (singlePage) return 1
  const match = prompt.match(/\b(\d{1,2})\s*pages?\b/i)
  return match ? Number(match[1]) : null
}

async function buildPlan(userPrompt: string): Promise<AIPlan> {
  const requestedPages = parseRequestedPageCount(userPrompt)
  const pageRule = requestedPages ? `Generate exactly ${requestedPages} pages.` : "Generate 4 to 7 pages."

  const planUserPrompt = `${userPrompt}\n\nOutput schema:\n{
  "projectName": "...",
  "siteType": "commerce | saas | portfolio | dashboard | blog | docs | agency | other",
  "targetAudience": "...",
  "brandStyle": "...",
  "pages": [
    {
      "path": "/",
      "title": "Home",
      "purpose": "...",
      "sections": ["...", "..."],
      "features": ["...", "..."],
      "primaryAction": "...",
      "layoutHint": "...",
      "componentsNeeded": ["Button", "Card", "Badge"]
    }
  ]
}\n\nRules:\n- ${pageRule}\n- first page must be /\n- every page must have unique purpose\n- no lorem ipsum\n- no filler`

  const messages: ChatMessage[] = [
    { role: "system", content: PLANNER_SYSTEM_PROMPT },
    { role: "user", content: planUserPrompt },
  ]

  const result = await callModel({
    model: { ...DEFAULT_GOOGLE_MODEL, id: "gemini-3.1-flash-preview", name: "Gemini 3.1 Flash" },
    messages,
    temperature: 0.2,
  })

  if (!result.ok) {
    throw new Error(`Planner model call failed: ${result.message} ${result.details ?? ""}`)
  }

  const parsed = extractJson<unknown>(result.content)
  const plan = PLAN_SCHEMA.parse(parsed)

  return normalizePlan(plan, requestedPages)
}

function normalizePlan(plan: AIPlan, requestedPages: number | null): AIPlan {
  const pages = plan.pages.map((p, index) => ({
    ...p,
    path: normalizeRoute(index === 0 ? "/" : p.path),
    sections: uniqueStrings(p.sections),
    features: uniqueStrings(p.features),
    componentsNeeded: uniqueStrings(p.componentsNeeded),
  }))

  const uniqueByPurpose = new Set<string>()
  const deduped = pages.filter((page) => {
    const key = page.purpose.trim().toLowerCase()
    if (uniqueByPurpose.has(key)) return false
    uniqueByPurpose.add(key)
    return true
  })

  const limited = requestedPages ? deduped.slice(0, requestedPages) : deduped.slice(0, 7)
  const minPages = requestedPages ?? 4

  while (limited.length < minPages) {
    const n = limited.length + 1
    limited.push({
      path: n === 1 ? "/" : `/page-${n}`,
      title: n === 1 ? "Home" : `Page ${n}`,
      purpose: n === 1 ? "Primary conversion landing experience" : `Support content page ${n}`,
      sections: ["Hero", "Core value", "Proof", "Action"],
      features: ["Responsive layout", "Clear CTA", "Accessible typography"],
      primaryAction: "Get started",
      layoutHint: "Stacked sections with action at top and bottom",
      componentsNeeded: ["Button", "Card", "Badge"],
    })
  }

  return {
    ...plan,
    pages: limited,
  }
}

function buildManifest(plan: AIPlan): ProjectManifest {
  return {
    projectName: slugify(plan.projectName),
    siteType: plan.siteType,
    brandStyle: plan.brandStyle,
    targetAudience: plan.targetAudience,
    navStyle: "minimal-sticky",
    footerStyle: "multi-column",
    motionStyle: "fade-stagger",
    routes: plan.pages.map((page) => ({
      route: normalizeRoute(page.path),
      filePath: routeToFilePath(page.path),
      componentName: routeToComponentName(page.path),
      metadataTitle: `${page.title} | ${plan.projectName}`,
      metadataDescription: page.purpose,
      purpose: page.purpose,
      sections: page.sections,
      features: page.features,
      primaryAction: page.primaryAction,
      layoutHint: page.layoutHint,
      allowedComponents: page.componentsNeeded,
    })),
  }
}

function buildRouteComponents(
  plan: AIPlan,
  manifest: ProjectManifest,
  catalog: ComponentsCatalog,
): Map<string, string[]> {
  const available = new Set<string>()
  for (const component of catalog.components) {
    available.add(component.name)
    component.exports.forEach((exp) => available.add(exp))
  }

  const result = new Map<string, string[]>()

  for (const page of plan.pages) {
    const route = normalizeRoute(page.path)
    const raw = page.componentsNeeded.filter((name) => available.has(name))
    const expanded = new Set(raw)

    for (const name of raw) {
      const supports = COMPONENT_SUPPORT_RULES[name]
      if (!supports) continue
      for (const support of supports) {
        if (available.has(support)) expanded.add(support)
      }
    }

    // Always allow common primitives.
    for (const base of ["Button", "Badge"]) {
      if (available.has(base)) expanded.add(base)
    }

    result.set(route, [...expanded])

    const routeMeta = manifest.routes.find((r) => r.route === route)
    if (routeMeta) routeMeta.allowedComponents = [...expanded]
  }

  return result
}

function scaffoldProjectFiles(manifest: ProjectManifest): GeneratedFile[] {
  return [
    { path: "package.json", content: packageTemplate(manifest) },
    { path: "next.config.ts", content: `import type { NextConfig } from "next"\n\nconst nextConfig: NextConfig = {}\n\nexport default nextConfig\n` },
    { path: "tsconfig.json", content: tsconfigTemplate() },
    { path: "tailwind.config.ts", content: tailwindTemplate() },
    { path: "postcss.config.js", content: `module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }\n` },
    { path: "components.json", content: "{}\n" },
    { path: "app/globals.css", content: globalsCssTemplate() },
    { path: "app/layout.tsx", content: layoutTemplate(manifest) },
    { path: "components/site-header.tsx", content: siteHeaderTemplate(manifest) },
    { path: "components/site-footer.tsx", content: siteFooterTemplate(manifest) },
    { path: "components/motion/fade-in.tsx", content: motionFadeInTemplate() },
    { path: "components/motion/stagger.tsx", content: motionStaggerTemplate() },
    { path: "components/motion/motion-card.tsx", content: motionCardTemplate() },
    { path: "lib/utils.ts", content: `import { clsx, type ClassValue } from "clsx"\nimport { twMerge } from "tailwind-merge"\n\nexport function cn(...inputs: ClassValue[]) {\n  return twMerge(clsx(inputs))\n}\n` },
    { path: "lib/site-config.ts", content: siteConfigTemplate(manifest) },
  ]
}

async function generatePageUIJson(args: {
  userPrompt: string
  page: ManifestPage
  manifest: ProjectManifest
  pagePlan: AIPlan["pages"][number]
  allowedComponents: string[]
}): Promise<PageUITree> {
  const userMessage = `Context:\nUser prompt: ${args.userPrompt}\nPage plan: ${JSON.stringify(args.pagePlan)}\nManifest: ${JSON.stringify({ projectName: args.manifest.projectName, route: args.page.route, siteType: args.manifest.siteType })}\nAllowed components: ${JSON.stringify(args.allowedComponents)}\n\nTask:\nGenerate the UI JSON tree for this page.`

  const result = await callModel({
    model: DEFAULT_GOOGLE_MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: PAGE_SYSTEM_PROMPT },
      { role: "user", content: userMessage },
    ],
  })

  if (!result.ok) return buildSafeFallbackTree(args.page)

  const parsed = extractJson<PageUITree>(result.content)
  if (!parsed || parsed.type !== "ui-tree" || !parsed.component?.name) {
    return buildSafeFallbackTree(args.page)
  }

  return parsed
}

async function repairPageUIJson(args: {
  userPrompt: string
  page: ManifestPage
  manifest: ProjectManifest
  pagePlan: AIPlan["pages"][number]
  allowedComponents: string[]
  uiTree: PageUITree
  reasons: string[]
}): Promise<PageUITree> {
  const repairPrompt = `Repair this JSON tree so it follows all rules.\nReasons: ${args.reasons.join("; ")}\nTree: ${JSON.stringify(args.uiTree)}\nAllowed components: ${JSON.stringify(args.allowedComponents)}\nPage plan: ${JSON.stringify(args.pagePlan)}\nReturn JSON only.`

  const result = await callModel({
    model: DEFAULT_GOOGLE_MODEL,
    temperature: 0.1,
    messages: [
      { role: "system", content: PAGE_SYSTEM_PROMPT },
      { role: "user", content: repairPrompt },
    ],
  })

  if (!result.ok) return args.uiTree

  const parsed = extractJson<PageUITree>(result.content)
  if (!parsed || parsed.type !== "ui-tree") return args.uiTree

  return parsed
}

function validatePageTree(args: {
  uiTree: PageUITree
  page: ManifestPage
  componentsCatalog: ComponentsCatalog
  pagePlan: AIPlan["pages"][number]
}): { valid: boolean; reasons: string[] } {
  const reasons: string[] = []

  if (!args.uiTree.component || !args.uiTree.component.name) {
    reasons.push("missing root component")
  }

  const available = new Set<string>(["main", "section", "div", "h1", "h2", "h3", "p", "span", "ul", "li", "img"])
  for (const component of args.componentsCatalog.components) {
    available.add(component.name)
    component.exports.forEach((exp) => available.add(exp))
  }

  const usedNames = collectNodeNames(args.uiTree.component)
  const invalidNames = usedNames.filter((name) => !available.has(name))
  if (invalidNames.length > 0) reasons.push(`invalid components: ${invalidNames.join(", ")}`)

  if (usedNames.includes("SiteHeader") || usedNames.includes("SiteFooter")) {
    reasons.push("header/footer duplication")
  }

  const textContent = collectText(args.uiTree.component).toLowerCase()
  const pageTitleLower = args.page.metadataTitle.toLowerCase().split("|")[0].trim()
  if (!textContent.includes(pageTitleLower)) reasons.push("page title missing")

  for (const section of args.pagePlan.sections) {
    if (!textContent.includes(section.toLowerCase())) {
      reasons.push(`missing section: ${section}`)
    }
  }

  if (!textContent.includes("px-4") && !textContent.includes("max-w")) {
    reasons.push("mobile-first layout hint not detected")
  }

  const handlerNames = collectHandlerNames(args.uiTree.component)
  if (handlerNames.some((name) => !/^\$handler\.[A-Za-z0-9_]+$/.test(name))) {
    reasons.push("invalid handler names")
  }

  return {
    valid: reasons.length === 0,
    reasons,
  }
}

function buildSafeFallbackTree(page: ManifestPage): PageUITree {
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "px-4 py-12 md:py-20" },
      children: [
        {
          name: "section",
          props: { className: "mx-auto max-w-5xl space-y-4" },
          children: [
            { name: "h1", props: { className: "text-3xl font-bold" }, children: [page.metadataTitle.split("|")[0].trim()] },
            { name: "p", props: { className: "text-muted-foreground" }, children: [page.purpose] },
          ],
        },
        {
          name: "section",
          props: { className: "mx-auto mt-8 max-w-5xl grid gap-4 sm:grid-cols-2" },
          children: page.sections.slice(0, 4).map((section) => ({
            name: "Card",
            props: { className: "p-4" },
            children: [
              { name: "h2", props: { className: "font-semibold" }, children: [section] },
              { name: "p", props: { className: "text-sm text-muted-foreground mt-2" }, children: [`${section} content and supporting feature details.`] },
            ],
          })),
        },
      ],
    },
  }
}

function convertUIJsonToPageFile(args: {
  page: ManifestPage
  uiTree: PageUITree
  componentsCatalog: ComponentsCatalog
}): string {
  const usedHandlers = new Set<string>(collectHandlerNames(args.uiTree.component).map((s) => s.replace("$handler.", "")))
  const clientMode = usedHandlers.size > 0

  const importMap = collectImports(args.uiTree.component, args.componentsCatalog)
  importMap.set("@/components/motion/fade-in", [...new Set([...(importMap.get("@/components/motion/fade-in") ?? []), "FadeIn"])])

  const importLines = [...importMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([importPath, names]) => `import { ${[...new Set(names)].sort().join(", ")} } from "${importPath}"`)

  if (clientMode) importLines.unshift("import { useRouter } from \"next/navigation\"")
  importLines.unshift("import type { Metadata } from \"next\"")

  const jsx = renderNode(args.uiTree.component, 4)

  const handlersBlock = clientMode ? renderHandlers(usedHandlers) : ""

  return `${clientMode ? '"use client"\n\n' : ""}${importLines.join("\n")}\n\nexport const metadata: Metadata = {\n  title: ${JSON.stringify(args.page.metadataTitle)},\n  description: ${JSON.stringify(args.page.metadataDescription)},\n}\n\nexport default function ${args.page.componentName}() {\n${clientMode ? "  const router = useRouter()\n\n" : ""}${handlersBlock}${clientMode ? "\n" : ""}  return (\n${jsx}\n  )\n}\n`
}

function renderHandlers(handlers: Set<string>): string {
  const lines: string[] = []

  for (const handler of handlers) {
    if (handler === "addToCart") {
      lines.push(`  const addToCart = (itemId: string) => {\n    const key = "v0-builder-cart"\n    const current = JSON.parse(localStorage.getItem(key) ?? "[]") as string[]\n    if (!current.includes(itemId)) current.push(itemId)\n    localStorage.setItem(key, JSON.stringify(current))\n    router.push("/checkout")\n  }`)
      continue
    }
    if (handler === "submitContact") {
      lines.push(`  const submitContact = async (formData: FormData) => {\n    const payload = Object.fromEntries(formData.entries())\n    const key = "v0-builder-contact-submissions"\n    const current = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown[]\n    localStorage.setItem(key, JSON.stringify([...current, payload]))\n    router.push("/thank-you")\n  }`)
      continue
    }
    if (handler === "subscribeNewsletter") {
      lines.push(`  const subscribeNewsletter = async (formData: FormData) => {\n    const email = String(formData.get("email") ?? "").trim()\n    if (!email) return\n    const key = "v0-builder-newsletter"\n    const current = JSON.parse(localStorage.getItem(key) ?? "[]") as string[]\n    if (!current.includes(email)) current.push(email)\n    localStorage.setItem(key, JSON.stringify(current))\n  }`)
      continue
    }
    if (handler === "searchSupport") {
      lines.push(`  const searchSupport = (formData: FormData) => {\n    const query = String(formData.get("query") ?? "").trim()\n    const target = query ? "/support?query=" + encodeURIComponent(query) : "/support"\n    router.push(target)\n  }`)
      continue
    }
    if (handler === "startCheckout") {
      lines.push(`  const startCheckout = () => {\n    router.push("/checkout")\n  }`)
      continue
    }

    lines.push(`  const ${handler} = async (formData: FormData) => {\n    const payload = Object.fromEntries(formData.entries())\n    const key = "v0-builder-handler-${handler}"\n    localStorage.setItem(key, JSON.stringify(payload))\n  }`)
  }

  return lines.join("\n\n")
}

function renderNode(node: UIJsonNode | string, indent: number): string {
  const pad = " ".repeat(indent)
  if (typeof node === "string") return `${pad}${JSON.stringify(node)}`

  const props = node.props ?? {}
  const propsEntries = Object.entries(props).filter(([, value]) => value !== undefined)

  const propsText = propsEntries
    .map(([key, value]) => `${key}={${propValueToJs(value)}}`)
    .join(" ")

  const open = propsText ? `<${node.name} ${propsText}>` : `<${node.name}>`

  const children = node.children ?? []
  if (children.length === 0) {
    return `${pad}${open}</${node.name}>`
  }

  const renderedChildren = children.map((child) => renderNode(child, indent + 2)).join("\n")
  return `${pad}${open}\n${renderedChildren}\n${pad}</${node.name}>`
}

function propValueToJs(value: unknown): string {
  if (typeof value === "string") {
    if (value.startsWith("$handler.")) {
      const fn = value.replace("$handler.", "")
      return fn
    }
    if (value.startsWith("$state.")) {
      return JSON.stringify([])
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return JSON.stringify(value)
  if (typeof value === "object" && value !== null) return JSON.stringify(value)
  return String(value)
}

function collectImports(node: UIJsonNode, catalog: ComponentsCatalog): Map<string, string[]> {
  const importMap = new Map<string, string[]>()

  const exportToPath = new Map<string, string>()
  for (const component of catalog.components) {
    for (const exp of component.exports) exportToPath.set(exp, component.import_path)
    exportToPath.set(component.name, component.import_path)
  }

  for (const name of collectNodeNames(node)) {
    const importPath = exportToPath.get(name)
    if (!importPath) continue
    const existing = importMap.get(importPath) ?? []
    existing.push(name)
    importMap.set(importPath, existing)
  }

  return importMap
}

function collectNodeNames(node: UIJsonNode | string): string[] {
  if (typeof node === "string") return []
  const out = [node.name]
  for (const child of node.children ?? []) {
    out.push(...collectNodeNames(child))
  }
  return out
}

function collectText(node: UIJsonNode | string): string {
  if (typeof node === "string") return node
  const propText = Object.values(node.props ?? {}).filter((v) => typeof v === "string").join(" ")
  return [propText, ...(node.children ?? []).map((child) => collectText(child))].join(" ")
}

function collectHandlerNames(node: UIJsonNode | string): string[] {
  if (typeof node === "string") return []
  const handlers = Object.values(node.props ?? {})
    .filter((v): v is string => typeof v === "string" && v.startsWith("$handler."))

  return [...handlers, ...(node.children ?? []).flatMap((child) => collectHandlerNames(child))]
}

function generateManifestFile(manifest: ProjectManifest): string {
  return `export const generatedManifest = ${JSON.stringify(manifest, null, 2)} as const\n`
}

function normalizeRoute(route: string): string {
  const clean = route.trim()
  if (!clean || clean === "/") return "/"
  return `/${clean.replace(/^\/+/, "").replace(/\/+$/, "")}`
}

function routeToFilePath(route: string): string {
  const normalized = normalizeRoute(route)
  if (normalized === "/") return "app/page.tsx"
  return `app${normalized}/page.tsx`
}

function routeToComponentName(route: string): string {
  if (normalizeRoute(route) === "/") return "HomePage"
  return `${normalizeRoute(route).replace(/^\//, "").split("/").map((s) => capitalize(s.replace(/[^a-zA-Z0-9]/g, ""))).join("")}Page`
}

function uniqueStrings(values: string[]): string[] {
  const set = new Set<string>()
  for (const value of values) {
    const trimmed = value.trim()
    if (!trimmed) continue
    set.add(trimmed)
  }
  return [...set]
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "ai-website"
}

function capitalize(value: string): string {
  return value ? value[0].toUpperCase() + value.slice(1) : value
}

function packageTemplate(manifest: ProjectManifest): string {
  return JSON.stringify({
    name: manifest.projectName,
    private: true,
    version: "0.1.0",
    scripts: {
      dev: "next dev",
      build: "next build",
      start: "next start",
      lint: "next lint",
    },
    dependencies: {
      next: "latest",
      react: "latest",
      "react-dom": "latest",
      "framer-motion": "latest",
      clsx: "latest",
      "tailwind-merge": "latest",
    },
    devDependencies: {
      typescript: "latest",
      tailwindcss: "latest",
      autoprefixer: "latest",
      postcss: "latest",
      "@types/node": "latest",
      "@types/react": "latest",
      "@types/react-dom": "latest",
    },
  }, null, 2) + "\n"
}

function tsconfigTemplate(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      lib: ["dom", "dom.iterable", "esnext"],
      allowJs: false,
      skipLibCheck: true,
      strict: true,
      noEmit: true,
      module: "esnext",
      moduleResolution: "bundler",
      resolveJsonModule: true,
      isolatedModules: true,
      jsx: "preserve",
      incremental: true,
      paths: { "@/*": ["./*"] },
    },
    include: ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
    exclude: ["node_modules"],
  }, null, 2) + "\n"
}

function tailwindTemplate(): string {
  return `import type { Config } from "tailwindcss"\n\nconst config: Config = {\n  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],\n  theme: {\n    extend: {},\n  },\n  plugins: [],\n}\n\nexport default config\n`
}

function globalsCssTemplate(): string {
  return `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  color-scheme: dark;\n}\n\nbody {\n  @apply bg-background text-foreground antialiased;\n}\n`
}

function layoutTemplate(manifest: ProjectManifest): string {
  return `import type { Metadata } from "next"\nimport "./globals.css"\n\nimport { SiteHeader } from "@/components/site-header"\nimport { SiteFooter } from "@/components/site-footer"\n\nexport const metadata: Metadata = {\n  title: "${manifest.projectName}",\n  description: ${JSON.stringify(manifest.targetAudience)},\n}\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body className=\"min-h-screen bg-background text-foreground\">\n        <SiteHeader />\n        {children}\n        <SiteFooter />\n      </body>\n    </html>\n  )\n}\n`
}

function siteHeaderTemplate(manifest: ProjectManifest): string {
  const links = manifest.routes
    .map((route) => ({
      href: route.route,
      label: route.metadataTitle.split("|")[0].trim(),
    }))

  return `import Link from "next/link"\n\nimport { Button } from "@/components/ui/button"\n\nconst navItems = ${JSON.stringify(links, null, 2)}\n\nexport function SiteHeader() {\n  return (\n    <header className=\"sticky top-0 z-50 border-b border-border/60 bg-background/95 backdrop-blur\">\n      <div className=\"mx-auto flex h-14 max-w-6xl items-center justify-between px-4\">\n        <Link href=\"/\" className=\"font-semibold\">${manifest.projectName}</Link>\n        <nav className=\"hidden items-center gap-3 md:flex\">\n          {navItems.map((item) => (\n            <Link key={item.href} href={item.href} className=\"text-sm text-muted-foreground hover:text-foreground\">\n              {item.label}\n            </Link>\n          ))}\n        </nav>\n        <Button asChild size=\"sm\"><Link href=\"/\">${manifest.routes[0]?.primaryAction ?? "Get started"}</Link></Button>\n      </div>\n    </header>\n  )\n}\n`
}

function siteFooterTemplate(manifest: ProjectManifest): string {
  return `import Link from "next/link"\n\nconst navItems = ${JSON.stringify(manifest.routes.map((r) => ({ href: r.route, label: r.metadataTitle.split("|")[0].trim() })), null, 2)}\n\nexport function SiteFooter() {\n  return (\n    <footer className=\"border-t border-border/60 py-10\">\n      <div className=\"mx-auto grid max-w-6xl gap-8 px-4 sm:grid-cols-2\">\n        <div>\n          <p className=\"text-sm font-medium\">${manifest.projectName}</p>\n          <p className=\"mt-2 text-sm text-muted-foreground\">${manifest.brandStyle}</p>\n        </div>\n        <div className=\"grid grid-cols-2 gap-2 text-sm\">\n          {navItems.map((item) => (\n            <Link key={item.href} href={item.href} className=\"text-muted-foreground hover:text-foreground\">\n              {item.label}\n            </Link>\n          ))}\n        </div>\n      </div>\n    </footer>\n  )\n}\n`
}

function motionFadeInTemplate(): string {
  return `"use client"\n\nimport { motion } from "framer-motion"\n\nexport function FadeIn({ children, className }: { children: React.ReactNode; className?: string }) {\n  return (\n    <motion.div\n      className={className}\n      initial={{ opacity: 0, y: 10 }}\n      whileInView={{ opacity: 1, y: 0 }}\n      viewport={{ once: true, margin: "-80px" }}\n      transition={{ duration: 0.45, ease: "easeOut" }}\n    >\n      {children}\n    </motion.div>\n  )\n}\n`
}

function motionStaggerTemplate(): string {
  return `"use client"\n\nimport { motion } from "framer-motion"\n\nexport function Stagger({ children, className }: { children: React.ReactNode; className?: string }) {\n  return (\n    <motion.div\n      className={className}\n      initial=\"hidden\"\n      whileInView=\"show\"\n      viewport={{ once: true, margin: "-80px" }}\n      variants={{\n        hidden: {},\n        show: { transition: { staggerChildren: 0.08 } },\n      }}\n    >\n      {children}\n    </motion.div>\n  )\n}\n`
}

function motionCardTemplate(): string {
  return `"use client"\n\nimport { motion } from "framer-motion"\n\nexport function MotionCard({ children, className }: { children: React.ReactNode; className?: string }) {\n  return (\n    <motion.div\n      className={className}\n      whileHover={{ y: -4 }}\n      transition={{ type: "spring", stiffness: 280, damping: 24 }}\n    >\n      {children}\n    </motion.div>\n  )\n}\n`
}

function siteConfigTemplate(manifest: ProjectManifest): string {
  return `export const siteConfig = {\n  name: ${JSON.stringify(manifest.projectName)},\n  description: ${JSON.stringify(manifest.targetAudience)},\n  siteType: ${JSON.stringify(manifest.siteType)},\n  navStyle: ${JSON.stringify(manifest.navStyle)},\n  footerStyle: ${JSON.stringify(manifest.footerStyle)},\n  motionStyle: ${JSON.stringify(manifest.motionStyle)},\n} as const\n`
}
