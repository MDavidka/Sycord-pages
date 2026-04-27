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

interface PipelineLog {
  step: string
  detail: string
}

interface RunBuilderResult {
  manifest: ProjectManifest
  files: BuilderFile[]
  logs: PipelineLog[]
  build: { ok: boolean; errors: string[]; attempts: number }
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
    children?: Array<{ name: string; copy?: string; className?: string }>
  }
}

const PLANNER_MODEL = { id: "gemini-3.1-flash-preview", provider: "Google" }
const PAGE_MODEL = { id: "gemini-3.1-pro-preview", provider: "Google" }

async function callAIAgent(messages: ChatMessage[], temperature = 0.2, retries = 2) {
  let lastError = "Unknown AI error"
  for (let i = 0; i <= retries; i++) {
    const res = await callModel({
      model: i === 0 ? PLANNER_MODEL : PAGE_MODEL,
      messages,
      temperature,
    })
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
        sections: ["hero", "highlights", "proof", "cta"],
        features: ["primary CTA", "secondary CTA", "feature cards"],
        primaryAction: "Get Started",
        layoutHint: "landing",
        componentsNeeded: ["Button", "Card", "Badge", "Separator"],
      },
      {
        path: "/features",
        title: "Features",
        purpose: "Show product capabilities and benefits.",
        sections: ["feature grid", "use cases", "comparison", "cta"],
        features: ["feature cards", "comparison table", "cta"],
        primaryAction: "Try Features",
        layoutHint: "catalog",
        componentsNeeded: ["Card", "Badge", "Button", "Tabs", "Table"],
      },
      {
        path: "/contact",
        title: "Contact",
        purpose: "Capture inquiries and support requests.",
        sections: ["intro", "contact form", "channels", "faq"],
        features: ["submit contact", "faq accordion"],
        primaryAction: "Send Message",
        layoutHint: "contact",
        componentsNeeded: ["Card", "Input", "Textarea", "Button", "Accordion", "Label"],
      },
    ],
  }
}

async function planWebsite(userPrompt: string): Promise<WebsitePlan> {
  const content = await callAIAgent([
    {
      role: "system",
      content: "You are the planning brain of a v0-style AI website builder. Return strict JSON only.",
    },
    { role: "user", content: userPrompt },
  ], 0.2)

  const parsed = extractJson<WebsitePlan>(content)
  const base = parsed && parsed.pages?.length ? parsed : fallbackPlan(userPrompt)

  const seen = new Set<string>()
  const pages = base.pages
    .slice(0, 7)
    .map((p, i) => {
      const cleaned = sanitizeRoute(p.path || `/${p.title || `page-${i + 1}`}`)
      const route = seen.has(cleaned) ? `${cleaned}-${i + 1}` : cleaned
      seen.add(route)
      return {
        ...p,
        path: i === 0 ? "/" : route,
        sections: (p.sections || []).slice(0, 8),
        features: (p.features || []).slice(0, 8),
        componentsNeeded: (p.componentsNeeded || []).slice(0, 8),
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
  const candidates = ["component.json", "components.json"]
  for (const file of candidates) {
    try {
      const raw = await fs.readFile(path.join(process.cwd(), file), "utf8")
      const parsed = JSON.parse(raw) as { components?: Array<{ name?: string; import_path?: string; exports?: string[]; composition?: string; purpose?: string }> }
      if (parsed.components?.length) {
        return parsed.components
          .filter((c) => c.name && c.import_path)
          .map((c) => ({
            name: c.name as string,
            import_path: c.import_path as string,
            exports: c.exports || [c.name as string],
            composition: c.composition,
            purpose: c.purpose,
          }))
      }
    } catch {
      // continue
    }
  }
  return []
}

function buildComponentSubset(page: ManifestPage, library: ComponentEntry[]) {
  const index = new Map(library.map((c) => [c.name.toLowerCase(), c]))
  const wanted = new Set(page.componentsNeeded.map((c) => c.toLowerCase()))
  const subset: ComponentEntry[] = []

  for (const key of wanted) {
    const hit = index.get(key)
    if (!hit) continue
    subset.push(hit)
    if (hit.name === "Card") {
      hit.exports = Array.from(new Set([...hit.exports, "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter"]))
    }
  }

  return subset
}

async function generatePageJson(userPrompt: string, page: ManifestPage, manifest: ProjectManifest, componentSubset: ComponentEntry[]): Promise<PageJson> {
  const content = await callAIAgent([
    {
      role: "system",
      content: "Generate only JSON page body. Output strict JSON only. Root type must be ui-tree.",
    },
    {
      role: "user",
      content: JSON.stringify({
        userPrompt,
        page,
        routes: manifest.pages.map((p) => p.path),
        components: componentSubset,
        allowedMotion: ["FadeIn", "Stagger", "MotionCard"],
      }),
    },
  ], 0.3)

  const parsed = extractJson<PageJson>(content)
  if (parsed?.type === "ui-tree" && parsed.component) return parsed

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

function validatePageJson(json: PageJson, page: ManifestPage) {
  const errors: string[] = []
  if (json.type !== "ui-tree") errors.push("root must be ui-tree")
  if (!json.component?.name) errors.push("missing root component")
  const count = json.component?.children?.length ?? 0
  if (count < 4) errors.push("need at least 4 sections")
  const body = JSON.stringify(json).toLowerCase()
  if (body.includes("lorem ipsum")) errors.push("contains lorem ipsum")
  if (body.includes("siteheader") || body.includes("sitefooter")) errors.push("should not include global chrome")
  if (!body.includes(page.title.toLowerCase()) && !body.includes(page.primaryAction.toLowerCase())) {
    errors.push("page identity not represented")
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
            <p className="text-muted-foreground">Built for mobile first browsing with scalable desktop polish.</p>
            <Button asChild><Link href="#">${cta}</Link></Button>
          </FadeIn>
        </div>
      </section>`
}

function convertToPageFile(manifest: ProjectManifest, page: ManifestPage, json: PageJson): string {
  const sectionNodes = json.component.children?.map((c) => c.copy || c.name) || page.sections
  const sectionMarkup = sectionNodes.map((s) => renderSection(s, page.primaryAction)).join("\n")

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

function scaffoldFiles(manifest: ProjectManifest): BuilderFile[] {
  const navLinks = manifest.pages.map((p) => `{ href: "${p.path}", label: "${p.title}" }`).join(", ")
  const siteConfig = `export const siteConfig = { name: ${JSON.stringify(manifest.projectName)}, links: [${navLinks}] }\n`
  return [
    {
      path: "components/motion/fade-in.tsx",
      content: `"use client"\nimport { motion } from "framer-motion"\nexport function FadeIn({ children }: { children: React.ReactNode }) { return <motion.div initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.35 }}>{children}</motion.div> }\n`,
    },
    {
      path: "components/motion/stagger.tsx",
      content: `"use client"\nimport { motion } from "framer-motion"\nexport function Stagger({ children }: { children: React.ReactNode }) { return <motion.div initial="hidden" whileInView="show" viewport={{ once: true }} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08 } } }}>{children}</motion.div> }\n`,
    },
    {
      path: "components/motion/motion-card.tsx",
      content: `"use client"\nimport { motion } from "framer-motion"\nexport function MotionCard({ children }: { children: React.ReactNode }) { return <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>{children}</motion.div> }\n`,
    },
    { path: "lib/site-config.ts", content: siteConfig },
    {
      path: "lib/generated-manifest.ts",
      content: `import type { ProjectManifest } from "@/lib/ai-website-builder"\nexport const generatedManifest: ProjectManifest = ${JSON.stringify(manifest, null, 2)}\n`,
    },
    {
      path: "lib/actions/contact-actions.ts",
      content: `export async function submitContact(formData: FormData) { const name = String(formData.get("name") || "Guest"); return { ok: true, message: \`Thanks \${name}, we will contact you shortly.\` } }\n`,
    },
    {
      path: "lib/actions/cart-actions.ts",
      content: `export function addToCart(current: string[], item: string) { return Array.from(new Set([...current, item])) }\nexport function removeFromCart(current: string[], item: string) { return current.filter((x) => x !== item) }\n`,
    },
  ]
}

function runBuildValidation(files: BuilderFile[]) {
  const errors: string[] = []
  const paths = new Set(files.map((f) => f.path))
  if (!paths.has("components/motion/fade-in.tsx")) errors.push("Missing fade-in motion wrapper")
  const todo = files.find((f) => f.content.includes("TODO"))
  if (todo) errors.push(`Found TODO in ${todo.path}`)
  return { ok: errors.length === 0, errors, attempts: 1 }
}

export async function runAIWebsiteBuilder(userPrompt: string): Promise<RunBuilderResult> {
  const logs: PipelineLog[] = []

  logs.push({ step: "planning", detail: "Generating AI site plan" })
  const plan = await planWebsite(userPrompt)

  logs.push({ step: "manifest", detail: "Building deterministic manifest" })
  const manifest = buildManifest(plan)

  logs.push({ step: "components", detail: "Loading component source-of-truth" })
  const library = await loadComponentLibrary()

  logs.push({ step: "scaffold", detail: "Generating static scaffold files" })
  const files: BuilderFile[] = [...scaffoldFiles(manifest)]

  for (const page of manifest.pages) {
    logs.push({ step: "page-json", detail: `Generating ${page.path} JSON` })
    const subset = buildComponentSubset(page, library)
    const pageJson = await generatePageJson(userPrompt, page, manifest, subset)

    logs.push({ step: "validate", detail: `Validating ${page.path}` })
    const errors = validatePageJson(pageJson, page)
    const usableJson = errors.length
      ? {
          type: "ui-tree" as const,
          version: "1.0",
          component: { name: "main", children: page.sections.map((s) => ({ name: "section", copy: s })) },
        }
      : pageJson

    logs.push({ step: "convert", detail: `Converting ${page.path} to TSX` })
    files.push({ path: page.filePath, content: convertToPageFile(manifest, page, usableJson) })
  }

  logs.push({ step: "build", detail: "Running deterministic validation" })
  const build = runBuildValidation(files)

  return { manifest, files, logs, build }
}
