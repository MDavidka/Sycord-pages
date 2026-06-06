// Unit tests for parsePlan (task 6.1) covering design defaulting, manifest
// completion, the no-JSON fallback, backward compatibility, and files derivation.

import { parsePlan } from "../prompts"
import { legacyReferenceParse, projectLegacyFields } from "./generators"

describe("parsePlan unit tests", () => {
  it("(1) retains all supplied content for a full valid input", () => {
    const input = {
      summary: "A bakery website",
      design: { style: "warm rustic", colors: "amber + cream", typography: "serif headings", layout: "wide grid" },
      steps: ["plan", "build"],
      pages: [
        {
          path: "app/page.tsx",
          title: "Home",
          purpose: "welcome",
          sections: ["Hero", "Menu"],
          design: { visualApproach: "cozy hero", mood: "inviting", sectionLayouts: ["full-bleed", "grid"] },
        },
      ],
      components: ["components/site-header.tsx"],
      backend: ["app/api/contact/route.ts"],
      manifest: {
        routes: ["app/page.tsx"],
        navigation: [{ label: "Home", route: "app/page.tsx" }],
        sharedLayout: "header + footer",
        backendEndpoints: ["app/api/contact/route.ts"],
        metadata: "bakery SEO",
      },
    }
    const plan = parsePlan(JSON.stringify(input))
    expect(plan.summary).toBe("A bakery website")
    expect(plan.design).toEqual(input.design)
    expect(plan.pages[0].design).toEqual(input.pages[0].design)
    expect(plan.manifest).toEqual(input.manifest)
  })

  it("(2) defaults a missing page design from the site-level design", () => {
    const input = {
      design: { style: "sleek dark SaaS", colors: "indigo on slate", typography: "geometric", layout: "sticky nav" },
      pages: [{ path: "app/page.tsx", title: "Home", purpose: "landing", sections: ["Hero"] }],
    }
    const plan = parsePlan(JSON.stringify(input))
    const d = plan.pages[0].design!
    expect(d.visualApproach).toBe("sleek dark SaaS")
    expect(d.mood).toBe("sleek dark SaaS — indigo on slate")
    expect(d.sectionLayouts).toEqual(["sticky nav"])
  })

  it("(3) derives all five manifest contents when manifest is missing", () => {
    const input = {
      design: { style: "minimal", colors: "mono", typography: "sans", layout: "stacked" },
      pages: [
        { path: "app/page.tsx", title: "Home", purpose: "x", sections: ["a"] },
        { path: "app/about/page.tsx", title: "About", purpose: "y", sections: ["b"] },
      ],
      components: ["components/site-header.tsx"],
      backend: ["app/api/contact/route.ts — POST"],
    }
    const plan = parsePlan(JSON.stringify(input))
    const m = plan.manifest
    expect(m.routes).toEqual(["app/page.tsx", "app/about/page.tsx"])
    expect(m.navigation).toEqual([
      { label: "Home", route: "app/page.tsx" },
      { label: "About", route: "app/about/page.tsx" },
    ])
    expect(m.sharedLayout.length).toBeGreaterThan(0)
    expect(m.backendEndpoints).toEqual(["app/api/contact/route.ts — POST"])
    expect(m.metadata).toContain("minimal")
  })

  it("(4) retains a partial manifest (nav + metadata) and derives the rest", () => {
    const input = {
      design: { style: "bold", colors: "red", typography: "x", layout: "y" },
      pages: [{ path: "app/page.tsx", title: "Home", purpose: "x", sections: ["a"] }],
      backend: ["app/api/x/route.ts"],
      manifest: {
        navigation: [{ label: "Start", route: "app/page.tsx" }],
        metadata: "custom SEO direction",
      },
    }
    const plan = parsePlan(JSON.stringify(input))
    const m = plan.manifest
    // Retained:
    expect(m.navigation).toEqual([{ label: "Start", route: "app/page.tsx" }])
    expect(m.metadata).toBe("custom SEO direction")
    // Derived:
    expect(m.routes).toEqual(["app/page.tsx"])
    expect(m.sharedLayout.length).toBeGreaterThan(0)
    expect(m.backendEndpoints).toEqual(["app/api/x/route.ts"])
  })

  it("(5) returns a schema-valid fallback with a present home route and never throws", () => {
    let plan!: ReturnType<typeof parsePlan>
    expect(() => {
      plan = parsePlan("this is not json at all — just prose")
    }).not.toThrow()
    expect(plan.manifest.routes).toContain("app/page.tsx")
    expect(plan.manifest.navigation).toEqual([{ label: "Home", route: "app/page.tsx" }])
    expect(plan.manifest.sharedLayout.length).toBeGreaterThan(0)
    expect(plan.manifest.metadata.length).toBeGreaterThan(0)
    expect(plan.summary.length).toBeGreaterThan(0)
  })

  it("(6) keeps legacy fields equal to the pinned reference for a legacy input", () => {
    const legacy = JSON.stringify({
      summary: "Legacy site",
      design: { style: "a", colors: "b", typography: "c", layout: "d" },
      steps: ["one", "two"],
      pages: [{ path: "app/page.tsx", title: "Home", purpose: "p", sections: ["s1", "s2"] }],
      components: ["components/x.tsx"],
      backend: ["app/api/y/route.ts — POST"],
    })
    const plan = parsePlan(legacy)
    expect(projectLegacyFields(plan)).toEqual(legacyReferenceParse(legacy))
  })

  it("(7) honors explicit files, else derives them from the plan", () => {
    const withExplicit = parsePlan(
      JSON.stringify({
        pages: [{ path: "app/page.tsx", title: "Home", purpose: "x", sections: ["a"] }],
        files: [{ path: "app/custom.tsx", purpose: "custom file" }],
      }),
    )
    expect(withExplicit.files).toEqual([{ path: "app/custom.tsx", purpose: "custom file" }])

    const derived = parsePlan(
      JSON.stringify({
        pages: [{ path: "app/page.tsx", title: "Home", purpose: "x", sections: ["a"] }],
        components: ["components/site-header.tsx"],
        backend: ["app/api/contact/route.ts — POST"],
      }),
    )
    expect(derived.files).toEqual([
      { path: "app/page.tsx", purpose: "Home page" },
      { path: "components/site-header.tsx", purpose: "shared component" },
      { path: "app/api/contact/route.ts", purpose: "backend" },
    ])
  })
})
