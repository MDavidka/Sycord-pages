// Feature: syra-creative-builder, Property 7: Home route requirement appears in every prompt builder

import fc from "fast-check"
import { buildForceGenerateMessage, buildGeneratePrompt, buildPlanPrompt } from "../prompts"
import { arbitraryFramework, arbitraryPlan } from "./generators"

describe("Property 7: home route requirement appears in every prompt builder", () => {
  it("buildPlanPrompt, buildGeneratePrompt, and buildForceGenerateMessage all require entryFile as home", () => {
    fc.assert(
      fc.property(arbitraryFramework, arbitraryPlan, (fw, plan) => {
        const required = `MUST be "${fw.entryFile}"`
        expect(buildPlanPrompt("Build a site", fw)).toContain(required)
        expect(buildGeneratePrompt("Build a site", plan, fw)).toContain(required)
        expect(buildForceGenerateMessage("Build a site", plan, fw)).toContain(required)
      }),
      { numRuns: 200 },
    )
  })
})
