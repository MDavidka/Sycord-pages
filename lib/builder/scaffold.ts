// ── Step 5: Next.js File Scaffold ───────────────────────────────────
// Generate base project files deterministically. No AI call.

import type { ProjectManifest, GeneratedFile } from "./types"

export function runScaffoldStep(manifest: ProjectManifest): GeneratedFile[] {
  const files: GeneratedFile[] = []
  const { theme, chrome, design, pages } = manifest

  // package.json
  files.push({
    path: "package.json",
    kind: "config",
    content: JSON.stringify({
      name: manifest.projectName,
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint",
      },
      dependencies: {
        next: "^14.2.0",
        react: "^18.3.0",
        "react-dom": "^18.3.0",
        "framer-motion": "^11.0.0",
        "lucide-react": "^0.400.0",
        "class-variance-authority": "^0.7.0",
        clsx: "^2.1.0",
        "tailwind-merge": "^2.3.0",
        tailwindcss: "^3.4.0",
        "tailwindcss-animate": "^1.0.7",
        "@radix-ui/react-accordion": "^1.2.0",
        "@radix-ui/react-avatar": "^1.1.0",
        "@radix-ui/react-dialog": "^1.1.0",
        "@radix-ui/react-dropdown-menu": "^2.1.0",
        "@radix-ui/react-label": "^2.1.0",
        "@radix-ui/react-navigation-menu": "^1.2.0",
        "@radix-ui/react-select": "^2.1.0",
        "@radix-ui/react-separator": "^1.1.0",
        "@radix-ui/react-slot": "^1.1.0",
        "@radix-ui/react-tabs": "^1.1.0",
        "@radix-ui/react-toast": "^1.2.0",
      },
      devDependencies: {
        typescript: "^5.0.0",
        "@types/node": "^20.0.0",
        "@types/react": "^18.3.0",
        "@types/react-dom": "^18.3.0",
        autoprefixer: "^10.4.0",
        postcss: "^8.4.0",
      },
    }, null, 2),
  })

  // next.config.ts
  files.push({
    path: "next.config.ts",
    kind: "config",
    content: `import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
}

export default nextConfig
`,
  })

  // tsconfig.json
  files.push({
    path: "tsconfig.json",
    kind: "config",
    content: JSON.stringify({
      compilerOptions: {
        target: "ES2017",
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
    }, null, 2),
  })

  // postcss.config.js
  files.push({
    path: "postcss.config.js",
    kind: "config",
    content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
`,
  })

  // tailwind.config.ts
  const hsl = `${theme.primaryHue} ${theme.primarySat}% 50%`
  files.push({
    path: "tailwind.config.ts",
    kind: "config",
    content: `import type { Config } from "tailwindcss"
import tailwindAnimate from "tailwindcss-animate"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
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
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: ["${theme.bodyFont}", "system-ui", "sans-serif"],
        heading: ["${theme.headingFont}", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [tailwindAnimate],
}

export default config
`,
  })

  // components.json
  files.push({
    path: "components.json",
    kind: "config",
    content: JSON.stringify({
      "$schema": "https://ui.shadcn.com/schema.json",
      style: "default",
      rsc: true,
      tsx: true,
      tailwind: {
        config: "tailwind.config.ts",
        css: "app/globals.css",
        baseColor: "slate",
        cssVariables: true,
      },
      aliases: {
        components: "@/components",
        utils: "@/lib/utils",
      },
    }, null, 2),
  })

  // app/globals.css
  files.push({
    path: "app/globals.css",
    kind: "style",
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: ${theme.primaryHue} 5% 10%;
    --card: 0 0% 100%;
    --card-foreground: ${theme.primaryHue} 5% 10%;
    --primary: ${hsl.replace(" ", " ").replace("% ", "% ")};
    --primary-foreground: 0 0% 100%;
    --secondary: ${theme.primaryHue} 5% 96%;
    --secondary-foreground: ${theme.primaryHue} 5% 10%;
    --muted: ${theme.primaryHue} 5% 96%;
    --muted-foreground: ${theme.primaryHue} 5% 45%;
    --accent: ${theme.primaryHue} 5% 96%;
    --accent-foreground: ${theme.primaryHue} 5% 10%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: ${theme.primaryHue} 5% 90%;
    --input: ${theme.primaryHue} 5% 90%;
    --ring: ${theme.primaryHue} ${theme.primarySat}% 50%;
    --radius: ${theme.radius};
  }

  .dark {
    --background: ${theme.primaryHue} 5% 5%;
    --foreground: 0 0% 95%;
    --card: ${theme.primaryHue} 5% 8%;
    --card-foreground: 0 0% 95%;
    --primary: ${theme.primaryHue} ${theme.primarySat}% 55%;
    --primary-foreground: 0 0% 100%;
    --secondary: ${theme.primaryHue} 5% 15%;
    --secondary-foreground: 0 0% 95%;
    --muted: ${theme.primaryHue} 5% 15%;
    --muted-foreground: ${theme.primaryHue} 5% 60%;
    --accent: ${theme.primaryHue} 5% 15%;
    --accent-foreground: 0 0% 95%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: ${theme.primaryHue} 5% 18%;
    --input: ${theme.primaryHue} 5% 18%;
    --ring: ${theme.primaryHue} ${theme.primarySat}% 55%;
  }
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
`,
  })

  // lib/utils.ts
  files.push({
    path: "lib/utils.ts",
    kind: "scaffold",
    content: `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
`,
  })

  // lib/site-config.ts
  const navLinks = pages.map(p => ({ label: p.title, href: p.route }))
  files.push({
    path: "lib/site-config.ts",
    kind: "scaffold",
    content: `export const siteConfig = {
  name: ${JSON.stringify(chrome.brandName)},
  description: ${JSON.stringify(manifest.brief.rawPrompt)},
  navLinks: ${JSON.stringify(navLinks, null, 4)},
  primaryCta: {
    label: ${JSON.stringify(chrome.primaryCtaLabel)},
    href: ${JSON.stringify(chrome.primaryCtaHref)},
  },
}
`,
  })

  // lib/generated-manifest.ts
  files.push({
    path: "lib/generated-manifest.ts",
    kind: "scaffold",
    content: `// Auto-generated manifest — do not edit manually.
export const generatedManifest = ${JSON.stringify(manifest, null, 2)} as const
`,
  })

  // app/layout.tsx
  files.push({
    path: "app/layout.tsx",
    kind: "scaffold",
    content: `import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: ${JSON.stringify(chrome.brandName)},
  description: ${JSON.stringify(manifest.brief.rawPrompt)},
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <SiteHeader />
        <main className="min-h-screen">{children}</main>
        <SiteFooter />
      </body>
    </html>
  )
}
`,
  })

  // components/site-header.tsx
  files.push({
    path: "components/site-header.tsx",
    kind: "component",
    content: generateSiteHeader(manifest),
  })

  // components/site-footer.tsx
  files.push({
    path: "components/site-footer.tsx",
    kind: "component",
    content: generateSiteFooter(manifest),
  })

  // Motion wrappers
  files.push({
    path: "components/motion/fade-in.tsx",
    kind: "component",
    content: `"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

interface FadeInProps {
  children: ReactNode
  delay?: number
  duration?: number
  className?: string
}

export function FadeIn({ children, delay = 0, duration = 0.5, className }: FadeInProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
`,
  })

  files.push({
    path: "components/motion/stagger.tsx",
    kind: "component",
    content: `"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

interface StaggerProps {
  children: ReactNode
  staggerDelay?: number
  className?: string
}

export function Stagger({ children, staggerDelay = 0.1, className }: StaggerProps) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: staggerDelay } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
`,
  })

  files.push({
    path: "components/motion/motion-card.tsx",
    kind: "component",
    content: `"use client"

import { motion } from "framer-motion"
import type { ReactNode } from "react"

interface MotionCardProps {
  children: ReactNode
  className?: string
  delay?: number
}

export function MotionCard({ children, className, delay = 0 }: MotionCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
`,
  })

  // shadcn ui primitives
  files.push(...generateShadcnComponents())

  return files
}

function generateSiteHeader(manifest: ProjectManifest): string {
  const { chrome, pages } = manifest
  const links = pages
    .filter(p => p.route !== "/")
    .slice(0, 6)
    .map(p => `    { label: "${p.title}", href: "${p.route}" }`)
    .join(",\n")

  return `"use client"

import Link from "next/link"
import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

const navLinks = [
${links},
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 sm:h-16 items-center px-4 sm:px-6 lg:px-8">
        <Link href="/" className="mr-4 sm:mr-6 flex items-center space-x-2">
          <span className="text-lg sm:text-xl font-bold">${chrome.brandName}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-4 lg:gap-6 text-sm flex-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button size="sm" asChild>
            <Link href="${chrome.primaryCtaHref}">${chrome.primaryCtaLabel}</Link>
          </Button>
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="ml-auto md:hidden p-2 text-muted-foreground hover:text-foreground"
          aria-label={open ? "Close menu" : "Open menu"}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="flex flex-col p-4 gap-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="text-sm text-muted-foreground hover:text-foreground py-2"
              >
                {link.label}
              </Link>
            ))}
            <Button size="sm" className="mt-2 w-full" asChild>
              <Link href="${chrome.primaryCtaHref}" onClick={() => setOpen(false)}>${chrome.primaryCtaLabel}</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  )
}
`
}

function generateSiteFooter(manifest: ProjectManifest): string {
  const { chrome, pages } = manifest
  const links = pages
    .filter(p => p.route !== "/")
    .slice(0, 6)
    .map(p => `      { label: "${p.title}", href: "${p.route}" }`)
    .join(",\n")

  return `import Link from "next/link"

const footerLinks = [
${links},
]

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="container px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div>
            <Link href="/" className="text-lg font-bold">${chrome.brandName}</Link>
            <p className="mt-1 text-sm text-muted-foreground">Built with care.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {footerLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-foreground transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-8 border-t border-border pt-6 text-center text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} ${chrome.brandName}. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
`
}

function generateShadcnComponents(): GeneratedFile[] {
  const components: GeneratedFile[] = []

  // Button
  components.push({
    path: "components/ui/button.tsx",
    kind: "component",
    content: `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
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
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
`,
  })

  // Card
  components.push({
    path: "components/ui/card.tsx",
    kind: "component",
    content: `import * as React from "react"
import { cn } from "@/lib/utils"

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-lg border border-border bg-card text-card-foreground shadow-sm", className)} {...props} />
  )
)
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-4 sm:p-6", className)} {...props} />
  )
)
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-xl sm:text-2xl font-semibold leading-none tracking-tight", className)} {...props} />
  )
)
CardTitle.displayName = "CardTitle"

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />
  )
)
CardDescription.displayName = "CardDescription"

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 sm:p-6 pt-0", className)} {...props} />
  )
)
CardContent.displayName = "CardContent"

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-4 sm:p-6 pt-0", className)} {...props} />
  )
)
CardFooter.displayName = "CardFooter"

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
`,
  })

  // Badge
  components.push({
    path: "components/ui/badge.tsx",
    kind: "component",
    content: `import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
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
  }
)

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
`,
  })

  // Input
  components.push({
    path: "components/ui/input.tsx",
    kind: "component",
    content: `import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
`,
  })

  // Textarea
  components.push({
    path: "components/ui/textarea.tsx",
    kind: "component",
    content: `import * as React from "react"
import { cn } from "@/lib/utils"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
`,
  })

  // Separator
  components.push({
    path: "components/ui/separator.tsx",
    kind: "component",
    content: `"use client"

import * as React from "react"
import * as SeparatorPrimitive from "@radix-ui/react-separator"
import { cn } from "@/lib/utils"

const Separator = React.forwardRef<
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
      className
    )}
    {...props}
  />
))
Separator.displayName = SeparatorPrimitive.Root.displayName

export { Separator }
`,
  })

  // Accordion
  components.push({
    path: "components/ui/accordion.tsx",
    kind: "component",
    content: `"use client"

import * as React from "react"
import * as AccordionPrimitive from "@radix-ui/react-accordion"
import { ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const Accordion = AccordionPrimitive.Root

const AccordionItem = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Item>
>(({ className, ...props }, ref) => (
  <AccordionPrimitive.Item ref={ref} className={cn("border-b", className)} {...props} />
))
AccordionItem.displayName = "AccordionItem"

const AccordionTrigger = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Header className="flex">
    <AccordionPrimitive.Trigger
      ref={ref}
      className={cn(
        "flex flex-1 items-center justify-between py-4 font-medium transition-all hover:underline [&[data-state=open]>svg]:rotate-180",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200" />
    </AccordionPrimitive.Trigger>
  </AccordionPrimitive.Header>
))
AccordionTrigger.displayName = AccordionPrimitive.Trigger.displayName

const AccordionContent = React.forwardRef<
  React.ElementRef<typeof AccordionPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof AccordionPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <AccordionPrimitive.Content
    ref={ref}
    className="overflow-hidden text-sm transition-all data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
    {...props}
  >
    <div className={cn("pb-4 pt-0", className)}>{children}</div>
  </AccordionPrimitive.Content>
))
AccordionContent.displayName = AccordionPrimitive.Content.displayName

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent }
`,
  })

  // Tabs
  components.push({
    path: "components/ui/tabs.tsx",
    kind: "component",
    content: `"use client"

import * as React from "react"
import * as TabsPrimitive from "@radix-ui/react-tabs"
import { cn } from "@/lib/utils"

const Tabs = TabsPrimitive.Root

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground",
      className
    )}
    {...props}
  />
))
TabsList.displayName = TabsPrimitive.List.displayName

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm",
      className
    )}
    {...props}
  />
))
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
))
TabsContent.displayName = TabsPrimitive.Content.displayName

export { Tabs, TabsList, TabsTrigger, TabsContent }
`,
  })

  return components
}
