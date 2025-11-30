"use client"

import { useState, useEffect } from "react"
import { Briefcase, ShoppingCart, BookOpen, HelpCircle, Check, Globe, Triangle, ArrowRight, CheckCircle2 } from "lucide-react"
import { themes } from "@/lib/webshop-types"
import { signIn, useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"

interface ProjectFormProps {
  onSubmit: (data: any) => void
}

const steps = [
  { id: 1, name: "Típus" },
  { id: 2, name: "Csatlakozás" },
  { id: 3, name: "Név" },
  { id: 4, name: "Domain" },
]

const websiteTypes = [
  { id: "service", label: "Szolgáltatás", icon: Briefcase },
  { id: "hosting", label: "Hosting", icon: Globe },
  { id: "webshop", label: "Webáruház", icon: ShoppingCart },
  { id: "blog", label: "Blog", icon: BookOpen },
  { id: "other", label: "Egyéb", icon: HelpCircle },
]

export function ProjectForm({ onSubmit }: ProjectFormProps) {
  const { data: session } = useSession()
  const [currentStep, setCurrentStep] = useState(1)
  const [hasDomain, setHasDomain] = useState(false)
  const [formData, setFormData] = useState({
    websiteType: "",
    businessName: "",
    domain: "",
    subdomain: "",
    selectedStyle: "modern", // Default style
    status: "pending",
  })
  const [suggestedDomains, setSuggestedDomains] = useState<string[]>([])
  const [subdomainError, setSubdomainError] = useState("")

  // @ts-ignore
  const isVercelConnected = !!session?.user?.vercelAccessToken

  const generateDomainSuggestions = (name: string) => {
    if (!name.trim()) {
      setSuggestedDomains([])
      return
    }
    const slug = name
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[^a-z0-9]/g, "")
      .substring(0, 20)

    setSuggestedDomains([`${slug}.com`, `${slug}.hu`, `${slug}online.hu`])
  }

  const validateSubdomain = (value: string) => {
    if (!value) {
      setSubdomainError("Aldomain kötelező")
      return false
    }
    if (value.length < 3) {
      setSubdomainError("Legalább 3 karakter")
      return false
    }
    if (!/^[a-z0-9-]+$/.test(value)) {
      setSubdomainError("Csak kisbetűk, számok és kötőjelek")
      return false
    }
    if (value.startsWith("-") || value.endsWith("-")) {
      setSubdomainError("Nem kezdődhet vagy végződhet kötőjellel")
      return false
    }
    setSubdomainError("")
    return true
  }

  const handleNext = () => {
    if (!isStepValid()) return

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleVercelConnect = async () => {
    try {
      await signIn("vercel", { callbackUrl: window.location.href })
    } catch (err) {
      console.error("Vercel login failed", err)
    }
  }

  const handleFinalSubmit = () => {
    const submitData = {
        ...formData,
        subdomain: formData.subdomain || "",
        domain: formData.domain || "",
      }
      onSubmit(submitData)
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <h2 className="text-2xl font-bold mb-2 text-center">Milyen weboldalt szeretnél?</h2>
            <p className="text-muted-foreground text-center mb-6 text-sm">Válaszd ki a célodnak legmegfelelőbbet</p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4">
              {websiteTypes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setFormData({ ...formData, websiteType: id })}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border transition-all duration-200 group relative overflow-hidden ${
                    formData.websiteType === id
                      ? "border-primary bg-primary/5 shadow-md ring-1 ring-primary/20"
                      : "border-border hover:border-foreground/30 hover:bg-accent/50"
                  }`}
                >
                  <div className={`p-3 rounded-full mb-3 transition-colors ${
                      formData.websiteType === id ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground group-hover:text-foreground"
                  }`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="font-semibold text-sm text-center">{label}</span>
                  {formData.websiteType === id && (
                      <div className="absolute top-2 right-2 text-primary">
                          <CheckCircle2 className="w-4 h-4" />
                      </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )
      case 2:
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
             <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-tr from-black to-zinc-800 text-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-xl rotate-3">
                    <Triangle className="w-8 h-8 fill-current" />
                </div>
                <h2 className="text-2xl font-bold">Vercel Csatlakozás</h2>
                <p className="text-muted-foreground text-sm mt-1">Kapcsold össze fiókodat a publikáláshoz</p>
             </div>

            <div className="space-y-4">
                 <div
                    onClick={isVercelConnected ? undefined : handleVercelConnect}
                    className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                     isVercelConnected
                        ? "border-green-500/20 bg-green-50/50 cursor-default"
                        : "border-black/10 hover:border-black cursor-pointer bg-white group hover:shadow-lg"
                 }`}>
                     <div className="p-5 flex items-center gap-4">
                         <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                             isVercelConnected ? "bg-green-100 text-green-600" : "bg-black text-white"
                         }`}>
                             <svg className="w-6 h-6" viewBox="0 0 76 65" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M37.5274 0L75.0548 65H0L37.5274 0Z" fill="currentColor"/>
                             </svg>
                         </div>
                         <div className="flex-1 min-w-0">
                             <h3 className="font-bold text-base truncate">Vercel</h3>
                             <p className="text-xs text-muted-foreground truncate">
                                 {isVercelConnected
                                    ? `Connected as ${session?.user?.name || "User"}`
                                    : "Connect your account to deploy"
                                 }
                             </p>
                         </div>
                         <div className="shrink-0">
                             {isVercelConnected ? (
                                 <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center shadow-sm">
                                     <Check className="w-5 h-5" />
                                 </div>
                             ) : (
                                 <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors">
                                     <ArrowRight className="w-4 h-4" />
                                 </div>
                             )}
                         </div>
                     </div>
                     {isVercelConnected && (
                         <div className="absolute inset-x-0 bottom-0 h-1 bg-green-500" />
                     )}
                 </div>

                 {!isVercelConnected && (
                    <div className="text-center">
                        <Button onClick={handleVercelConnect} className="w-full">
                            Connect Vercel Account
                        </Button>
                        <p className="text-xs text-muted-foreground mt-2">
                            Kötelező lépés a folytatáshoz
                        </p>
                    </div>
                 )}
            </div>
          </div>
        )
      case 3:
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
             <div className="text-center mb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Briefcase className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Mi a vállalkozásod neve?</h2>
                <p className="text-muted-foreground text-sm mt-1">Ez jelenik majd meg a fejlécben</p>
             </div>

            <div className="relative">
                <input
                type="text"
                className="w-full p-4 pl-4 border border-border rounded-xl bg-background shadow-sm focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-lg"
                placeholder="pl. Szuper Webshop Kft."
                value={formData.businessName}
                autoFocus
                onChange={(e) => {
                    const value = e.target.value
                    setFormData({ ...formData, businessName: value })
                    generateDomainSuggestions(value)
                }}
                />
            </div>
          </div>
        )
      case 4:
        return (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300 max-w-md mx-auto">
             <div className="text-center mb-6">
                <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-4">
                    <Globe className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-bold">Domain beállítás</h2>
                <p className="text-muted-foreground text-sm mt-1">Hol legyen elérhető a weboldalad?</p>
             </div>

            <div className="bg-secondary/30 p-1 rounded-xl flex mb-6">
              <button
                onClick={() => {
                  setHasDomain(false)
                  setFormData({ ...formData, domain: "", subdomain: "" })
                  setSubdomainError("")
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  !hasDomain
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Ingyenes aldomain
              </button>
              <button
                onClick={() => {
                  setHasDomain(true)
                  setFormData({ ...formData, domain: "", subdomain: "" })
                  setSubdomainError("")
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                  hasDomain
                    ? "bg-background shadow text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Saját domain
              </button>
            </div>

            {!hasDomain ? (
              <div className="space-y-4">
                <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <span className="text-muted-foreground font-semibold">https://</span>
                    </div>
                    <input
                    type="text"
                    className={`w-full p-3 pl-[4.5rem] pr-24 border rounded-xl bg-background transition-all ${
                        subdomainError ? "border-red-500 focus:ring-red-200" : "border-border focus:border-primary focus:ring-2 focus:ring-primary/20"
                    }`}
                    placeholder="weboldalad"
                    value={formData.subdomain}
                    onChange={(e) => {
                        const value = e.target.value.toLowerCase().trim()
                        setFormData({ ...formData, subdomain: value, domain: "" })
                        validateSubdomain(value)
                    }}
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        <span className="text-muted-foreground font-medium">.ltpd.xyz</span>
                    </div>
                </div>
                {subdomainError ? (
                    <p className="text-sm text-red-500 flex items-center gap-1">
                        <Triangle className="w-3 h-3 fill-current" /> {subdomainError}
                    </p>
                ) : formData.subdomain && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Elérhető
                    </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground mb-3">Írd be a már megvásárolt domained:</p>
                <input
                    type="text"
                    placeholder="pl. sajat-cegem.hu"
                    className="w-full p-3 border rounded-xl bg-background"
                    value={formData.domain}
                    onChange={(e) => {
                      const value = e.target.value.trim()
                      setFormData({ ...formData, domain: value })
                    }}
                  />

                 {suggestedDomains.length > 0 && (
                    <div className="mt-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-2">Ötletek (nem regisztrált):</p>
                        <div className="flex flex-wrap gap-2">
                        {suggestedDomains.map((domain) => (
                            <button
                            key={domain}
                            onClick={() => setFormData({ ...formData, domain, subdomain: "" })}
                            className="text-xs bg-secondary hover:bg-secondary/80 border border-border px-3 py-1.5 rounded-full transition-colors"
                            >
                            {domain}
                            </button>
                        ))}
                        </div>
                    </div>
                 )}
              </div>
            )}

            <div className="pt-6 mt-6 border-t">
                 <Button
                    className="w-full h-12 text-base shadow-lg bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={handleFinalSubmit}
                    disabled={!isStepValid()}
                >
                    Weboldal Létrehozása
                </Button>
            </div>
          </div>
        )
      default:
        return null
    }
  }

  const isStepValid = () => {
    switch (currentStep) {
      case 1:
        return !!formData.websiteType
      case 2:
        return !!isVercelConnected
      case 3:
        return !!formData.businessName
      case 4:
        return hasDomain ? !!formData.domain : !!formData.subdomain && !subdomainError
      default:
        return false
    }
  }

  return (
    <div className="relative w-full">
      {/* Progress Steps - Mobile Optimized */}
      <div className="mb-8">
        <div className="flex items-center justify-between px-2">
            {steps.map((step) => (
                <div key={step.id} className="flex flex-col items-center z-10">
                    <div
                        className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center text-xs md:text-sm font-bold transition-all duration-500 ${
                            currentStep >= step.id
                                ? "bg-primary text-primary-foreground shadow-md scale-100"
                                : "bg-muted text-muted-foreground scale-90"
                        }`}
                    >
                        {currentStep > step.id ? <Check className="w-4 h-4 md:w-5 md:h-5" /> : step.id}
                    </div>
                    <span className={`text-[10px] md:text-xs mt-2 font-medium transition-colors duration-300 ${
                        currentStep >= step.id ? "text-primary" : "text-muted-foreground"
                    }`}>
                        {step.name}
                    </span>
                </div>
            ))}
            {/* Progress Bar Background */}
            <div className="absolute top-4 left-0 w-full px-6 md:px-8 -z-0">
                <div className="h-0.5 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-in-out"
                        style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                    />
                </div>
            </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="min-h-[300px]">
          {renderStep()}
      </div>

      {/* Navigation Buttons - Hidden on Step 4/final */}
      {currentStep < 4 && (
        <div className="flex justify-between gap-3 mt-6 pt-6 border-t border-border">
            <button
            onClick={handleBack}
            disabled={currentStep === 1}
            className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                currentStep === 1
                    ? "text-muted-foreground opacity-50 cursor-not-allowed"
                    : "hover:bg-accent text-foreground"
            }`}
            >
            Vissza
            </button>
            <button
            onClick={handleNext}
            disabled={!isStepValid()}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all flex items-center gap-2"
            >
            Következő <ArrowRight className="w-4 h-4" />
            </button>
        </div>
      )}
    </div>
  )
}
