// AI prompts for the planner pass. We ask the model for a single JSON object
// shaped like a `GeneratedProjectManifest`, with strict rules that map onto
// our deterministic renderer's capabilities. The downstream code re-validates
// and falls back if the model misbehaves, so prompt slips never break a build.

import { THEME_PRESETS } from "./themes"

const SECTION_KINDS = [
  "hero",
  "feature-grid",
  "stats",
  "testimonials",
  "pricing",
  "faq",
  "contact",
  "gallery",
  "product-grid",
  "comparison",
  "process",
  "cta",
  "logos",
  "team",
  "blog-preview",
] as const

const VARIANTS_BY_KIND: Record<(typeof SECTION_KINDS)[number], string[]> = {
  hero: ["split", "centered", "gradient-card", "saas-dashboard", "ecommerce", "editorial"],
  "feature-grid": ["cards", "bento", "icon-grid", "alternating"],
  stats: ["row", "card-row", "split-callout"],
  testimonials: ["grid-cards", "spotlight", "marquee-static"],
  pricing: ["three-tier", "two-tier-toggle"],
  faq: ["accordion", "two-column"],
  contact: ["form", "split-form", "info-card"],
  gallery: ["grid", "masonry", "spotlight"],
  "product-grid": ["card-grid", "compact"],
  comparison: ["table"],
  process: ["steps", "timeline", "numbered-cards"],
  cta: ["banner", "split", "boxed-card"],
  logos: ["row", "marquee-static"],
  team: ["card-grid"],
  "blog-preview": ["card-grid", "feature-and-list"],
}

export const PLAN_SYSTEM_PROMPT = `You are a senior product designer + copywriter generating a complete shadcn/ui website plan.

Return ONLY one JSON object, no prose, no markdown fences, matching this shape:
{
  "brief": {
    "projectName": string,
    "tagline": string,
    "description": string,
    "audience": string,
    "voice": string,
    "themePreset": one of ${THEME_PRESETS.map((p) => `"${p}"`).join(" | ")},
    "navLinks": [ { "label": string, "href": string } ],
    "primaryCta": { "label": string, "href": string },
    "secondaryCta"?: { "label": string, "href": string },
    "footerCta"?: { "label": string, "href": string },
    "socialLinks"?: [ { "label": string, "href": string } ],
    "contact"?: { "email"?: string, "phone"?: string, "address"?: string }
  },
  "needsDatabase": boolean,
  "integrations": [
    {
      "kind": "database" | "auth" | "email" | "analytics" | "storage" | "payments" | "other",
      "name": string,
      "provider": string,
      "reason": string,
      "envVars": string[]
    }
  ],
  "pages": [
    {
      "path": "/" or "/something" (lowercase, kebab),
      "title": string,
      "metaTitle": string,
      "metaDescription": string,
      "sections": SectionPlan[]
    }
  ]
}

Integration & database rules:
- Set "needsDatabase": true for bookings, ecommerce, orders, cart, dashboards, accounts, admin panels, CMS/blog editing, marketplaces, saved forms, inventory, or any user-generated/persistent data.
- Set "needsDatabase": false for purely static landing pages, marketing sites, brochure sites, or one-off event pages without signups.
- If "needsDatabase" is true, ALWAYS include exactly one integration with "provider": "turso", "kind": "database", "name": "Turso", and "envVars": ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"].
- Only add non-database integrations (payments, email, auth, etc.) if the requested app clearly needs them. Do NOT invent analytics or marketing tools the user didn't ask for.
- Never hard-code secret values anywhere in the plan. Only env var NAMES may appear.

SectionPlan rules:
- "kind" must be one of: ${SECTION_KINDS.map((k) => `"${k}"`).join(" | ")}
- "variant" should be one of:
${Object.entries(VARIANTS_BY_KIND)
  .map(([k, v]) => `    ${k}: ${v.map((x) => `"${x}"`).join(" | ")}`)
  .join("\n")}
- Provide concrete, on-brand copy. NEVER use "Lorem ipsum", "production-ready responsive", "blah blah", or vague filler.
- "items" should be a meaningful array for content-heavy kinds (feature-grid, stats, testimonials, pricing, faq, gallery, product-grid, comparison, process, logos, team, blog-preview).
- For pricing items, set price, period, features (3-5 strings), and exactly one item with "highlighted": true.
- For testimonials, include quote, author, role, and initials (2 chars).
- For faq, include title (question) and description (answer) for each item.
- For stats, include value and label, optionally suffix ("+", "%", "k").
- For logos, include label only (vendor names).
- For gallery / product-grid / blog-preview / team: include title, description, optional category/tag/price.
- For process: include eyebrow ("Step 01"), title, description.
- For contact: prefer variant "form" or "split-form".

Page structure rules:
- Home page ("/") MUST have at least 5 sections from DIFFERENT kinds. A clean rhythm:
  hero -> logos OR stats -> feature-grid -> (process OR comparison OR gallery) -> testimonials -> pricing OR product-grid -> faq -> cta.
- Internal pages must NOT clone the homepage. Pick 3-5 sections suited to that page's job.
- Vary the "variant" so consecutive sections never share the same layout.
- Internal links must only point to paths you defined in "pages" or in-page anchors ("#section-id").
- 3 to 6 total pages. Always include "/" first.
- Never reference shadcn components that aren't standard (only use what a normal shadcn install provides).
- Sections must NOT include site headers, footers or global navigation; the scaffold renders those.

Voice & copy rules:
- Names, taglines and descriptions must be specific to the user's prompt. No generic "Welcome to our website".
- Replace any vague phrase with specific value. Numbers are good ("ships in 48h", "12,400 active studios").
- Keep CTA labels punchy (2-4 words).
- All hrefs that are not in-page anchors must start with "/" and match a defined page.

Output strict JSON. No comments, no trailing commas, no markdown.`

export const PAGE_REPAIR_PROMPT = `You are repairing JSON for a website-builder pipeline.
The previous output was not valid JSON or did not match the schema described.
Return ONLY the fixed JSON object — no markdown, no commentary.
Preserve the original intent (project name, theme, page list, copy) where possible
but make it conform to the schema. If a field is missing, fill it sensibly.`

export const COPY_POLISH_PROMPT = `You are a senior copywriter polishing a JSON site plan.
Improve the copy in every "heading", "subheading", "description", "title" and item field
so it is specific, vivid, and on-brand for: {brief}.
Replace any of these phrases that appear: "Lorem ipsum", "production-ready", "responsive behavior",
"blah", "placeholder", "TODO", "etc.", "Coming soon".
Return the SAME JSON shape with the same paths/structure — only the copy strings change.
Do NOT add or remove sections. Output JSON only.`
