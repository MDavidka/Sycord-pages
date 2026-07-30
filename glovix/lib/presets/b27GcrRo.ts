import type { Preset } from './index'

export const b27GcrRo: Preset = {
  id: 'b27GcrRo',
  name: 'Shadcn Professional',
  description: 'Professional website preset built entirely from shadcn/ui components. Uses Card, Button, Badge, Avatar, Separator, Accordion, Tabs, and all 57 shadcn primitives. No custom CSS — only shadcn composition + layout Tailwind.',
  requiredShadcnComponents: [
    'button', 'card', 'badge', 'separator', 'avatar', 'input', 'label',
    'textarea', 'accordion', 'tabs', 'dialog', 'sheet', 'dropdown-menu',
    'navigation-menu', 'table', 'form', 'select', 'checkbox', 'switch',
    'tooltip', 'hover-card', 'scroll-area', 'skeleton', 'progress',
    'carousel', 'aspect-ratio', 'collapsible', 'alert', 'alert-dialog',
    'breadcrumb', 'calendar', 'chart', 'command', 'context-menu',
    'drawer', 'empty', 'field', 'input-group', 'input-otp', 'item',
    'kbd', 'menubar', 'pagination', 'popover', 'radio-group',
    'resizable', 'sidebar', 'slider', 'sonner', 'spinner',
    'toggle', 'toggle-group',
  ],
  sections: [
    {
      name: 'SectionHero',
      path: 'components/sections/hero.tsx',
      description: 'Hero section with badge, heading, description, and dual CTAs. Uses Badge + Button.',
      content: `'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface HeroProps {
  badge?: string
  title: string
  description: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
}

export function SectionHero({ badge, title, description, primaryCta, secondaryCta }: HeroProps) {
  return (
    <section className="container mx-auto flex flex-col items-center gap-6 py-20 text-center">
      {badge && <Badge variant="secondary">{badge}</Badge>}
      <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">
        {title}
      </h1>
      <p className="max-w-2xl text-muted-foreground text-lg">
        {description}
      </p>
      <div className="flex gap-3">
        <Button asChild size="lg">
          <a href={primaryCta.href}>{primaryCta.label}</a>
        </Button>
        {secondaryCta && (
          <Button asChild variant="outline" size="lg">
            <a href={secondaryCta.href}>{secondaryCta.label}</a>
          </Button>
        )}
      </div>
    </section>
  )
}
`,
    },
    {
      name: 'SectionFeatures',
      path: 'components/sections/features.tsx',
      description: 'Features grid using Card + CardHeader + CardTitle + CardDescription + CardContent + CardFooter. 1-3 column responsive grid.',
      content: `import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { LucideIcon } from 'lucide-react'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
  cta?: { label: string; href: string }
}

interface FeaturesProps {
  heading: string
  subheading?: string
  features: Feature[]
  columns?: 2 | 3 | 4
}

export function SectionFeatures({ heading, subheading, features, columns = 3 }: FeaturesProps) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section className="container mx-auto py-16">
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        {subheading && <p className="text-muted-foreground">{subheading}</p>}
      </div>
      <div className={\`grid gap-6 \${cols}\`}>
        {features.map((feature, i) => (
          <Card key={i}>
            <CardHeader>
              <feature.icon className="h-8 w-8 text-primary" />
              <CardTitle>{feature.title}</CardTitle>
              <CardDescription>{feature.description}</CardDescription>
            </CardHeader>
            {feature.cta && (
              <CardFooter>
                <Button asChild variant="outline" className="w-full">
                  <a href={feature.cta.href}>{feature.cta.label}</a>
                </Button>
              </CardFooter>
            )}
          </Card>
        ))}
      </div>
    </section>
  )
}
`,
    },
    {
      name: 'SectionPricing',
      path: 'components/sections/pricing.tsx',
      description: 'Pricing cards using Card + Separator + Badge. Highlighted tier gets border-primary.',
      content: `import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Check } from 'lucide-react'

interface PricingTier {
  name: string
  price: string
  period?: string
  description: string
  features: string[]
  cta: { label: string; href: string }
  featured?: boolean
}

interface PricingProps {
  heading: string
  subheading?: string
  tiers: PricingTier[]
}

export function SectionPricing({ heading, subheading, tiers }: PricingProps) {
  return (
    <section className="container mx-auto py-16">
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        {subheading && <p className="text-muted-foreground">{subheading}</p>}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        {tiers.map((tier) => (
          <Card key={tier.name} className={tier.featured ? 'border-primary' : ''}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{tier.name}</CardTitle>
                {tier.featured && <Badge>Popular</Badge>}
              </div>
              <CardDescription>{tier.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <span className="text-3xl font-bold">{tier.price}</span>
                {tier.period && <span className="text-muted-foreground text-sm">/{tier.period}</span>}
              </div>
              <Separator />
              <ul className="space-y-2 text-sm text-muted-foreground">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button asChild className="w-full" variant={tier.featured ? 'default' : 'outline'}>
                <a href={tier.cta.href}>{tier.cta.label}</a>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </section>
  )
}
`,
    },
    {
      name: 'SectionCta',
      path: 'components/sections/cta.tsx',
      description: 'Call-to-action section with Card background, heading, description, and button.',
      content: `import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface CtaProps {
  title: string
  description: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
}

export function SectionCta({ title, description, primaryCta, secondaryCta }: CtaProps) {
  return (
    <section className="container mx-auto py-16">
      <Card className="border-primary/20">
        <CardHeader className="text-center pb-2">
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="text-base">{description}</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center gap-3 pt-4">
          <Button asChild size="lg">
            <a href={primaryCta.href}>{primaryCta.label}</a>
          </Button>
          {secondaryCta && (
            <Button asChild variant="outline" size="lg">
              <a href={secondaryCta.href}>{secondaryCta.label}</a>
            </Button>
          )}
        </CardContent>
      </Card>
    </section>
  )
}
`,
    },
    {
      name: 'SectionFooter',
      path: 'components/sections/footer.tsx',
      description: 'Four-column footer with links, using Separator and text-muted-foreground.',
      content: `import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface FooterColumn {
  title: string
  links: { label: string; href: string }[]
}

interface FooterProps {
  brand: string
  columns: FooterColumn[]
  newsletter?: {
    title: string
    description: string
    placeholder: string
    buttonLabel: string
  }
}

export function SectionFooter({ brand, columns, newsletter }: FooterProps) {
  return (
    <footer className="border-t bg-muted/40">
      <div className="container mx-auto py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-1">
            <p className="text-sm font-semibold">{brand}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Built with shadcn/ui — accessible, customizable, open source.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-3">{col.title}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="hover:text-foreground transition-colors">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {newsletter && (
            <div className="sm:col-span-2 lg:col-span-1">
              <h4 className="text-sm font-semibold mb-3">{newsletter.title}</h4>
              <p className="text-xs text-muted-foreground mb-2">{newsletter.description}</p>
              <div className="flex gap-2">
                <Input placeholder={newsletter.placeholder} className="h-9 text-sm" />
                <Button size="sm">{newsletter.buttonLabel}</Button>
              </div>
            </div>
          )}
        </div>
        <Separator className="my-6" />
        <p className="text-xs text-muted-foreground text-center">
          &copy; {new Date().getFullYear()} {brand}. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
`,
    },
    {
      name: 'SectionNavbar',
      path: 'components/sections/navbar.tsx',
      description: 'Sticky navbar with brand, navigation links, and auth buttons. Uses Button variant="ghost" for nav links.',
      content: `'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { Menu } from 'lucide-react'

interface NavLink {
  label: string
  href: string
}

interface NavbarProps {
  brand: string
  brandHref?: string
  links: NavLink[]
  auth?: {
    signInLabel: string
    signInHref: string
    signUpLabel: string
    signUpHref: string
  }
}

export function SectionNavbar({ brand, brandHref = '/', links, auth }: NavbarProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto flex h-14 items-center justify-between">
        <a href={brandHref} className="font-semibold text-sm">{brand}</a>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm">
              <a href={link.href}>{link.label}</a>
            </Button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {auth && (
            <>
              <Button asChild variant="ghost" size="sm">
                <a href={auth.signInHref}>{auth.signInLabel}</a>
              </Button>
              <Button asChild size="sm">
                <a href={auth.signUpHref}>{auth.signUpLabel}</a>
              </Button>
            </>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-64">
            <nav className="flex flex-col gap-1 mt-6">
              {links.map((link) => (
                <Button key={link.href} asChild variant="ghost" className="justify-start" onClick={() => setOpen(false)}>
                  <a href={link.href}>{link.label}</a>
                </Button>
              ))}
              {auth && (
                <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                  <Button asChild variant="outline" size="sm" onClick={() => setOpen(false)}>
                    <a href={auth.signInHref}>{auth.signInLabel}</a>
                  </Button>
                  <Button asChild size="sm" onClick={() => setOpen(false)}>
                    <a href={auth.signUpHref}>{auth.signUpLabel}</a>
                  </Button>
                </div>
              )}
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
`,
    },
    {
      name: 'SectionTestimonials',
      path: 'components/sections/testimonials.tsx',
      description: 'Testimonial cards using Card + Avatar + Badge.',
      content: `import { Card, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'

interface Testimonial {
  quote: string
  author: string
  role: string
  avatar?: string
  company?: string
}

interface TestimonialsProps {
  heading: string
  subheading?: string
  testimonials: Testimonial[]
}

export function SectionTestimonials({ heading, subheading, testimonials }: TestimonialsProps) {
  return (
    <section className="container mx-auto py-16">
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        {subheading && <p className="text-muted-foreground">{subheading}</p>}
      </div>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {testimonials.map((t, i) => (
          <Card key={i}>
            <CardContent className="pt-6 space-y-4">
              <p className="text-muted-foreground text-sm leading-relaxed">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {t.avatar && <AvatarImage src={t.avatar} alt={t.author} />}
                  <AvatarFallback>{t.author.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{t.author}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
                {t.company && <Badge variant="outline" className="ml-auto text-xs">{t.company}</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
`,
    },
    {
      name: 'SectionFaq',
      path: 'components/sections/faq.tsx',
      description: 'FAQ section using Accordion + AccordionItem + AccordionTrigger + AccordionContent.',
      content: `import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

interface FaqItem {
  question: string
  answer: string
}

interface FaqProps {
  heading: string
  subheading?: string
  items: FaqItem[]
}

export function SectionFaq({ heading, subheading, items }: FaqProps) {
  return (
    <section className="container mx-auto py-16 max-w-3xl">
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        {subheading && <p className="text-muted-foreground">{subheading}</p>}
      </div>
      <Accordion type="single" collapsible className="w-full">
        {items.map((item, i) => (
          <AccordionItem key={i} value={\`item-\${i}\`}>
            <AccordionTrigger className="text-left text-sm font-medium">
              {item.question}
            </AccordionTrigger>
            <AccordionContent className="text-sm text-muted-foreground">
              {item.answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  )
}
`,
    },
    {
      name: 'SectionStats',
      path: 'components/sections/stats.tsx',
      description: 'Statistics grid using Card with large numbers and muted labels.',
      content: `import { Card, CardContent } from '@/components/ui/card'

interface Stat {
  value: string
  label: string
}

interface StatsProps {
  stats: Stat[]
}

export function SectionStats({ stats }: StatsProps) {
  return (
    <section className="container mx-auto py-16">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="pt-6 text-center">
              <p className="text-3xl font-bold">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  )
}
`,
    },
    {
      name: 'SectionContact',
      path: 'components/sections/contact.tsx',
      description: 'Contact form using Card + Form + FormField + Input + Textarea + Button.',
      content: `'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface ContactProps {
  heading: string
  subheading?: string
}

export function SectionContact({ heading, subheading }: ContactProps) {
  return (
    <section className="container mx-auto py-16">
      <div className="text-center mb-10 space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">{heading}</h2>
        {subheading && <p className="text-muted-foreground">{subheading}</p>}
      </div>
      <Card className="mx-auto max-w-lg">
        <CardHeader>
          <CardTitle>Send a message</CardTitle>
          <CardDescription>We&apos;ll get back to you within 24 hours.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" placeholder="Your name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea id="message" placeholder="How can we help?" rows={4} />
            </div>
            <Button type="submit" className="w-full">Send message</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
`,
    },
    {
      name: 'SectionLogos',
      path: 'components/sections/logos.tsx',
      description: 'Logo cloud using a simple flex wrap grid with grayscale opacity.',
      content: `interface LogosProps {
  heading?: string
  logos: { name: string; src: string; href?: string }[]
}

export function SectionLogos({ heading, logos }: LogosProps) {
  return (
    <section className="container mx-auto py-12">
      {heading && (
        <p className="text-center text-sm text-muted-foreground mb-8">{heading}</p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
        {logos.map((logo) => (
          <a key={logo.name} href={logo.href || '#'} className="transition-opacity hover:opacity-80">
            <img src={logo.src} alt={logo.name} className="h-8 w-auto" />
          </a>
        ))}
      </div>
    </section>
  )
}
`,
    },
    {
      name: 'SectionNewsletter',
      path: 'components/sections/newsletter.tsx',
      description: 'Newsletter signup using Card + Input + Button.',
      content: `import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface NewsletterProps {
  title: string
  description: string
  placeholder?: string
  buttonLabel?: string
}

export function SectionNewsletter({ title, description, placeholder = 'Enter your email', buttonLabel = 'Subscribe' }: NewsletterProps) {
  return (
    <section className="container mx-auto py-16">
      <Card className="mx-auto max-w-xl border-primary/20">
        <CardHeader className="text-center">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <Input type="email" placeholder={placeholder} className="flex-1" />
            <Button type="submit">{buttonLabel}</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  )
}
`,
    },
  ],
}
