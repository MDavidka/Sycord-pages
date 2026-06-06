// Feature: syra-creative-builder, Property 9: Generate prompt conveys the manifest's coherence contents

import fc from "fast-check"
import { buildGeneratePrompt } from "../prompts"
import { arbitraryFramework, arbitraryPlan } from "./generators"

describe("Property 9: generate prompt conveys the manifest's coherence contents", () => {
  it("contains the navigation entries, shared layout, and metadata/SEO direction", () => {
    fc.assert(
      fc.property(arbitraryPlan, arbitraryFramework, (plan, fw) => {
        const out = buildGeneratePrompt("Build a site", plan, fw)

        for (const nav of plan.manifest.navigation) {
          expect(out).toContain(nav.label)
          expect(out).toContain(nav.route)
        }
        expect(out).toContain(plan.manifest.sharedLayout)
        expect(out).toContain(plan.manifest.metadata)
      }),
      { numRuns: 200 },
    )
  })
})
