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

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState([])
  const [invites, setInvites] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [deletingDeployments, setDeletingDeployments] = useState<Set<string>>(new Set())
  const [flaggedDeployments, setFlaggedDeployments] = useState<Set<string>>(new Set())
  const [debugError, setDebugError] = useState<string | null>(null)
  const [userStatus, setUserStatus] = useState<{ isBlocked: boolean; subscription: string; isPremium: boolean }>({ isBlocked: false, subscription: "Free", isPremium: false })

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
    async function fetchData() {
      try {
        const [projectsRes, invitesRes] = await Promise.all([
          fetch("/api/projects"),
          fetch("/api/user/invites")
        ]);

        if (projectsRes.ok) {
          const data = await projectsRes.json()
          setProjects(data)
        }

        if (invitesRes.ok) {
          const invitesData = await invitesRes.json()
          console.log("[Dashboard] Pending invites:", invitesData)
          setInvites(invitesData)
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setIsLoading(false)
      }
    }

    if (status === "authenticated") {
      fetchData()
    }
  }, [status])

  const handleInviteAction = async (projectId: string, action: "accept" | "deny") => {
    try {
      const res = await fetch("/api/user/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action })
      });
      if (res.ok) {
        setInvites(invites.filter((inv: any) => inv.projectId !== projectId));
        if (action === "accept") {
          // Refresh projects list if accepted
          const projectsRes = await fetch("/api/projects");
          if (projectsRes.ok) {
            setProjects(await projectsRes.json());
          }
        }
      }
    } catch (e) {
      console.error("Error responding to invite", e);
    }
  };

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
                  placeholder="Keresés a webhelyek között..."
                  className="w-full pl-10 pr-4 py-3 border border-input rounded-xl bg-background/50 backdrop-blur-sm text-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none"
                />
              </div>
              <div className="px-4 py-3 border border-input rounded-xl bg-muted/50 backdrop-blur-sm text-sm font-medium whitespace-nowrap">
                {projects.length}/3
              </div>
            </div>
          </div>

          {invites.length > 0 && (
            <div className="mb-8">
              <h2 className="text-md font-semibold text-foreground mb-4">Pending Invites</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {invites.map((invite: any) => (
                  <div key={invite.projectId} className="border border-border/50 bg-card/30 backdrop-blur-sm rounded-xl p-5 flex flex-col gap-3">
                    <div>
                      <h3 className="font-semibold text-foreground">{invite.businessName}</h3>
                      <p className="text-xs text-muted-foreground">Invited by {invite.ownerName}</p>
                    </div>
                    <div className="flex gap-2 mt-auto pt-2">
                      <Button onClick={() => handleInviteAction(invite.projectId, "accept")} className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90" size="sm">Accept</Button>
                      <Button onClick={() => handleInviteAction(invite.projectId, "deny")} variant="outline" className="flex-1" size="sm">Decline</Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

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
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {projects.map((project: any) => {
                const hasActualCode = project.pages && project.pages.some((p: any) => p.name === 'index.html' && !p.content.includes("Website in Progress"));

                return (
                <div
                  key={project._id}
                  className="group relative border border-border/50 bg-card/30 backdrop-blur-sm rounded-xl overflow-hidden flex flex-col hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
                >
                  {((project.domain && project.deploymentId) || hasActualCode) ? (
                    <WebsitePreviewCard
                      domain={project.cloudflareUrl || project.domain || "example.com"}
                      isLive={!!project.deploymentId && !flaggedDeployments.has(project.deploymentId)}
                      deploymentId={project.deploymentId}
                      projectId={project._id}
                      businessName={project.businessName}
                      createdAt={project.createdAt}
                      style={project.style || "default"}
                      fallbackHtml={project.pages?.find((p: any) => p.name === 'index.html')?.content}
                      onDelete={() => handleDeleteProject(project._id)}
                      isShared={project.isShared}
                      ownerName={project.ownerName}
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
              )})}
            </div>
          )}
        </main>
      </div>

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
