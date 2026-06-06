// Feature: syra-creative-builder, Property 5: Files list derivation honors explicit input, else derives from the plan

import fc from "fast-check"
import { parsePlan } from "../prompts"
import { arbitraryPlanSource } from "./generators"

describe("Property 5: files list honors explicit input, else derives from the plan", () => {
  it("returns explicit files as-is, otherwise derives from pages + components + backend", () => {
    fc.assert(
      fc.property(arbitraryPlanSource, (source) => {
        const plan = parsePlan(JSON.stringify(source))

        const explicit = Array.isArray(source.files)
          ? source.files
              .map((f: any) => ({ path: String(f?.path || "").trim(), purpose: String(f?.purpose || "").trim() }))
              .filter((f: any) => f.path)
          : []

        if (explicit.length) {
          expect(plan.files).toEqual(explicit)
        } else {
          const derived = [
            ...plan.pages.map((p) => ({ path: p.path, purpose: `${p.title} page` })),
            ...plan.components.map((c) => ({ path: c, purpose: "shared component" })),
            ...plan.backend.map((b) => ({ path: b.split(/\s/)[0].trim(), purpose: "backend" })),
          ].filter((f) => f.path && /[/.]/.test(f.path))
          expect(plan.files).toEqual(derived)
        }
      }),
      { numRuns: 200 },
    )
  })
})
