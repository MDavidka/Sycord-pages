"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, Plus, LogOut, User, TriangleAlert, Search, LayoutTemplate, CreditCard, Trash2, Folder } from "lucide-react"
import { useState, useEffect, Suspense, useCallback } from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { WebsitePreviewCard } from "@/components/website-preview-card"
import { ProjectDashboardCard } from "@/components/project-dashboard-card"
import { DashboardModeToggle, type DashboardMode } from "@/components/dashboard-mode-toggle"
import { AstroDashboard } from "@/components/astro-dashboard"
import { Skeleton } from "@/components/ui/skeleton"
import { CollabInvitePopup, type CollabInvite } from "@/components/collab-invite-popup"

const MAX_FREE_PROJECTS = 3

function getValidProjectUrl(project: any): string | null {
  const candidate = project?.cloudflareUrl || project?.deploymentRuntime?.url || project?.domain || project?.deployment?.domain
  if (!candidate || typeof candidate !== "string") return null
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`
  try {
    const url = new URL(withProtocol)
    if (!url.hostname.includes(".") || url.hostname === "example.com") return null
    return url.toString()
  } catch { return null }
}

function CardSkeleton() {
  return (
    <div className="rounded-[18px] sm:rounded-[20px] p-5 flex flex-col justify-between min-h-[148px] bg-[#18181b]/80 border border-[#27272a]">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3.5 flex-1 min-w-0">
          <Skeleton className="h-12 w-12 rounded-[14px] shrink-0 bg-zinc-800" />
          <div className="space-y-2 flex-1 min-w-0">
            <Skeleton className="h-4 w-28 bg-zinc-800" />
            <Skeleton className="h-3 w-20 bg-zinc-800" />
          </div>
        </div>
        <Skeleton className="h-8 w-8 rounded-lg shrink-0 bg-zinc-800" />
      </div>
      <div className="pt-3.5 border-t border-[#27272a]/70 flex items-center justify-between">
        <Skeleton className="h-3 w-24 bg-zinc-800" />
        <Skeleton className="h-3 w-16 bg-zinc-800" />
      </div>
    </div>
  )
}

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [flaggedDeployments] = useState<Set<string>>(new Set())
  const [debugError, setDebugError] = useState<string | null>(null)
  const [userStatus, setUserStatus] = useState<{ isBlocked: boolean; subscription: string; isPremium: boolean }>({ isBlocked: false, subscription: "Free", isPremium: false })
  const [pendingInvites, setPendingInvites] = useState<CollabInvite[]>([])
  const [activeMode, setActiveMode] = useState<DashboardMode>("projects")
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const q = searchQuery.trim().toLowerCase()
  const filtered: any[] = q
    ? projects.filter((p: any) => (p.businessName || "").toLowerCase().includes(q) || (p.cloudflareUrl || p.domain || "").toLowerCase().includes(q))
    : projects
  const canCreateMore = userStatus.isPremium || projects.filter((p: any) => !p?.isCollaborator).length < MAX_FREE_PROJECTS
  const ownedCount = projects.filter((p: any) => !p?.isCollaborator).length

  useEffect(() => {
    const openCreate = searchParams.get("open_create_modal")
    const error = searchParams.get("error")
    const mode = searchParams.get("mode")
    if (mode === "astro" || mode === "projects") {
      setActiveMode(mode)
    }
    if (error) {
      setDebugError(error)
      const u = new URL(window.location.href); u.searchParams.delete("error"); window.history.replaceState({}, "", u.toString())
    }
    if (openCreate === "true") {
      const u = new URL(window.location.href); u.searchParams.delete("open_create_modal"); window.history.replaceState({}, "", u.toString())
      router.push("/dashboard/create")
    }
  }, [searchParams, router])

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/projects", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch("/api/user/status", { cache: "no-store" }).then(r => r.ok ? r.json() : null),
    ]).then(([projectsData, statusData]) => {
      setProjects(projectsData)
      if (statusData) setUserStatus(statusData)
    }).catch(console.error).finally(() => setIsLoading(false))
  }, [status])

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch("/api/collab/invites")
      if (res.ok) setPendingInvites(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    if (status !== "authenticated") return
    fetchInvites()
    const id = setInterval(fetchInvites, 20000)
    return () => clearInterval(id)
  }, [status, fetchInvites])

  const handleDeleteProject = async () => {
    if (!projectToDelete) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/projects/${projectToDelete.id}`, { method: "DELETE" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message || "Failed") }
      setProjects((prev: any) => prev.filter((p: any) => p._id !== projectToDelete.id))
      const project: any = projects.find((p: any) => p._id === projectToDelete.id)
      if (project?.dokployApplicationId || project?.applicationId) {
        fetch("/api/deploy/coolify", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ applicationId: project.dokployApplicationId || project.applicationId, projectId: project.dokployProjectId || project.projectId }) }).catch(console.error)
      }
      setProjectToDelete(null)
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project")
    } finally {
      setIsDeleting(false)
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen md:ml-16 px-4 pt-6 pb-20 md:pb-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <CardSkeleton key={i} />)}
          </div>
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") { router.push("/login"); return null }

  const userInitials = session?.user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"

  if (userStatus.isBlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <TriangleAlert className="h-10 w-10 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2">Account Unavailable</h1>
            <p className="text-muted-foreground">Sycord is currently not available. Please contact support.</p>
          </div>
          <div className="pt-4 space-y-3">
            <a href="mailto:admin@sycord.com" className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors">Contact Support</a>
            <div><button onClick={() => signOut({ callbackUrl: "/" })} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign Out</button></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="min-h-screen bg-background md:ml-16">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={28} height={28} priority />
              <span className="text-base font-semibold text-foreground">
                {userStatus.isPremium ? (userStatus.subscription === "Sycord Enterprise" ? "Sycord Enterprise" : "Sycord+") : "Sycord"}
              </span>
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm">{userInitials}</AvatarFallback>
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
                <DropdownMenuItem><User className="mr-2 h-4 w-4" /><span>Profile</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/subscriptions")}><CreditCard className="mr-2 h-4 w-4" /><span>Plans</span></DropdownMenuItem>
                <DropdownMenuItem><Settings className="mr-2 h-4 w-4" /><span>Settings</span></DropdownMenuItem>
                {session?.user?.email === "dmarton336@gmail.com" && (<><DropdownMenuSeparator /><DropdownMenuItem onClick={() => router.push("/admin")}><Settings className="mr-2 h-4 w-4" /><span className="text-primary font-semibold">Admin Panel</span></DropdownMenuItem></>)}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /><span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-5 pb-20 md:pb-6">
          <div className="flex items-center justify-between mb-5">
            <h1 className="text-base font-semibold text-foreground">Projects</h1>
            <Button
              onClick={() => router.push("/dashboard/create")}
              size="sm"
              className="h-10 px-4 rounded-xl gap-1.5 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>New Project</span>
            </Button>
          </div>

          {activeMode === "astro" ? (
            /* ASTRO MODE: Global Agentic AI Workspace */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="flex items-center">
                <DashboardModeToggle
                  activeMode={activeMode}
                  onChange={(mode) => {
                    setActiveMode(mode)
                    const u = new URL(window.location.href)
                    if (mode === "projects") {
                      u.searchParams.delete("mode")
                    } else {
                      u.searchParams.set("mode", mode)
                    }
                    window.history.replaceState({}, "", u.toString())
                  }}
                />
              </div>
              <AstroDashboard />
            </div>
          ) : (
            /* PROJECTS MODE: Projects List & Search */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* Search Bar & Counter */}
              <div className="flex gap-2.5 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#18181b]/70 border border-[#27272a] text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div className="px-3.5 py-2.5 border border-[#27272a] rounded-xl bg-[#18181b]/70 text-sm font-medium text-zinc-400 tabular-nums whitespace-nowrap shadow-xs">
                  {ownedCount}/{MAX_FREE_PROJECTS}
                </div>
              </div>

              {/* Segmented Projects / Astro Switch */}
              <div className="flex items-center">
                <DashboardModeToggle
                  activeMode={activeMode}
                  onChange={(mode) => {
                    setActiveMode(mode)
                    const u = new URL(window.location.href)
                    if (mode === "projects") {
                      u.searchParams.delete("mode")
                    } else {
                      u.searchParams.set("mode", mode)
                    }
                    window.history.replaceState({}, "", u.toString())
                  }}
                />
              </div>

              {isLoading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {[1, 2, 3].map((i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="border border-dashed border-[#27272a] rounded-[22px] p-12 text-center bg-[#18181b]/30">
                  <div className="max-w-sm mx-auto">
                    <h3 className="text-base font-semibold mb-2 text-zinc-100">No projects yet</h3>
                    <p className="text-sm text-muted-foreground mb-5">
                      Create your first project and get your site live in minutes.
                    </p>
                    <Button
                      onClick={() => router.push("/dashboard/create")}
                      className="rounded-xl gap-1.5"
                    >
                      <Plus className="h-4 w-4" />
                      Create First Project
                    </Button>
                  </div>
                </div>
              ) : q && filtered.length === 0 ? (
                <div className="border border-dashed border-[#27272a] rounded-[22px] p-12 text-center bg-[#18181b]/30">
                  <div className="max-w-sm mx-auto">
                    <Search className="h-5 w-5 text-muted-foreground mx-auto mb-3" />
                    <h3 className="text-base font-semibold mb-1 text-zinc-100">No results</h3>
                    <p className="text-sm text-muted-foreground">
                      No project matches &quot;{searchQuery}&quot;.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Modern New Project Card */}
                  {canCreateMore && !q && (
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/create")}
                      className="group relative flex flex-col items-center justify-center min-h-[148px] p-5 rounded-[18px] sm:rounded-[20px] border border-dashed border-[#27272a] hover:border-zinc-500 bg-[#18181b]/30 hover:bg-[#18181b]/70 transition-all duration-200 text-center cursor-pointer select-none"
                    >
                      <div className="h-12 w-12 rounded-[14px] bg-[#222226] border border-[#2f2f35] flex items-center justify-center mb-2.5 group-hover:border-zinc-400 group-hover:scale-105 transition-all shadow-inner">
                        <Plus className="h-5 w-5 text-zinc-400 group-hover:text-zinc-100 transition-colors" />
                      </div>
                      <h3 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                        New Project
                      </h3>
                      <p className="text-xs text-zinc-500 mt-0.5">
                        Create a new site in a few clicks
                      </p>
                      <span className="mt-2 text-[10px] text-zinc-500/70 font-mono">
                        {ownedCount}/{MAX_FREE_PROJECTS} used
                      </span>
                    </button>
                  )}

                  {filtered.map((project: any) => {
                    const liveUrl = getValidProjectUrl(project)
                    const fallbackHtml = project.pages?.find((p: any) => p.name === "index.html")?.content
                    const deploymentKey = String(project.deploymentId || project.githubRepoId || project._id)
                    const isLive = Boolean(liveUrl) && !flaggedDeployments.has(deploymentKey)
                    const projectDomain = liveUrl || project.cloudflareUrl || project.domain || (project.subdomain ? `${project.subdomain}.sycord.com` : "example.com")
                    return (
                      <ProjectDashboardCard
                        key={project._id}
                        domain={projectDomain}
                        isLive={isLive}
                        deploymentId={deploymentKey}
                        projectId={project._id}
                        businessName={project.businessName}
                        createdAt={project.createdAt}
                        chatSession={project.chatSession}
                        style={project.style || "default"}
                        framework={project.framework}
                        fallbackHtml={fallbackHtml}
                        githubOwner={project.githubOwner}
                        githubRepo={project.githubRepo}
                        githubBranch={project.githubBranch}
                        githubUrl={project.githubUrl}
                        githubSavedAt={project.githubSavedAt}
                        githubCommitMessage={project.githubCommitMessage}
                        profileImage={project.profileImage}
                        onDelete={() => setProjectToDelete({ id: project._id, name: project.businessName })}
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {pendingInvites.length > 0 && <CollabInvitePopup invite={pendingInvites[0]} onDismiss={() => setPendingInvites(prev => prev.slice(1))} />}

      <Dialog open={!!debugError} onOpenChange={open => !open && setDebugError(null)}>
        <DialogContent className="sm:max-w-md border-red-200 bg-red-50 dark:bg-red-950/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400"><TriangleAlert className="h-5 w-5" />Authentication Error</DialogTitle>
            <DialogDescription className="text-red-600/90 dark:text-red-400/90">An error occurred during authentication.</DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-white dark:bg-black/20 rounded-md border border-red-100 dark:border-red-900/50 font-mono text-sm break-all">{debugError}</div>
          <div className="flex justify-end"><Button variant="outline" onClick={() => setDebugError(null)} className="border-red-200 hover:bg-red-100">Close</Button></div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!projectToDelete} onOpenChange={open => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete &quot;{projectToDelete?.name}&quot; and all its data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); handleDeleteProject() }} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isDeleting ? "Deleting..." : "Delete Project"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen md:ml-16 px-4 pt-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-9 w-28 rounded-xl" />
          </div>
          <Skeleton className="h-11 w-full rounded-xl" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {[1,2,3].map(i=><CardSkeleton key={i}/>)}
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
