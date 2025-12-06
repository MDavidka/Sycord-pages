"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { ProjectForm } from "./project-form"
import { themes } from "@/lib/webshop-types"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { useSession } from "next-auth/react"
import { TriangleAlert, ExternalLink } from "lucide-react"

interface CreateProjectModalProps {
  isOpen: boolean
  onClose: () => void
}

export function CreateProjectModal({ isOpen, onClose }: CreateProjectModalProps) {
  const router = useRouter()
  const { data: session, update } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  // Log session state for debugging
  useEffect(() => {
    if (isOpen) {
      console.log("[v0-debug] Modal open. Session:", session)
      // @ts-ignore
      if (session?.user?.isFirebaseConnected) {
        console.log("[v0-debug] Firebase connected in session")
      } else {
        console.log("[v0-debug] Firebase connection MISSING")
      }
    }
  }, [isOpen, session])

  // Check for firebase_connected param in URL to force session update
  useEffect(() => {
    if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.get("firebase_connected")) {
            console.log("[v0-debug] Firebase connected flag found, updating session...");
            update().then(() => {
                console.log("[v0-debug] Session updated.");
                // Remove the param from URL without reload
                url.searchParams.delete("firebase_connected");
                window.history.replaceState({}, "", url.toString());
            });
        }
    }
  }, [update]);

  // @ts-ignore
  const isFirebaseConnected = !!session?.user?.isFirebaseConnected

  const handleFirebaseConnect = () => {
    console.log("[v0] User initiated Firebase connection flow")
    window.location.href = `/api/auth/firebase/authorize`
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
          {!isFirebaseConnected ? (
            <div className="flex flex-col items-center justify-center space-y-6 py-8 text-center">
              <div className="h-16 w-16 bg-amber-500 text-white rounded-full flex items-center justify-center">
                {/* Simple Flame Icon for Firebase */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="lucide lucide-flame"
                >
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.1.2-2.2.6-3.3.7 3.7 4.4 4.5 4.5 3.3z" />
                </svg>
              </div>
              <div className="space-y-2 max-w-md">
                <h3 className="text-lg font-semibold">Connect Firebase to Continue</h3>
                <p className="text-sm text-muted-foreground">
                  We use Firebase Hosting for fast and secure deployment. You must connect your Google account with Firebase permissions.
                </p>
              </div>
              <Button
                onClick={handleFirebaseConnect}
                className="w-full max-w-xs bg-amber-500 text-white hover:bg-amber-600 gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Connect Firebase Account
              </Button>
              <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 p-3 rounded-md border border-blue-200">
                <TriangleAlert className="w-4 h-4" />
                <p>We will create a new site in your Firebase project.</p>
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
