"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ProjectForm } from "./project-form"
import { themes } from "@/lib/webshop-types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ArrowRight, Triangle, ShieldCheck, Zap } from "lucide-react"

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [vercelConnectProject, setVercelConnectProject] = useState<any>(null)

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

      setIsLoading(false)

      if (newProject.vercelAuthRequired) {
        // Show Vercel connect UI instead of closing
        setVercelConnectProject(newProject)
        toast.info("Please connect Vercel to complete deployment")
      } else {
        toast.success("Project created successfully!")
        onClose()
        // Wait a bit for modal to close before redirecting
        setTimeout(() => {
          router.push(`/dashboard/sites/${newProject._id}`)
        }, 100)
      }
    } catch (error) {
      console.error("[v0] Project creation error:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create project")
      setIsLoading(false)
    }
  }

  const handleVercelConnect = () => {
    if (!vercelConnectProject) return
    window.location.href = `/api/auth/vercel/connect?next=/dashboard/sites/${vercelConnectProject._id}?auto_deploy=true`
  }

  const handleClose = () => {
    // Reset state when closing
    if (vercelConnectProject) {
       // If user closes without connecting, they just go to the project page (undeployed)
       // Or we can warn them. For now, let's just close and redirect to dashboard/project
       router.push(`/dashboard/sites/${vercelConnectProject._id}`)
    }
    setVercelConnectProject(null)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-4 md:p-6">
        {!vercelConnectProject ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-lg md:text-xl">Új Projekt Létrehozása</DialogTitle>
              <DialogDescription className="text-xs md:text-sm">
                Lépésről lépésre hozz létre egy új weboldalt
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 md:py-6">
              <ProjectForm onSubmit={handleFormSubmit} />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center py-8 px-4 space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center shadow-xl">
               <Triangle className="h-10 w-10 text-white fill-white" />
            </div>

            <div className="space-y-2 max-w-md">
              <h2 className="text-2xl font-bold">Connect to Vercel</h2>
              <p className="text-muted-foreground">
                To provide free, high-performance hosting for your website, we integrate with Vercel.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg mt-4">
               <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border border-border">
                  <Zap className="h-6 w-6 text-yellow-500 mb-2" />
                  <h3 className="font-semibold text-sm">Instant Deployment</h3>
                  <p className="text-xs text-muted-foreground mt-1">Your site goes live in seconds</p>
               </div>
               <div className="flex flex-col items-center p-4 rounded-xl bg-muted/50 border border-border">
                  <ShieldCheck className="h-6 w-6 text-green-500 mb-2" />
                  <h3 className="font-semibold text-sm">Secure & Free</h3>
                  <p className="text-xs text-muted-foreground mt-1">SSL included, 100% free hosting</p>
               </div>
            </div>

            <div className="w-full max-w-sm pt-4 space-y-3">
              <Button
                onClick={handleVercelConnect}
                className="w-full h-12 text-base font-medium bg-black hover:bg-black/90 text-white shadow-lg transition-all hover:scale-[1.02]"
              >
                Connect & Deploy
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                onClick={handleClose}
                className="w-full text-muted-foreground hover:text-foreground"
              >
                Skip for now
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
