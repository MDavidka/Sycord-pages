// Feature: syra-creative-builder, Property 8: Generate prompt pairs each route with its own page design

import fc from "fast-check"
import { buildGeneratePrompt } from "../prompts"
import { arbitraryFramework, arbitraryPlan } from "./generators"

describe("Property 8: generate prompt pairs each route with its own page design", () => {
  it("emits every page path together with its own visual approach, mood, and section layouts", () => {
    fc.assert(
      fc.property(arbitraryPlan, arbitraryFramework, (plan, fw) => {
        const out = buildGeneratePrompt("Build a site", plan, fw)
        for (const page of plan.pages) {
          expect(out).toContain(page.path)
          const d = page.design!
          expect(out).toContain(d.visualApproach)
          expect(out).toContain(d.mood)
          for (const sl of d.sectionLayouts) {
            expect(out).toContain(sl)
          }
        }
      }),
      { numRuns: 200 },
    )
  })
})
