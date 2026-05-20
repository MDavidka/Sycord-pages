// ============================================================
// Syra Website Builder — Orchestrator (v2)
//
// 3-Node AI Pipeline:
//
//   Node A: callNodeA(prompt) → SiteArchitecture
//           Establishes routes, DB schema, global theme.
//
//   Node B: callNodeB(route, arch) × N (concurrent) → PageUITree[]
//           Generates primitive JSON AST per route.
//
//   Node C: callNodeC(arch, pageTrees) → ServerActionPlan
//           Bridges UI forms to database server actions.
//
//   Compiler (deterministic, no AI):
//           Traverses JSON trees → writes .tsx files.
//
//   Scaffold + validate → RunBuilderResult
// ============================================================

import { callModel, extractJson, type ChatMessage, type ModelSelection } from "@/lib/ai-provider"

import type {
  BuilderFile,
  BuilderOptions,
  ComponentNode,
  CtaPlan,
  EnvVarRequirement,
  GeneratedProjectManifest,
  IntegrationKind,
  IntegrationPlan,
  NavLink,
  PageUITree,
  PipelineLog,
  ProjectContext,
  RequiredComponent,
  RouteProgress,
  RunBuilderResult,
  ServerActionPlan,
  SiteArchitecture,
  StateVar,
  ThemePreset,
  ThemeTokens,
} from "./types"
import { buildTheme, detectPresetFromPrompt, THEME_PRESETS } from "./themes"
import { NODE_A_SYSTEM_PROMPT, NODE_B_SYSTEM_PROMPT, NODE_C_SYSTEM_PROMPT, DESIGN_DIRECTION_PROMPT, REPAIR_PROMPT } from "./prompts"
import { DESIGN_DIRECTION_SYSTEM_PROMPT, fallbackDesignDirection, normalizeDesignDirection, type DesignDirection } from "./design-directions"
import { computeQualityScore, runBuildValidation } from "./validate"
import { ALL_UI_COMPONENTS, buildUiComponentFiles, scaffoldBaseFiles, computeInitials } from "./scaffold"
import { compileAllPages, routeToFilePath } from "./compiler"

// Re-export types so callers can `import { ... } from "@/lib/ai-website-builder"`.
export type {
  BuilderOptions,
  DesignDirection,
  EnvVarRequirement,
  GeneratedProjectManifest,
  IntegrationPlan,
  PageUITree,
  ProjectContext,
  RouteProgress,
  RunBuilderResult,
  SiteArchitecture,
  ThemeTokens,
} from "./types"

// ─── Model selection ──────────────────────────────────────────────────────────

const FALLBACK_MODEL: ModelSelection = { id: "gemini-3.1-flash-preview", provider: "Google" }
const DEFAULT_BEST_MODEL: ModelSelection = { id: "gemini-3.1-pro-preview", provider: "Google" }

function pickModel(opts: BuilderOptions): ModelSelection {
  const m = opts.model
  if (m && typeof m.id === "string" && typeof m.provider === "string") return m
  return opts.quality === "fast" ? FALLBACK_MODEL : DEFAULT_BEST_MODEL
}

// ─── AI agent helper ──────────────────────────────────────────────────────────

async function callAIAgent(
  messages: ChatMessage[],
  opts: { temperature?: number; retries?: number; model: ModelSelection },
): Promise<string> {
  const temperature = opts.temperature ?? 0.4
  const retries = opts.retries ?? 1
  let lastError = "Unknown AI error"

  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await callModel({ model: opts.model, messages, temperature })
    if (res.ok) return res.content
    lastError = `${res.message}${res.details ? `: ${res.details}` : ""}`
    if (attempt === retries && opts.model.provider !== "Google") {
      const fallback = await callModel({ model: FALLBACK_MODEL, messages, temperature })
      if (fallback.ok) return fallback.content
    }
  }
  throw new Error(lastError)
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : fallback
}

function sanitizeRoute(routePath: string): string {
  if (!routePath) return "/"
  let cleaned = routePath.trim().toLowerCase()
  if (!cleaned.startsWith("/")) cleaned = `/${cleaned}`
  cleaned = cleaned.replace(/\s+/g, "-").replace(/[^a-z0-9\-/]/g, "").replace(/\/+/g, "/")
  if (cleaned.length > 1 && cleaned.endsWith("/")) cleaned = cleaned.slice(0, -1)
  return cleaned || "/"
}

function prettifyPath(path: string): string {
  if (path === "/") return "Home"
  const last = path.split("/").filter(Boolean).pop() ?? path
  return last.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ")
}

// ─── Node A parser ────────────────────────────────────────────────────────────

function normalizeSiteArchitecture(
  raw: unknown,
  prompt: string,
  project?: ProjectContext,
): SiteArchitecture {
  const root = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>

  const projectName = safeText(root.project_name, project?.name?.trim() || prompt.split(/\s+/).slice(0, 3).join(" ") || "My Site")

  // Theme config
  const themeRaw = (root.theme_config as Record<string, unknown> | undefined) ?? {}
  const primaryColor = safeText(themeRaw.primary_color, "#6366f1")

  // Database schema
  const dbSchema = Array.isArray(root.database_schema)
    ? (root.database_schema as unknown[]).map((m) => {
        const r = (m && typeof m === "object" ? (m as Record<string, unknown>) : {}) as Record<string, unknown>
        const fields = Array.isArray(r.fields)
          ? (r.fields as unknown[]).map((f) => {
              const fRaw = (f && typeof f === "object" ? (f as Record<string, unknown>) : {}) as Record<string, unknown>
              return {
                name: safeText(fRaw.name, "id"),
                type: safeText(fRaw.type, "string"),
              }
            })
          : []
        return { model_name: safeText(r.model_name, "Entry"), fields }
      })
    : []

  // Routes
  const rawRoutes = Array.isArray(root.routes) ? (root.routes as unknown[]) : []
  const seen = new Set<string>()
  const routes: SiteArchitecture["routes"] = []

  for (let i = 0; i < rawRoutes.length; i++) {
    const r = (rawRoutes[i] && typeof rawRoutes[i] === "object" ? (rawRoutes[i] as Record<string, unknown>) : {}) as Record<string, unknown>
    const rawPath = safeText(r.path, "")
    const normalized = i === 0 ? "/" : sanitizeRoute(rawPath || `/page-${i + 1}`)
    if (seen.has(normalized)) continue
    seen.add(normalized)
    routes.push({
      path: normalized,
      purpose: safeText(r.purpose, prettifyPath(normalized)),
    })
  }

  // Ensure home route always exists
  if (!seen.has("/")) {
    routes.unshift({ path: "/", purpose: "Landing page with hero and key features" })
    seen.add("/")
  }

  // Minimum 3 routes
  const defaultRoutes = ["/about", "/pricing", "/contact", "/features"]
  for (const dr of defaultRoutes) {
    if (routes.length >= 5) break
    if (!seen.has(dr)) {
      routes.push({ path: dr, purpose: prettifyPath(dr) })
      seen.add(dr)
    }
  }

  const themePreset = detectPresetFromPrompt(`${prompt} ${project?.category ?? ""} ${project?.description ?? ""}`)
  const navLinks: NavLink[] = routes.slice(0, 5).map((r, i) => ({
    label: i === 0 ? "Home" : prettifyPath(r.path),
    href: r.path,
  }))

  const needsDatabase = dbSchema.length > 0

  return {
    project_name: projectName,
    theme_config: { primary_color: primaryColor, mode: themeRaw.mode === "dark" ? "dark" : "light" },
    database_schema: dbSchema,
    routes,
    global_components: ["Navbar", "Footer"],
    themePreset,
    navLinks,
    primaryCta: { label: "Get started", href: routes.find(r => r.path === "/contact")?.path ?? routes[1]?.path ?? "/" },
    secondaryCta: { label: "Learn more", href: routes.find(r => r.path === "/about")?.path ?? "/" },
    footerCta: { label: "Talk to us", href: routes.find(r => r.path === "/contact")?.path ?? "/" },
    contact: { email: "hello@example.com" },
    logoUrl: project?.logoUrl,
    logoInitials: computeInitials(projectName),
    category: project?.category,
    description: project?.description?.trim() || prompt,
    tagline: `${projectName} — built for modern teams.`,
    audience: "Modern teams that care about craft.",
    voice: "Confident, warm, specific.",
    needsDatabase,
    deploymentMode: "next-server",
  }
}

// ─── Node B parser ────────────────────────────────────────────────────────────

const ALLOWED_PRIMITIVES: ReadonlySet<string> = new Set([
  "main", "section", "div", "header", "footer", "nav", "aside", "article",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "ul", "ol", "li",
  "img", "form", "fieldset", "button", "input", "textarea", "label",
  "select", "option", "table", "thead", "tbody", "tr", "th", "td",
  "Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter",
  "Button", "Badge", "Input", "Textarea", "Label", "Separator", "Avatar",
  "AvatarImage", "AvatarFallback", "Accordion", "AccordionItem",
  "AccordionTrigger", "AccordionContent", "Tabs", "TabsList", "TabsTrigger", "TabsContent",
])

function normalizeComponentNode(raw: unknown, depth = 0): ComponentNode | undefined {
  if (depth > 10 || !raw || typeof raw !== "object" || Array.isArray(raw)) return undefined
  const r = raw as Record<string, unknown>
  const component = safeText(r.component, "")
  if (!ALLOWED_PRIMITIVES.has(component)) {
    // Fall back to a safe div so we don't lose the children
    const children = Array.isArray(r.children)
      ? r.children.map((c) => normalizeComponentNode(c, depth + 1)).filter((c): c is ComponentNode => Boolean(c))
      : undefined
    return {
      id: `div-${depth}`,
      component: "div",
      props: typeof (r as Record<string, unknown>).props === "object" ? (r.props as Record<string, unknown>) : undefined,
      text: safeText(r.text, "") || undefined,
      children: children?.length ? children : undefined,
    }
  }

  const children = Array.isArray(r.children)
    ? r.children
        .map((c) => normalizeComponentNode(c, depth + 1))
        .filter((c): c is ComponentNode => Boolean(c))
        .slice(0, 50)
    : undefined

  const id = safeText(r.id, "") || `${component.toLowerCase()}-${depth}`
  const props = r.props && typeof r.props === "object" && !Array.isArray(r.props)
    ? (r.props as Record<string, unknown>)
    : undefined

  return {
    id: id.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80),
    component: component as ComponentNode["component"],
    props,
    text: safeText(r.text, "") || undefined,
    children: children?.length ? children : undefined,
  }
}

function normalizePageUITree(raw: unknown, route: string, purpose: string): PageUITree {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>

  const tree = normalizeComponentNode(r.tree) ?? {
    id: "root",
    component: "main" as const,
    props: { className: "flex-1" },
    children: [
      {
        id: "fallback-section",
        component: "section" as const,
        props: { className: "py-24 px-4 max-w-4xl mx-auto text-center" },
        children: [
          {
            id: "fallback-h1",
            component: "h1" as const,
            props: { className: "text-4xl font-bold mb-4" },
            text: prettifyPath(route),
          },
        ],
      },
    ],
  }

  const state = Array.isArray(r.state)
    ? (r.state as unknown[]).map((s) => {
        const sv = (s && typeof s === "object" ? s : {}) as Record<string, unknown>
        return {
          name: safeText(sv.name, "value"),
          type: (["string", "number", "boolean", "array", "object"].includes(safeText(sv.type, "")) ? safeText(sv.type, "string") : "string") as StateVar["type"],
          default: sv.default ?? "",
        }
      })
    : []

  return {
    route,
    is_server_component: r.is_server_component === false ? false : !state.length,
    imports: Array.isArray(r.imports) ? (r.imports as unknown[]).map((i) => safeText(i, "")).filter(Boolean) : [],
    state,
    tree,
    purpose,
  }
}

// ─── Node C parser ────────────────────────────────────────────────────────────

function normalizeServerActionPlan(raw: unknown): ServerActionPlan {
  const r = (raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {}) as Record<string, unknown>

  const actions = Array.isArray(r.actions)
    ? (r.actions as unknown[]).map((a) => {
        const ar = (a && typeof a === "object" ? a : {}) as Record<string, unknown>
        const inputFields = Array.isArray(ar.inputFields)
          ? (ar.inputFields as unknown[]).map((f) => {
              const fr = (f && typeof f === "object" ? f : {}) as Record<string, unknown>
              return {
                name: safeText(fr.name, "value"),
                type: (["string", "number", "boolean", "date"].includes(safeText(fr.type, "")) ? safeText(fr.type, "string") : "string") as "string" | "number" | "boolean" | "date",
                required: Boolean(fr.required),
              }
            })
          : []
        return {
          name: safeText(ar.name, "handleAction"),
          kind: ar.kind === "query" ? "query" as const : "mutation" as const,
          model: safeText(ar.model, "Entry"),
          inputFields,
          operation: (["insert", "update", "delete", "select"].includes(safeText(ar.operation, "")) ? safeText(ar.operation, "insert") : "insert") as "insert" | "update" | "delete" | "select",
          description: safeText(ar.description, ""),
        }
      })
    : []

  const routeBindings: Record<string, string[]> = {}
  if (r.routeBindings && typeof r.routeBindings === "object" && !Array.isArray(r.routeBindings)) {
    for (const [k, v] of Object.entries(r.routeBindings as Record<string, unknown>)) {
      if (Array.isArray(v)) {
        routeBindings[k] = v.map((item) => safeText(item, "")).filter(Boolean)
      }
    }
  }

  return { actions, routeBindings }
}

// ─── Integration resolution ───────────────────────────────────────────────────

const INTEGRATION_KINDS: ReadonlySet<IntegrationKind> = new Set<IntegrationKind>([
  "database", "auth", "email", "analytics", "storage", "payments", "other",
])

const INTEGRATION_ID_ALIASES: Record<string, string> = {
  "turso": "turso", "mongodb": "mongodb", "supabase": "supabase",
  "firebase": "firebase", "upstash": "upstash", "upstash-redis": "upstash",
  "redis": "upstash", "nextauth": "nextauth", "auth-js": "nextauth",
  "clerk": "clerk", "stripe": "stripe", "paypal": "paypal",
  "openai": "openai", "resend": "resend", "github": "github",
  "sendgrid": "resend", "postmark": "resend",
}

function normalizeId(raw: string | undefined | null): string {
  return (raw ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

function tursoIntegration(reason: string): IntegrationPlan {
  return {
    kind: "database",
    name: "Turso",
    provider: "turso",
    reason: reason || "SQLite database for persistent app data",
    envVars: ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"],
  }
}

function resolveIntegrations(
  needsDatabase: boolean,
  project?: ProjectContext,
): { integrations: IntegrationPlan[]; databaseProvider: "turso" | "none"; unconnectedRequested: string[] } {
  const connected = new Set<string>(["turso"])
  for (const id of project?.connectedIntegrationIds ?? []) {
    const norm = normalizeId(id)
    if (norm) connected.add(INTEGRATION_ID_ALIASES[norm] ?? norm)
  }
  for (const pi of project?.integrations ?? []) {
    const provider = normalizeId(pi.provider || pi.name)
    if (provider) connected.add(INTEGRATION_ID_ALIASES[provider] ?? provider)
  }

  const integrations: IntegrationPlan[] = []
  if (needsDatabase) {
    integrations.push(tursoIntegration(""))
  }

  // Include connected project integrations
  for (const pi of project?.integrations ?? []) {
    const provider = normalizeId(pi.provider || pi.name)
    const id = INTEGRATION_ID_ALIASES[provider] ?? provider
    if (!id || integrations.some((i) => normalizeId(i.provider) === id)) continue
    integrations.push({ kind: "other", name: pi.name, provider: id, reason: "Already connected", envVars: [] })
  }

  return {
    integrations,
    databaseProvider: needsDatabase ? "turso" : "none",
    unconnectedRequested: [],
  }
}

function buildRequiredEnvVars(integrations: IntegrationPlan[], needsDatabase: boolean): EnvVarRequirement[] {
  const out: EnvVarRequirement[] = []
  const seen = new Set<string>()
  for (const integration of integrations) {
    for (const key of integration.envVars) {
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        key,
        purpose: `${integration.name} — ${integration.reason || "integration env var"}`.trim(),
        provider: integration.provider,
        required: integration.kind === "database" || needsDatabase,
        integration: integration.name,
      })
    }
  }
  return out
}

function computeMissingEnvVars(
  required: EnvVarRequirement[],
  existingKeys: string[] | undefined,
  project?: ProjectContext,
): EnvVarRequirement[] {
  const present = new Set((existingKeys ?? []).filter(Boolean))
  for (const v of project?.envVars ?? []) {
    if (typeof v?.key === "string" && typeof v?.value === "string" && v.value.length > 0) {
      present.add(v.key)
    }
  }
  for (const key of required.map((r) => r.key)) {
    const fromServer = process.env[key]
    if (typeof fromServer === "string" && fromServer.length > 0) present.add(key)
  }
  return required.filter((env) => !present.has(env.key))
}

// ─── Fallback page tree ───────────────────────────────────────────────────────

function buildFallbackPageTree(route: string, arch: SiteArchitecture): PageUITree {
  const name = prettifyPath(route)
  const purpose = arch.routes.find((r) => r.path === route)?.purpose ?? name

  return {
    route,
    is_server_component: true,
    imports: ["Card", "CardContent", "Button"],
    state: [],
    purpose,
    tree: {
      id: "main-root",
      component: "main",
      props: { className: "flex-1" },
      children: [
        {
          id: "hero-section",
          component: "section",
          props: { className: "py-24 px-4 max-w-5xl mx-auto text-center" },
          children: [
            {
              id: "eyebrow",
              component: "p",
              props: { className: "text-sm font-semibold uppercase tracking-widest text-primary mb-4" },
              text: arch.project_name,
            },
            {
              id: "heading",
              component: "h1",
              props: { className: "text-5xl font-bold tracking-tight mb-6" },
              text: name,
            },
            {
              id: "desc",
              component: "p",
              props: { className: "text-xl text-muted-foreground max-w-2xl mx-auto mb-8" },
              text: purpose,
            },
            {
              id: "cta-btn",
              component: "Button",
              props: { className: "text-lg px-8 py-4" },
              text: arch.primaryCta.label,
            },
          ],
        },
      ],
    },
  }
}

// ─── Pipeline context passed to onProgress ───────────────────────────────────

export interface BuilderProgressEvent {
  stage: string
  routeStatuses?: RouteProgress[]
  log?: string
}

// ─── Node A call ─────────────────────────────────────────────────────────────

async function runNodeA(
  prompt: string,
  opts: BuilderOptions,
  logs: PipelineLog[],
  onProgress?: (e: BuilderProgressEvent) => void,
): Promise<SiteArchitecture> {
  const model = pickModel(opts)
  onProgress?.({ stage: "node-a", log: "Node A: analyzing site architecture..." })

  const contextParts: string[] = [prompt]
  if (opts.project?.name) contextParts.push(`Project: ${opts.project.name}`)
  if (opts.project?.description) contextParts.push(`Description: ${opts.project.description}`)
  if (opts.project?.category) contextParts.push(`Category: ${opts.project.category}`)
  const userContent = contextParts.join("\n")

  let raw = ""
  try {
    raw = await callAIAgent(
      [
        { role: "system", content: NODE_A_SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      { model, temperature: 0.5 },
    )
    logs.push({ step: "node-a", detail: `Site architecture returned ${raw.length} chars` })
  } catch (err) {
    logs.push({ step: "node-a", detail: `Node A failed: ${err instanceof Error ? err.message : String(err)}. Using fallback architecture.` })
  }

  const parsed = extractJson<unknown>(raw)
  const arch = normalizeSiteArchitecture(parsed, prompt, opts.project)
  logs.push({ step: "node-a", detail: `Architecture: ${arch.routes.length} routes, DB schema: ${arch.database_schema.map((m) => m.model_name).join(", ") || "none"}` })
  onProgress?.({
    stage: "node-a",
    log: `Architecture ready: ${arch.routes.map((r) => r.path).join(", ")}`,
    routeStatuses: arch.routes.map((r) => ({ path: r.path, purpose: r.purpose, status: "pending" })),
  })
  return arch
}

// ─── Node B call (single route) ───────────────────────────────────────────────

async function runNodeBForRoute(
  route: { path: string; purpose: string },
  arch: SiteArchitecture,
  opts: BuilderOptions,
  logs: PipelineLog[],
  onProgress?: (e: BuilderProgressEvent) => void,
): Promise<PageUITree> {
  const model = pickModel(opts)
  onProgress?.({ stage: "node-b", log: `Generating UI tree for ${route.path}...` })

  const archContext = JSON.stringify({
    project_name: arch.project_name,
    theme_config: arch.theme_config,
    database_schema: arch.database_schema,
    routes: arch.routes,
  })

  let raw = ""
  try {
    raw = await callAIAgent(
      [
        { role: "system", content: NODE_B_SYSTEM_PROMPT(route.path, route.purpose) },
        {
          role: "user",
          content: `Site architecture:\n${archContext}\n\nBuild the UI tree for the route: ${route.path}\nPurpose: ${route.purpose}`,
        },
      ],
      { model, temperature: 0.6, retries: 1 },
    )
    logs.push({ step: "node-b", detail: `Page tree for ${route.path}: ${raw.length} chars` })
  } catch (err) {
    logs.push({ step: "node-b", detail: `Node B failed for ${route.path}: ${err instanceof Error ? err.message : String(err)}. Using fallback.` })
  }

  const parsed = extractJson<unknown>(raw)
  if (parsed) {
    const tree = normalizePageUITree(parsed, route.path, route.purpose)
    onProgress?.({ stage: "node-b", log: `UI tree ready for ${route.path}` })
    return tree
  }

  // Deterministic fallback if Node B fails
  const fallback = buildFallbackPageTree(route.path, arch)
  logs.push({ step: "node-b", detail: `Using fallback tree for ${route.path}` })
  onProgress?.({ stage: "node-b", log: `Fallback tree for ${route.path}` })
  return fallback
}

// ─── Node C call ─────────────────────────────────────────────────────────────

async function runNodeC(
  arch: SiteArchitecture,
  pageTrees: PageUITree[],
  opts: BuilderOptions,
  logs: PipelineLog[],
  onProgress?: (e: BuilderProgressEvent) => void,
): Promise<ServerActionPlan | undefined> {
  if (!arch.needsDatabase || arch.database_schema.length === 0) {
    logs.push({ step: "node-c", detail: "No database required, skipping server actions." })
    return undefined
  }

  onProgress?.({ stage: "node-c", log: "Node C: generating server actions..." })
  const model = pickModel(opts)

  const archJson = JSON.stringify({
    project_name: arch.project_name,
    database_schema: arch.database_schema,
    routes: arch.routes.map((r) => r.path),
  })
  const treesSummary = JSON.stringify(
    pageTrees.map((t) => ({
      route: t.route,
      hasForm: JSON.stringify(t.tree).includes('"form"'),
      stateVars: t.state.map((s) => s.name),
    })),
  )

  let raw = ""
  try {
    raw = await callAIAgent(
      [
        { role: "system", content: NODE_C_SYSTEM_PROMPT(archJson, treesSummary) },
        {
          role: "user",
          content: `Generate server actions for this site. Database models: ${arch.database_schema.map((m) => m.model_name).join(", ")}.`,
        },
      ],
      { model, temperature: 0.3, retries: 1 },
    )
    logs.push({ step: "node-c", detail: `Server actions returned ${raw.length} chars` })
  } catch (err) {
    logs.push({ step: "node-c", detail: `Node C failed: ${err instanceof Error ? err.message : String(err)}` })
    return undefined
  }

  const parsed = extractJson<unknown>(raw)
  if (!parsed) return undefined

  const plan = normalizeServerActionPlan(parsed)
  logs.push({ step: "node-c", detail: `Server actions: ${plan.actions.length} action(s)` })
  onProgress?.({ stage: "node-c", log: `${plan.actions.length} server action(s) planned` })
  return plan
}

// ─── Design direction ─────────────────────────────────────────────────────────

async function runDesignDirection(
  prompt: string,
  opts: BuilderOptions,
  logs: PipelineLog[],
): Promise<DesignDirection> {
  const fallback = fallbackDesignDirection(prompt, opts.project)
  if (opts.quality === "fast") {
    logs.push({ step: "design-direction", detail: `Fast mode: ${fallback.concept}` })
    return fallback
  }
  const model = pickModel(opts)
  try {
    const raw = await callAIAgent(
      [
        { role: "system", content: DESIGN_DIRECTION_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      { model, temperature: 0.75, retries: 0 },
    )
    const parsed = extractJson<unknown>(raw)
    const direction = normalizeDesignDirection(parsed, fallback)
    logs.push({ step: "design-direction", detail: `Concept: ${direction.concept}` })
    return direction
  } catch {
    logs.push({ step: "design-direction", detail: `Direction failed, using fallback: ${fallback.concept}` })
    return fallback
  }
}

// ─── Manifest assembly ────────────────────────────────────────────────────────

function assembleManifest(
  arch: SiteArchitecture,
  pageTrees: PageUITree[],
  serverActions: ServerActionPlan | undefined,
  direction: DesignDirection,
  project?: ProjectContext,
): GeneratedProjectManifest {
  const { integrations, databaseProvider, unconnectedRequested } = resolveIntegrations(arch.needsDatabase, project)
  const requiredEnvVars = buildRequiredEnvVars(integrations, arch.needsDatabase)

  return {
    brief: {
      projectName: arch.project_name,
      tagline: arch.tagline ?? `${arch.project_name} — built for modern teams.`,
      description: arch.description ?? "",
      audience: arch.audience ?? "Modern teams",
      voice: arch.voice ?? "Confident, warm, specific.",
      themePreset: arch.themePreset,
      navLinks: arch.navLinks,
      primaryCta: arch.primaryCta,
      secondaryCta: arch.secondaryCta,
      footerCta: arch.footerCta,
      contact: arch.contact,
      logoUrl: arch.logoUrl,
      logoInitials: arch.logoInitials,
      category: arch.category,
    },
    theme: buildTheme(arch.themePreset),
    designDirection: direction,
    architecture: arch,
    pageTrees,
    serverActions,
    deploymentMode: "next-server",
    needsDatabase: arch.needsDatabase,
    databaseProvider,
    integrations,
    requiredEnvVars,
    unconnectedIntegrations: unconnectedRequested,
  }
}

// ─── Required UI components ───────────────────────────────────────────────────

function pickRequiredUiComponents(requiredSlugs: Set<string>): RequiredComponent[] {
  return ALL_UI_COMPONENTS.filter((c) => requiredSlugs.has(c.slug))
}

// ─── Public entry point ───────────────────────────────────────────────────────

export async function runAIWebsiteBuilder(
  prompt: string,
  options: BuilderOptions = {},
  onProgress?: (e: BuilderProgressEvent) => void,
): Promise<RunBuilderResult> {
  const logs: PipelineLog[] = []
  logs.push({ step: "start", detail: `Builder started${options.model ? ` with ${options.model.provider}/${options.model.id}` : ""}` })
  onProgress?.({ stage: "node-a", log: "Starting 3-node pipeline..." })

  // ── Step 1: Design Direction ────────────────────────────────────────────────
  const direction = await runDesignDirection(prompt, options, logs)

  // ── Step 2: Node A — Site Architecture ──────────────────────────────────────
  const arch = await runNodeA(prompt, options, logs, onProgress)

  // ── Step 3: Node B — Page UI Trees (all routes, concurrent) ─────────────────
  onProgress?.({
    stage: "node-b",
    log: `Building ${arch.routes.length} page trees concurrently...`,
    routeStatuses: arch.routes.map((r) => ({ path: r.path, purpose: r.purpose, status: "generating" })),
  })

  const pageTrees = await Promise.all(
    arch.routes.map((route) =>
      runNodeBForRoute(route, arch, options, logs, onProgress),
    ),
  )

  logs.push({ step: "node-b", detail: `All ${pageTrees.length} page trees generated` })
  onProgress?.({
    stage: "node-b",
    log: `All ${pageTrees.length} UI trees complete.`,
    routeStatuses: arch.routes.map((r) => ({ path: r.path, purpose: r.purpose, status: "done" })),
  })

  // ── Step 4: Node C — Server Actions ─────────────────────────────────────────
  onProgress?.({ stage: "node-c", log: "Node C: server actions..." })
  const serverActions = await runNodeC(arch, pageTrees, options, logs, onProgress)

  // ── Step 5: Compile page trees → .tsx files ──────────────────────────────────
  onProgress?.({ stage: "compiling", log: "Compiling JSON ASTs to TSX files..." })
  const { pages: compiledPages, requiredSlugs } = compileAllPages(pageTrees, arch.project_name)
  const pageFiles: BuilderFile[] = compiledPages.map((p) => ({ path: p.path, content: p.content }))

  for (const p of compiledPages) {
    logs.push({ step: "compile", detail: `Compiled ${p.path} (${p.content.split("\n").length} lines)` })
  }
  onProgress?.({ stage: "compiling", log: `Compiled ${pageFiles.length} page files.` })

  // ── Step 6: Assemble manifest ────────────────────────────────────────────────
  const manifest = assembleManifest(arch, pageTrees, serverActions, direction, options.project)

  // ── Step 7: Scaffold base + UI files ─────────────────────────────────────────
  onProgress?.({ stage: "scaffolding", log: "Scaffolding project files..." })
  const requiredComponents = pickRequiredUiComponents(requiredSlugs)
  const baseFiles = scaffoldBaseFiles(manifest, requiredComponents, prompt)
  const uiFiles = buildUiComponentFiles(Array.from(requiredSlugs))
  logs.push({ step: "scaffold", detail: `Scaffolded ${baseFiles.length} base files + ${uiFiles.length} UI components` })

  const allFiles: BuilderFile[] = [...baseFiles, ...uiFiles, ...pageFiles]

  // ── Step 8: Build validation ─────────────────────────────────────────────────
  onProgress?.({ stage: "validating", log: "Validating build..." })
  const connectedIds = Array.from(new Set([
    ...(options.project?.connectedIntegrationIds ?? []),
    ...(options.project?.integrations?.map((i) => i.provider || i.name) ?? []),
  ].map((s) => (s ?? "").toLowerCase()).filter(Boolean)))

  const build = runBuildValidation(allFiles, {
    needsDatabase: manifest.needsDatabase,
    deploymentMode: manifest.deploymentMode,
    connectedIntegrationIds: connectedIds,
  })

  if (!build.ok) {
    logs.push({ step: "validate", detail: `Build validation: ${build.errors.length} error(s): ${build.errors.slice(0, 3).join("; ")}` })
  } else {
    logs.push({ step: "validate", detail: `Build validation passed (${build.warnings.length} warning(s))` })
  }

  // ── Step 9: Missing env vars ─────────────────────────────────────────────────
  const missingEnvVars = computeMissingEnvVars(
    manifest.requiredEnvVars,
    options.project?.envVarKeys,
    options.project,
  )

  const qualityScore = computeQualityScore(manifest, build)
  logs.push({ step: "done", detail: `Quality: ${qualityScore}/100 | Files: ${allFiles.length} | Deployment: ${manifest.deploymentMode}` })
  onProgress?.({ stage: "done", log: `Done. ${allFiles.length} files, quality ${qualityScore}/100` })

  const advisoryWarnings = [...build.warnings]
  if (manifest.needsDatabase && missingEnvVars.length) {
    advisoryWarnings.unshift(`Missing env vars: ${missingEnvVars.map((e) => e.key).join(", ")}`)
  }

  return {
    manifest,
    files: allFiles,
    logs,
    build,
    warnings: advisoryWarnings,
    qualityScore,
    needsDatabase: manifest.needsDatabase,
    databaseProvider: manifest.databaseProvider,
    integrations: manifest.integrations,
    requiredEnvVars: manifest.requiredEnvVars,
    missingEnvVars,
    unconnectedIntegrations: manifest.unconnectedIntegrations,
    deploymentMode: manifest.deploymentMode,
  }
}
