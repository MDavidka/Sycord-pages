/**
 * Flexible generation pipeline for Syra — planning() tool + PlanChecklist UI.
 * AI may define its own steps; default pipeline is suggested, not mandatory semantics.
 */

export type PlanStepStatus = "pending" | "in_progress" | "completed" | "skipped"

export type PlannedPage = {
  route: string
  name: string
  sections?: string[]
}

export type GenerationPlanStep = {
  id: string
  title: string
  description: string
  strict: boolean
  status: PlanStepStatus
  hints?: string[]
}

export type GenerationPlan = {
  id: string
  title: string
  appType: string
  pages: PlannedPage[]
  shadcnComponents: string[]
  steps: GenerationPlanStep[]
  notes?: string
  createdAt: number
  updatedAt: number
}

export type CustomPlanStepInput = {
  id?: string
  title: string
  description?: string
  strict?: boolean
}

export const NEXT_STANDALONE_CONFIG_HINT = `// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
export default nextConfig;`

export const SUGGESTED_PIPELINE: Omit<GenerationPlanStep, "status" | "hints">[] = [
  {
    id: "setup",
    title: "Setup Next.js + deps",
    description:
      "Project already has Next.js App Router in Pages (app/layout.tsx). Do NOT run create-next-app if those exist. Delete legacy index.html if present. npm install + ensure output: 'standalone'.",
    strict: false,
  },
  {
    id: "shadcn",
    title: "Install shadcn/ui components",
    description:
      "Prefer addShadcnComponent({ components: [...] }) in 1–2 batches (8–12 components max per batch). CLI (npx shadcn@latest) is fallback only when foundation files are missing.",
    strict: false,
  },
  {
    id: "layout",
    title: "Layout & shared UI",
    description: "app/layout.tsx, globals.css, theme, navbar/footer per Sycord Design Contract.",
    strict: false,
  },
  {
    id: "pages",
    title: "Build planned pages",
    description: "Create each route under app/ from the page list below.",
    strict: false,
  },
  {
    id: "validate",
    title: "Validate",
    description: "typeCheck() + lintCheck(). deploy() for production build — never npm run build.",
    strict: false,
  },
]

function slugifyStepId(title: string, index: number): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  return base || `step-${index + 1}`
}

function stepHints(stepId: string, pages: PlannedPage[], shadcnComponents: string[]): string[] {
  const core = shadcnComponents.slice(0, 12)
  const list = core.length ? core.join(" ") : "button card input label separator"

  if (/setup|next|init/.test(stepId)) {
    return [
      "listFiles() — if app/layout.tsx exists, SKIP create-next-app",
      "deleteFile('index.html') if present (legacy placeholder, breaks create-next-app)",
      "write_file next.config.mjs with output: 'standalone' if missing",
      'executeCommand({ commands: ["npm install"] })',
    ]
  }
  if (/shadcn|component|ui/.test(stepId)) {
    return [
      `addShadcnComponent({ components: [${core.slice(0, 6).map((c) => `"${c}"`).join(", ")}] })`,
      "Install more only when a page needs them — not 40 at once",
      'Fallback: executeCommand({ command: "npx shadcn@latest init -y" }) only if components.json missing',
    ]
  }
  if (/layout|shell/.test(stepId)) {
    return ["app/layout.tsx", "Inter --font-sans", "ThemeProvider + dark mode toggle"]
  }
  if (/page|route|build/.test(stepId)) {
    return pages.map(
      (p) => `app${p.route === "/" ? "" : p.route}/page.tsx — ${p.name}`,
    )
  }
  if (/valid|check|lint|deploy/.test(stepId)) {
    return [
      "typeCheck()",
      'executeCommand({ command: "npm run lint" }) or lintCheck()',
      "deploy() when ready",
    ]
  }
  return []
}

export function buildGenerationPlan(input: {
  title?: string
  appType?: string
  pages?: PlannedPage[]
  shadcnComponents?: string[]
  steps?: CustomPlanStepInput[]
  notes?: string
}): GenerationPlan {
  const now = Date.now()
  const pages = input.pages?.length ? input.pages : [{ route: "/", name: "Home" }]
  const shadcnComponents = (input.shadcnComponents ?? ["button", "card", "input", "label", "separator"]).slice(
    0,
    16,
  )

  const stepDefs: Omit<GenerationPlanStep, "status" | "hints">[] = input.steps?.length
    ? input.steps.map((s, i) => ({
        id: s.id?.trim() || slugifyStepId(s.title, i),
        title: s.title,
        description: s.description || "",
        strict: s.strict ?? false,
      }))
    : SUGGESTED_PIPELINE

  const steps: GenerationPlanStep[] = stepDefs.map((def, idx) => ({
    ...def,
    status: idx === 0 ? "in_progress" : "pending",
    hints: stepHints(def.id, pages, shadcnComponents),
  }))

  return {
    id: `plan-${now}`,
    title: input.title || `Build ${input.appType || "website"}`,
    appType: input.appType || "website",
    pages,
    shadcnComponents,
    steps,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
  }
}

export function updatePlanStep(
  plan: GenerationPlan,
  stepId: string,
  status: PlanStepStatus,
): GenerationPlan {
  const steps = plan.steps.map((s) => (s.id === stepId ? { ...s, status } : s))

  if (status === "completed" || status === "skipped") {
    const idx = steps.findIndex((s) => s.id === stepId)
    const next = steps.find((s, i) => i > idx && s.status === "pending")
    if (next) {
      for (let i = 0; i < steps.length; i++) {
        if (steps[i].id === next.id) steps[i] = { ...steps[i], status: "in_progress" }
      }
    }
  }

  if (status === "in_progress") {
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].id !== stepId && steps[i].status === "in_progress") {
        steps[i] = { ...steps[i], status: "pending" }
      }
    }
  }

  return { ...plan, steps, updatedAt: Date.now() }
}

export function planProgress(plan: GenerationPlan): { completed: number; total: number; label: string } {
  const total = plan.steps.length
  const completed = plan.steps.filter((s) => s.status === "completed").length
  const current = plan.steps.find((s) => s.status === "in_progress")
  return {
    completed,
    total,
    label: current?.title ?? plan.steps.find((s) => s.status === "pending")?.title ?? "Complete",
  }
}

export function formatPlanForAi(plan: GenerationPlan): string {
  const { completed, total } = planProgress(plan)
  const lines = [
    `[SYSTEM] Plan "${plan.title}" (${completed}/${total} steps done)`,
    `App type: ${plan.appType}`,
  ]

  if (plan.notes?.trim()) {
    lines.push("", "Notes:", plan.notes.trim())
  }

  lines.push(
    "",
    "Pages to build:",
    ...plan.pages.map((p) => `- ${p.route} → ${p.name}${p.sections?.length ? ` [${p.sections.join(", ")}]` : ""}`),
    "",
    "shadcn to install (start with these — add more only when needed):",
    plan.shadcnComponents.map((c) => `- ${c}`).join("\n") || "- button, card, input, label, separator",
    "",
    "Your steps (you defined these — adapt freely, mark completed only after success):",
  )

  for (const step of plan.steps) {
    const tag = step.strict ? "required" : "flexible"
    const icon =
      step.status === "completed" ? "✅" : step.status === "in_progress" ? "▶" : step.status === "skipped" ? "⏭" : "○"
    lines.push(`${icon} [${tag}] ${step.title}${step.description ? ` — ${step.description}` : ""}`)
    if (step.hints?.length && step.status !== "completed") {
      lines.push(`   ${step.hints.slice(0, 4).join("\n   ")}`)
    }
  }

  lines.push(
    "",
    "IMPORTANT project rules:",
    "- This is Next.js App Router — NO index.html (legacy placeholder). deleteFile('index.html') if it exists.",
    "- If app/layout.tsx + app/page.tsx exist in Pages, extend them — do NOT run create-next-app.",
    "- Mark planning updateStep completed ONLY after the step actually succeeded (check tool output).",
    "- Prefer addShadcnComponent over npx shadcn CLI (CLI may fail on older Node in workspace).",
    "- Chain setup: executeCommand({ commands: ['npm install', 'npm run lint'] })",
    "",
    NEXT_STANDALONE_CONFIG_HINT,
  )

  return lines.join("\n")
}
