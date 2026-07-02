/**
 * Shadcn Component Contract — concise composition rules for Syra.
 *
 * Distilled from the shadcn/ui usage skill so Syra knows HOW to set up and
 * compose components correctly (the #1 source of build errors is wrong
 * composition / missing sub-parts / bad imports — not missing docs).
 *
 * Injected into the system prompt. Keep this tight — it is a checklist, not a
 * manual. When Syra needs the exact API of a specific component it should call
 * shadcnDocs({ component }).
 */
export const SHADCN_COMPONENT_CONTRACT = `
## 🧩 SHADCN COMPONENT CONTRACT (how to set up & compose — read before writing any UI)

You build UIs by **composing shadcn/ui components**, not by writing styled \`<div>\`s. These rules prevent the composition/import errors that break the Docker build.

### Setup — install only what you use
- shadcn foundation (\`lib/utils.ts\`, \`components.json\`, \`globals.css\`, \`tailwind.config.ts\`) is added automatically by \`addShadcnComponent\`.
- **Install just-in-time.** Add a component the moment a file needs it — never bulk-install "to be safe".
- **Start small:** 8–12 core primitives cover most sites (\`button card input label separator badge dialog tabs accordion select dropdown-menu\`).
- **Avoid fragile/version-sensitive components unless the user actually needs them:** \`resizable\`, \`sidebar\`, \`chart\`, \`carousel\`, \`calendar\`, \`command\`, \`data-table\`. Every installed \`components/ui/*.tsx\` is compiled by the Docker build — an unused one with a version mismatch fails deploy.
- **Prefer \`addShadcnComponent({ components:[...] })\`** over \`npx shadcn\` CLI (CLI often crashes on the workspace Node: \`File is not defined\`).
- After installing, only import components confirmed by \`listShadcnComponents()\`. Importing a missing \`@/components/ui/*\` is a hard build error.

### Composition — always keep required sub-parts
- **Items live inside their Group:** \`SelectItem\` → \`SelectGroup\`, \`DropdownMenuItem\` → \`DropdownMenuGroup\`, \`CommandItem\` → \`CommandGroup\`.
- **Overlays need a Title (a11y):** \`DialogTitle\`, \`SheetTitle\`, \`DrawerTitle\` (use \`className="sr-only"\` if visually hidden).
- **Card:** compose \`CardHeader\`/\`CardTitle\`/\`CardDescription\`/\`CardContent\`/\`CardFooter\` — don't dump everything in \`CardContent\`.
- **Tabs:** \`TabsTrigger\` must sit inside \`TabsList\` (never directly in \`Tabs\`).
- **Avatar:** always include \`AvatarFallback\`.
- **Button has no \`isLoading\`/\`isPending\`** — compose \`<Spinner />\` + \`disabled\`.
- **Forms:** wrap fields in \`FieldGroup\` + \`Field\` (or \`Label\` + control) — not raw \`div\` + \`space-y-*\`.

### Use components instead of custom markup
- Callout → \`Alert\`  ·  Empty state → \`Empty\`  ·  Toast → \`sonner\` \`toast()\`
- Divider → \`Separator\` (not \`<hr>\`)  ·  Loading → \`Skeleton\` (not \`animate-pulse\` divs)  ·  Status chip → \`Badge\` (not styled \`<span>\`)

### Styling — className is for layout, not repainting components
- **Semantic tokens only:** \`bg-primary\`, \`text-muted-foreground\`, \`bg-background\`, \`text-destructive\` — never raw \`bg-blue-500\`/\`text-gray-600\` on components.
- **Built-in variants first:** \`variant="outline"\`, \`size="sm"\` — don't re-create them with utility classes.
- Layout classes are fine (\`max-w-md\`, \`mx-auto\`, \`mt-4\`, \`grid\`, \`flex\`).
- Spacing: \`flex flex-col gap-4\` — **not** \`space-y-4\`.  Equal w/h: \`size-10\` — **not** \`w-10 h-10\`.  Use \`truncate\`.  Use \`cn()\` for conditional classes.
- **No manual \`dark:\` overrides** (tokens handle it) and **no \`z-index\` on overlays** (they self-stack).

### Icons (lucide-react)
- Icons in a \`Button\` use \`data-icon="inline-start"\` / \`data-icon="inline-end"\` — no sizing class on the icon.
- Never wrap an icon in a colored circle (generic-AI-site tell).

When unsure about a component's exact props/variants, call \`shadcnDocs({ component })\` — do not guess the API.
`.trim()
