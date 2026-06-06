// Feature: syra-creative-builder, Property 1: parsePlan always returns a schema-valid plan with a complete manifest

import fc from "fast-check"
import { parsePlan } from "../prompts"
import type { SyraPlan } from "../types"
import { arbitraryNonJsonText, arbitraryPlanJson } from "./generators"

function assertSchemaValidPlan(plan: SyraPlan) {
  expect(typeof plan.summary).toBe("string")
  expect(plan.summary.length).toBeGreaterThan(0)

  expect(plan.design).toBeDefined()
  for (const k of ["style", "colors", "typography", "layout"] as const) {
    expect(typeof plan.design[k]).toBe("string")
    expect(plan.design[k].length).toBeGreaterThan(0)
  }

  expect(Array.isArray(plan.steps)).toBe(true)
  expect(plan.steps.length).toBeGreaterThan(0)
  expect(Array.isArray(plan.pages)).toBe(true)
  expect(Array.isArray(plan.components)).toBe(true)
  expect(Array.isArray(plan.backend)).toBe(true)
  expect(Array.isArray(plan.files)).toBe(true)

  // Every page must carry a well-typed design.
  for (const p of plan.pages) {
    expect(typeof p.path).toBe("string")
    expect(p.design).toBeDefined()
    expect(typeof p.design!.visualApproach).toBe("string")
    expect(typeof p.design!.mood).toBe("string")
    expect(Array.isArray(p.design!.sectionLayouts)).toBe(true)
  }

  // The manifest must be complete and well-typed.
  const m = plan.manifest
  expect(m).toBeDefined()
  expect(Array.isArray(m.routes)).toBe(true)
  expect(m.routes.length).toBeGreaterThan(0)
  expect(Array.isArray(m.navigation)).toBe(true)
  for (const n of m.navigation) {
    expect(typeof n.label).toBe("string")
    expect(typeof n.route).toBe("string")
  }
  expect(typeof m.sharedLayout).toBe("string")
  expect(m.sharedLayout.length).toBeGreaterThan(0)
  expect(Array.isArray(m.backendEndpoints)).toBe(true)
  expect(typeof m.metadata).toBe("string")
  expect(m.metadata.length).toBeGreaterThan(0)
}

describe("Property 1: parsePlan returns a schema-valid plan with a complete manifest", () => {
  it("holds for plan-shaped JSON inputs", () => {
    fc.assert(
      fc.property(arbitraryPlanJson, (json) => {
        assertSchemaValidPlan(parsePlan(json))
      }),
      { numRuns: 200 },
    )
  })

  it("holds for non-JSON inputs (catch fallback)", () => {
    fc.assert(
      fc.property(arbitraryNonJsonText, (text) => {
        assertSchemaValidPlan(parsePlan(text))
      }),
      { numRuns: 200 },
    )
  })
})
