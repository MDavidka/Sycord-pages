"use client"

import Image from "next/image"
import { useSession } from "next-auth/react"
import {
  ArrowRight,
  Check,
  Github,
  Globe,
  MousePointerClick,
  Sparkles,
  Twitter,
  Wand2,
  Zap,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"

const features = [
  {
    icon: Sparkles,
    title: "AI-native",
    description:
      "Describe a vision in one sentence and Sycord scaffolds the layout, copy and visuals in seconds.",
  },
  {
    icon: MousePointerClick,
    title: "Drag, drop, ship",
    description:
      "Refine sections visually. Every block is a real component you can tweak — no lock-in.",
  },
  {
    icon: Zap,
    title: "Lightning hosting",
    description:
      "Edge-deployed on a global network with sub-100ms TTFB and free SSL on every domain.",
  },
  {
    icon: Globe,
    title: "Bring your domain",
    description:
      "Connect a custom domain in two clicks. We handle DNS, redirects and HTTPS for you.",
  },
]

const steps = [
  {
    n: "01",
    title: "Describe it",
    body: "Tell Syra what you're building. Landing page, portfolio, store — anything goes.",
  },
  {
    n: "02",
    title: "Generate it",
    body: "Sycord drafts pages, components and copy in a single, editable canvas.",
  },
  {
    n: "03",
    title: "Publish it",
    body: "One click to deploy worldwide with analytics, SEO and a free .sycord.com domain.",
  },
]

const stats = [
  { value: "60s", label: "Average build time" },
  { value: "10k+", label: "Sites launched" },
  { value: "99.99%", label: "Edge uptime" },
  { value: "0", label: "Lines of code required" },
]

const testimonials = [
  {
    quote:
      "I shipped my agency landing page on a coffee break. The AI nailed the brand voice on the first try.",
    name: "Lina Park",
    role: "Founder, Northbeam Studio",
    initial: "L",
  },
  {
    quote:
      "Sycord replaced three tools for us. Our marketing team writes the prompt, and we just hit publish.",
    name: "Marco Reyes",
    role: "Head of Growth, Loophole",
    initial: "M",
  },
  {
    quote:
      "The components are real React. I exported the site to our monorepo without rewriting a single line.",
    name: "Sana Iqbal",
    role: "Staff Engineer, Helix",
    initial: "S",
  },
]

const tiers = [
  {
    name: "Hobby",
    price: "Free",
    cadence: "forever",
    description: "Spin up unlimited drafts and host one live site on us.",
    features: ["1 published site", "Sycord subdomain", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$19",
    cadence: "/month",
    description: "Everything you need to ship a real product or brand.",
    features: [
      "Unlimited published sites",
      "Custom domains + SSL",
      "AI revisions & A/B copy",
      "Priority email support",
    ],
    cta: "Go Pro",
    highlight: true,
  },
  {
    name: "Team",
    price: "$49",
    cadence: "/month",
    description: "Collaborate with your team and keep brand systems in sync.",
    features: [
      "Up to 10 editors",
      "Shared component library",
      "Role-based access",
      "SAML SSO add-on",
    ],
    cta: "Talk to us",
    highlight: false,
  },
]

export default function LandingPage() {
  const { data: session } = useSession()
  const userInitial =
    session?.user?.name?.trim()?.charAt(0)?.toUpperCase() || "M"

  return (
    <main className="relative w-full overflow-hidden bg-[#0d0e11] text-white">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1.6px, transparent 1.6px)",
          backgroundSize: "36px 36px",
          backgroundPosition: "0 0",
        }}
      />

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-5 pt-6 sm:px-8 sm:pt-8 lg:px-12 lg:pt-10">
        <header className="flex items-center justify-between">
          <Image
            src="/logo.png"
            alt="Sycord"
            width={48}
            height={48}
            priority
            className="h-8 w-auto opacity-60 sm:h-9 lg:h-10"
          />

          <div className="flex items-center gap-2 rounded-full border border-white/5 bg-white/[0.04] p-1.5 backdrop-blur-sm">
            <div
              aria-hidden
              className="h-7 w-20 rounded-full bg-white/[0.05] sm:w-28"
            />
            {session?.user?.image ? (
              <Image
                src={session.user.image}
                alt="Profile"
                width={28}
                height={28}
                className="h-7 w-7 rounded-md object-cover"
              />
            ) : (
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white text-[13px] font-semibold text-black">
                {userInitial}
              </div>
            )}
          </div>
        </header>

        <section className="flex min-h-[58svh] flex-col items-center justify-center pb-10 pt-16 text-center sm:pb-14 sm:pt-20 lg:min-h-[62svh]">
          <h1 className="text-balance text-[2.75rem] font-bold leading-[1.05] tracking-tight sm:text-6xl md:text-7xl lg:text-[5.5rem]">
            Create <span className="text-zinc-500">your site</span>
            <br />
            under a minute
          </h1>

          <div className="mt-10 flex items-center justify-center gap-3 sm:mt-12">
            <Button variant="outline">Button</Button>
            <Button variant="outline">Button</Button>
          </div>
        </section>

        <section
          aria-label="Product preview"
          className="mx-auto w-full max-w-5xl"
        >
          <div className="relative overflow-hidden rounded-[2rem] border border-white/[0.06] bg-white/[0.04] sm:rounded-[2.5rem]">
            <div className="aspect-[16/10] w-full bg-gradient-to-b from-white/[0.05] via-white/[0.02] to-transparent" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-[#0d0e11] to-transparent"
            />
          </div>
        </section>

        <section className="mt-24 sm:mt-32" aria-label="Features">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-zinc-300"
            >
              Why Sycord
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              The fastest way from idea to live site
            </h2>
            <p className="mt-4 text-balance text-zinc-400 sm:text-lg">
              No templates to fight, no boilerplate to clone. Sycord ships a
              production-ready website the moment you describe it.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {features.map(({ icon: Icon, title, description }) => (
              <Card
                key={title}
                className="border-white/5 bg-white/[0.03] text-white"
              >
                <CardHeader>
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/[0.06] text-white">
                    <Icon className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-3 text-lg">{title}</CardTitle>
                  <CardDescription className="text-zinc-400">
                    {description}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-24 sm:mt-32" aria-label="How it works">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-zinc-300"
            >
              How it works
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Three steps. One minute.
            </h2>
          </div>

          <div className="relative mt-12 grid gap-6 lg:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.n}
                className="relative overflow-hidden rounded-2xl border border-white/5 bg-white/[0.03] p-6 sm:p-8"
              >
                <span className="font-mono text-sm text-zinc-500">{step.n}</span>
                <h3 className="mt-4 text-xl font-semibold sm:text-2xl">
                  {step.title}
                </h3>
                <p className="mt-2 text-zinc-400">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-24 sm:mt-32" aria-label="Stats">
          <div className="overflow-hidden rounded-3xl border border-white/5 bg-white/[0.03]">
            <dl className="grid grid-cols-2 divide-y divide-white/5 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
              {stats.map((stat, idx) => (
                <div
                  key={stat.label}
                  className={`px-6 py-8 text-center ${
                    idx >= 2 ? "border-t border-white/5 sm:border-t-0" : ""
                  } ${idx % 2 === 1 ? "border-l border-white/5 sm:border-l-0 sm:border-l" : ""}`}
                >
                  <dt className="text-sm uppercase tracking-wider text-zinc-500">
                    {stat.label}
                  </dt>
                  <dd className="mt-2 text-3xl font-semibold sm:text-4xl">
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="mt-24 sm:mt-32" aria-label="Testimonials">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-zinc-300"
            >
              Loved by builders
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Teams ship faster on Sycord
            </h2>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {testimonials.map((t) => (
              <figure
                key={t.name}
                className="flex h-full flex-col justify-between rounded-2xl border border-white/5 bg-white/[0.03] p-6"
              >
                <blockquote className="text-balance text-zinc-300">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-sm font-semibold text-black">
                    {t.initial}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{t.name}</div>
                    <div className="text-xs text-zinc-500">{t.role}</div>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-24 sm:mt-32" aria-label="Pricing">
          <div className="mx-auto max-w-2xl text-center">
            <Badge
              variant="outline"
              className="border-white/10 bg-white/[0.04] text-zinc-300"
            >
              Pricing
            </Badge>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Start free. Scale when you do.
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {tiers.map((tier) => (
              <Card
                key={tier.name}
                className={`relative border bg-white/[0.03] text-white ${
                  tier.highlight
                    ? "border-white/20 bg-white/[0.06]"
                    : "border-white/5"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute right-4 top-4">
                    <Badge className="bg-white text-black hover:bg-white">
                      Most popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-lg">{tier.name}</CardTitle>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold">{tier.price}</span>
                    <span className="text-sm text-zinc-500">{tier.cadence}</span>
                  </div>
                  <CardDescription className="mt-2 text-zinc-400">
                    {tier.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col">
                  <ul className="space-y-2.5">
                    {tier.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-start gap-2 text-sm text-zinc-300"
                      >
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-zinc-400" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    variant={tier.highlight ? "default" : "outline"}
                    className={`mt-6 w-full ${
                      tier.highlight
                        ? "bg-white text-black hover:bg-zinc-200"
                        : ""
                    }`}
                  >
                    {tier.cta}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-24 sm:mt-32" aria-label="Call to action">
          <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.08] to-white/[0.02] p-8 text-center sm:p-14">
            <Wand2 className="mx-auto h-8 w-8 text-zinc-300" />
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight sm:text-4xl md:text-5xl">
              Your next site is one prompt away.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400 sm:text-lg">
              Join thousands of founders, designers and indie hackers shipping
              with Sycord every day.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button className="bg-white text-black hover:bg-zinc-200">
                Get started
                <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
              <Button variant="outline">View demo</Button>
            </div>
          </div>
        </section>

        <Separator className="mt-24 bg-white/5 sm:mt-32" />

        <footer className="flex flex-col items-center justify-between gap-6 py-10 text-sm text-zinc-500 sm:flex-row">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Sycord"
              width={28}
              height={28}
              className="h-6 w-auto opacity-60"
            />
            <span>© {new Date().getFullYear()} Sycord. All rights reserved.</span>
          </div>
          <nav className="flex items-center gap-6">
            <a className="hover:text-white" href="/about">
              About
            </a>
            <a className="hover:text-white" href="/contact">
              Contact
            </a>
            <a className="hover:text-white" href="/tos">
              Terms
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <a
              aria-label="Twitter"
              href="#"
              className="rounded-md border border-white/10 p-2 transition-colors hover:border-white/30 hover:text-white"
            >
              <Twitter className="h-4 w-4" />
            </a>
            <a
              aria-label="GitHub"
              href="#"
              className="rounded-md border border-white/10 p-2 transition-colors hover:border-white/30 hover:text-white"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>
        </footer>
      </div>
    </main>
  )
}
