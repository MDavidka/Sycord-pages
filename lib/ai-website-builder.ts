import { promises as fs } from "fs"
import path from "path"
import { callModel, extractJson, type ChatMessage } from "@/lib/ai-provider"

export interface PlannedPage {
  path: string
  title: string
  purpose: string
  sections: string[]
  features: string[]
  primaryAction: string
  layoutHint: string
  componentsNeeded: string[]
}

export interface WebsitePlan {
  projectName: string
  siteType: string
  targetAudience: string
  brandStyle: string
  globalFeatures: string[]
  pages: PlannedPage[]
}

export interface ManifestPage extends PlannedPage {
  filePath: string
  componentName: string
  description: string
  metadata: {
    title: string
    description: string
  }
}

export interface ProjectManifest {
  projectName: string
  siteType: string
  brandStyle: string
  pages: ManifestPage[]
  theme: { tone: string; radius: string }
  chrome: { navStyle: string; footerStyle: string }
  motion: { profile: string }
}

interface BuilderFile {
  path: string
  content: string
}

export interface PipelineLog {
  step: string
  fn: string
  status: "running" | "completed" | "failed" | "fallback"
  detail: string
  durationMs?: number
  error?: string
}

interface RunBuilderResult {
  manifest: ProjectManifest
  files: BuilderFile[]
  logs: PipelineLog[]
  build: { ok: boolean; errors: string[]; attempts: number }
}

export class BuilderPipelineError extends Error {
  logs: PipelineLog[]
  failingFn: string

  constructor(message: string, failingFn: string, logs: PipelineLog[]) {
    super(message)
    this.name = "BuilderPipelineError"
    this.failingFn = failingFn
    this.logs = logs
  }
}

interface ComponentEntry {
  name: string
  import_path: string
  exports: string[]
  composition?: string
  purpose?: string
}

interface PageJson {
  type: "ui-tree"
  version: string
  component: {
    name: string
    props?: Record<string, string>
    children?: Array<{
      name: string
      props?: Record<string, string>
      copy?: string
      className?: string
      children?: Array<{ name: string; copy?: string; className?: string }>
    }>
  }
}

const GOOGLE_PLANNER_MODEL = { id: "gemini-3.1-flash-preview", provider: "Google" }
const GOOGLE_PAGE_MODEL = { id: "gemini-3.1-flash-preview", provider: "Google" }

async function callAIAgent(
  messages: ChatMessage[],
  opts: { temperature?: number; retries?: number; mode?: "planner" | "page" } = {},
) {
  const temperature = opts.temperature ?? 0.2
  const retries = opts.retries ?? (opts.mode === "page" ? 1 : 2)
  const model = opts.mode === "page" ? GOOGLE_PAGE_MODEL : GOOGLE_PLANNER_MODEL

  let lastError = "Unknown AI error"
  for (let i = 0; i <= retries; i++) {
    const res = await callModel({ model, messages, temperature })
    if (res.ok) return res.content
    lastError = `${res.message}${res.details ? `: ${res.details}` : ""}`
  }
  throw new Error(lastError)
}

function slugToComponentName(routePath: string) {
  if (routePath === "/") return "HomePage"
  return `${routePath.replace(/^\//, "").split("/").map((s) => s.split("-").map((p) => p[0]?.toUpperCase() + p.slice(1)).join("")).join("")}Page`
}

function routeToFilePath(routePath: string) {
  return routePath === "/" ? "app/page.tsx" : `app${routePath}/page.tsx`
}

function sanitizeRoute(routePath: string) {
  const cleaned = `/${routePath.replace(/^\/+/, "").replace(/[^a-zA-Z0-9\-/]/g, "").toLowerCase()}`
  return cleaned === "/" ? "/" : cleaned.replace(/\/$/, "")
}

function fallbackPlan(prompt: string): WebsitePlan {
  const baseName = prompt.split(" ").slice(0, 3).join(" ") || "Sycord Site"
  return {
    projectName: baseName,
    siteType: "business",
    targetAudience: "general customers",
    brandStyle: "clean modern mobile-first",
    globalFeatures: ["mobile nav", "cta buttons", "contact options"],
    pages: [
      {
        path: "/",
        title: "Home",
        purpose: "Introduce the brand and primary value proposition.",
        sections: ["Hero", "Highlights", "Proof", "CTA"],
        features: ["primary CTA", "secondary CTA", "feature cards"],
        primaryAction: "Get Started",
        layoutHint: "landing",
        componentsNeeded: ["Button", "Card", "Badge", "Separator"],
      },
      {
        path: "/features",
        title: "Features",
        purpose: "Show product capabilities and benefits.",
        sections: ["Feature Grid", "Use Cases", "Comparison", "CTA"],
        features: ["feature cards", "comparison table", "cta"],
        primaryAction: "Try Features",
        layoutHint: "catalog",
        componentsNeeded: ["Card", "Badge", "Button", "Tabs", "Table"],
      },
      {
        path: "/contact",
        title: "Contact",
        purpose: "Capture inquiries and support requests.",
        sections: ["Intro", "Contact Form", "Channels", "FAQ"],
        features: ["submit contact", "faq accordion"],
        primaryAction: "Send Message",
        layoutHint: "contact",
        componentsNeeded: ["Card", "Input", "Textarea", "Button", "Accordion", "Label"],
      },
    ],
  }
}

async function planWebsite(userPrompt: string): Promise<WebsitePlan> {
  const content = await callAIAgent(
    [
      {
        role: "system",
        content:
          "You are the planning brain of a v0-style AI website builder. Analyze deeply and return strict JSON only with 4-7 pages unless user asked fewer.",
      },
      { role: "user", content: userPrompt },
    ],
    { mode: "planner" },
  )

  const parsed = extractJson<WebsitePlan>(content)
  const base = parsed && parsed.pages?.length ? parsed : fallbackPlan(userPrompt)

  const seen = new Set<string>()
  const pages = base.pages.slice(0, 7).map((p, i) => {
    const cleaned = sanitizeRoute(p.path || `/${p.title || `page-${i + 1}`}`)
    const route = seen.has(cleaned) ? `${cleaned}-${i + 1}` : cleaned
    seen.add(route)
    return {
      ...p,
      path: i === 0 ? "/" : route,
      sections: (p.sections || []).slice(0, 8),
      features: (p.features || []).slice(0, 8),
      componentsNeeded: (p.componentsNeeded || []).slice(0, 10),
    }
  })

  return {
    ...base,
    pages: pages.length ? pages : fallbackPlan(userPrompt).pages,
  }
}

function buildManifest(plan: WebsitePlan): ProjectManifest {
  const pages: ManifestPage[] = plan.pages.map((p) => ({
    ...p,
    filePath: routeToFilePath(p.path),
    componentName: slugToComponentName(p.path),
    description: p.purpose,
    metadata: {
      title: `${p.title} | ${plan.projectName}`,
      description: p.purpose,
    },
  }))

  return {
    projectName: plan.projectName,
    siteType: plan.siteType,
    brandStyle: plan.brandStyle,
    pages,
    theme: { tone: plan.brandStyle, radius: "rounded-xl" },
    chrome: { navStyle: plan.siteType, footerStyle: "simple" },
    motion: { profile: "soft-reveal" },
  }
}

async function loadComponentLibrary(): Promise<ComponentEntry[]> {
  for (const file of ["component.json", "components.json"]) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), file), "utf8")
      const parsed = JSON.parse(raw) as {
        components?: Array<{ name?: string; import_path?: string; exports?: string[]; composition?: string; purpose?: string }>
      }
      if (!parsed.components?.length) continue
      return parsed.components
        .filter((c) => c.name && c.import_path)
        .map((c) => ({
          name: c.name as string,
          import_path: c.import_path as string,
          exports: c.exports || [c.name as string],
          composition: c.composition,
          purpose: c.purpose,
        }))
    } catch {
      // try next file
    }
  }
  return []
}

function addCompositionExports(component: ComponentEntry) {
  if (component.name === "Card") {
    component.exports = Array.from(
      new Set([...component.exports, "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"]),
    )
  }
  if (component.name === "Accordion") {
    component.exports = Array.from(
      new Set([...component.exports, "AccordionItem", "AccordionTrigger", "AccordionContent"]),
    )
  }
  if (component.name === "Tabs") {
    component.exports = Array.from(new Set([...component.exports, "TabsList", "TabsTrigger", "TabsContent"]))
  }
}

function buildComponentSubset(page: ManifestPage, library: ComponentEntry[]) {
  const index = new Map(library.map((c) => [c.name.toLowerCase(), { ...c }]))
  const subset: ComponentEntry[] = []
  for (const wanted of page.componentsNeeded.map((c) => c.toLowerCase())) {
    const hit = index.get(wanted)
    if (!hit) continue
    addCompositionExports(hit)
    subset.push(hit)
  }
  return subset
}

async function generatePageJson(
  userPrompt: string,
  page: ManifestPage,
  manifest: ProjectManifest,
  componentSubset: ComponentEntry[],
): Promise<PageJson> {
  const content = await callAIAgent(
    [
      {
        role: "system",
        content:
          "You are the page JSON generator of a v0-style AI website builder. Generate only JSON for one page body. No markdown. No TSX. No global header/footer/nav.",
      },
      {
        role: "user",
        content: JSON.stringify({
          userPrompt,
          page,
          manifestSummary: {
            projectName: manifest.projectName,
            routes: manifest.pages.map((p) => ({ path: p.path, title: p.title })),
          },
          components: componentSubset,
          allowedMotionWrappers: ["FadeIn", "Stagger", "MotionCard"],
        }),
      },
    ],
    { temperature: 0.3, mode: "page" },
  )

  const parsed = extractJson<PageJson>(content)
  if (parsed?.type === "ui-tree" && parsed.component) {
    return parsed
  }

  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: page.sections.map((section) => ({
        name: "section",
        copy: section,
        className: "px-4 py-10 sm:px-6 lg:px-8",
      })),
    },
  }
}

function fallbackPageJson(page: ManifestPage): PageJson {
  return {
    type: "ui-tree",
    version: "1.0",
    component: {
      name: "main",
      props: { className: "min-h-screen bg-background text-foreground" },
      children: page.sections.map((section) => ({
        name: "section",
        copy: section,
        className: "px-4 py-10 sm:px-6 lg:px-8",
      })),
    },
  }
}

function validatePageJson(json: PageJson, page: ManifestPage, routes: string[]) {
  const errors: string[] = []
  if (json.type !== "ui-tree") errors.push("root must be ui-tree")
  if (!json.component?.name) errors.push("missing root component")
  if ((json.component.children?.length ?? 0) < 4) errors.push("at least 4 sections are required")
  const body = JSON.stringify(json).toLowerCase()
  if (body.includes("lorem ipsum")) errors.push("contains lorem ipsum")
  if (body.includes("siteheader") || body.includes("sitefooter")) errors.push("contains global chrome")
  if (!body.includes(page.title.toLowerCase()) && !body.includes(page.primaryAction.toLowerCase())) {
    errors.push("missing page identity")
  }
  if (body.includes('"href":"/') && !routes.some((r) => body.includes(`\"href\":\"${r}`))) {
    errors.push("contains link not in manifest routes")
  }
  return errors
}

function renderSection(section: string, cta: string) {
  return `
      <section className="px-4 py-10 sm:px-6 sm:py-14 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-6xl space-y-4">
          <FadeIn>
            <Badge variant="secondary" className="w-fit">${section}</Badge>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">${section}</h2>
            <p className="text-muted-foreground">Built mobile-first with production-ready responsive behavior.</p>
            <Button asChild><Link href="#">${cta}</Link></Button>
          </FadeIn>
        </div>
      </section>`
}

function convertToPageFile(manifest: ProjectManifest, page: ManifestPage, json: PageJson): string {
  const sectionNodes = json.component.children?.map((c) => c.copy || c.name) || page.sections
  const sectionMarkup = sectionNodes.map((s) => renderSection(String(s), page.primaryAction)).join("\n")

  return `import Link from "next/link"
import type { Metadata } from "next"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { FadeIn } from "@/components/motion/fade-in"

export const metadata: Metadata = {
  title: ${JSON.stringify(page.metadata.title)},
  description: ${JSON.stringify(page.metadata.description)},
}

export default function ${page.componentName}() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <section className="px-4 py-10 sm:px-6 sm:py-16 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-6xl space-y-4">
          <Badge>${manifest.projectName}</Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-6xl">${page.title}</h1>
          <p className="max-w-2xl text-base text-muted-foreground sm:text-lg">${page.description}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild><Link href="#">${page.primaryAction}</Link></Button>
            <Button asChild variant="outline"><Link href="/">Back home</Link></Button>
          </div>
        </div>
      </section>
${sectionMarkup}
    </main>
  )
}
`
}

function createSiteHeader(manifest: ProjectManifest) {
  const links = manifest.pages.map((p) => `<Link href="${p.path}" className="text-sm text-muted-foreground hover:text-foreground">${p.title}</Link>`).join("\n            ")
  const mobileLinks = manifest.pages.map((p) => `<Link href="${p.path}" className="block py-2 text-base">${p.title}</Link>`).join("\n            ")
  return `"use client"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="font-semibold">${manifest.projectName}</Link>
        <nav className="hidden items-center gap-4 md:flex">
            ${links}
        </nav>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="md:hidden">Menu</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full max-w-none sm:w-80 sm:max-w-sm">
            <nav className="mt-8 space-y-1">
            ${mobileLinks}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
`
}

function createSiteFooter(manifest: ProjectManifest) {
  const links = manifest.pages.map((p) => `<Link href="${p.path}" className="text-sm text-muted-foreground hover:text-foreground">${p.title}</Link>`).join("\n            ")
  return `import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-8 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} ${manifest.projectName}. All rights reserved.</p>
        <div className="flex flex-wrap gap-3">${links}</div>
      </div>
    </footer>
  )
}
`
}

function scaffoldFiles(manifest: ProjectManifest): BuilderFile[] {
  const navLinks = manifest.pages.map((p) => `{ href: "${p.path}", label: "${p.title}" }`).join(", ")
  return [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: manifest.projectName.toLowerCase().replace(/[^a-z0-9-]+/g, "-") || "generated-site",
          private: true,
          scripts: { dev: "next dev", build: "next build", start: "next start" },
          dependencies: {
            next: "latest",
            react: "latest",
            "react-dom": "latest",
            "framer-motion": "latest",
          },
        },
        null,
        2,
      ),
    },
    { path: "next.config.ts", content: "const nextConfig = {}\nexport default nextConfig\n" },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            lib: ["dom", "dom.iterable", "es2022"],
            strict: true,
            jsx: "preserve",
            moduleResolution: "bundler",
            baseUrl: ".",
            paths: { "@/*": ["./*"] },
          },
          include: ["**/*.ts", "**/*.tsx"],
        },
        null,
        2,
      ),
    },
    {
      path: "tailwind.config.ts",
      content: "export default { content: [\"./app/**/*.{ts,tsx}\", \"./components/**/*.{ts,tsx}\"] }\n",
    },
    { path: "postcss.config.js", content: "module.exports = { plugins: { tailwindcss: {}, autoprefixer: {} } }\n" },
    {
      path: "app/layout.tsx",
      content:
        "import type { Metadata } from \"next\"\nimport \"./globals.css\"\nimport { SiteHeader } from \"@/components/site-header\"\nimport { SiteFooter } from \"@/components/site-footer\"\n\nexport const metadata: Metadata = { title: \"Generated Site\", description: \"AI generated website\" }\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html lang=\"en\">\n      <body className=\"bg-background text-foreground\">\n        <SiteHeader />\n        {children}\n        <SiteFooter />\n      </body>\n    </html>\n  )\n}\n",
    },
    {
      path: "app/globals.css",
      content: "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n:root{color-scheme:light dark;}\n",
    },
    { path: "components/site-header.tsx", content: createSiteHeader(manifest) },
    { path: "components/site-footer.tsx", content: createSiteFooter(manifest) },
    {
      path: "components/motion/fade-in.tsx",
      content:
        '"use client"\nimport { motion } from "framer-motion"\nexport function FadeIn({ children }: { children: React.ReactNode }) { return <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}>{children}</motion.div> }\n',
    },
    {
      path: "components/motion/stagger.tsx",
      content:
        '"use client"\nimport { motion } from "framer-motion"\nexport function Stagger({ children }: { children: React.ReactNode }) { return <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}>{children}</motion.div> }\n',
    },
    {
      path: "components/motion/motion-card.tsx",
      content:
        '"use client"\nimport { motion } from "framer-motion"\nexport function MotionCard({ children }: { children: React.ReactNode }) { return <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>{children}</motion.div> }\n',
    },
    {
      path: "lib/utils.ts",
      content: "export function cn(...values: Array<string | undefined | false | null>) { return values.filter(Boolean).join(' ') }\n",
    },
    {
      path: "lib/site-config.ts",
      content: `export const siteConfig = { name: ${JSON.stringify(manifest.projectName)}, links: [${navLinks}] }\n`,
    },
    {
      path: "lib/generated-manifest.ts",
      content: `import type { ProjectManifest } from \"@/lib/ai-website-builder\"\nexport const generatedManifest: ProjectManifest = ${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: "lib/actions/contact-actions.ts",
      content:
        "export async function submitContact(formData: FormData) { const name = String(formData.get(\"name\") || \"Guest\"); return { ok: true, message: `Thanks ${name}, we will contact you shortly.` } }\n",
    },
    {
      path: "lib/actions/cart-actions.ts",
      content:
        "export function addToCart(current: string[], item: string) { return Array.from(new Set([...current, item])) }\nexport function removeFromCart(current: string[], item: string) { return current.filter((x) => x !== item) }\n",
    },
  ]
}

function runBuildValidation(files: BuilderFile[]) {
  const errors: string[] = []
  const fileMap = new Map(files.map((f) => [f.path, f.content]))

  for (const must of ["app/layout.tsx", "app/globals.css", "components/site-header.tsx", "components/site-footer.tsx"]) {
    if (!fileMap.has(must)) errors.push(`Missing required file: ${must}`)
  }

  for (const [filePath, content] of fileMap) {
    if (!content.trim()) errors.push(`Empty file: ${filePath}`)
    if (content.includes("TODO")) errors.push(`Found TODO in ${filePath}`)
    if (filePath.endsWith(".tsx") && !content.includes("export default") && !filePath.includes("components/")) {
      errors.push(`Route file missing default export: ${filePath}`)
    }
  }

  return { ok: errors.length === 0, errors, attempts: 1 }
}

export async function runAIWebsiteBuilder(userPrompt: string): Promise<RunBuilderResult> {
  const logs: PipelineLog[] = []
  const begin = (fn: string, detail: string) => {
    const entry: PipelineLog = { step: "runAIWebsiteBuilder", fn, status: "running", detail }
    logs.push(entry)
    return { entry, started: Date.now() }
  }

  const complete = (ctx: { entry: PipelineLog; started: number }, detail?: string) => {
    ctx.entry.status = "completed"
    ctx.entry.durationMs = Date.now() - ctx.started
    if (detail) ctx.entry.detail = detail
  }

  const fail = (ctx: { entry: PipelineLog; started: number }, error: unknown) => {
    ctx.entry.status = "failed"
    ctx.entry.durationMs = Date.now() - ctx.started
    ctx.entry.error = error instanceof Error ? error.message : String(error)
  }

  try {
    const planning = begin("planning", "Generating AI site plan")
    const plan = await planWebsite(userPrompt)
    complete(planning, `Planned ${plan.pages.length} pages`)

    const manifestStep = begin("manifest", "Building deterministic manifest")
    const manifest = buildManifest(plan)
    complete(manifestStep, `Manifest ready with ${manifest.pages.length} routes`)

    const componentContext = begin("componentContext", "Loading component source-of-truth")
    const library = await loadComponentLibrary()
    complete(componentContext, `Loaded ${library.length} component definitions`)

    const scaffoldStep = begin("scaffold", "Generating Next.js base files")
    const files: BuilderFile[] = [...scaffoldFiles(manifest)]
    complete(scaffoldStep, `Scaffolded ${files.length} base files`)

    for (const page of manifest.pages) {
      const jsonStep = begin("generatePageJson", `Generating JSON for ${page.path}`)
      const subset = buildComponentSubset(page, library)
      const rawJson = await generatePageJson(userPrompt, page, manifest, subset)
      files.push({
        path: `.sycord/page-json${page.path === "/" ? "/home" : page.path}.json`,
        content: JSON.stringify(rawJson, null, 2),
      })
      complete(jsonStep, `Generated JSON for ${page.path} using ${subset.length} components`)

      const validateStep = begin("validatePageJson", `Validating ${page.path}`)
      const errors = validatePageJson(rawJson, page, manifest.pages.map((p) => p.path))
      complete(validateStep, errors.length ? `Validation found ${errors.length} issue(s)` : "Validation passed")

      const usableJson = errors.length ? fallbackPageJson(page) : rawJson
      if (errors.length) {
        logs.push({
          step: "runAIWebsiteBuilder",
          fn: "fallback",
          status: "fallback",
          detail: `Fallback for ${page.path}: ${errors.join("; ")}`,
        })
      }

      const convertStep = begin("convert", `Converting ${page.path} into ${page.filePath}`)
      files.push({ path: page.filePath, content: convertToPageFile(manifest, page, usableJson) })
      complete(convertStep, `Generated ${page.filePath}`)
    }

    const buildStep = begin("buildValidation", "Checking generated project output")
    const build = runBuildValidation(files)
    complete(buildStep, build.ok ? "Build validation passed" : `Build validation failed with ${build.errors.length} error(s)`)

    logs.push({
      step: "runAIWebsiteBuilder",
      fn: "done",
      status: "completed",
      detail: `Generated ${files.length} files`,
    })

    return { manifest, files, logs, build }
  } catch (error) {
    const running = [...logs].reverse().find((log) => log.status === "running")
    if (running) {
      fail({ entry: running, started: Date.now() }, error)
    }
    const failingFn = running?.fn || "unknown"
    throw new BuilderPipelineError(
      `Builder failed in ${failingFn}: ${error instanceof Error ? error.message : String(error)}`,
      failingFn,
      logs,
    )
  }
}
