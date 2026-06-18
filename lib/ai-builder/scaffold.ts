// Generates the static base of the Next.js project — files that
// don't depend on AI output (package.json, tsconfig, layout, header,
// footer, motion wrappers, helpers, theme/css, and a serialized
// manifest used at runtime by the layout for nav/footer rendering).
//
// All generated files are returned as { path, content } entries.

import type { GeneratedFile, SiteManifest } from "./types"

export function generateScaffoldFiles(manifest: SiteManifest): GeneratedFile[] {
  return [
    { path: "package.json", content: pkgJson(manifest) },
    { path: "next.config.ts", content: nextConfigTs() },
    { path: "tsconfig.json", content: tsconfigJson() },
    { path: "tailwind.config.ts", content: tailwindConfigTs() },
    { path: "postcss.config.js", content: postcssConfigJs() },
    { path: "components.json", content: shadcnComponentsJson() },
    { path: "app/layout.tsx", content: appLayoutTsx(manifest) },
    { path: "app/globals.css", content: globalsCss(manifest) },
    { path: "components/site-header.tsx", content: siteHeaderTsx(manifest) },
    { path: "components/site-footer.tsx", content: siteFooterTsx(manifest) },
    { path: "components/motion/fade-in.tsx", content: fadeInTsx() },
    { path: "components/motion/stagger.tsx", content: staggerTsx() },
    { path: "components/motion/motion-card.tsx", content: motionCardTsx() },
    { path: "lib/utils.ts", content: utilsTs() },
    { path: "lib/site-config.ts", content: siteConfigTs(manifest) },
    { path: "lib/generated-manifest.ts", content: generatedManifestTs(manifest) },
  ]
}

function pkgJson(manifest: SiteManifest): string {
  const name = manifest.projectName
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "ai-generated-site"
  return JSON.stringify(
    {
      name,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "^15.0.0",
        react: "^19.0.0",
        "react-dom": "^19.0.0",
        "framer-motion": "^12.0.0",
        "lucide-react": "^0.454.0",
        clsx: "^2.1.1",
        "tailwind-merge": "^2.5.0",
        "class-variance-authority": "^0.7.1",
        "tailwindcss-animate": "^1.0.7",
        "@radix-ui/react-slot": "^1.1.0",
      },
      devDependencies: {
        typescript: "^5.4.0",
        "@types/node": "^22.0.0",
        "@types/react": "^19.0.0",
        "@types/react-dom": "^19.0.0",
        tailwindcss: "^3.4.0",
        postcss: "^8.4.0",
        autoprefixer: "^10.4.0",
      },
    },
    null,
    2,
  )
}

function nextConfigTs(): string {
  return `import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  reactStrictMode: true,
}

export default nextConfig
`
}

function tsconfigJson(): string {
  return JSON.stringify(
    {
      compilerOptions: {
        target: "ES2022",
        lib: ["dom", "dom.iterable", "esnext"],
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
        paths: { "@/*": ["./*"] },
      },
      include: ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    null,
    2,
  )
}

function tailwindConfigTs(): string {
  return `import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    container: { center: true, padding: "1rem" },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
`
}

function postcssConfigJs(): string {
  return `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`
}

function shadcnComponentsJson(): string {
  return JSON.stringify(
    {
      $schema: "https://ui.shadcn.com/schema.json",
      style: "default",
      rsc: true,
      tsx: true,
      tailwind: {
        config: "tailwind.config.ts",
        css: "app/globals.css",
        baseColor: "neutral",
        cssVariables: true,
      },
      aliases: {
        components: "@/components",
        utils: "@/lib/utils",
        ui: "@/components/ui",
      },
    },
    null,
    2,
  )
}

function appLayoutTsx(manifest: SiteManifest): string {
  return `import type { Metadata } from "next"
import "./globals.css"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { siteConfig } from "@/lib/site-config"

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: \`%s — \${siteConfig.name}\` },
  description: siteConfig.description,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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

function globalsCss(manifest: SiteManifest): string {
  // Use a default light/dark token set; the primary color hint is
  // applied as the --primary token. Tailwind 3-style directives so the
  // generated project is portable and doesn't depend on Tailwind v4.
  return `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 240 10% 3.9%;
    --card: 0 0% 100%;
    --card-foreground: 240 10% 3.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 240 10% 3.9%;
    --primary: 240 5.9% 10%;
    --primary-foreground: 0 0% 98%;
    --secondary: 240 4.8% 95.9%;
    --secondary-foreground: 240 5.9% 10%;
    --muted: 240 4.8% 95.9%;
    --muted-foreground: 240 3.8% 45%;
    --accent: 240 4.8% 95.9%;
    --accent-foreground: 240 5.9% 10%;
    --destructive: 0 72% 51%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 5.9% 90%;
    --input: 240 5.9% 90%;
    --ring: 240 5.9% 10%;
    --radius: ${manifest.theme.radius};
  }

  .dark {
    --background: 240 10% 3.9%;
    --foreground: 0 0% 98%;
    --card: 240 10% 3.9%;
    --card-foreground: 0 0% 98%;
    --popover: 240 10% 3.9%;
    --popover-foreground: 0 0% 98%;
    --primary: 0 0% 98%;
    --primary-foreground: 240 5.9% 10%;
    --secondary: 240 3.7% 15.9%;
    --secondary-foreground: 0 0% 98%;
    --muted: 240 3.7% 15.9%;
    --muted-foreground: 240 5% 64.9%;
    --accent: 240 3.7% 15.9%;
    --accent-foreground: 0 0% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 0 0% 98%;
    --border: 240 3.7% 15.9%;
    --input: 240 3.7% 15.9%;
    --ring: 240 4.9% 83.9%;
  }
}

@layer base {
  * { @apply border-border; }
  body {
    @apply bg-background text-foreground;
    font-family: ${JSON.stringify(manifest.theme.font)};
  }
}
`
}

function siteHeaderTsx(manifest: SiteManifest): string {
  const layoutClass = manifest.navStyle === "centered"
    ? "flex flex-col items-center gap-3 sm:flex-row sm:justify-center"
    : manifest.navStyle === "split"
    ? "flex items-center justify-between"
    : "flex items-center justify-between"

  return `"use client"

import Link from "next/link"
import { useState } from "react"
import { siteConfig } from "@/lib/site-config"
import { generatedManifest } from "@/lib/generated-manifest"

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const items = generatedManifest.pages.map((p) => ({ href: p.path, label: p.title }))

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto w-full max-w-6xl px-4 py-3 ${layoutClass}">
        <Link href="/" className="text-base font-semibold tracking-tight">
          {siteConfig.name}
        </Link>
        <button
          type="button"
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border sm:hidden"
        >
          <span className="block h-0.5 w-4 bg-foreground" />
        </button>
        <nav className="hidden gap-4 sm:flex">
          {items.map((item) => (
            <Link key={item.href} href={item.href} className="text-sm text-muted-foreground hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {open ? (
        <nav className="border-t border-border bg-background sm:hidden">
          <ul className="mx-auto w-full max-w-6xl px-4 py-2">
            {items.map((item) => (
              <li key={item.href} className="py-2">
                <Link href={item.href} className="block text-sm" onClick={() => setOpen(false)}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
`
}

function siteFooterTsx(manifest: SiteManifest): string {
  if (manifest.footerStyle === "minimal") {
    return `import { siteConfig } from "@/lib/site-config"

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-8">
      <div className="mx-auto w-full max-w-6xl px-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
      </div>
    </footer>
  )
}
`
  }
  if (manifest.footerStyle === "centered") {
    return `import Link from "next/link"
import { siteConfig } from "@/lib/site-config"
import { generatedManifest } from "@/lib/generated-manifest"

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-4 px-4 text-center">
        <p className="text-sm font-semibold">{siteConfig.name}</p>
        <ul className="flex flex-wrap items-center justify-center gap-4">
          {generatedManifest.pages.map((p) => (
            <li key={p.path}>
              <Link href={p.path} className="text-xs text-muted-foreground hover:text-foreground">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} {siteConfig.name}</p>
      </div>
    </footer>
  )
}
`
  }
  // columns
  return `import Link from "next/link"
import { siteConfig } from "@/lib/site-config"
import { generatedManifest } from "@/lib/generated-manifest"

export function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 sm:grid-cols-2 md:grid-cols-3">
        <div>
          <p className="text-sm font-semibold">{siteConfig.name}</p>
          <p className="mt-2 text-xs text-muted-foreground">{siteConfig.description}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Pages</p>
          <ul className="mt-2 space-y-1.5">
            {generatedManifest.pages.map((p) => (
              <li key={p.path}>
                <Link href={p.path} className="text-sm text-muted-foreground hover:text-foreground">
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Legal</p>
          <ul className="mt-2 space-y-1.5">
            <li className="text-sm text-muted-foreground">© {new Date().getFullYear()} {siteConfig.name}</li>
          </ul>
        </div>
      </div>
    </footer>
  )
}
`
}

function fadeInTsx(): string {
  return `"use client"

import { motion, type HTMLMotionProps } from "framer-motion"

export interface FadeInProps extends HTMLMotionProps<"div"> {
  delay?: number
}

export function FadeIn({ delay = 0, children, ...rest }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
`
}

function staggerTsx(): string {
  return `"use client"

import { motion, type HTMLMotionProps } from "framer-motion"

export function Stagger({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-80px" }}
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08 } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: "easeOut" } },
      }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
`
}

function motionCardTsx(): string {
  return `"use client"

import { motion, type HTMLMotionProps } from "framer-motion"

export function MotionCard({ children, ...rest }: HTMLMotionProps<"div">) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}
`
}

function utilsTs(): string {
  return `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`
}

function siteConfigTs(manifest: SiteManifest): string {
  const cfg = {
    name: manifest.projectName,
    description: `${manifest.projectName} — ${manifest.brandStyle}`,
    siteType: manifest.siteType,
    targetAudience: manifest.targetAudience,
  }
  return `export const siteConfig = ${JSON.stringify(cfg, null, 2)} as const
`
}

function generatedManifestTs(manifest: SiteManifest): string {
  // Trim to fields the runtime actually uses (header/footer nav).
  const slim = {
    projectName: manifest.projectName,
    pages: manifest.pages.map((p) => ({ path: p.path, title: p.title })),
  }
  return `export const generatedManifest = ${JSON.stringify(slim, null, 2)} as const
`
}
