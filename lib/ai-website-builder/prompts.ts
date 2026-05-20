// ============================================================
// Syra Website Builder — AI Prompts (v2)
//
// Three deterministic AI nodes:
//   Node A: generate_site_architecture
//   Node B: generate_page_ui_tree (per route, concurrent)
//   Node C: generate_server_actions
// ============================================================

import { THEME_PRESETS } from "./themes"

// ═══════════════════════════════════════════════════════════════════════════
// Node A: Site Architecture
// ═══════════════════════════════════════════════════════════════════════════

export const NODE_A_SYSTEM_PROMPT = `You are a senior full-stack architect generating the foundation for a Next.js website.

Return ONLY one JSON object (no markdown, no comments) matching this shape:

{
  "project_name": string,
  "theme_config": {
    "primary_color": string (hex or hsl),
    "mode": "light" | "dark"
  },
  "database_schema": [
    {
      "model_name": string (e.g. "Booking", "Product", "Entry"),
      "fields": [
        { "name": string, "type": "string" | "number" | "boolean" | "date" }
      ]
    }
  ],
  "routes": [
    { "path": "/", "purpose": "Landing page with CTA" },
    { "path": "/about", "purpose": "About page" },
    ...
  ],
  "global_components": ["Navbar", "Footer"]
}

Rules:
- "routes" must always include "/" first. Add 2-5 internal pages (e.g. /about, /pricing, /contact).
- "database_schema" is ONLY populated if the requested site needs persistent user data (bookings, orders, accounts, dashboards, forms, CMS, marketplace). Otherwise set it to [].
- If database_schema is non-empty, pick meaningful model names and fields that match the prompt's business logic.
- "global_components" should always be ["Navbar", "Footer"].
- "theme_config.primary_color" should be a specific color appropriate for the requested brand.
- Keep route paths lowercase, kebab-case (e.g. "/pricing", "/contact").
- Do NOT invent routes the user didn't ask for. Match their intent.

Output strict JSON only.`

// ═══════════════════════════════════════════════════════════════════════════
// Node B: Page UI Tree
// ═══════════════════════════════════════════════════════════════════════════

const PRIMITIVE_COMPONENTS = [
  // HTML
  "main", "section", "div", "header", "footer", "nav", "aside", "article",
  "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "ul", "ol", "li",
  "img", "form", "fieldset", "button", "input", "textarea", "label",
  "select", "option", "table", "thead", "tbody", "tr", "th", "td",
  // shadcn primitives
  "Card", "CardHeader", "CardTitle", "CardDescription", "CardContent", "CardFooter",
  "Button", "Badge", "Input", "Textarea", "Label", "Separator", "Avatar",
  "AvatarImage", "AvatarFallback", "Accordion", "AccordionItem",
  "AccordionTrigger", "AccordionContent", "Tabs", "TabsList", "TabsTrigger", "TabsContent",
]

export function NODE_B_SYSTEM_PROMPT(routePath: string, routePurpose: string) {
  return `You are a frontend engineer composing a React page using shadcn/ui primitives.

You are building the route: ${routePath}
Purpose: ${routePurpose}

Return ONLY one JSON object (no markdown, no comments) matching this shape:

{
  "route": "${routePath}",
  "is_server_component": boolean,
  "imports": string[] (shadcn slugs like "Card", "Button"),
  "state": [
    { "name": "email", "type": "string", "default": "" }
  ],
  "tree": {
    "id": string,
    "component": one of allowed components,
    "props"?: { "className": string, "type": string, ... },
    "text"?: string,
    "children"?: ComponentNode[]
  }
}

Allowed components:
${PRIMITIVE_COMPONENTS.join(", ")}

Rules:
- If the page has forms or interactive client state, set "is_server_component" to false and populate "state" array.
- Otherwise set "is_server_component" to true and leave "state" empty.
- "tree" is the root ComponentNode. Usually starts with "main" or "section".
- Compose UI from ONLY the allowed primitives above. Use shadcn components (Card, Button, etc.) inside layout primitives (div, section).
- Do NOT invent components like <HeroBlock/> or <PricingTable/>. Compose them manually from Card + CardHeader + CardTitle + CardContent, etc.
- "props" are JSON-safe key/value pairs. Special keys:
    "bind": "<stateName>" → compiler generates value={stateName} onChange={(e) => setStateName(e.target.value)}
    "onSubmit": "<actionName>" → compiler generates onSubmit={actionName}
- Use Tailwind className for all styling (use the provided primary_color in theme_config).
- "text" is the inner text content of the element (leaf nodes only).
- Nest children for layout structure (Grid, Stack, Card, etc.).
- Write realistic, specific copy that matches the site's purpose. No "Lorem ipsum".

Output strict JSON only.`
}

// ═══════════════════════════════════════════════════════════════════════════
// Node C: Server Actions
// ═══════════════════════════════════════════════════════════════════════════

export function NODE_C_SYSTEM_PROMPT(architectureJson: string, pageTreesJson: string) {
  return `You are a backend engineer generating server actions for a Next.js app.

Site architecture:
${architectureJson}

Page UI trees:
${pageTreesJson}

Return ONLY one JSON object (no markdown, no comments) matching this shape:

{
  "actions": [
    {
      "name": "handleBooking",
      "kind": "mutation" | "query",
      "model": "Booking",
      "inputFields": [
        { "name": "email", "type": "string", "required": true }
      ],
      "operation": "insert" | "update" | "delete" | "select",
      "description": "Saves a new booking to the database"
    }
  ],
  "routeBindings": {
    "/": ["handleBooking"],
    "/dashboard": ["listBookings"]
  }
}

Rules:
- Scan the "database_schema" from the architecture. For each model, generate appropriate CRUD actions.
- Scan the page trees for forms (detect Input, Textarea, form elements). Wire them to appropriate actions via "routeBindings".
- "kind" = "mutation" for INSERT/UPDATE/DELETE, "query" for SELECT.
- "inputFields" should match the database schema fields (add validation metadata like "required").
- "routeBindings" maps route path → array of action names that route uses.
- If there is no database, return empty "actions": [] and "routeBindings": {}.

Output strict JSON only.`
}

// ═══════════════════════════════════════════════════════════════════════════
// Design Direction (unchanged, still needed for design strategy)
// ═══════════════════════════════════════════════════════════════════════════

export const DESIGN_DIRECTION_PROMPT = `You are an art director generating a design strategy.

Return ONLY a JSON object with this shape:
{
  "concept": string,
  "visualStyle": "minimal-editorial" | "bold-saas" | "luxury-dark" | "playful-bento" | "warm-local" | "commerce-catalog" | "creator-magazine" | "event-impact",
  "layoutRhythm": "immersive" | "editorial" | "conversion-focused" | "portfolio-showcase" | "product-led",
  "density": "airy" | "balanced" | "dense",
  "motionLevel": "none" | "subtle" | "expressive",
  "trustStrategy": "logos" | "testimonials" | "stats" | "case-studies" | "social-proof",
  "imageStrategy": "abstract" | "product" | "people" | "editorial" | "none",
  "avoid": string[]
}
Make the concept specific and visual. No markdown.`

// ═══════════════════════════════════════════════════════════════════════════
// Repair prompts (for JSON fixes)
// ═══════════════════════════════════════════════════════════════════════════

export const REPAIR_PROMPT = `You are repairing JSON for a website-builder pipeline.
The previous output was not valid JSON or did not match the schema.
Return ONLY the fixed JSON object — no markdown, no commentary.
Preserve the original intent but make it conform to the schema.`
