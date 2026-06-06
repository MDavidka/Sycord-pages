// Feature: syra-creative-builder, Property 4: Manifest routes are a superset of (and when derived, equal) the page routes

import fc from "fast-check"
import { parsePlan } from "../prompts"
import { arbitraryPlanSource } from "./generators"

describe("Property 4: manifest routes superset of page routes (equal when derived)", () => {
  it("contains every page path; equals the page route set when routes are derived", () => {
    fc.assert(
      fc.property(arbitraryPlanSource, (source) => {
        const plan = parsePlan(JSON.stringify(source))

        // Always a superset of the page routes.
        for (const page of plan.pages) {
          expect(plan.manifest.routes).toContain(page.path)
        }

        // When no routes were supplied, the sets are equal.
        const suppliedRoutes = Array.isArray(source.manifest?.routes)
          ? source.manifest.routes.map(String).filter(Boolean)
          : []
        if (!suppliedRoutes.length) {
          expect(new Set(plan.manifest.routes)).toEqual(new Set(plan.pages.map((p) => p.path)))
        }
      }),
      { numRuns: 200 },
    )
  })
})
