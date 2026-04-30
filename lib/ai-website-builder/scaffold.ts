// File scaffolding for generated sites. Emits a complete, deployable
// Next.js App Router project: configs, app/layout.tsx, app/globals.css,
// SiteHeader, SiteFooter, lib helpers, and a curated set of shadcn-style
// local UI components in `components/ui/*`.

import type {
  BuilderFile,
  ColorTokens,
  GeneratedProjectManifest,
  RequiredComponent,
  ThemeTokens,
} from "./types"

function projectSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "generated-site"
  )
}

function tokensToCssVars(tokens: ColorTokens, radius: string): string {
  return `  --background: ${tokens.background};
  --foreground: ${tokens.foreground};
  --card: ${tokens.card};
  --card-foreground: ${tokens.cardForeground};
  --popover: ${tokens.popover};
  --popover-foreground: ${tokens.popoverForeground};
  --primary: ${tokens.primary};
  --primary-foreground: ${tokens.primaryForeground};
  --secondary: ${tokens.secondary};
  --secondary-foreground: ${tokens.secondaryForeground};
  --muted: ${tokens.muted};
  --muted-foreground: ${tokens.mutedForeground};
  --accent: ${tokens.accent};
  --accent-foreground: ${tokens.accentForeground};
  --destructive: ${tokens.destructive};
  --destructive-foreground: ${tokens.destructiveForeground};
  --border: ${tokens.border};
  --input: ${tokens.input};
  --ring: ${tokens.ring};
  --radius: ${radius};`
}

function backgroundUtilities(theme: ThemeTokens): string {
  switch (theme.background) {
    case "grid":
      return `.bg-grid {
  background-image:
    linear-gradient(to right, hsl(var(--border) / 0.4) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.4) 1px, transparent 1px);
  background-size: 32px 32px;
}`
    case "radial":
      return `.bg-radial {
  background: radial-gradient(circle at top, hsl(var(--primary) / 0.18), transparent 60%);
}`
    case "noise":
      return `.bg-noise {
  background-image: radial-gradient(hsl(var(--foreground) / 0.06) 1px, transparent 1px);
  background-size: 4px 4px;
}`
    case "soft":
      return `.bg-soft { background: linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--accent) / 0.15) 100%); }`
    default:
      return ""
  }
}

function buildGlobalsCss(theme: ThemeTokens): string {
  const fontDisplay = theme.fontDisplay ?? theme.fontSans
  return `@import "tailwindcss";

:root {
${tokensToCssVars(theme.light, theme.radius)}
}

.dark {
${tokensToCssVars(theme.dark, theme.radius)}
}

@theme inline {
  --font-sans: ${theme.fontSans};
  --font-display: ${fontDisplay};
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
}

@layer base {
  * { border-color: hsl(var(--border)); }
  html { scroll-behavior: smooth; }
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--font-sans);
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
    -webkit-font-smoothing: antialiased;
    text-rendering: optimizeLegibility;
  }
  h1, h2, h3, h4 { font-family: var(--font-display); letter-spacing: -0.02em; }
}

${backgroundUtilities(theme)}
`
}

function buildPackageJson(slug: string, requiredComponents: RequiredComponent[]): string {
  const slugs = new Set(requiredComponents.map((c) => c.slug))
  const deps: Record<string, string> = {
    next: "^15.0.0",
    react: "^19.0.0",
    "react-dom": "^19.0.0",
    "lucide-react": "^0.454.0",
    clsx: "^2.1.1",
    "tailwind-merge": "^2.5.5",
    "class-variance-authority": "^0.7.1",
    "@radix-ui/react-slot": "^1.1.0",
  }
  if (slugs.has("accordion")) deps["@radix-ui/react-accordion"] = "^1.2.2"
  if (slugs.has("avatar")) deps["@radix-ui/react-avatar"] = "^1.1.1"
  if (slugs.has("separator")) deps["@radix-ui/react-separator"] = "^1.1.0"
  if (slugs.has("label")) deps["@radix-ui/react-label"] = "^2.1.0"
  if (slugs.has("tabs")) deps["@radix-ui/react-tabs"] = "^1.1.1"
  const devDeps: Record<string, string> = {
    "@tailwindcss/postcss": "^4.0.0",
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    postcss: "^8.4.0",
    tailwindcss: "^4.0.0",
    typescript: "^5.0.0",
  }
  return JSON.stringify(
    {
      name: slug,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: deps,
      devDependencies: devDeps,
    },
    null,
    2,
  )
}

function buildNextConfig(): string {
  return `/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  reactStrictMode: true,
}

export default nextConfig
`
}

function buildTsconfig(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "es2022"],
        allowJs: true,
        skipLibCheck: true,
        strict: true,
        noEmit: true,
        esModuleInterop: true,
        module: "esnext",
        moduleResolution: "bundler",
        resolveJsonModule: true,
        isolatedModules: true,
        jsx: "preserve",
        incremental: true,
        plugins: [{ name: "next" }],
        baseUrl: ".",
        paths: { "@/*": ["./*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  )
}

function buildPostcssConfig(): string {
  return `module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
}
`
}

function buildLayout(manifest: GeneratedProjectManifest): string {
  const projectName = manifest.brief.projectName
  return `import type { Metadata } from "next"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: ${JSON.stringify(`${projectName} — ${manifest.brief.tagline}`)},
  description: ${JSON.stringify(manifest.brief.description)},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
`
}

function buildSiteHeader(manifest: GeneratedProjectManifest): string {
  const projectName = manifest.brief.projectName
  const navLinks = manifest.brief.navLinks
  const primaryCta = manifest.brief.primaryCta
  const navItems = navLinks
    .map((l) => `{ label: ${JSON.stringify(l.label)}, href: ${JSON.stringify(l.href)} }`)
    .join(",\n  ")
  return `"use client"

import * as React from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const navItems: { label: string; href: string }[] = [
  ${navItems},
]

export function SiteHeader() {
  const [open, setOpen] = React.useState(false)
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", onKey)
    return () => {
      document.body.style.overflow = ""
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">${projectName
            .split(/\s+/)
            .map((w) => w[0])
            .filter(Boolean)
            .slice(0, 2)
            .join("")
            .toUpperCase() || "S"}</span>
          <span>${projectName}</span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="hidden md:block">
          <Button asChild size="sm"><Link href={${JSON.stringify(primaryCta.href)}}>${primaryCta.label}</Link></Button>
        </div>
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md text-foreground/80 transition hover:bg-accent hover:text-accent-foreground md:hidden"
          aria-label="Open menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>
      <div
        className={cn(
          "border-t border-border/60 bg-background md:hidden",
          open ? "block" : "hidden",
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 sm:px-6 lg:px-8">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-base font-medium text-muted-foreground transition hover:bg-accent hover:text-accent-foreground"
            >
              {item.label}
            </Link>
          ))}
          <Button asChild className="mt-2 w-full" onClick={() => setOpen(false)}>
            <Link href={${JSON.stringify(primaryCta.href)}}>${primaryCta.label}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
`
}

function buildSiteFooter(manifest: GeneratedProjectManifest): string {
  const { projectName, navLinks, footerCta, contact, socialLinks, description } = manifest.brief
  const navItems = navLinks
    .map((l) => `{ label: ${JSON.stringify(l.label)}, href: ${JSON.stringify(l.href)} }`)
    .join(", ")
  const socials = (socialLinks ?? []).map((s) => `{ label: ${JSON.stringify(s.label)}, href: ${JSON.stringify(s.href)} }`).join(", ")
  return `import Link from "next/link"
import { Button } from "@/components/ui/button"

const navItems: { label: string; href: string }[] = [${navItems}]
const socialLinks: { label: string; href: string }[] = [${socials}]
const footerInfo = {
  email: ${JSON.stringify(contact?.email ?? "")},
  phone: ${JSON.stringify(contact?.phone ?? "")},
  address: ${JSON.stringify(contact?.address ?? "")},
}

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="space-y-3 lg:col-span-2">
            <p className="text-lg font-semibold tracking-tight">${projectName}</p>
            <p className="max-w-md text-sm text-muted-foreground">${description.replace(/"/g, '\\"')}</p>
            ${footerCta?.label
              ? `<Button asChild size="sm" variant="outline" className="mt-2"><Link href={${JSON.stringify(footerCta.href)}}>${footerCta.label}</Link></Button>`
              : ""}
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Explore</p>
            <ul className="space-y-2 text-sm">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="text-muted-foreground transition hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Contact</p>
            <ul className="space-y-2 text-sm text-muted-foreground">
              {footerInfo.email ? <li><a href={\`mailto:\${footerInfo.email}\`} className="transition hover:text-foreground">{footerInfo.email}</a></li> : null}
              {footerInfo.phone ? <li><a href={\`tel:\${footerInfo.phone.replace(/\\s/g, "")}\`} className="transition hover:text-foreground">{footerInfo.phone}</a></li> : null}
              {footerInfo.address ? <li>{footerInfo.address}</li> : null}
            </ul>
            {socialLinks.length > 0 ? (
              <ul className="flex flex-wrap gap-x-4 gap-y-2 pt-2 text-sm">
                {socialLinks.map((s) => (
                  <li key={s.href}>
                    <a href={s.href} className="text-muted-foreground transition hover:text-foreground">{s.label}</a>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div className="mt-12 flex flex-col items-start justify-between gap-3 border-t border-border/60 pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} ${projectName}. All rights reserved.</p>
          <p>Crafted with care.</p>
        </div>
      </div>
    </footer>
  )
}
`
}

function buildLibUtils(): string {
  return `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
}

function buildSiteConfig(manifest: GeneratedProjectManifest): string {
  return `import type { Metadata } from "next"

export const siteConfig = ${JSON.stringify(
    {
      name: manifest.brief.projectName,
      tagline: manifest.brief.tagline,
      description: manifest.brief.description,
      audience: manifest.brief.audience,
      navLinks: manifest.brief.navLinks,
      primaryCta: manifest.brief.primaryCta,
      secondaryCta: manifest.brief.secondaryCta,
      footerCta: manifest.brief.footerCta,
      socialLinks: manifest.brief.socialLinks ?? [],
      contact: manifest.brief.contact ?? null,
      themePreset: manifest.theme.preset,
    },
    null,
    2,
  )} as const

export type SiteConfig = typeof siteConfig

export function pageMetadata(input: { title: string; description: string }): Metadata {
  return {
    title: \`\${input.title} — \${siteConfig.name}\`,
    description: input.description,
  }
}
`
}

function buildGeneratedManifest(manifest: GeneratedProjectManifest): string {
  return `// Auto-generated. Snapshot of the design brief, theme tokens and
// page plan that produced this site. Useful for follow-up generation
// passes and for diffing edits between regenerations.
export const generatedManifest = ${JSON.stringify(manifest, null, 2)} as const

export type GeneratedManifest = typeof generatedManifest
`
}

// ---------- shadcn-compatible local UI components ----------

const UI_COMPONENT_BUILDERS: Record<string, () => string> = {
  button: () => `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-6 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  },
)
Button.displayName = "Button"
export { buttonVariants }
`,

  badge: () => `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        destructive: "border-transparent bg-destructive text-destructive-foreground",
        outline: "text-foreground",
      },
    },
    defaultVariants: { variant: "default" },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
export { badgeVariants }
`,

  card: () => `import * as React from "react"
import { cn } from "@/lib/utils"

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", className)} {...props} />
  ),
)
Card.displayName = "Card"

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-6", className)} {...props} />
  ),
)
CardHeader.displayName = "CardHeader"

export const CardTitle = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("font-semibold leading-none tracking-tight", className)} {...props} />
  ),
)
CardTitle.displayName = "CardTitle"

export const CardDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  ),
)
CardDescription.displayName = "CardDescription"

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-6 pt-0", className)} {...props} />
  ),
)
CardContent.displayName = "CardContent"

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-6 pt-0", className)} {...props} />
  ),
)
CardFooter.displayName = "CardFooter"
`,

  separator: () => `"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

export const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
  <SeparatorPrimitive.Root
    ref={ref}
    decorative={decorative}
    orientation={orientation}
    className={cn(
      "shrink-0 bg-border",
      orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
      className,
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName
`,

  input: () => `import * as React from "react"
import { cn } from "@/lib/utils"

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = "Input"
`,

  textarea: () => `import * as React from "react"
import { cn } from "@/lib/utils"

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = "Textarea"
`,

  label: () => `"use client"

import * as React from "react"
import * as LabelPrimitive from "@radix-ui/react-label"
import { cva } from "class-variance-authority"
import { cn } from "@/lib/utils"

const labelVariants = cva("text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70")

export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root ref={ref} className={cn(labelVariants(), className)} {...props} />
))
Label.displayName = LabelPrimitive.Root.displayName
`,

  avatar: () => `"use client"

import * as React from "react"
import * as AvatarPrimitive from "@radix-ui/react-avatar"
import { cn } from "@/lib/utils"

export const Avatar = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Root
    ref={ref}
    className={cn("relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full", className)}
    {...props}
  />
))
Avatar.displayName = AvatarPrimitive.Root.displayName

export const AvatarImage = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Image>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Image>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Image ref={ref} className={cn("aspect-square h-full w-full", className)} {...props} />
))
AvatarImage.displayName = AvatarPrimitive.Image.displayName

export const AvatarFallback = React.forwardRef<
  React.ElementRef<typeof AvatarPrimitive.Fallback>,
  React.ComponentPropsWithoutRef<typeof AvatarPrimitive.Fallback>
>(({ className, ...props }, ref) => (
  <AvatarPrimitive.Fallback
    ref={ref}
    className={cn("flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium", className)}
    {...props}
  />
))
AvatarFallback.displayName = AvatarPrimitive.Fallback.displayName
`,

  accordion: () => `"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

export const Accordion = AccordionPrimitive.Root

export const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b last:border-0", className)} {...props} />
))
AccordionItem.displayName = "AccordionItem"

export const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-5 text-left text-base font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className,
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = "AccordionTrigger"

export const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-5 text-muted-foreground", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = "AccordionContent"
`,

  tabs: () => `"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

export const Tabs = TabsPrimitive.Root

export const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)}
    {...props}
  />
))
TabsList.displayName = "TabsList"

export const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow",
      className,
    )}
    {...props}
  />
))
TabsTrigger.displayName = "TabsTrigger"

export const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("mt-4 ring-offset-background", className)} {...props} />
))
TabsContent.displayName = "TabsContent"
`,
}

export const ALL_UI_COMPONENTS: RequiredComponent[] = Object.keys(UI_COMPONENT_BUILDERS).map((slug) => ({
  slug,
  path: `components/ui/${slug}.tsx`,
  exports: [],
}))

export function buildUiComponentFiles(slugs: Iterable<string>): BuilderFile[] {
  const out: BuilderFile[] = []
  const seen = new Set<string>()
  for (const slug of slugs) {
    if (seen.has(slug)) continue
    seen.add(slug)
    const builder = UI_COMPONENT_BUILDERS[slug]
    if (!builder) continue
    out.push({ path: `components/ui/${slug}.tsx`, content: builder() })
  }
  return out
}

export function scaffoldBaseFiles(
  manifest: GeneratedProjectManifest,
  requiredComponents: RequiredComponent[],
): BuilderFile[] {
  const slug = projectSlug(manifest.brief.projectName)
  const files: BuilderFile[] = [
    { path: "package.json", content: buildPackageJson(slug, requiredComponents) },
    { path: "next.config.mjs", content: buildNextConfig() },
    { path: "tsconfig.json", content: buildTsconfig() },
    { path: "postcss.config.js", content: buildPostcssConfig() },
    { path: "app/globals.css", content: buildGlobalsCss(manifest.theme) },
    { path: "app/layout.tsx", content: buildLayout(manifest) },
    { path: "components/site-header.tsx", content: buildSiteHeader(manifest) },
    { path: "components/site-footer.tsx", content: buildSiteFooter(manifest) },
    { path: "lib/utils.ts", content: buildLibUtils() },
    { path: "lib/site-config.ts", content: buildSiteConfig(manifest) },
    { path: "lib/generated-manifest.ts", content: buildGeneratedManifest(manifest) },
    { path: "next-env.d.ts", content: `/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n` },
  ]
  return files
}
