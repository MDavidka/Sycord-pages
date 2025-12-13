"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, Plus, LogOut, User, Menu, TriangleAlert } from "lucide-react"
import { useState, useEffect, Suspense } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { WebsitePreviewCard } from "@/components/website-preview-card"
import { WelcomeOverlay } from "@/components/welcome-overlay"
import { CreateProjectModal } from "@/components/create-project-modal"
import { ThemeToggle } from "@/components/theme-toggle"
import { DashboardHeader } from "@/components/dashboard-header"

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [showWelcome, setShowWelcome] = useState(true)
  const [deletingDeployments, setDeletingDeployments] = useState<Set<string>>(new Set())
  const [flaggedDeployments, setFlaggedDeployments] = useState<Set<string>>(new Set())
  const [debugError, setDebugError] = useState<string | null>(null)

  // Check for auto-open modal query param and errors
  useEffect(() => {
    const openCreateModal = searchParams.get("open_create_modal")
    const error = searchParams.get("error")

    if (error) {
      setDebugError(error)
      // Clean up URL
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete("error")
      window.history.replaceState({}, "", newUrl.toString())
    }

    if (openCreateModal === "true") {
        setIsModalOpen(true)
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete("open_create_modal")
        window.history.replaceState({}, "", newUrl.toString())
    }
  }, [searchParams])

  useEffect(() => {
    async function fetchProjects() {
      try {
        const response = await fetch("/api/projects")
        if (response.ok) {
          const data = await response.json()
          setProjects(data)
        }
      } catch (error) {
        console.error("Error fetching projects:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchProjects()
    }
  }, [status])

  useEffect(() => {
    const welcomeTimer = setTimeout(() => {
      setShowWelcome(false)
    }, 2000)

    return () => clearTimeout(welcomeTimer)
  }, [])

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-foreground">Betöltés...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

  const handleDeleteDeployment = async (deploymentId: string, projectId: string) => {
    if (!confirm("Are you sure you want to delete this deployment?")) return

    setDeletingDeployments((prev) => new Set([...prev, deploymentId]))

    try {
      const response = await fetch(`/api/deployments?id=${deploymentId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        setFlaggedDeployments((prev) => {
          const next = new Set(prev)
          next.delete(deploymentId)
          return next
        })

        setProjects((prevProjects: any) =>
          prevProjects.map((p: any) =>
            p._id === projectId
              ? {
                  ...p,
                  domain: null,
                  subdomain: null,
                  deploymentId: null,
                }
              : p,
          ),
        )
      } else {
        alert("Failed to delete deployment")
      }
    } catch (error) {
      console.error("[v0] Error deleting deployment:", error)
      alert("Error deleting deployment")
    } finally {
      setDeletingDeployments((prev) => {
        const next = new Set(prev)
        next.delete(deploymentId)
        return next
      })
    }
  }

  return (
    <>
      <div className="min-h-screen bg-background md:ml-16">
        <DashboardHeader />

        <main className="container mx-auto px-4 py-6 md:py-8 pb-20 md:pb-6">
          <div className="flex flex-col gap-4 mb-6 md:mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground">Projektek</h1>
              <Button onClick={() => setIsModalOpen(true)} className="w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Új Projekt
              </Button>
            </div>
            <div className="flex gap-3 items-center">
              <input
                type="text"
                placeholder="Keresés a webhelyek között..."
                className="flex-1 p-3 border border-input rounded-md bg-transparent text-sm"
              />
              <div className="px-4 py-3 border border-input rounded-md bg-muted text-sm font-medium whitespace-nowrap">
                {projects.length}/3
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center bg-card">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
              <p className="text-muted-foreground">Betöltés...</p>
            </div>
          ) : projects.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-foreground mb-2">Még nincsenek projektek</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Kezdje el első projektjét, és indítsa el weboldalát {"{"}name{"}"}.ltpd.xyz címen
                </p>
                <Button onClick={() => setIsModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Első Projekt Létrehozása
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {projects.map((project: any) => (
                <div
                  key={project._id}
                  className="border border-border rounded-lg overflow-hidden flex flex-col hover:border-foreground/20 transition-colors"
                >
                  {project.domain && project.deploymentId ? (
                    <WebsitePreviewCard
                      domain={project.cloudflareUrl || project.domain}
                      isLive={!flaggedDeployments.has(project.deploymentId)}
                      deploymentId={project.deploymentId}
                      projectId={project._id}
                      businessName={project.businessName}
                      createdAt={project.createdAt}
                      style={project.style || "default"}
                      onDelete={(deploymentId) => handleDeleteDeployment(deploymentId, project._id)}
                    />
                  ) : (
                    <div className="w-full h-64 sm:h-80 md:h-96 bg-gray-100 rounded-lg flex items-center justify-center border border-border">
                      <p className="text-xs text-muted-foreground">Nincs preview</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      <CreateProjectModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />

      <WelcomeOverlay
        userName={session?.user?.name || "Felhasználó"}
        userImage={session?.user?.image}
        isVisible={showWelcome}
        onComplete={() => setShowWelcome(false)}
      />

      {/* Debug Error Popup */}
      <Dialog open={!!debugError} onOpenChange={(open) => !open && setDebugError(null)}>
        <DialogContent className="sm:max-w-md border-red-200 bg-red-50 dark:bg-red-950/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <TriangleAlert className="h-5 w-5" />
              Authentication Error
            </DialogTitle>
            <DialogDescription className="text-red-600/90 dark:text-red-400/90">
              An error occurred during the authentication process.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-white dark:bg-black/20 rounded-md border border-red-100 dark:border-red-900/50 font-mono text-sm break-all">
            {debugError}
          </div>
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => setDebugError(null)} className="border-red-200 hover:bg-red-100 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-900/40">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DashboardContent />
    </Suspense>
  )
}
