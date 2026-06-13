import type { BlockType } from "@/lib/builder/types"

export interface BlockMeta {
  type: BlockType
  label: string
  description: string
  category: string
  variants: string[]
  defaultProps: Record<string, unknown>
}

export const blockMetadata: BlockMeta[] = [
  {
    type: "navbar",
    label: "Navbar",
    description: "Navigation bar with logo, links, and CTA",
    category: "Navigation",
    variants: ["default", "centered"],
    defaultProps: { logo: "Brand", links: ["Features", "Pricing", "About"], ctaText: "Get Started" },
  },
  {
    type: "hero",
    label: "Hero",
    description: "Full-width hero section with headline and CTAs",
    category: "Hero",
    variants: ["centered", "split", "gradient", "minimal"],
    defaultProps: { headline: "Your Headline Here", subheadline: "A compelling subheadline that explains your value proposition.", primaryCta: "Get Started", secondaryCta: "Learn More" },
  },
  {
    type: "features",
    label: "Features",
    description: "Feature showcase with icon cards",
    category: "Content",
    variants: ["grid", "list", "alternating"],
    defaultProps: { title: "Features", subtitle: "Everything you need", items: [{ icon: "Zap", title: "Fast", description: "Lightning fast performance" }, { icon: "Shield", title: "Secure", description: "Enterprise-grade security" }, { icon: "Globe", title: "Global", description: "Available worldwide" }] },
  },
  {
    type: "pricing",
    label: "Pricing",
    description: "Pricing tiers with feature comparison",
    category: "Commerce",
    variants: ["simple", "comparison"],
    defaultProps: { title: "Pricing", subtitle: "Choose the plan that fits your needs" },
  },
  {
    type: "cta",
    label: "Call to Action",
    description: "Conversion-focused section with CTA button",
    category: "Conversion",
    variants: ["simple", "split"],
    defaultProps: { headline: "Ready to get started?", subheadline: "Start building today.", buttonText: "Start Free" },
  },
  {
    type: "footer",
    label: "Footer",
    description: "Page footer with links and copyright",
    category: "Navigation",
    variants: ["simple", "multi-column", "minimal"],
    defaultProps: { logo: "Brand", copyright: "2026 Brand. All rights reserved.", links: ["Privacy", "Terms"] },
  },
  {
    type: "testimonials",
    label: "Testimonials",
    description: "Customer testimonials with quotes and ratings",
    category: "Social Proof",
    variants: ["cards", "carousel", "spotlight"],
    defaultProps: { title: "What our customers say" },
  },
  {
    type: "stats",
    label: "Stats",
    description: "Key metrics and statistics display",
    category: "Social Proof",
    variants: ["grid", "bar", "counter"],
    defaultProps: { title: "By the numbers" },
  },
  {
    type: "faq",
    label: "FAQ",
    description: "Frequently asked questions accordion",
    category: "Content",
    variants: ["accordion"],
    defaultProps: { title: "Frequently Asked Questions" },
  },
  {
    type: "team",
    label: "Team",
    description: "Team member grid with photos and roles",
    category: "Content",
    variants: ["grid"],
    defaultProps: { title: "Meet the Team" },
  },
  {
    type: "contact",
    label: "Contact",
    description: "Contact form with name, email, and message",
    category: "Forms",
    variants: ["form"],
    defaultProps: { title: "Get in Touch", subtitle: "We'd love to hear from you." },
  },
  {
    type: "newsletter",
    label: "Newsletter",
    description: "Email subscription form with social proof",
    category: "Conversion",
    variants: ["simple"],
    defaultProps: { title: "Stay in the loop", subtitle: "Get updates on new features.", buttonText: "Subscribe" },
  },
  {
    type: "logocloud",
    label: "Logo Cloud",
    description: "Company logos with hover effects",
    category: "Social Proof",
    variants: ["default"],
    defaultProps: { title: "Trusted by leading companies" },
  },
  {
    type: "content",
    label: "Content",
    description: "Rich text content section",
    category: "Content",
    variants: ["prose", "columns", "highlight"],
    defaultProps: { body: "## Getting Started\n\nWrite your content here. Supports **bold**, *italic*, and lists.\n\n- First item\n- Second item\n- Third item" },
  },
  {
    type: "image",
    label: "Image",
    description: "Image with text overlay or side-by-side layout",
    category: "Media",
    variants: ["hero-image", "side-by-side", "grid"],
    defaultProps: { title: "Visual Storytelling", subtitle: "A picture is worth a thousand words.", imageSide: "left" },
  },
  {
    type: "video",
    label: "Video",
    description: "Embedded YouTube or Vimeo video",
    category: "Media",
    variants: ["youtube", "vimeo"],
    defaultProps: { url: "", title: "Watch Our Story" },
  },
  {
    type: "gallery",
    label: "Gallery",
    description: "Image gallery in grid or masonry layout",
    category: "Media",
    variants: ["grid", "masonry"],
    defaultProps: { title: "Gallery" },
  },
  {
    type: "divider",
    label: "Divider",
    description: "Visual separator between sections",
    category: "Layout",
    variants: ["line", "space", "dots"],
    defaultProps: { height: 60, width: "full" },
  },
  {
    type: "banner",
    label: "Banner",
    description: "Announcement bar or ribbon",
    category: "Content",
    variants: ["ribbon", "bar"],
    defaultProps: { text: "New: We just launched v2.0!", linkText: "Learn more" },
  },

  // ---- Mini elements (shadcn-based, can be dropped anywhere) ----
  {
    type: "button",
    label: "Button",
    description: "A shadcn button you can place anywhere",
    category: "Elements",
    variants: ["default", "secondary", "outline", "ghost", "link", "destructive"],
    defaultProps: { text: "Click me", size: "default", align: "left", url: "#", fullWidth: false },
  },
  {
    type: "heading",
    label: "Heading",
    description: "A title / heading element",
    category: "Elements",
    variants: ["h1", "h2", "h3", "h4"],
    defaultProps: { text: "Heading", align: "left" },
  },
  {
    type: "text",
    label: "Text",
    description: "A paragraph of body text",
    category: "Elements",
    variants: ["base", "lead", "muted", "small"],
    defaultProps: { text: "Write some text here. Drag me anywhere on the page.", align: "left" },
  },
  {
    type: "badge",
    label: "Badge",
    description: "A small shadcn badge / pill",
    category: "Elements",
    variants: ["default", "secondary", "outline", "destructive"],
    defaultProps: { text: "New", align: "left" },
  },
  {
    type: "card",
    label: "Card",
    description: "A shadcn card with title and content",
    category: "Elements",
    variants: ["default", "ghost"],
    defaultProps: { title: "Card title", description: "Card description goes here.", body: "Put any supporting content inside this card.", buttonText: "Action" },
  },
]

export const categories = [...new Set(blockMetadata.map((b) => b.category))]
