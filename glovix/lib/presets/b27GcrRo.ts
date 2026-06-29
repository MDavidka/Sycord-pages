import type { Preset } from './index'
import { cn } from '@/lib/utils'

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
import { cn } from '@/lib/utils'

interface HeroProps {
  badge?: string
  title: string
  description: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  className?: string
}

export function SectionHero({ badge, title, description, primaryCta, secondaryCta, className }: HeroProps) {
  return (
    <section className={cn("container mx-auto flex flex-col items-center gap-8 py-24 text-center sm:py-32", className)}>
      {badge && <Badge variant="secondary" className="px-4 py-1.5 text-sm font-medium">{badge}</Badge>}
      <h1 className="max-w-4xl text-4xl font-extrabold tracking-tight sm:text-6xl text-balance">
        {title}
      </h1>
      <p className="max-w-2xl text-muted-foreground text-lg sm:text-xl leading-relaxed">
        {description}
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mt-4">
        <Button asChild size="lg" className="px-8 h-12 text-base font-semibold">
          <a href={primaryCta.href}>{primaryCta.label}</a>
        </Button>
        {secondaryCta && (
          <Button asChild variant="outline" size="lg" className="px-8 h-12 text-base font-semibold bg-background/50 backdrop-blur-sm">
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
import { cn } from '@/lib/utils'

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
  className?: string
}

export function SectionFeatures({ heading, subheading, features, columns = 3, className }: FeaturesProps) {
  const cols = columns === 2 ? 'sm:grid-cols-2' : columns === 4 ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2 lg:grid-cols-3'

  return (
    <section className={cn("py-24 sm:py-32", className)}>
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">{heading}</h2>
          {subheading && <p className="text-muted-foreground text-lg max-w-3xl mx-auto">{subheading}</p>}
        </div>
        <div className={cn("grid gap-8", cols)}>
          {features.map((feature, i) => (
            <Card key={i} className="bg-background/50 backdrop-blur-sm border-muted transition-all duration-300 hover:shadow-lg hover:border-primary/20">
              <CardHeader className="space-y-4">
                <div className="bg-primary/10 w-12 h-12 rounded-xl flex items-center justify-center">
                  <feature.icon className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-2">
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">{feature.description}</CardDescription>
                </div>
              </CardHeader>
              {feature.cta && (
                <CardFooter>
                  <Button asChild variant="ghost" className="px-0 hover:bg-transparent hover:text-primary transition-colors">
                    <a href={feature.cta.href} className="flex items-center gap-2">
                      {feature.cta.label}
                      <span className="text-lg">→</span>
                    </a>
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
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
import { cn } from '@/lib/utils'

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
  className?: string
}

export function SectionPricing({ heading, subheading, tiers, className }: PricingProps) {
  return (
    <section className={cn("py-24 sm:py-32", className)}>
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">{heading}</h2>
          {subheading && <p className="text-muted-foreground text-lg max-w-3xl mx-auto">{subheading}</p>}
        </div>
        <div className="grid gap-8 lg:grid-cols-3">
          {tiers.map((tier) => (
            <Card key={tier.name} className={cn(
              "relative flex flex-col transition-all duration-300",
              tier.featured ? "border-primary shadow-xl scale-105 z-10" : "border-muted"
            )}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl font-bold">{tier.name}</CardTitle>
                  {tier.featured && <Badge className="bg-primary text-primary-foreground font-semibold">Popular</Badge>}
                </div>
                <CardDescription className="text-base pt-2">{tier.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6 flex-1">
                <div className="pt-2">
                  <span className="text-4xl font-bold tracking-tight">{tier.price}</span>
                  {tier.period && <span className="text-muted-foreground ml-1">/{tier.period}</span>}
                </div>
                <Separator className="bg-muted-foreground/10" />
                <ul className="space-y-3">
                  {tier.features.map((f) => (
                    <li key={f} className="flex items-start gap-3 text-sm text-muted-foreground">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter className="pt-6">
                <Button asChild className="w-full h-12 font-semibold" variant={tier.featured ? 'default' : 'outline'}>
                  <a href={tier.cta.href}>{tier.cta.label}</a>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
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
import { cn } from '@/lib/utils'

interface CtaProps {
  title: string
  description: string
  primaryCta: { label: string; href: string }
  secondaryCta?: { label: string; href: string }
  className?: string
}

export function SectionCta({ title, description, primaryCta, secondaryCta, className }: CtaProps) {
  return (
    <section className={cn("py-24 sm:py-32", className)}>
      <div className="container mx-auto">
        <Card className="border-primary/20 bg-primary/5 dark:bg-primary/[0.02] overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
          <CardHeader className="text-center pb-2 relative z-10 pt-12 sm:pt-16">
            <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">{title}</CardTitle>
            <CardDescription className="text-lg sm:text-xl max-w-2xl mx-auto pt-4">{description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row justify-center gap-4 pt-8 pb-12 sm:pb-16 relative z-10">
            <Button asChild size="lg" className="h-12 px-8 font-semibold">
              <a href={primaryCta.href}>{primaryCta.label}</a>
            </Button>
            {secondaryCta && (
              <Button asChild variant="outline" size="lg" className="h-12 px-8 font-semibold bg-background/50">
                <a href={secondaryCta.href}>{secondaryCta.label}</a>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
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
  className?: string
}

export function SectionFooter({ brand, columns, newsletter, className }: FooterProps) {
  return (
    <footer className={cn("border-t bg-muted/20", className)}>
      <div className="container mx-auto py-16 sm:py-24">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <p className="text-lg font-bold tracking-tight">{brand}</p>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed max-w-xs">
              Crafting premium digital experiences with speed and precision. Built on top of the Sycord platform.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h4 className="text-sm font-semibold mb-4 text-foreground uppercase tracking-wider">{col.title}</h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="hover:text-primary transition-colors">{link.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {newsletter && (
            <div className="sm:col-span-2 lg:col-span-2">
              <h4 className="text-sm font-semibold mb-4 text-foreground uppercase tracking-wider">{newsletter.title}</h4>
              <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{newsletter.description}</p>
              <div className="flex gap-2">
                <Input placeholder={newsletter.placeholder} className="h-10 text-sm bg-background/50" />
                <Button size="default" className="h-10 px-4">{newsletter.buttonLabel}</Button>
              </div>
            </div>
          )}
        </div>
        <Separator className="my-12 opacity-50" />
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-muted-foreground font-medium">
          <p>&copy; {new Date().getFullYear()} {brand}. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
          </div>
        </div>
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
  className?: string
}

export function SectionNavbar({ brand, brandHref = '/', links, auth, className }: NavbarProps) {
  const [open, setOpen] = useState(false)

  return (
    <header className={cn("sticky top-0 z-50 border-b border-border/40 bg-background/80 backdrop-blur-md supports-[backdrop-filter]:bg-background/60", className)}>
      <div className="container mx-auto flex h-16 items-center justify-between">
        <a href={brandHref} className="font-bold text-xl tracking-tight text-primary">{brand}</a>

        <nav className="hidden md:flex items-center gap-1">
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost" size="sm" className="font-medium text-muted-foreground hover:text-foreground">
              <a href={link.href}>{link.label}</a>
            </Button>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {auth && (
            <>
              <Button asChild variant="ghost" size="sm" className="font-medium">
                <a href={auth.signInHref}>{auth.signInLabel}</a>
              </Button>
              <Button asChild size="sm" className="font-semibold px-5">
                <a href={auth.signUpHref}>{auth.signUpLabel}</a>
              </Button>
            </>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-6 w-6" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:w-80">
            <nav className="flex flex-col gap-2 mt-8">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">Menu</p>
              {links.map((link) => (
                <Button key={link.href} asChild variant="ghost" className="justify-start text-lg h-12" onClick={() => setOpen(false)}>
                  <a href={link.href}>{link.label}</a>
                </Button>
              ))}
              {auth && (
                <div className="flex flex-col gap-3 mt-8 pt-8 border-t border-muted">
                  <Button asChild variant="outline" className="h-12 text-base" onClick={() => setOpen(false)}>
                    <a href={auth.signInHref}>{auth.signInLabel}</a>
                  </Button>
                  <Button asChild className="h-12 text-base font-semibold" onClick={() => setOpen(false)}>
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
import { cn } from '@/lib/utils'

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
  className?: string
}

export function SectionTestimonials({ heading, subheading, testimonials, className }: TestimonialsProps) {
  return (
    <section className={cn("py-24 sm:py-32", className)}>
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">{heading}</h2>
          {subheading && <p className="text-muted-foreground text-lg max-w-3xl mx-auto">{subheading}</p>}
        </div>
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t, i) => (
            <Card key={i} className="bg-background border-muted shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="pt-8 space-y-6">
                <p className="text-muted-foreground text-base leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-primary/10">
                    {t.avatar && <AvatarImage src={t.avatar} alt={t.author} />}
                    <AvatarFallback className="bg-primary/5 text-primary font-bold">{t.author.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-bold truncate">{t.author}</p>
                    <p className="text-sm text-muted-foreground truncate">{t.role}</p>
                  </div>
                  {t.company && <Badge variant="secondary" className="hidden sm:inline-flex text-[10px] uppercase font-bold tracking-wider">{t.company}</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
import { cn } from '@/lib/utils'

interface FaqItem {
  question: string
  answer: string
}

interface FaqProps {
  heading: string
  subheading?: string
  items: FaqItem[]
  className?: string
}

export function SectionFaq({ heading, subheading, items, className }: FaqProps) {
  return (
    <section className={cn("py-24 sm:py-32", className)}>
      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">{heading}</h2>
          {subheading && <p className="text-muted-foreground text-lg">{subheading}</p>}
        </div>
        <Accordion type="single" collapsible className="w-full space-y-4">
          {items.map((item, i) => (
            <AccordionItem key={i} value={\`item-\${i}\`} className="border border-muted rounded-xl px-6 bg-background/50 backdrop-blur-sm overflow-hidden">
              <AccordionTrigger className="text-left text-base font-semibold py-6 hover:no-underline hover:text-primary transition-colors">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="text-base text-muted-foreground pb-6 leading-relaxed">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
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
import { cn } from '@/lib/utils'

interface Stat {
  value: string
  label: string
}

interface StatsProps {
  stats: Stat[]
  className?: string
}

export function SectionStats({ stats, className }: StatsProps) {
  return (
    <section className={cn("py-20 sm:py-24", className)}>
      <div className="container mx-auto">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label} className="border-none shadow-none bg-transparent">
              <CardContent className="pt-6 text-center space-y-2">
                <p className="text-4xl sm:text-5xl font-extrabold tracking-tight text-primary">{stat.value}</p>
                <p className="text-base font-medium text-muted-foreground uppercase tracking-widest">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
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
import { cn } from '@/lib/utils'

interface ContactProps {
  heading: string
  subheading?: string
  className?: string
}

export function SectionContact({ heading, subheading, className }: ContactProps) {
  return (
    <section className={cn("py-24 sm:py-32", className)}>
      <div className="container mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-balance">{heading}</h2>
          {subheading && <p className="text-muted-foreground text-lg max-w-2xl mx-auto">{subheading}</p>}
        </div>
        <Card className="mx-auto max-w-2xl bg-background/50 backdrop-blur-sm border-muted shadow-xl">
          <CardHeader className="pt-10 px-10">
            <CardTitle className="text-2xl">Send a message</CardTitle>
            <CardDescription className="text-base">Our team typically responds within a few business hours.</CardDescription>
          </CardHeader>
          <CardContent className="p-10 pt-6">
            <form className="grid gap-6" onSubmit={(e) => e.preventDefault()}>
              <div className="grid sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="first-name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">First Name</Label>
                  <Input id="first-name" placeholder="John" className="h-12 bg-background/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last-name" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                  <Input id="last-name" placeholder="Doe" className="h-12 bg-background/50" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Work Email</Label>
                <Input id="email" type="email" placeholder="john@company.com" className="h-12 bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message" className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Message</Label>
                <Textarea id="message" placeholder="How can we help your business?" rows={5} className="bg-background/50 resize-none" />
              </div>
              <Button type="submit" className="w-full h-14 text-lg font-bold shadow-lg shadow-primary/20">Send message</Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
`,
    },
    {
      name: 'SectionLogos',
      path: 'components/sections/logos.tsx',
      description: 'Logo cloud using a simple flex wrap grid with grayscale opacity.',
      content: `import { cn } from '@/lib/utils'

interface LogosProps {
  heading?: string
  logos: { name: string; src: string; href?: string }[]
  className?: string
}

export function SectionLogos({ heading, logos, className }: LogosProps) {
  return (
    <section className={cn("py-16 sm:py-20", className)}>
      <div className="container mx-auto">
        {heading && (
          <p className="text-center text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground mb-12">{heading}</p>
        )}
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-10 opacity-50 hover:opacity-100 transition-opacity duration-500">
          {logos.map((logo) => (
            <a key={logo.name} href={logo.href || '#'} className="transition-all duration-300 grayscale hover:grayscale-0 hover:scale-110">
              <img src={logo.src} alt={logo.name} className="h-8 w-auto sm:h-10" />
            </a>
          ))}
        </div>
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
import { cn } from '@/lib/utils'

interface NewsletterProps {
  title: string
  description: string
  placeholder?: string
  buttonLabel?: string
  className?: string
}

export function SectionNewsletter({ title, description, placeholder = 'Enter your email', buttonLabel = 'Subscribe', className }: NewsletterProps) {
  return (
    <section className={cn("py-24 sm:py-32", className)}>
      <div className="container mx-auto">
        <Card className="mx-auto max-w-4xl border-primary/20 bg-primary/[0.03] overflow-hidden relative">
          <CardHeader className="text-center pt-12 px-10 relative z-10">
            <CardTitle className="text-3xl sm:text-4xl font-bold tracking-tight text-balance">{title}</CardTitle>
            <CardDescription className="text-lg pt-4 max-w-2xl mx-auto">{description}</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-16 pt-8 relative z-10">
            <form className="flex flex-col sm:flex-row gap-3 max-w-lg mx-auto" onSubmit={(e) => e.preventDefault()}>
              <Input type="email" placeholder={placeholder} className="h-12 bg-background/80" />
              <Button type="submit" className="h-12 px-8 font-bold">{buttonLabel}</Button>
            </form>
          </CardContent>
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
        </Card>
      </div>
    </section>
  )
}
`,
    },
  ],
}
