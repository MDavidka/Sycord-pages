/**
 * Strict generation pipeline for Syra — planning() tool + PlanChecklist UI.
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
  /** Exact commands or files the AI should run for this step */
  hints?: string[]
}

export type GenerationPlan = {
  id: string
  title: string
  appType: string
  pages: PlannedPage[]
  shadcnComponents: string[]
  steps: GenerationPlanStep[]
  createdAt: number
  updatedAt: number
}

export const NEXT_STANDALONE_CONFIG_HINT = `// next.config.mjs (or next.config.js)
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
};
export default nextConfig;
// CommonJS: module.exports = nextConfig;`

export const DEFAULT_PIPELINE_STEP_DEFS: Omit<GenerationPlanStep, "status" | "hints">[] = [
  {
    id: "init-nextjs",
    title: "Initialize Next.js project",
    description:
      "Scaffold App Router project in workspace app/ with TypeScript, Tailwind, ESLint, @/* alias, and output: 'standalone' in next.config.",
    strict: true,
  },
  {
    id: "init-shadcn",
    title: "Initialize shadcn/ui",
    description:
      "Run npx shadcn@latest init -y in project root (use latest CLI — older shadcn versions may fail).",
    strict: true,
  },
  {
    id: "seed-ui-components",
    title: "Seed base UI components",
    description:
      "Install required shadcn components via npx shadcn@latest add <name> -y (or addShadcnComponent). Match the planned UI needs.",
    strict: true,
  },
  {
    id: "inject-layout",
    title: "Inject builder logic & layout",
    description:
      "Create app/layout.tsx, app/globals.css (--font-sans Inter), theme provider, navbar/footer, Sycord Design Contract compliance.",
    strict: false,
  },
  {
    id: "create-pages",
    title: "Create named pages",
    description: "Build each planned route as app/<segment>/page.tsx with exact page names from the plan.",
    strict: true,
  },
  {
    id: "validate",
    title: "Validate compilation",
    description: "Run typeCheck() and lintCheck() / npm run lint. Do NOT run npm run build — deploy() builds via issue_deploy.",
    strict: true,
  },
  {
    id: "deploy",
    title: "Deploy to sycord.site",
    description: "Call deploy() → POST issue_deploy { uuid } (git pull + rebuild + restart).",
    strict: false,
  },
]

function stepHints(
  stepId: string,
  pages: PlannedPage[],
  shadcnComponents: string[],
): string[] {
  switch (stepId) {
    case "init-nextjs":
      return [
        'createWorkspace()',
        'executeCommand({ command: "npx create-next-app@latest . --typescript --tailwind --eslint --app --import-alias \\"@/*\\" --yes" })',
        "write next.config with output: 'standalone'",
        'executeCommand({ command: "npm install" })',
      ]
    case "init-shadcn":
      return [
        'executeCommand({ command: "npx shadcn@latest init -y" })',
        "Prefer shadcn@latest CLI in project folder — deprecated registry-only flows may fail.",
      ]
    case "seed-ui-components": {
      const list = shadcnComponents.length ? shadcnComponents.join(" ") : "button card input label separator badge"
      return [
        `executeCommand({ command: "npx shadcn@latest add ${list} -y" })`,
        "OR addShadcnComponent({ components: [...] }) for Pages-backed installs",
        "listShadcnComponents() to verify before importing",
      ]
    }
    case "inject-layout":
      return [
        "app/layout.tsx with Inter (--font-sans), ThemeProvider, dark mode toggle",
        "components/sections/* or shared navbar/footer",
        "Hero gradient per Sycord Design Contract",
      ]
    case "create-pages":
      return pages.map((p) => `app${p.route === "/" ? "" : p.route}/page.tsx — ${p.name}${p.sections?.length ? ` (${p.sections.join(", ")})` : ""}`)
    case "validate":
      return ["typeCheck()", 'lintCheck() or executeCommand({ command: "npm run lint" })']
    case "deploy":
      return ["deploy() — issue_deploy only, never npm run build"]
    default:
      return []
  }
}

export function buildGenerationPlan(input: {
  title?: string
  appType?: string
  pages?: PlannedPage[]
  shadcnComponents?: string[]
}): GenerationPlan {
  const now = Date.now()
  const pages = input.pages?.length
    ? input.pages
    : [{ route: "/", name: "Home" }]
  const shadcnComponents = input.shadcnComponents ?? ["button", "card", "input", "label", "separator"]

  const steps: GenerationPlanStep[] = DEFAULT_PIPELINE_STEP_DEFS.map((def, idx) => ({
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
    createdAt: now,
    updatedAt: now,
  }
}

export function updatePlanStep(
  plan: GenerationPlan,
  stepId: string,
  status: PlanStepStatus,
): GenerationPlan {
  const steps = plan.steps.map((s) => {
    if (s.id === stepId) return { ...s, status }
    return s
  })

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
  const strictSteps = plan.steps.filter((s) => s.strict)
  const completed = strictSteps.filter((s) => s.status === "completed").length
  const total = strictSteps.length
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
    `[SYSTEM] Generation plan "${plan.title}" (${completed}/${total} strict steps done)`,
    `App type: ${plan.appType}`,
    "",
    "Pages (exact routes to create):",
    ...plan.pages.map((p) => `- ${p.route} → ${p.name}${p.sections?.length ? ` [${p.sections.join(", ")}]` : ""}`),
    "",
    "shadcn components to seed:",
    plan.shadcnComponents.map((c) => `- ${c}`).join("\n") || "- (determine from UI)",
    "",
    "Pipeline (follow in order — do not skip strict steps):",
  ]

  for (const step of plan.steps) {
    const tag = step.strict ? "STRICT" : "optional"
    const icon =
      step.status === "completed" ? "✅" : step.status === "in_progress" ? "▶" : step.status === "skipped" ? "⏭" : "○"
    lines.push(`${icon} [${tag}] ${step.title} — ${step.status}`)
    if (step.hints?.length && step.status !== "completed") {
      lines.push(`   ${step.hints.slice(0, 4).join("\n   ")}`)
    }
  }

  lines.push(
    "",
    "next.config MUST include output: 'standalone':",
    NEXT_STANDALONE_CONFIG_HINT,
    "",
    "Call planning({ action: 'updateStep', stepId, status: 'completed' }) after each step before moving on.",
  )

  return lines.join("\n")
}
