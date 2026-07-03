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

export const SUGGESTED_PIPELINE: Omit<GenerationPlanStep, "status" | "hints">[] = [
  {
    id: "foundation",
    title: "Layout, routing & theme",
    description:
      "src/App.tsx with react-router-dom routes + shared layout (Navbar/Footer). Tailwind base, dark-mode toggle, reusable components in src/components/.",
    strict: false,
  },
  {
    id: "pages",
    title: "Build the pages",
    description: "Create each route as its own file under src/pages/, composing your Tailwind components.",
    strict: false,
  },
  {
    id: "polish",
    title: "Content & polish",
    description: "Real copy, images, responsive check at 375px and 1280px, lucide icons.",
    strict: false,
  },
  {
    id: "ship",
    title: "Verify & deploy",
    description: "typeCheck() + lintCheck(), fix issues, then deploy() (Syte Docker-builds & serves — never npm run build).",
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

function routeToPageFile(route: string): string {
  if (route === "/" || route === "") return "src/pages/Home.tsx"
  const seg = route.replace(/^\/+|\/+$/g, "").split("/")[0]
  const name = seg.charAt(0).toUpperCase() + seg.slice(1)
  return `src/pages/${name}.tsx`
}

function stepHints(stepId: string, pages: PlannedPage[]): string[] {
  if (/found|setup|layout|theme|shell|routing|init/.test(stepId)) {
    return [
      "src/App.tsx: react-router-dom routes + shared layout (Navbar/Footer)",
      "src/index.css: Tailwind base; dark mode via class strategy + toggle",
      "Build small reusable components in src/components/",
    ]
  }
  if (/page|route|build/.test(stepId)) {
    return pages.map((p) => `${routeToPageFile(p.route)} — ${p.name}`)
  }
  if (/polish|content|design|review/.test(stepId)) {
    return ["Real copy + images (Unsplash/Pexels)", "Responsive at 375px and 1280px", "lucide-react icons, no colored circles"]
  }
  if (/valid|check|lint|deploy|ship/.test(stepId)) {
    return ["typeCheck() then lintCheck()", "Fix reported errors", "deploy() — Syte Docker-builds & serves the SPA"]
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
  // Kept for type/UI compatibility; the Vite baseline doesn't use shadcn.
  const shadcnComponents = (input.shadcnComponents ?? []).slice(0, 16)

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
    hints: stepHints(def.id, pages),
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
    "Pages to build (one route per file under src/pages/, wired in src/App.tsx with react-router-dom):",
    ...plan.pages.map((p) => `- ${p.route} → ${p.name}${p.sections?.length ? ` [${p.sections.join(", ")}]` : ""}`),
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
    "Reminders: Vite + React SPA (no shadcn, no Next.js). Build reusable Tailwind components. Mark a step completed only after it truly succeeded. Deploy via deploy() — never run npm run build yourself (Syte Docker-builds it).",
  )

  return lines.join("\n")
}
