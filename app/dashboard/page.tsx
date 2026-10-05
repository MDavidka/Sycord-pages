"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Settings, Plus, LogOut, User, TriangleAlert, Search, LayoutTemplate, CreditCard, Trash2, Folder, Shield, Megaphone } from "lucide-react"
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
    <div className="rounded-[22px] border border-border/80 bg-surface/90 p-4 sm:p-5 flex items-center justify-between">
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <Skeleton className="size-11 rounded-[14px] shrink-0 bg-surface-raised" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-4 w-32 bg-surface-raised rounded-[6px]" />
          <Skeleton className="h-3 w-24 bg-surface-muted rounded-[4px]" />
        </div>
      </div>
      <Skeleton className="h-8 w-16 rounded-[12px] bg-surface-raised shrink-0 ml-3" />
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

  const [announcements, setAnnouncements] = useState<any[]>([])

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/projects", { cache: "no-store" }).then(r => r.ok ? r.json() : []),
      fetch("/api/user/status", { cache: "no-store" }).then(r => r.ok ? r.json() : null),
      fetch("/api/announcements", { cache: "no-store" }).then(r => r.ok ? r.json() : { announcements: [] }),
    ]).then(([projectsData, statusData, annData]) => {
      setProjects(projectsData)
      if (statusData) setUserStatus(statusData)
      if (annData?.announcements) setAnnouncements(annData.announcements)
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
            <Skeleton className="h-6 w-28 bg-zinc-800/80" />
            <Skeleton className="h-9 w-28 rounded-lg bg-zinc-800/80" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg bg-zinc-800/60" />
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
      <div className="min-h-screen bg-background md:ml-16 text-foreground">
        <header className="sticky top-0 bg-background/80 backdrop-blur-md z-50">
          <div className="max-w-[430px] sm:max-w-4xl mx-auto px-5 sm:px-6 py-4 flex items-center justify-between">
            <Link href="/" className="flex items-center">
              <Image
                src="/logo.png"
                alt="Sycord"
                width={32}
                height={32}
                priority
                className="rounded-[8px] object-contain shrink-0"
              />
            </Link>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="User account menu"
                  className="relative size-8 rounded-full bg-amber-900/40 border border-amber-700/50 flex items-center justify-center text-amber-200 font-medium text-xs transition-transform active:scale-[0.97] outline-none cursor-pointer"
                >
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="size-full rounded-full object-cover"
                    />
                  ) : (
                    userInitials
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-surface border border-border text-foreground rounded-[18px] p-1.5 shadow-2xl" align="end" forceMount>
                <DropdownMenuLabel className="font-normal px-2.5 py-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">{session?.user?.name}</p>
                    <p className="text-xs leading-none text-text-muted">{session?.user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="rounded-[10px] text-xs text-text-secondary hover:text-foreground hover:bg-surface-muted"><User className="mr-2 size-4" strokeWidth={1.75} /><span>Profile</span></DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/subscriptions")} className="rounded-[10px] text-xs text-text-secondary hover:text-foreground hover:bg-surface-muted"><CreditCard className="mr-2 size-4" strokeWidth={1.75} /><span>Plans</span></DropdownMenuItem>
                <DropdownMenuItem className="rounded-[10px] text-xs text-text-secondary hover:text-foreground hover:bg-surface-muted"><Settings className="mr-2 size-4" strokeWidth={1.75} /><span>Settings</span></DropdownMenuItem>
                {session?.user?.email === "dmarton336@gmail.com" && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem onClick={() => router.push("/admin")} className="rounded-[10px] text-xs">
                      <Shield className="mr-2 size-4 text-emerald-400" strokeWidth={1.75} />
                      <span className="text-emerald-400 font-medium">Moderator View</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="rounded-[10px] text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                  <LogOut className="mr-2 size-4" strokeWidth={1.75} /><span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="max-w-[430px] sm:max-w-4xl mx-auto px-5 sm:px-6 pt-4 pb-20 md:pb-12 space-y-5">
          {announcements.length > 0 && (
            <div className="space-y-2">
              {announcements.map((ann) => (
                <div
                  key={ann.id || ann._id}
                  className={cn(
                    "flex items-start gap-3 p-4 rounded-[18px] border text-xs leading-relaxed",
                    ann.type === "warning" || ann.type === "maintenance"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-200"
                      : ann.type === "important"
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-200"
                      : "bg-surface border-border text-text-secondary"
                  )}
                >
                  <Megaphone className="size-4 shrink-0 mt-0.5 text-text-secondary" strokeWidth={1.75} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-foreground">{ann.title}</p>
                    <p className="text-xs text-text-muted mt-0.5">{ann.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Welcome Banner — dark card with blue-indigo left accent */}
          <div className="relative overflow-hidden rounded-[20px] bg-[#1a1a2e]/60 border border-[#292940]/60 px-5 py-5">
            {/* Left accent stripe */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b from-indigo-500 to-indigo-700/60 rounded-l-[20px]" />
            <h2 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
              Welcome back {session?.user?.name?.split(" ")[0] || "there"}!
            </h2>
            {/* Latest project status line */}
            {!isLoading && projects.length > 0 && (() => {
              const latest: any = projects[0]
              const liveUrl = getValidProjectUrl(latest)
              const isLive = Boolean(liveUrl)
              return (
                <div className="flex items-center gap-2 mt-2">
                  {/* GitHub icon */}
                  <svg className="size-[18px] text-text-secondary shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
                  </svg>
                  <span className="text-sm text-text-secondary font-medium">{latest.businessName || "project"}</span>
                  <span className={cn("size-[8px] rounded-full shrink-0", isLive ? "bg-blue-500" : "bg-text-muted")} />
                  <span className="text-sm text-text-muted">{isLive ? "succesful" : "pending"}</span>
                </div>
              )
            })()}
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
            /* PROJECTS MODE */
            <div className="space-y-4 animate-in fade-in duration-200">
              {/* Search Bar + New Project Button — side by side */}
              <div className="flex items-center gap-3">
                <div className="relative flex items-center flex-1 h-11 bg-transparent border border-[#292929] focus-within:border-[#3a3a3a] rounded-[14px] px-3.5 transition-colors">
                  <Search className="size-[18px] text-text-muted shrink-0 mr-2.5" strokeWidth={2} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    className="w-full bg-transparent text-sm text-foreground placeholder:text-text-muted outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/create")}
                  aria-label="Create new project"
                  className="h-11 px-5 rounded-[14px] bg-[#2a2a2a] hover:bg-[#333] border border-[#3a3a3a] text-sm font-medium text-text-secondary hover:text-foreground transition-all active:scale-[0.97] cursor-pointer shrink-0"
                >
                  New
                </button>
              </div>

              {/* Compact floating pill toolbar */}
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

              {/* Projects Content Area — large rounded container */}
              <div className="rounded-[22px] border border-[#292929]/80 bg-transparent min-h-[340px] sm:min-h-[420px] p-4 sm:p-5">
                {isLoading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                      <CardSkeleton key={i} />
                    ))}
                  </div>
                ) : projects.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <div className="space-y-3">
                      <Folder className="size-8 text-text-muted mx-auto opacity-40" strokeWidth={1.5} />
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-foreground">No projects yet</h3>
                        <p className="text-xs text-text-muted">
                          Create your first project to get started.
                        </p>
                      </div>
                      <Button
                        type="button"
                        onClick={() => router.push("/dashboard/create")}
                        aria-label="Create new project"
                      >
                        <Plus className="size-4" strokeWidth={2} />
                        <span>New Project</span>
                      </Button>
                    </div>
                  </div>
                ) : q && filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-center">
                    <div className="space-y-2">
                      <Search className="size-5 text-text-muted mx-auto opacity-60" strokeWidth={1.75} />
                      <h3 className="text-sm font-medium text-foreground">No results</h3>
                      <p className="text-xs text-text-muted">
                        No project matches &quot;{searchQuery}&quot;.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Skeleton className="h-6 w-28 bg-zinc-800/80" />
            <Skeleton className="h-9 w-28 rounded-lg bg-zinc-800/80" />
          </div>
          <Skeleton className="h-10 w-full rounded-lg bg-zinc-800/60" />
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
