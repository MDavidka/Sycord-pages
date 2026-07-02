/**
 * Sycord Design Contract — mandatory design law injected into Syra's system prompt.
 * Overrides generic design guidance where they conflict.
 */
export const SYCORD_DESIGN_CONTRACT = `
## 📐 SYCORD DESIGN CONTRACT (MANDATORY — overrides conflicting design rules below)

Fixed design law for every AI-generated website (Next.js + shadcn/ui + Tailwind). Follow without exception.

### 1. Framework & Component Rules
- Always use **shadcn/ui** components (Button, Card, Badge, Input, etc.) — never raw unstyled \`<div>\` buttons.
- Always use **Lucide React** (\`lucide-react\`) for icons. Never emoji, never inline hand-drawn SVG icons, never icon packs outside Lucide.
- Icons at natural size (\`h-4 w-4\` to \`h-6 w-6\`) — **never wrap icons in a colored circle background** (top giveaway of generic AI sites).
- All interactive elements (buttons, links, inputs) from \`components/ui/*\` — no custom one-off styled buttons.

### 2. Font Rules
- Primary font: **Inter** (body + UI), loaded via \`next/font/google\`.
- CSS variable MUST be \`--font-sans\` (not \`--font-geist-sans\`) wired into \`body { font-family: var(--font-sans), system-ui, sans-serif }\` in \`globals.css\`.
- Optional secondary display font only if brand needs personality — otherwise Inter via weight contrast (500/600/700).
- JetBrains Mono only for code blocks, technical data, or pricing tables — never body copy.
- System fonts (Arial, Helvetica, Times) only as final fallback in the stack.

### 3. Color Pattern Rules
- Base theme from an official shadcn preset (Zinc, Slate, Stone, Gray, or Neutral) + ONE accent (Blue, Green, Orange, Rose, or Violet).
- Never invent arbitrary HSL primaries — start from a real preset; adjust only for specified brand color.
- Maximum **2 non-neutral hues** visible in any single viewport.
- \`--card\` and \`--background\` must differ perceptibly in light AND dark mode.
- \`--border\` visible against \`--background\` — never near-invisible.
- Dark mode mandatory alongside light mode with a functional toggle; default from \`prefers-color-scheme\`.

### 4. Shape & Component Styling
- Border radius from theme \`--radius\` token (\`rounded-lg\`, \`rounded-md\`, \`rounded-sm\`) — no arbitrary px.
- Cards, inputs, buttons, badges, modals use consistent radius; badges/chips may use pill radius.
- No colored left-border accent bars on cards — use elevation (shadow) or subtle neutral border.
- Shadows soft and tone-matched, never pure black — layered (tight + diffuse).

### 5. Imagery & Backgrounds
- Content images from real stock (Unsplash, Pexels, approved CDN) or AI-generated — no gray placeholder boxes or broken links.
- Hero/feature sections include at least one real photo or generated image (text-only heroes only for pure SaaS/dashboard tools).
- **Gradient below hero (required on landing pages):** soft gradient-mesh or radial transition using primary/accent at 0.15–0.3 opacity:
  \`background: radial-gradient(ellipse 80% 60% at 50% -10%, hsl(var(--primary) / 0.25), transparent);\`
- No decorative floating blobs unrelated to content — gradients feel like lighting, not decoration.
- Every \`<img>\` needs \`alt\`, \`width\`, \`height\`, \`loading="lazy"\`.

### 6. Layout Rules
- Avoid generic "3-column feature grid with icon-in-circle" as the only feature layout — vary with asymmetric/staggered layouts.
- Left-align body copy; center only short hero headlines/taglines.
- Vary section padding/rhythm — not every section identical height.
- Mobile-first: verify at 375px and 1280px+ before shipping.

### 7. Pre-Flight Checklist (before delivering)
- [ ] \`--font-sans\` on \`body\`
- [ ] \`--card\` ≠ \`--background\` in light AND dark
- [ ] Theme from named shadcn preset, not arbitrary HSL
- [ ] Max 2 non-neutral hues per viewport
- [ ] Lucide icons, never in colored circles
- [ ] Hero gradient transition below (opacity 0.15–0.3 minimum)
- [ ] All images resolve (no broken/placeholder)
- [ ] Border radius via \`--radius\` token
- [ ] Dark mode toggle present and functional
- [ ] WCAG AA contrast on text/background pairs

Run \`grep()\` to audit violations (e.g. \`@/registry/\`, emoji, \`--font-geist\`) before \`deploy()\`.
`.trim()
