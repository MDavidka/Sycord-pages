// Feature: syra-creative-builder, Property 2: Every parsed page has a non-empty per-page design

import fc from "fast-check"
import { parsePlan } from "../prompts"
import { arbitraryPlanJson } from "./generators"

describe("Property 2: every parsed page has a non-empty per-page design", () => {
  it("populates visualApproach, mood, and sectionLayouts for every page", () => {
    fc.assert(
      fc.property(arbitraryPlanJson, (json) => {
        const plan = parsePlan(json)
        for (const page of plan.pages) {
          expect(page.design).toBeDefined()
          expect(page.design!.visualApproach.trim().length).toBeGreaterThan(0)
          expect(page.design!.mood.trim().length).toBeGreaterThan(0)
          expect(Array.isArray(page.design!.sectionLayouts)).toBe(true)
          expect(page.design!.sectionLayouts.length).toBeGreaterThan(0)
          for (const sl of page.design!.sectionLayouts) {
            expect(sl.trim().length).toBeGreaterThan(0)
          }
        }
      }),
      { numRuns: 200 },
    )
  })
})
