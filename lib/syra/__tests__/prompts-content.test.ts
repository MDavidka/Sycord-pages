// Prompt-content assertion tests (task 6.2) for the four prompt builders.

import {
  SYRA_SYSTEM,
  buildForceGenerateMessage,
  buildGeneratePrompt,
  buildPlanPrompt,
} from "../prompts"
import type { ProjectFramework, SyraPlan } from "../types"

const fw: ProjectFramework = {
  framework: "Next.js",
  router: "app",
  language: "typescript",
  styling: "Tailwind CSS",
  packageManager: "npm",
  entryFile: "app/page.tsx",
  componentsDir: "components",
  isEmpty: false,
  notes: [],
}

const plan: SyraPlan = {
  summary: "A SaaS marketing site",
  design: { style: "sleek dark", colors: "indigo", typography: "geometric", layout: "sticky nav" },
  steps: ["plan", "build"],
  pages: [
    {
      path: "app/page.tsx",
      title: "Home",
      purpose: "landing",
      sections: ["Hero", "Pricing"],
      design: { visualApproach: "bold hero canvas", mood: "confident", sectionLayouts: ["full-bleed", "3-col grid"] },
    },
    {
      path: "app/about/page.tsx",
      title: "About",
      purpose: "story",
      sections: ["Mission"],
      design: { visualApproach: "editorial columns", mood: "warm", sectionLayouts: ["two-column"] },
    },
  ],
  components: ["components/site-header.tsx", "components/site-footer.tsx"],
  backend: ["app/api/contact/route.ts"],
  manifest: {
    routes: ["app/page.tsx", "app/about/page.tsx"],
    navigation: [
      { label: "Home", route: "app/page.tsx" },
      { label: "About", route: "app/about/page.tsx" },
    ],
    sharedLayout: "sticky header + footer on every route",
    backendEndpoints: ["app/api/contact/route.ts"],
    metadata: "unique titles + descriptions per route",
  },
  files: [],
}

describe("buildPlanPrompt content", () => {
  const out = buildPlanPrompt("Build a SaaS site", fw)

  it("drops the old prescriptive page/section quotas and the fixed specimen", () => {
    expect(out).not.toContain("3-6 PAGES")
    expect(out).not.toContain("4-8")
    expect(out).not.toContain("Logos/social proof")
    expect(out).not.toContain("Features grid")
    expect(out).not.toContain("Hero: headline")
  })

  it("includes at least one named design principle and at least one guardrail", () => {
    expect(out).toContain("DESIGN PRINCIPLE")
    expect(out).toContain("GUARDRAIL")
  })

  it("extends the JSON contract with per-page design and the manifest's five contents", () => {
    expect(out).toContain("visualApproach")
    expect(out).toContain("mood")
    expect(out).toContain("sectionLayouts")
    expect(out).toContain("manifest")
    expect(out).toContain("routes")
    expect(out).toContain("navigation")
    expect(out).toContain("sharedLayout")
    expect(out).toContain("backendEndpoints")
    expect(out).toContain("metadata")
  })

  it("frames the home route as required and conveys creative structure", () => {
    expect(out).toContain(`MUST be "${fw.entryFile}"`)
    expect(out).toContain("YOURS to invent")
    expect(out).toContain("optional, non-binding")
  })
})

describe("SYRA_SYSTEM content", () => {
  it("removes the fixed 'Typical App Router layout' block", () => {
    expect(SYRA_SYSTEM).not.toContain("Typical App Router layout")
  })

  it("frames structure as a creative decision and allows varying designs", () => {
    expect(SYRA_SYSTEM).toContain("SITE STRUCTURE IS A CREATIVE DECISION")
    expect(SYRA_SYSTEM).toContain("creative decisions YOU make")
    expect(SYRA_SYSTEM).toContain("visually\ndistinct designs")
  })

  it("retains the deployability guardrails", () => {
    expect(SYRA_SYSTEM).toContain("deployable Next.js App Router build")
    expect(SYRA_SYSTEM).toContain("@/components/ui")
    expect(SYRA_SYSTEM).toContain("never ship a raw")
    expect(SYRA_SYSTEM).toContain("no empty sections")
    expect(SYRA_SYSTEM).toContain('"coming soon"')
    expect(SYRA_SYSTEM).toContain("Route Handlers")
    expect(SYRA_SYSTEM).toContain(".env")
    expect(SYRA_SYSTEM).toContain("no TODO")
  })
})

describe("buildGeneratePrompt content", () => {
  const out = buildGeneratePrompt("Build a SaaS site", plan, fw)

  it("pairs each route with its own page design", () => {
    for (const p of plan.pages) {
      expect(out).toContain(p.path)
      expect(out).toContain(p.design!.visualApproach)
      expect(out).toContain(p.design!.mood)
    }
  })

  it("conveys the manifest navigation, shared layout, and metadata", () => {
    expect(out).toContain("Home -> app/page.tsx")
    expect(out).toContain("About -> app/about/page.tsx")
    expect(out).toContain(plan.manifest.sharedLayout)
    expect(out).toContain(plan.manifest.metadata)
  })

  it("keeps the home-route guardrail", () => {
    expect(out).toContain(`MUST be "${fw.entryFile}"`)
  })
})

describe("buildForceGenerateMessage content", () => {
  it("keeps the home-route guardrail and shadcn recovery instruction", () => {
    const out = buildForceGenerateMessage("Build a SaaS site", plan, fw)
    expect(out).toContain(`MUST be "${fw.entryFile}"`)
    expect(out).toContain("@/components/ui/*")
  })
})
