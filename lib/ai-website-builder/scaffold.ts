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

export function computeInitials(name: string): string {
  if (!name) return "SY"
  const letters = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter((c): c is string => Boolean(c))
    .slice(0, 2)
    .join("")
    .toUpperCase()
  return letters || name.slice(0, 2).toUpperCase()
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

function buildPackageJson(
  slug: string,
  requiredComponents: RequiredComponent[],
  opts: { needsDatabase: boolean },
): string {
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
  if (opts.needsDatabase) deps["@libsql/client"] = "^0.14.0"
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
        start: "next start -H 0.0.0.0",
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
  const logoUrl = manifest.brief.logoUrl
  const metaIcons = logoUrl
    ? `,\n  icons: { icon: ${JSON.stringify(logoUrl)}, apple: ${JSON.stringify(logoUrl)} }`
    : ""
  return `import type { Metadata } from "next"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata: Metadata = {
  title: ${JSON.stringify(`${projectName} — ${manifest.brief.tagline}`)},
  description: ${JSON.stringify(manifest.brief.description)},
  openGraph: {
    title: ${JSON.stringify(`${projectName} — ${manifest.brief.tagline}`)},
    description: ${JSON.stringify(manifest.brief.description)},
    siteName: ${JSON.stringify(projectName)},
    type: "website",
  }${metaIcons},
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

function buildSiteHeader(_manifest: GeneratedProjectManifest): string {
  return `"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { siteConfig } from "@/lib/site-config"

const navItems = siteConfig.navLinks
const primaryCta = siteConfig.primaryCta

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
          {siteConfig.logoUrl ? (
            <Image
              src={siteConfig.logoUrl}
              alt={siteConfig.name + " logo"}
              width={32}
              height={32}
              className="h-8 w-8 rounded-lg object-cover"
              priority
            />
          ) : (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-xs font-semibold text-primary-foreground">
              {siteConfig.logoInitials}
            </span>
          )}
          <span>{siteConfig.name}</span>
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
          <Button asChild size="sm"><Link href={primaryCta.href}>{primaryCta.label}</Link></Button>
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
            <Link href={primaryCta.href}>{primaryCta.label}</Link>
          </Button>
        </div>
      </div>
    </header>
  )
}
`
}

function buildSiteFooter(_manifest: GeneratedProjectManifest): string {
  return `import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/lib/site-config"

const navItems = siteConfig.navLinks
const socialLinks = siteConfig.socialLinks
const footerInfo: { email?: string; phone?: string; address?: string } = siteConfig.contact ?? {}
const footerCta = siteConfig.footerCta

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-border/60 bg-card/40">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-4">
          <div className="space-y-3 lg:col-span-2">
            <div className="flex items-center gap-2">
              {siteConfig.logoUrl ? (
                <Image
                  src={siteConfig.logoUrl}
                  alt={siteConfig.name + " logo"}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md object-cover"
                />
              ) : (
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground">
                  {siteConfig.logoInitials}
                </span>
              )}
              <p className="text-lg font-semibold tracking-tight">{siteConfig.name}</p>
            </div>
            <p className="max-w-md text-sm text-muted-foreground">{siteConfig.description}</p>
            {footerCta ? (
              <Button asChild size="sm" variant="outline" className="mt-2">
                <Link href={footerCta.href}>{footerCta.label}</Link>
              </Button>
            ) : null}
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
          <p>© {new Date().getFullYear()} {siteConfig.name}. All rights reserved.</p>
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
  const logoInitials = manifest.brief.logoInitials || computeInitials(manifest.brief.projectName)
  return `import type { Metadata } from "next"

export const siteConfig = ${JSON.stringify(
    {
      name: manifest.brief.projectName,
      tagline: manifest.brief.tagline,
      description: manifest.brief.description,
      audience: manifest.brief.audience,
      category: manifest.brief.category ?? null,
      logoUrl: manifest.brief.logoUrl ?? null,
      logoInitials,
      navLinks: manifest.brief.navLinks,
      primaryCta: manifest.brief.primaryCta,
      secondaryCta: manifest.brief.secondaryCta ?? null,
      footerCta: manifest.brief.footerCta ?? null,
      socialLinks: manifest.brief.socialLinks ?? [],
      contact: manifest.brief.contact ?? null,
      themePreset: manifest.theme.preset,
      integrations: manifest.integrations,
      needsDatabase: manifest.needsDatabase,
      databaseProvider: manifest.databaseProvider ?? null,
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
  "line-graph": () => `"use client"

import * as React from "react"
import { LineChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"

export interface LineGraphProps {
  data?: Array<{ name: string; value: number }>
  xKey?: string
  yKey?: string
  color?: string
  className?: string
}

const FALLBACK_DATA = [
  { name: "Mon", value: 40 },
  { name: "Tue", value: 55 },
  { name: "Wed", value: 48 },
  { name: "Thu", value: 70 },
  { name: "Fri", value: 62 },
]

export function LineGraph({ data, xKey = "name", yKey = "value", color = "hsl(var(--primary))", className }: LineGraphProps) {
  const chartData = data && data.length ? data : FALLBACK_DATA
  return (
    <div className={cn("h-48 w-full rounded-xl border bg-card p-4", className)}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey={xKey} axisLine={false} tickLine={false} fontSize={12} />
          <YAxis hide />
          <Tooltip />
          <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
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

// ---------- Turso / @libsql database scaffolding ----------

// Shapes that the AI planner expresses as "needsDatabase" plus prompt
// keywords. We pick a minimal, real-world SQL schema per shape so queries
// compile and the generated health route can actually run.
export type DbShape = "bookings" | "orders" | "generic"

export function detectDbShape(manifest: GeneratedProjectManifest, prompt: string): DbShape {
  const blob = `${prompt} ${manifest.brief.description} ${manifest.brief.tagline} ${manifest.brief.category ?? ""}`.toLowerCase()
  if (/(book|reservation|appointment|schedule|booking)/.test(blob)) return "bookings"
  if (/(shop|store|ecommerce|e-commerce|cart|checkout|order|product|candle|merch)/.test(blob)) return "orders"
  return "generic"
}

function buildDbClient(): string {
  return `import { createClient, type Client } from "@libsql/client"

// Lazily construct a Turso client so missing env vars only blow up at call
// time (not at module import). This keeps build/CI green even when the
// user hasn't filled in TURSO_DATABASE_URL yet.

let client: Client | null = null

export function getDbClient(): Client {
  if (client) return client
  const url = process.env.TURSO_DATABASE_URL
  const authToken = process.env.TURSO_AUTH_TOKEN
  if (!url) {
    throw new Error(
      "Missing TURSO_DATABASE_URL. Add it to your deploy environment.",
    )
  }
  client = createClient({ url, authToken })
  return client
}

export function hasDbEnv(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL)
}
`
}

function buildDbSchema(shape: DbShape): string {
  const tables: string[] = []
  if (shape === "bookings") {
    tables.push(`CREATE TABLE IF NOT EXISTS bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  party_size INTEGER NOT NULL DEFAULT 2,
  starts_at TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`)
    tables.push(`CREATE INDEX IF NOT EXISTS idx_bookings_starts_at ON bookings(starts_at);`)
  } else if (shape === "orders") {
    tables.push(`CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL,
  image_url TEXT,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`)
    tables.push(`CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  total_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`)
    tables.push(`CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price_cents INTEGER NOT NULL
);`)
  } else {
    tables.push(`CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);`)
  }

  return `import { getDbClient } from "@/lib/db/client"

// Database schema for this generated site. Apply with \`applySchema()\` on
// first boot or via the health check. Idempotent thanks to IF NOT EXISTS.

export const schemaStatements: string[] = ${JSON.stringify(tables, null, 2)}

export async function applySchema(): Promise<void> {
  const db = getDbClient()
  for (const statement of schemaStatements) {
    await db.execute(statement)
  }
}
`
}

function buildDbQueries(shape: DbShape): string {
  if (shape === "bookings") {
    return `import { getDbClient } from "@/lib/db/client"

export interface BookingInput {
  name: string
  email: string
  phone?: string
  partySize: number
  startsAt: string
  notes?: string
}

export interface BookingRecord extends BookingInput {
  id: number
  status: string
  createdAt: string
}

export async function createBooking(input: BookingInput): Promise<number> {
  const db = getDbClient()
  const result = await db.execute({
    sql: \`INSERT INTO bookings (name, email, phone, party_size, starts_at, notes)
          VALUES (?, ?, ?, ?, ?, ?)\`,
    args: [input.name, input.email, input.phone ?? null, input.partySize, input.startsAt, input.notes ?? null],
  })
  return Number(result.lastInsertRowid ?? 0)
}

export async function listUpcomingBookings(limit = 50): Promise<BookingRecord[]> {
  const db = getDbClient()
  const result = await db.execute({
    sql: \`SELECT id, name, email, phone, party_size as partySize, starts_at as startsAt,
                 notes, status, created_at as createdAt
          FROM bookings
          WHERE starts_at >= datetime('now')
          ORDER BY starts_at ASC
          LIMIT ?\`,
    args: [limit],
  })
  return result.rows as unknown as BookingRecord[]
}

export async function updateBookingStatus(id: number, status: string): Promise<void> {
  const db = getDbClient()
  await db.execute({
    sql: "UPDATE bookings SET status = ? WHERE id = ?",
    args: [status, id],
  })
}
`
  }
  if (shape === "orders") {
    return `import { getDbClient } from "@/lib/db/client"

export interface ProductRecord {
  id: number
  slug: string
  name: string
  description: string | null
  priceCents: number
  imageUrl: string | null
  stock: number
}

export interface OrderInput {
  customerName: string
  customerEmail: string
  items: { productId: number; quantity: number; unitPriceCents: number }[]
}

export async function listProducts(limit = 24): Promise<ProductRecord[]> {
  const db = getDbClient()
  const result = await db.execute({
    sql: \`SELECT id, slug, name, description, price_cents as priceCents,
                 image_url as imageUrl, stock
          FROM products ORDER BY created_at DESC LIMIT ?\`,
    args: [limit],
  })
  return result.rows as unknown as ProductRecord[]
}

export async function getProductBySlug(slug: string): Promise<ProductRecord | null> {
  const db = getDbClient()
  const result = await db.execute({
    sql: \`SELECT id, slug, name, description, price_cents as priceCents,
                 image_url as imageUrl, stock
          FROM products WHERE slug = ? LIMIT 1\`,
    args: [slug],
  })
  const row = result.rows[0]
  return (row as unknown as ProductRecord) ?? null
}

export async function createOrder(input: OrderInput): Promise<number> {
  const db = getDbClient()
  const total = input.items.reduce((sum, it) => sum + it.quantity * it.unitPriceCents, 0)
  const insert = await db.execute({
    sql: \`INSERT INTO orders (customer_name, customer_email, total_cents) VALUES (?, ?, ?)\`,
    args: [input.customerName, input.customerEmail, total],
  })
  const orderId = Number(insert.lastInsertRowid ?? 0)
  for (const item of input.items) {
    await db.execute({
      sql: \`INSERT INTO order_items (order_id, product_id, quantity, unit_price_cents)
            VALUES (?, ?, ?, ?)\`,
      args: [orderId, item.productId, item.quantity, item.unitPriceCents],
    })
  }
  return orderId
}
`
  }
  return `import { getDbClient } from "@/lib/db/client"

export interface EntryRecord {
  id: number
  title: string
  body: string | null
  createdAt: string
}

export async function listEntries(limit = 50): Promise<EntryRecord[]> {
  const db = getDbClient()
  const result = await db.execute({
    sql: \`SELECT id, title, body, created_at as createdAt
          FROM entries ORDER BY created_at DESC LIMIT ?\`,
    args: [limit],
  })
  return result.rows as unknown as EntryRecord[]
}

export async function createEntry(input: { title: string; body?: string }): Promise<number> {
  const db = getDbClient()
  const result = await db.execute({
    sql: "INSERT INTO entries (title, body) VALUES (?, ?)",
    args: [input.title, input.body ?? null],
  })
  return Number(result.lastInsertRowid ?? 0)
}
`
}

function buildHealthRoute(): string {
  return `import { NextResponse } from "next/server"
import { getDbClient, hasDbEnv } from "@/lib/db/client"
import { applySchema } from "@/lib/db/schema"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  if (!hasDbEnv()) {
    return NextResponse.json(
      { ok: false, error: "Missing TURSO_DATABASE_URL environment variable." },
      { status: 503 },
    )
  }
  try {
    const db = getDbClient()
    await applySchema()
    const result = await db.execute("SELECT 1 as ok")
    return NextResponse.json({ ok: true, result: result.rows })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    )
  }
}
`
}

export function buildDatabaseFiles(
  manifest: GeneratedProjectManifest,
  prompt: string,
): BuilderFile[] {
  if (!manifest.needsDatabase) return []
  const shape = detectDbShape(manifest, prompt)
  const files: BuilderFile[] = [
    { path: "lib/db/client.ts", content: buildDbClient() },
    { path: "lib/db/schema.ts", content: buildDbSchema(shape) },
    { path: "lib/db/queries.ts", content: buildDbQueries(shape) },
  ]
  files.push({ path: "app/api/health/db/route.ts", content: buildHealthRoute() })
  return files
}

export function scaffoldBaseFiles(
  manifest: GeneratedProjectManifest,
  requiredComponents: RequiredComponent[],
  prompt: string,
): BuilderFile[] {
  const slug = projectSlug(manifest.brief.projectName)
  const needsDatabase = manifest.needsDatabase
  const files: BuilderFile[] = [
    { path: "package.json", content: buildPackageJson(slug, requiredComponents, { needsDatabase }) },
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
  files.push(...buildDatabaseFiles(manifest, prompt))
  return files
}
