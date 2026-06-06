// Feature: syra-creative-builder, Property 3: Manifest completion retains supplied content and derives the rest

import fc from "fast-check"
import { parsePlan } from "../prompts"
import { arbitraryPlanSource } from "./generators"

const str = (v: any): string => (typeof v === "string" ? v.trim() : "")
const arr = (v: any): any[] => (Array.isArray(v) ? v : [])

describe("Property 3: manifest completion retains supplied content and derives the rest", () => {
  it("retains supplied non-empty content and derives the omitted fields", () => {
    fc.assert(
      fc.property(arbitraryPlanSource, (source) => {
        const plan = parsePlan(JSON.stringify(source))
        const m = plan.manifest
        const sup = source.manifest
        const pagePaths: string[] = source.pages.map((p: any) => p.path)

        // routes: supplied entries retained (superset); when omitted, equals page paths.
        const supRoutes = arr(sup?.routes).map(String).filter(Boolean)
        if (supRoutes.length) {
          for (const r of supRoutes) expect(m.routes).toContain(r)
          for (const p of pagePaths) expect(m.routes).toContain(p)
        } else {
          expect(m.routes).toEqual(pagePaths)
        }

        // navigation: supplied valid entries retained; else one entry per page.
        const supNav = arr(sup?.navigation).filter((n: any) => n && n.label && n.route)
        if (supNav.length) {
          expect(m.navigation).toEqual(
            supNav.map((n: any) => ({ label: str(n.label), route: str(n.route) })),
          )
        } else {
          expect(m.navigation).toEqual(
            source.pages.map((p: any) => ({ label: str(p.title) || "Page", route: p.path })),
          )
        }

        // sharedLayout: supplied retained; else a non-empty derived default.
        const supSL = str(sup?.sharedLayout)
        if (supSL) {
          expect(m.sharedLayout).toBe(supSL)
        } else {
          expect(m.sharedLayout.length).toBeGreaterThan(0)
        }

        // backendEndpoints: supplied retained; else derived from the plan backend.
        const supBE = arr(sup?.backendEndpoints).map(String).filter(Boolean)
        if (supBE.length) {
          expect(m.backendEndpoints).toEqual(supBE)
        } else {
          expect(m.backendEndpoints).toEqual(plan.backend)
        }

        // metadata: supplied retained; else a non-empty derived value.
        const supMeta = str(sup?.metadata)
        if (supMeta) {
          expect(m.metadata).toBe(supMeta)
        } else {
          expect(m.metadata.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 200 },
    )
  })
})
