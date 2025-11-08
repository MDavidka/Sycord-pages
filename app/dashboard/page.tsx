"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, Plus, LogOut, User, Menu } from "lucide-react"
import { Modal } from "@/components/ui/modal"
import { ProjectForm } from "@/components/project-form"
import { useState, useEffect } from "react"
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
import { DeploymentStatusCard } from "@/components/deployment-status-card"
import { DeploymentWarningCard } from "@/components/deployment-warning-card"
import { WebsitePreviewCard } from "@/components/website-preview-card"

export default function DashboardPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingDeployments, setDeletingDeployments] = useState<Set<string>>(new Set())
  const [flaggedDeployments, setFlaggedDeployments] = useState<Set<string>>(new Set())

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

  if (status === "loading" || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
          <p className="text-muted-foreground">Betöltés...</p>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  const MobileNav = () => (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72">
        <nav className="flex flex-col gap-4 mt-8">
          <Link href="/dashboard" className="text-sm text-foreground font-medium px-4 py-2 hover:bg-accent rounded-md">
            Áttekintés
          </Link>
          <Link
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-accent rounded-md"
          >
            Projektek
          </Link>
          <Link
            href="#"
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-accent rounded-md"
          >
            Analitika
          </Link>
          <Link
            href="/dashboard/webshop-demo"
            className="text-sm text-muted-foreground hover:text-foreground px-4 py-2 hover:bg-accent rounded-md"
          >
            Webshop Demo
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  )

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

        setProjects((prevProjects) =>
          prevProjects.map((p) =>
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

  const handleDeleteProject = async (projectId: string) => {
    const confirmed = confirm(
      "Are you sure you want to delete this entire website? This action cannot be undone. All deployments and data will be permanently removed.",
    )
    if (!confirmed) return

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: "DELETE",
      })

      if (response.ok) {
        console.log("[v0] Project deleted successfully")
        setProjects((prevProjects) => prevProjects.filter((p) => p._id !== projectId))
      } else {
        alert("Failed to delete project")
      }
    } catch (error) {
      console.error("[v0] Error deleting project:", error)
      alert("Error deleting project")
    }
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-8">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} />
              <span className="text-xl font-semibold text-foreground">Sycord</span>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/dashboard" className="text-sm text-foreground font-medium">
                Áttekintés
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Projektek
              </Link>
              <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Analitika
              </Link>
              <Link
                href="/dashboard/webshop-demo"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Webshop Demo
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <MobileNav />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                    <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem>
                  <User className="mr-2 h-4 w-4" />
                  <span>Profil</span>
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Beállítások</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Kijelentkezés</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8">
        <div className="flex flex-col gap-4 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              Üdvözöljük újra, {session?.user?.name || "Felhasználó"}
            </h1>
            <p className="text-sm md:text-base text-muted-foreground">Itt láthatja, mi történik ma a projektjeivel.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Keresés a webhelyek között..."
              className="flex-1 p-3 border border-input rounded-md bg-transparent text-sm"
            />
            <Button onClick={() => setIsModalOpen(true)} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Új Projekt
            </Button>
          </div>
        </div>

        {projects.length === 0 ? (
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
            {projects.map((project: any) => (
              <div
                key={project._id}
                className="border border-border rounded-lg overflow-hidden flex flex-col hover:border-foreground/20 transition-colors"
              >
                {project.domain && project.deploymentId ? (
                  <WebsitePreviewCard
                    domain={project.domain}
                    isLive={!flaggedDeployments.has(project.deploymentId)}
                    deploymentId={project.deploymentId}
                    projectId={project._id}
                    onDelete={(deploymentId) => handleDeleteDeployment(deploymentId, project._id)}
                  />
                ) : (
                  <div className="w-full aspect-video bg-gray-100 rounded-t-lg flex items-center justify-center border-b border-border">
                    <p className="text-xs text-muted-foreground">No preview</p>
                  </div>
                )}

                <div className="p-4 md:p-6 flex flex-col justify-between flex-1">
                  <div>
                    <h3 className="font-semibold text-base md:text-lg mb-2">{project.businessName}</h3>
                    {flaggedDeployments.has(project.deploymentId) ? (
                      <DeploymentWarningCard
                        subdomain={project.subdomain}
                        reason="curse_words"
                        deploymentId={project.deploymentId}
                        projectId={project._id}
                        onDelete={(deploymentId) => {
                          setFlaggedDeployments((prev) => {
                            const next = new Set(prev)
                            next.delete(deploymentId)
                            return next
                          })
                          handleDeleteDeployment(deploymentId, project._id)
                        }}
                      />
                    ) : project.domain ? (
                      <div className="space-y-2">
                        <DeploymentStatusCard
                          domain={project.domain}
                          subdomain={project.subdomain}
                          deploymentId={project.deploymentId}
                          projectId={project._id}
                          onDelete={(deploymentId) => handleDeleteDeployment(deploymentId, project._id)}
                          isDeleting={deletingDeployments.has(project.deploymentId)}
                        />
                      </div>
                    ) : (
                      <p className="text-xs md:text-sm text-muted-foreground italic">Nincs még üzemeltetve</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Létrehozva: {new Date(project.createdAt).toLocaleDateString("hu-HU")}
                    </p>
                  </div>
                  <div className="flex justify-end gap-2 mt-4">
                    <Link href={`/dashboard/sites/${project._id}`}>
                      <Button variant="ghost" size="icon">
                        <Settings className="h-5 w-5" />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteProject(project._id)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete entire website"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        <line x1="10" y1="11" x2="10" y2="17"></line>
                        <line x1="14" y1="11" x2="14" y2="17"></line>
                      </svg>
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ProjectForm
          onSubmit={async (data) => {
            try {
              // 1. Create the project in the database
              const projectResponse = await fetch("/api/projects", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
              })

              if (projectResponse.ok) {
                const newProject = await projectResponse.json()
                setProjects([...projects, newProject])

                // Use subdomain from form instead of auto-generating
                const subdomain = data.subdomain

                // 2. Deploy to subdomain
                const deployResponse = await fetch("/api/deployments", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    subdomain,
                    projectId: newProject._id,
                  }),
                })

                if (deployResponse.ok) {
                  const deploymentResult = await deployResponse.json()
                  console.log("[v0] Deployment successful:", deploymentResult)

                  setProjects((prevProjects) =>
                    prevProjects.map((p) =>
                      p._id === newProject._id
                        ? {
                            ...p,
                            domain: deploymentResult.deployment.domain,
                            subdomain: deploymentResult.deployment.subdomain,
                            deploymentId: deploymentResult.deployment._id,
                          }
                        : p,
                    ),
                  )
                } else {
                  const errorText = await deployResponse.text()
                  console.error("[v0] Deployment failed:", errorText)
                  // User can retry deployment from project settings
                }

                setIsModalOpen(false)
              }
            } catch (error) {
              console.error("[v0] Error creating project:", error)
            }
          }}
        />
      </Modal>
    </div>
  )
}
