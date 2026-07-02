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
    id: "foundation",
    title: "Layout, theme & shared UI",
    description:
      "Extend the existing Next.js App Router project (app/layout.tsx already exists — don't scaffold). Set up globals.css, theme + dark-mode toggle, navbar and footer.",
    strict: false,
  },
  {
    id: "pages",
    title: "Build the pages",
    description: "Create each route as app/<segment>/page.tsx, composing shadcn components. Install parts as you need them.",
    strict: false,
  },
  {
    id: "polish",
    title: "Content & polish",
    description: "Real copy, images, responsive check at 375px and 1280px, design-contract pass.",
    strict: false,
  },
  {
    id: "ship",
    title: "Verify & deploy",
    description: "typeCheck() + lintCheck(), fix issues, then deploy() (Syte builds the Docker image — never npm run build).",
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
  const core = shadcnComponents.slice(0, 6)

  if (/found|setup|layout|theme|shell|next|init/.test(stepId)) {
    return [
      "listFiles() first — extend app/layout.tsx, don't scaffold",
      "Inter via --font-sans, ThemeProvider + dark-mode toggle",
      `addShadcnComponent({ components: [${core.map((c) => `"${c}"`).join(", ")}] })`,
    ]
  }
  if (/shadcn|component|ui/.test(stepId)) {
    return [
      `addShadcnComponent({ components: [${core.map((c) => `"${c}"`).join(", ")}] })`,
      "Install what you import, when you import it — not in bulk",
    ]
  }
  if (/page|route|build/.test(stepId)) {
    return pages.map((p) => `app${p.route === "/" ? "" : p.route}/page.tsx — ${p.name}`)
  }
  if (/polish|content|design|review/.test(stepId)) {
    return ["Real copy + images", "Responsive at 375px and 1280px", "grep for @/registry/ and design-contract violations"]
  }
  if (/valid|check|lint|deploy|ship/.test(stepId)) {
    return ["typeCheck() then lintCheck()", "Fix reported errors", "deploy() — Syte builds the Docker image"]
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
    "Reminders: extend the existing App Router project (no create-next-app, no index.html). Install shadcn parts as you import them. Mark a step completed only after it truly succeeded. Deploy via deploy() — never npm run build.",
  )

  return lines.join("\n")
}
