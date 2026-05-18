"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, Plus, LogOut, User, TriangleAlert, Search, LayoutTemplate, CreditCard } from "lucide-react"
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
import { WebsitePreviewCard } from "@/components/website-preview-card"
import { Skeleton } from "@/components/ui/skeleton"
import { CollabInvitePopup, type CollabInvite } from "@/components/collab-invite-popup"

// Maximum number of projects a user can have on the free plan.
const MAX_FREE_PROJECTS = 3

function getValidProjectUrl(project: any): string | null {
  const candidate = project?.cloudflareUrl || project?.deploymentRuntime?.url || project?.domain || project?.deployment?.domain
  if (!candidate || typeof candidate !== "string") return null

  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`
  try {
    const url = new URL(withProtocol)
    if (!url.hostname.includes(".")) return null
    if (url.hostname === "example.com") return null
    return url.toString()
  } catch {
    return null
  }
}

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [deletingDeployments, setDeletingDeployments] = useState<Set<string>>(new Set())
  const [flaggedDeployments, setFlaggedDeployments] = useState<Set<string>>(new Set())
  const [debugError, setDebugError] = useState<string | null>(null)
  const [userStatus, setUserStatus] = useState<{ isBlocked: boolean; subscription: string; isPremium: boolean }>({ isBlocked: false, subscription: "Free", isPremium: false })
  const [pendingInvites, setPendingInvites] = useState<CollabInvite[]>([])

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
        const newUrl = new URL(window.location.href)
        newUrl.searchParams.delete("open_create_modal")
        window.history.replaceState({}, "", newUrl.toString())
        router.push("/dashboard/create")
    }
  }, [searchParams, router])

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
    async function checkUserStatus() {
      try {
        const response = await fetch("/api/user/status")
        if (response.ok) {
          const data = await response.json()
          setUserStatus(data)
        }
      } catch (error) {
        console.error("Error checking user status:", error)
      }
    }

    if (status === "authenticated") {
      checkUserStatus()
    }
  }, [status])

  useEffect(() => {
    async function fetchInvites() {
      try {
        const res = await fetch("/api/collab/invites")
        if (res.ok) {
          const data: CollabInvite[] = await res.json()
          setPendingInvites(data)
        }
      } catch (error) {
        console.error("Error fetching collaboration invites:", error)
      }
    }

    if (status === "authenticated") {
      fetchInvites()
      // Poll every 20 seconds for new invites
      const interval = setInterval(fetchInvites, 20000)
      return () => clearInterval(interval)
    }
  }, [status])

  if (status === "loading") {
    return (
       <div className="min-h-screen bg-background md:ml-16 p-6">
         <div className="container mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-10 w-32" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6">
               {[1, 2, 3].map((i) => (
                   <Skeleton key={i} className="h-[300px] w-full rounded-xl" />
               ))}
            </div>
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

  const handleDeleteProject = async (projectId: string) => {
    // The actual API call is handled inside WebsitePreviewCard for now,
    // or we can move it here.
    // Given the component structure, WebsitePreviewCard handles the fetch,
    // and calls this callback on success.
    // So we just need to update the local state.

    setProjects((prevProjects: any) =>
      prevProjects.filter((p: any) => p._id !== projectId)
    )
  }

  // Blocked user screen
  if (userStatus.isBlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <TriangleAlert className="h-10 w-10 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground mb-2">Account Unavailable</h1>
            <p className="text-muted-foreground">
              Sycord is currently not available for you. Please contact support for assistance.
            </p>
          </div>
          <div className="pt-4 space-y-3">
            <a href="mailto:admin@sycord.com" className="inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors">
              Contact Support
            </a>
            <div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background md:ml-16">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4 md:gap-8">
              <Link href="/" className="flex items-center gap-2">
                <Image src="/logo.png" alt="Logo" width={32} height={32} />
                <span className="text-xl font-semibold text-foreground">
                  {userStatus.isPremium
                    ? userStatus.subscription === "Sycord Enterprise"
                      ? "Sycord Enterprise"
                      : "Sycord+"
                    : "Sycord"}
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
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
                  <DropdownMenuItem onClick={() => router.push("/subscriptions")}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Plans</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Beállítások</span>
                  </DropdownMenuItem>
                  {session?.user?.email === "dmarton336@gmail.com" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => router.push("/admin")}>
                        <Settings className="mr-2 h-4 w-4" />
                        <span className="text-primary font-semibold">Admin Panel</span>
                      </DropdownMenuItem>
                    </>
                  )}
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

        <main className="container mx-auto px-4 py-6 md:py-8 pb-20 md:pb-6">
          <div className="flex flex-col gap-4 mb-6 md:mb-8">
            <div className="flex items-center justify-between">
              <h1 className="text-lg font-semibold text-foreground">Projektek</h1>
              <Button onClick={() => router.push("/dashboard/create")} className="w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Új Projekt
              </Button>
            </div>
            <div className="flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Keresés a webhelyek között..."
                  className="w-full pl-10 pr-4 py-3 border border-input rounded-xl bg-background/50 backdrop-blur-sm text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="px-4 py-3 border border-input rounded-xl bg-muted/50 backdrop-blur-sm text-sm font-medium whitespace-nowrap">
                {projects.length}/{MAX_FREE_PROJECTS}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-border rounded-lg overflow-hidden flex flex-col h-[300px]">
                   <Skeleton className="h-full w-full" />
                </div>
              ))}
            </div>
          ) : projects.length === 0 ? (
            <div className="border border-dashed border-border rounded-lg p-12 text-center">
              <div className="max-w-md mx-auto">
                <h3 className="text-lg font-semibold text-foreground mb-2">Még nincsenek projektek</h3>
                <p className="text-sm text-muted-foreground mb-6">
                  Kezdje el első projektjét, és indítsa el weboldalát {"{"}name{"}"}.pages.dev címen
                </p>
                <Button onClick={() => router.push("/dashboard/create")}>
                  <Plus className="h-4 w-4 mr-2" />
                  Első Projekt Létrehozása
                </Button>
              </div>
            </div>
          ) : (() => {
            const q = searchQuery.trim().toLowerCase()
            const filtered = q
              ? projects.filter((p: any) => {
                  const name = (p.businessName || "").toLowerCase()
                  const domain = (p.cloudflareUrl || p.domain || "").toLowerCase()
                  return name.includes(q) || domain.includes(q)
                })
              : projects
            const canCreateMore = projects.length < MAX_FREE_PROJECTS

            if (q && filtered.length === 0) {
              return (
                <div className="border border-dashed border-border rounded-lg p-12 text-center">
                  <div className="max-w-md mx-auto">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                      <Search className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <h3 className="text-base font-semibold text-foreground mb-1">Nincs találat</h3>
                    <p className="text-sm text-muted-foreground">
                      Nincs &quot;{searchQuery}&quot; nevű projekt.
                    </p>
                  </div>
                </div>
              )
            }

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
                {/* Inline "Create new" tile — only when under quota and not actively searching */}
                {canCreateMore && !q && (
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/create")}
                    className="group relative h-64 sm:h-80 md:h-96 border border-dashed border-border/60 hover:border-primary/50 rounded-xl flex flex-col items-center justify-center p-6 text-center bg-card/10 hover:bg-card/30 transition-all duration-300"
                    aria-label="Új projekt létrehozása"
                  >
                    <div className="h-14 w-14 rounded-full bg-background/70 border border-border/50 flex items-center justify-center mb-4 group-hover:border-primary/40 group-hover:bg-primary/10 transition-all">
                      <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">Új Projekt</h3>
                    <p className="text-xs text-muted-foreground max-w-[240px]">
                      Hozzon létre egy új webhelyet pár kattintással
                    </p>
                    <span className="mt-3 text-[11px] text-muted-foreground/70 tabular-nums">
                      {projects.length}/{MAX_FREE_PROJECTS} használatban
                    </span>
                  </button>
                )}

                {filtered.map((project: any) => {
                  const liveUrl = getValidProjectUrl(project)
                  const fallbackHtml = project.pages?.find((p: any) => p.name === 'index.html')?.content
                  const deploymentKey = String(project.deploymentId || project.githubRepoId || project._id)
                  const shouldShowPreview = Boolean(liveUrl || fallbackHtml)

                  return (
                    <div
                      key={project._id}
                      className="group relative border border-border/50 bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden flex flex-col hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                    >
                      {shouldShowPreview ? (
                        <WebsitePreviewCard
                          domain={liveUrl || project.cloudflareUrl || project.domain || "example.com"}
                          isLive={Boolean(liveUrl) && !flaggedDeployments.has(deploymentKey)}
                          deploymentId={deploymentKey}
                          projectId={project._id}
                          businessName={project.businessName}
                          createdAt={project.createdAt}
                          style={project.style || "default"}
                          fallbackHtml={fallbackHtml}
                          onDelete={() => handleDeleteProject(project._id)}
                        />
                      ) : (
                        <div className="w-full h-64 sm:h-80 md:h-96 bg-gradient-to-br from-muted/50 to-muted/10 flex flex-col items-center justify-center p-6 text-center group-hover:bg-muted/30 transition-colors">
                          <div className="h-16 w-16 rounded-full bg-background/50 flex items-center justify-center mb-4 shadow-sm border border-border/50">
                            <LayoutTemplate className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <h3 className="font-medium text-foreground mb-1">{project.businessName}</h3>
                          <p className="text-xs text-muted-foreground mb-4">Még nincs publikálva</p>
                          <Button variant="outline" size="sm" onClick={() => router.push(`/dashboard/sites/${project._id}`)}>
                            Szerkesztés
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
        </main>
      </div>

      {/* Collaboration Invite Popup — show one at a time */}
      {pendingInvites.length > 0 && (
        <CollabInvitePopup
          invite={pendingInvites[0]}
          onDismiss={() => setPendingInvites((prev) => prev.slice(1))}
        />
      )}

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
