"use client";

import {Link} from "../../navigation";
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { ArrowRight, Zap, Globe, Shield } from "lucide-react"
import {useTranslations} from 'next-intl';

export default function LandingPage() {
  const t = useTranslations('LandingPage');
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="Logo" width={32} height={32} />
            <span className="text-xl font-semibold text-foreground">Sycord</span>
          </div>
          <nav className="hidden md:flex items-center gap-8">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('Features')}
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('Pricing')}
            </Link>
            <Link href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t('Docs')}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-foreground">
                {t('SignIn')}
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-white text-black hover:bg-white/90">{t('GetStarted')}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
            {t('Beta')}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 text-balance leading-tight">
            {t('HeroTitle')}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance leading-relaxed">
            {t('HeroSubtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 text-base px-8">
                {t('StartBuilding')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-accent text-base px-8 bg-transparent"
              >
                {t('ViewDemo')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold text-foreground mb-1">100M+</div>
              <div className="text-sm text-muted-foreground mb-2">{t('APIRequests')}</div>
              <div className="text-xs text-muted-foreground/60">Vercel</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold text-foreground mb-1">99.9%</div>
              <div className="text-sm text-muted-foreground mb-2">{t('Uptime')}</div>
              <div className="text-xs text-muted-foreground/60">Cloudflare</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold text-foreground mb-1">10K</div>
              <div className="text-sm text-muted-foreground mb-2">{t('ActiveUsers')}</div>
              <div className="text-xs text-muted-foreground/60">Stripe</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold text-foreground mb-1">24/7</div>
              <div className="text-sm text-muted-foreground mb-2">{t('Support')}</div>
              <div className="text-xs text-muted-foreground/60">GitHub</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{t('FeaturesTitle')}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t('FeaturesSubtitle')}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-border rounded-lg p-8 bg-card hover:bg-accent transition-colors">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4 text-white">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{t('Feature1Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('Feature1Text')}</p>
            </div>
            <div className="border border-border rounded-lg p-8 bg-card hover:bg-accent transition-colors">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4 text-white">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{t('Feature2Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('Feature2Text')}</p>
            </div>
            <div className="border border-border rounded-lg p-8 bg-card hover:bg-accent transition-colors">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4 text-white">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{t('Feature3Title')}</h3>
              <p className="text-muted-foreground leading-relaxed">{t('Feature3Text')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center border border-border rounded-2xl p-12 bg-card">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t('CTATitle')}</h2>
          <p className="text-lg text-muted-foreground mb-8">{t('CTASubtitle')}</p>
          <Link href="/login">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 text-base px-8">
              {t('CreateAccount')}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t('Product')}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Features')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Pricing')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Templates')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t('Company')}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('About')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Blog')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Careers')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t('Resources')}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Documentation')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Support')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Status')}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t('Legal')}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Privacy')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Terms')}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t('Security')}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={24} height={24} />
              <span className="text-sm text-muted-foreground">{t('Copyright')}</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Twitter
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                GitHub
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                Discord
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
