import Link from "next/link"
import Image from "next/image"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import LanguageSwitcher from "@/components/language-switcher"
import { ArrowRight, Zap, Globe, Shield } from "lucide-react"

export default function LandingPage() {
  const t = useTranslations("LandingPage")

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
              {t("features")}
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("pricing")}
            </Link>
            <Link href="#docs" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              {t("docs")}
            </Link>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Link href="/login">
              <Button variant="ghost" className="text-foreground">
                {t("signIn")}
              </Button>
            </Link>
            <Link href="/login">
              <Button className="bg-white text-black hover:bg-white/90">{t("getStarted")}</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-24 md:py-32">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-block mb-4 px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">
            {t("nowInBeta")}
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-foreground mb-6 text-balance leading-tight">
            {t("heroTitle")}
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto text-balance leading-relaxed">
            {t("heroSubtitle")}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/login">
              <Button size="lg" className="bg-white text-black hover:bg-white/90 text-base px-8">
                {t("startBuilding")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/dashboard">
              <Button
                size="lg"
                variant="outline"
                className="border-border text-foreground hover:bg-accent text-base px-8 bg-transparent"
              >
                {t("viewDemo")}
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
              <div className="text-3xl font-bold text-foreground mb-1">{t("stat1")}</div>
              <div className="text-sm text-muted-foreground mb-2">{t("stat1Label")}</div>
              <div className="text-xs text-muted-foreground/60">{t("stat1Company")}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold text-foreground mb-1">{t("stat2")}</div>
              <div className="text-sm text-muted-foreground mb-2">{t("stat2Label")}</div>
              <div className="text-xs text-muted-foreground/60">{t("stat2Company")}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold text-foreground mb-1">{t("stat3")}</div>
              <div className="text-sm text-muted-foreground mb-2">{t("stat3Label")}</div>
              <div className="text-xs text-muted-foreground/60">{t("stat3Company")}</div>
            </div>
            <div className="text-center md:text-left">
              <div className="text-3xl font-bold text-foreground mb-1">{t("stat4")}</div>
              <div className="text-sm text-muted-foreground mb-2">{t("stat4Label")}</div>
              <div className="text-xs text-muted-foreground/60">{t("stat4Company")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-4">{t("featuresTitle")}</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">{t("featuresSubtitle")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border border-border rounded-lg p-8 bg-card hover:bg-accent transition-colors">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4 text-white">
                <Zap className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{t("feature1Title")}</h3>
              <p className="text-muted-foreground leading-relaxed">{t("feature1Description")}</p>
            </div>
            <div className="border border-border rounded-lg p-8 bg-card hover:bg-accent transition-colors">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4 text-white">
                <Globe className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{t("feature2Title")}</h3>
              <p className="text-muted-foreground leading-relaxed">{t("feature2Description")}</p>
            </div>
            <div className="border border-border rounded-lg p-8 bg-card hover:bg-accent transition-colors">
              <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center mb-4 text-white">
                <Shield className="h-6 w-6" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-2">{t("feature3Title")}</h3>
              <p className="text-muted-foreground leading-relaxed">{t("feature3Description")}</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto text-center border border-border rounded-2xl p-12 bg-card">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">{t("ctaTitle")}</h2>
          <p className="text-lg text-muted-foreground mb-8">{t("ctaSubtitle")}</p>
          <Link href="/login">
            <Button size="lg" className="bg-white text-black hover:bg-white/90 text-base px-8">
              {t("createYourAccount")}
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
              <h4 className="font-semibold text-foreground mb-4">{t("footerProduct")}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("features")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("pricing")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerTemplates")}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t("footerCompany")}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerAbout")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerBlog")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerCareers")}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t("footerResources")}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerDocumentation")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerSupport")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerStatus")}
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-foreground mb-4">{t("footerLegal")}</h4>
              <ul className="space-y-2">
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerPrivacy")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerTerms")}
                  </Link>
                </li>
                <li>
                  <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                    {t("footerSecurity")}
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={24} height={24} />
              <span className="text-sm text-muted-foreground">{t("footerRights")}</span>
            </div>
            <div className="flex items-center gap-6">
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                {t("footerTwitter")}
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                {t("footerGitHub")}
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground">
                {t("footerDiscord")}
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
