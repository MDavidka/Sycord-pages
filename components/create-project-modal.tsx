"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ProjectForm } from "./project-form"
import { themes } from "@/lib/webshop-types"
import { toast } from "sonner"

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleFormSubmit = async (formData: any) => {
    if (isLoading) {
      console.log("[v0] Submission already in progress")
      return
    }

    console.log("[v0] Form submitted with data:", formData)
    setIsLoading(true)

    try {
      const theme = themes[formData.selectedStyle as keyof typeof themes]

      if (!formData.businessName || !formData.websiteType) {
        throw new Error("Business name and website type are required")
      }

      if (!formData.domain && !formData.subdomain) {
        throw new Error("Either a domain or subdomain is required")
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: formData.businessName,
          websiteType: formData.websiteType,
          domain: formData.domain || null,
          subdomain: formData.subdomain || null,
          theme: formData.selectedStyle,
          primaryColor: theme.primary,
          secondaryColor: theme.secondary,
          headerStyle: "simple",
          productsPerPage: 12,
          currency: "EUR",
          showPrices: true,
          layout: "grid",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to create project")
      }

      const newProject = await response.json()
      console.log("[v0] Project created successfully:", newProject._id)
      toast.success("Project created successfully!")

      setIsLoading(false)
      onClose()

      // Wait a bit for modal to close before redirecting
      setTimeout(() => {
        router.push(`/dashboard/sites/${newProject._id}`)
      }, 100)
    } catch (error) {
      console.error("[v0] Project creation error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create project")
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg md:text-xl">Új Projekt Létrehozása</DialogTitle>
          <DialogDescription className="text-xs md:text-sm">
            Lépésről lépésre hozz létre egy új weboldalt
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 md:py-6">
          <ProjectForm onSubmit={handleFormSubmit} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
