"use client"

import { useState } from "react"
import { Button } from "./ui/button"
import { User, Briefcase, ShoppingCart, Check, X } from "lucide-react"

interface ProjectFormProps {
  onSubmit: (data: any) => void
}

const steps = [
  { id: 1, name: "Válassz típust" },
  { id: 2, name: "Domain" },
  { id: 3, name: "Név" },
]

export function ProjectForm({ onSubmit }: ProjectFormProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState({
    websiteType: "",
    hasDomain: null,
    businessName: "",
  })

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1)
    } else {
      onSubmit(formData)
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
            <h2 className="text-2xl font-bold mb-4 text-center">Milyen fajta vállalkozásnak szeretne weboldalt?</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg ${
                  formData.websiteType === "personal" ? "border-primary" : "border-border"
                }`}
                onClick={() => setFormData({ ...formData, websiteType: "personal" })}
              >
                <User className="h-8 w-8 mb-2" />
                <span className="font-semibold">Személyes</span>
              </button>
              <button
                className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg ${
                  formData.websiteType === "service" ? "border-primary" : "border-border"
                }`}
                onClick={() => setFormData({ ...formData, websiteType: "service" })}
              >
                <Briefcase className="h-8 w-8 mb-2" />
                <span className="font-semibold">Szolgáltatás</span>
              </button>
              <button
                className={`flex flex-col items-center justify-center p-4 border-2 rounded-lg ${
                  formData.websiteType === "shop" ? "border-primary" : "border-border"
                }`}
                onClick={() => setFormData({ ...formData, websiteType: "shop" })}
              >
                <ShoppingCart className="h-8 w-8 mb-2" />
                <span className="font-semibold">Webáruház</span>
              </button>
            </div>
          </div>
        )
      case 2:
        return (
          <div className="flex flex-col h-full">
            <h2 className="text-2xl font-bold mb-4 text-center">Van már megvásárolt domain-je?</h2>
            <div className="w-full p-2 border rounded-md bg-transparent mb-4 text-center text-muted-foreground">
              {formData.hasDomain === true ? 'Pelda.com' : formData.hasDomain === false ? 'weboldalad.sycord.com' : 'Valasszon opciot'}
            </div>
            <div className="flex justify-center gap-4">
              <Button
                variant={formData.hasDomain === true ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, hasDomain: true })}
              >
                <Check className="mr-2 h-4 w-4" />
                Igen
              </Button>
              <Button
                variant={formData.hasDomain === false ? "default" : "outline"}
                onClick={() => setFormData({ ...formData, hasDomain: false })}
              >
                <X className="mr-2 h-4 w-4" />
                Nem
              </Button>
            </div>
          </div>
        )
      case 3:
        return (
          <div className="flex flex-col h-full">
            <h2 className="text-2xl font-bold mb-2 text-center">Tervezd meg az online weboldalad!</h2>
            <div className="text-center mb-6">
                <p>A vállalkozásod neve?</p>
            </div>
            <input
              type="text"
              className="w-full p-2 border rounded-md bg-transparent"
              value={formData.businessName}
              onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
            />
          </div>
        )
      default:
        return null
    }
  }

  return (
    <div>
      {/* Status Bar */}
      <div className="flex items-center justify-between mb-8">
        {steps.map((step, index) => (
          <>
            <div
              className={`flex flex-col items-center ${
                currentStep >= step.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div
                className={`h-8 w-8 rounded-full border-2 flex items-center justify-center ${
                  currentStep > step.id ? "bg-primary border-primary text-primary-foreground" :
                  currentStep === step.id ? "border-primary" : "border-border"
                }`}
              >
                {currentStep > step.id ? <Check className="h-5 w-5" /> : step.id}
              </div>
              <p className="text-sm mt-1">{step.name}</p>
            </div>
            {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-primary' : 'bg-border'}`} />
            )}
          </>
        ))}
      </div>

      {/* Form Content */}
      <div className="mb-8 min-h-[150px]">{renderStep()}</div>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 1}>
          Vissza
        </Button>
        <Button onClick={handleNext} disabled={
            (currentStep === 1 && !formData.websiteType) ||
            (currentStep === 2 && formData.hasDomain === null) ||
            (currentStep === 3 && !formData.businessName)
        }>
          {currentStep === 3 ? "Befejezés" : "Következő"}
        </Button>
      </div>
    </div>
  )
}
