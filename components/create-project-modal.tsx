"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ProjectForm } from "./project-form"
import { themes } from "@/lib/webshop-types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { signIn, useSession } from "next-auth/react"
import { TriangleAlert, ExternalLink } from "lucide-react"

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const router = useRouter()
  const { data: session, update: updateSession } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Log session state for debugging
  useEffect(() => {
    if (isOpen) {
        console.log("[v0-debug] Modal open. Session:", session)
        // @ts-ignore
        if (session?.user?.vercelAccessToken) {
            console.log("[v0-debug] Vercel token present in session")
        } else {
            console.log("[v0-debug] Vercel token MISSING")
        }
    }
  }, [isOpen, session])

  // @ts-ignore
  const isVercelConnected = !!session?.user?.vercelAccessToken

  const handleVercelConnect = async () => {
    console.log("[v0] User initiated Vercel connection flow")
    try {
      // Sign in with Vercel to link account or get token
      await signIn("vercel", { callbackUrl: window.location.href })
    } catch (err) {
      console.error("[v0] SignIn call failed", err)
      toast.error("Failed to initiate login")
    }
  }

  const handleFormSubmit = async (formData: any) => {
    if (isLoading) return

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
          {!isVercelConnected ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center">
              <div className="h-16 w-16 bg-black text-white rounded-full flex items-center justify-center">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M24 22.525H0l12-21.05 12 21.05z" />
                </svg>
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-semibold">Connect Vercel to Continue</h3>
                <p className="text-sm text-muted-foreground">
                  We use Vercel for free, high-performance hosting. You must connect your Vercel account to deploy your website.
                </p>
              </div>
              <Button
                onClick={handleVercelConnect}
                className="w-full max-w-xs bg-black text-white hover:bg-zinc-800 gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Connect Vercel Account
              </Button>
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-200">
                <TriangleAlert className="w-4 h-4" />
                <p>This creates a project on your personal Vercel dashboard.</p>
              </div>
            </div>
          ) : (
            <ProjectForm onSubmit={handleFormSubmit} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
