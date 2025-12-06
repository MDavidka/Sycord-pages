"use client"

import { useState } from "react"
import { Briefcase, ShoppingCart, BookOpen, HelpCircle, Check, Globe } from "lucide-react"
import { themes } from "@/lib/webshop-types"

interface ProjectFormProps {
  onSubmit: (data: any) => void
}

const steps = [
  { id: 1, name: "Típus" },
  { id: 2, name: "Név" },
  { id: 3, name: "Domain" },
  { id: 4, name: "Stílus" },
]

const websiteTypes = [
  { id: "service", label: "Szolgáltatás", icon: Briefcase },
  { id: "hosting", label: "Hosting", icon: Globe },
  { id: "webshop", label: "Webáruház", icon: ShoppingCart },
  { id: "blog", label: "Blog", icon: BookOpen },
  { id: "other", label: "Egyéb", icon: HelpCircle },
]

export function ProjectForm({ onSubmit }: ProjectFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [hasDomain, setHasDomain] = useState(false) // toggle for own domain or subdomain
  const [formData, setFormData] = useState({
    websiteType: "",
    businessName: "",
    domain: "",
    subdomain: "",
    selectedStyle: "modern",
    status: "pending", // add pending status for newly created websites
  })
  const [suggestedDomains, setSuggestedDomains] = useState<string[]>([])
  const [subdomainError, setSubdomainError] = useState("")

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
    if (!isStepValid()) {
      console.log("[v0] Step validation failed at step", currentStep)
      return
    }

    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1)
    } else {
      const submitData = {
        ...formData,
        subdomain: formData.subdomain || "",
        domain: formData.domain || "",
      }
      console.log("[v0] Submitting form data:", submitData)
      onSubmit(submitData)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1)
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div>
            <h2 className="text-2xl font-bold mb-6 text-center">Milyen típusú weboldalt szeretnél?</h2>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {websiteTypes.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setFormData({ ...formData, websiteType: id })}
                  className={`flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all ${
                    formData.websiteType === id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <Icon className="h-6 w-6 mb-2" />
                  <span className="font-semibold text-xs text-center">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )
      case 2:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center">Mi a vállalkozásod neve?</h2>
            <input
              type="text"
              className="w-full p-3 border rounded-md bg-transparent"
              placeholder="pl. My Business"
              value={formData.businessName}
              onChange={(e) => {
                const value = e.target.value
                setFormData({ ...formData, businessName: value })
                generateDomainSuggestions(value)
              }}
            />
          </div>
        )
      case 3:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center">Domain beállítás</h2>

            <div className="flex gap-2 justify-center mb-6">
              <button
                onClick={() => {
                  setHasDomain(false)
                  setFormData({ ...formData, domain: "", subdomain: "" })
                  setSubdomainError("")
                }}
                className={`px-6 py-2 rounded-lg border-2 font-medium transition-all ${
                  !hasDomain
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                Nincs domainém
              </button>
              <button
                onClick={() => {
                  setHasDomain(true)
                  setFormData({ ...formData, domain: "", subdomain: "" })
                  setSubdomainError("")
                }}
                className={`px-6 py-2 rounded-lg border-2 font-medium transition-all ${
                  hasDomain
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-foreground/30"
                }`}
              >
                Van domainém
              </button>
            </div>

            {!hasDomain ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center">Az oldal URL-je:</p>
                <p className="text-lg font-semibold text-center bg-primary/10 rounded-lg py-3 px-4">
                  {formData.subdomain || "weboldalad"}.ltpd.xyz
                </p>
                <input
                  type="text"
                  className={`w-full p-3 border rounded-md bg-transparent ${subdomainError ? "border-red-500" : ""}`}
                  placeholder="pl. mytestsite"
                  value={formData.subdomain}
                  onChange={(e) => {
                    const value = e.target.value.toLowerCase().trim()
                    setFormData({ ...formData, subdomain: value, domain: "" })
                    validateSubdomain(value)
                  }}
                />
                {subdomainError && <p className="text-sm text-red-500">{subdomainError}</p>}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground text-center mb-3">Javasolt domain nevek:</p>
                <div className="space-y-2">
                  {suggestedDomains.map((domain) => (
                    <button
                      key={domain}
                      onClick={() => {
                        setFormData({ ...formData, domain, subdomain: "" })
                        console.log("[v0] Domain selected:", domain)
                      }}
                      className={`w-full p-3 rounded-lg border-2 transition-all text-left ${
                        formData.domain === domain
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-foreground/30"
                      }`}
                    >
                      {domain}
                    </button>
                  ))}
                </div>
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-2">Saját domain:</p>
                  <input
                    type="text"
                    placeholder="pl. custom.com"
                    className="w-full p-2 border rounded-md bg-transparent"
                    value={formData.domain}
                    onChange={(e) => {
                      const value = e.target.value.trim()
                      setFormData({ ...formData, domain: value })
                      console.log("[v0] Custom domain entered:", value)
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )
      case 4:
        return (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-center">Válassz egy stílust</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  onClick={() => setFormData({ ...formData, selectedStyle: key })}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    formData.selectedStyle === key
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-foreground/30"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex gap-1.5 h-8 rounded overflow-hidden">
                      <div className="flex-1" style={{ backgroundColor: theme.primary }} />
                      <div className="flex-1" style={{ backgroundColor: theme.secondary }} />
                      <div className="flex-1" style={{ backgroundColor: theme.accent }} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-semibold text-xs">{theme.name}</h3>
                      <p className="text-xs text-muted-foreground line-clamp-1">{theme.description}</p>
                    </div>
                  </div>
                </button>
              ))}
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
        return !!formData.businessName
      case 3:
        return hasDomain ? !!formData.domain : !!formData.subdomain && !subdomainError
      case 4:
        return !!formData.selectedStyle
      default:
        return false
    }
  }

  return (
    <div className="relative w-full">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-3xl rounded-3xl" />

      {/* Progress Steps - Responsive */}
      <div className="flex items-center justify-between mb-6 md:mb-8 overflow-x-auto pb-2 gap-1 md:gap-2">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-center min-w-fit">
            <div
              className={`flex flex-col items-center ${
                currentStep >= step.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div
                className={`h-6 w-6 md:h-8 md:w-8 rounded-full border-2 flex items-center justify-center text-xs md:text-sm font-semibold ${
                  currentStep > step.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : currentStep === step.id
                      ? "border-primary"
                      : "border-border"
                }`}
              >
                {currentStep > step.id ? <Check className="h-3 w-3 md:h-5 md:w-5" /> : step.id}
              </div>
              <p className="text-xs mt-1 text-center line-clamp-1">{step.name}</p>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 md:mx-2 hidden sm:block ${currentStep > step.id ? "bg-primary" : "bg-border"}`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Form Content - Responsive spacing */}
      <div className="mb-6 md:mb-8 min-h-[200px] px-2 md:px-4">{renderStep()}</div>

      {/* Navigation Buttons - Responsive */}
      <div className="flex justify-between gap-2 md:gap-3">
        <button
          onClick={handleBack}
          disabled={currentStep === 1}
          className="px-3 md:px-4 py-2 text-sm md:text-base border border-input rounded-md hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Vissza
        </button>
        <button
          onClick={handleNext}
          disabled={!isStepValid()}
          className="px-4 md:px-6 py-2 text-sm md:text-base bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {currentStep === steps.length ? "Befejezés" : "Következő"}
        </button>
      </div>
    </div>
  )
}
