// Feature: syra-creative-builder, Property 6: Backward-compatible equality of existing fields for legacy input

import fc from "fast-check"
import { parsePlan } from "../prompts"
import { arbitraryLegacyPlanJson, legacyReferenceParse, projectLegacyFields } from "./generators"

describe("Property 6: backward-compatible equality of existing fields for legacy input", () => {
  it("the legacy field projection deep-equals the pinned pre-change parser output", () => {
    fc.assert(
      fc.property(arbitraryLegacyPlanJson, (json) => {
        const plan = parsePlan(json)
        expect(projectLegacyFields(plan)).toEqual(legacyReferenceParse(json))
      }),
      { numRuns: 200 },
    )
  })
})
