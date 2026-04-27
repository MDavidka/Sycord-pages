// ── Step 2: Planning ────────────────────────────────────────────────
// Ask the AI to generate a sitemap and page plan from the intake brief.

import type { IntakeBrief, PlanEntry, ModelSelection } from "./types"
import { callModel, extractJson } from "@/lib/ai-provider"

const PLANNING_PROMPT = `You are the planning stage of a v0-style AI website builder.
Create a multi-page website plan from the user's brief.
Return only valid JSON.
Do not return markdown.
Do not return code.
Each page must include:
- path (string, starts with /)
- title (string)
- description (string)
- features (array of strings, at least 4)
- primaryAction (string)
- secondaryAction (string)
- audience (string)
- contentType (string)
Rules:
- Create at least 4 pages, ideally 5-7.
- The first page must have path "/".
- Each page must have a unique purpose.
- Each page must have at least 4 concrete sections or features.
- Avoid generic pages.
- Tailor everything to the user's brief.
Return a JSON array of page objects.`

function buildFallbackPlan(brief: IntakeBrief): PlanEntry[] {
  const pageTemplates: Record<string, PlanEntry> = {
    home: {
      path: "/",
      title: "Home",
      description: "Main landing page with hero, key features, and calls to action",
      features: ["Hero section with headline and CTA", "Featured highlights grid", "Social proof or testimonials", "Newsletter signup"],
      primaryAction: "Get Started",
      secondaryAction: "Learn More",
      audience: brief.audience,
      contentType: "landing",
    },
    phones: {
      path: "/phones",
      title: "Phones",
      description: "Browse the latest phones with specs, pricing, and filters",
      features: ["Phone catalog grid with cards", "Filter by brand, price, features", "Product detail previews", "Add to cart buttons", "Compare feature"],
      primaryAction: "View Details",
      secondaryAction: "Add to Cart",
      audience: "shoppers",
      contentType: "catalog",
    },
    deals: {
      path: "/deals",
      title: "Deals",
      description: "Current promotions, discounts, and special offers",
      features: ["Deal countdown timers", "Discount banner cards", "Bundle offers section", "Flash sale highlights"],
      primaryAction: "Shop Deal",
      secondaryAction: "View All Deals",
      audience: "shoppers",
      contentType: "promotions",
    },
    "trade-in": {
      path: "/trade-in",
      title: "Trade-In",
      description: "Trade in your old device for credit toward a new purchase",
      features: ["Trade-in value estimator form", "Step-by-step process guide", "Accepted devices list", "FAQ about trade-in"],
      primaryAction: "Get Estimate",
      secondaryAction: "Learn How It Works",
      audience: "shoppers",
      contentType: "form",
    },
    cart: {
      path: "/cart",
      title: "Cart",
      description: "Review items, adjust quantities, and proceed to checkout",
      features: ["Cart items list with quantities", "Price summary and totals", "Promo code input", "Checkout button"],
      primaryAction: "Checkout",
      secondaryAction: "Continue Shopping",
      audience: "shoppers",
      contentType: "transaction",
    },
    support: {
      path: "/support",
      title: "Support",
      description: "Get help with orders, devices, and common questions",
      features: ["Search support articles", "FAQ accordion", "Contact form", "Support categories"],
      primaryAction: "Contact Us",
      secondaryAction: "Browse FAQ",
      audience: brief.audience,
      contentType: "support",
    },
    about: {
      path: "/about",
      title: "About",
      description: "Learn about our company, mission, and team",
      features: ["Company story section", "Team members grid", "Mission and values", "Statistics and milestones"],
      primaryAction: "Contact Us",
      secondaryAction: "Join Our Team",
      audience: brief.audience,
      contentType: "informational",
    },
    contact: {
      path: "/contact",
      title: "Contact",
      description: "Get in touch with our team",
      features: ["Contact form with validation", "Office location map", "Email and phone details", "Business hours"],
      primaryAction: "Send Message",
      secondaryAction: "Call Us",
      audience: brief.audience,
      contentType: "form",
    },
    features: {
      path: "/features",
      title: "Features",
      description: "Explore all platform features and capabilities",
      features: ["Feature cards with icons", "Comparison table", "Integration logos", "Feature deep-dives"],
      primaryAction: "Get Started",
      secondaryAction: "View Pricing",
      audience: brief.audience,
      contentType: "informational",
    },
    pricing: {
      path: "/pricing",
      title: "Pricing",
      description: "Compare plans and choose the right option for you",
      features: ["Pricing tier cards", "Feature comparison table", "FAQ about billing", "Enterprise contact CTA"],
      primaryAction: "Start Free Trial",
      secondaryAction: "Contact Sales",
      audience: brief.audience,
      contentType: "pricing",
    },
    customers: {
      path: "/customers",
      title: "Customers",
      description: "See how our customers succeed with our platform",
      features: ["Customer testimonial cards", "Logo carousel", "Case study previews", "Stats and metrics"],
      primaryAction: "Read Case Study",
      secondaryAction: "Become a Customer",
      audience: brief.audience,
      contentType: "social-proof",
    },
    docs: {
      path: "/docs",
      title: "Documentation",
      description: "Guides, tutorials, and API reference",
      features: ["Getting started guide", "API reference navigation", "Code examples", "Search documentation"],
      primaryAction: "Get Started",
      secondaryAction: "View API Reference",
      audience: "developers",
      contentType: "documentation",
    },
    projects: {
      path: "/projects",
      title: "Projects",
      description: "Explore our portfolio of completed projects",
      features: ["Project gallery grid", "Category filters", "Project detail cards", "Before/after comparisons"],
      primaryAction: "View Project",
      secondaryAction: "Start Your Project",
      audience: brief.audience,
      contentType: "portfolio",
    },
    "case-studies": {
      path: "/case-studies",
      title: "Case Studies",
      description: "In-depth looks at our best client work",
      features: ["Case study cards with results", "Industry filters", "Metrics highlights", "Client testimonials"],
      primaryAction: "Read Full Study",
      secondaryAction: "Get Similar Results",
      audience: brief.audience,
      contentType: "case-study",
    },
    settings: {
      path: "/settings",
      title: "Settings",
      description: "Configure your account and preferences",
      features: ["Profile settings form", "Notification preferences", "Security settings", "Theme preferences"],
      primaryAction: "Save Changes",
      secondaryAction: "Reset to Defaults",
      audience: brief.audience,
      contentType: "settings",
    },
    analytics: {
      path: "/analytics",
      title: "Analytics",
      description: "View metrics, charts, and performance data",
      features: ["Overview dashboard cards", "Charts and graphs", "Date range filter", "Export data button"],
      primaryAction: "Export Report",
      secondaryAction: "Customize View",
      audience: brief.audience,
      contentType: "dashboard",
    },
    orders: {
      path: "/orders",
      title: "Orders",
      description: "View and manage all orders",
      features: ["Orders data table", "Status filters", "Order detail view", "Bulk actions"],
      primaryAction: "View Order",
      secondaryAction: "Export Orders",
      audience: brief.audience,
      contentType: "data-table",
    },
    users: {
      path: "/users",
      title: "Users",
      description: "Manage user accounts and permissions",
      features: ["Users data table", "Role filters", "User detail view", "Invite user form"],
      primaryAction: "Invite User",
      secondaryAction: "Export Users",
      audience: brief.audience,
      contentType: "data-table",
    },
    services: {
      path: "/services",
      title: "Services",
      description: "Explore our professional services",
      features: ["Service cards with descriptions", "Process timeline", "Pricing ranges", "Book consultation CTA"],
      primaryAction: "Book Consultation",
      secondaryAction: "View All Services",
      audience: brief.audience,
      contentType: "services",
    },
    blog: {
      path: "/blog",
      title: "Blog",
      description: "Read the latest articles, news, and insights",
      features: ["Article cards with thumbnails", "Category filters", "Featured post hero", "Newsletter signup"],
      primaryAction: "Read Article",
      secondaryAction: "Subscribe",
      audience: brief.audience,
      contentType: "blog",
    },
  }

  const plan: PlanEntry[] = []
  for (const page of brief.requestedPages) {
    const template = pageTemplates[page]
    if (template) plan.push(template)
  }

  if (plan.length === 0) {
    plan.push(pageTemplates.home)
    plan.push(pageTemplates.about)
    plan.push(pageTemplates.contact)
    plan.push(pageTemplates.features)
  }

  if (!plan.some(p => p.path === "/")) {
    plan.unshift(pageTemplates.home)
  }

  return plan
}

export async function runPlanningStep(
  brief: IntakeBrief,
  model: ModelSelection,
): Promise<PlanEntry[]> {
  const userContent = `User brief:
Site type: ${brief.siteType}
Keywords: ${brief.keywords.slice(0, 20).join(", ")}
Requested pages: ${brief.requestedPages.join(", ")}
Features: ${brief.requestedFeatures.join(", ")}
Style: ${brief.styleHints.join(", ")}
Audience: ${brief.audience}

Original prompt: "${brief.rawPrompt}"`

  const result = await callModel({
    model,
    messages: [
      { role: "system", content: PLANNING_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: 0.2,
  })

  if (result.ok) {
    const parsed = extractJson<PlanEntry[]>(result.content)
    if (parsed && Array.isArray(parsed) && parsed.length >= 3) {
      // Validate each entry has required fields
      const valid = parsed.every(
        p => p.path && p.title && p.features && Array.isArray(p.features)
      )
      if (valid) {
        if (!parsed.some(p => p.path === "/")) {
          parsed[0].path = "/"
        }
        return parsed
      }
    }
  }

  return buildFallbackPlan(brief)
}
