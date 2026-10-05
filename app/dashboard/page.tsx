"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings, Plus, LogOut, User, TriangleAlert, Search, LayoutTemplate, CreditCard, Trash2, Folder, Shield, Megaphone, Monitor, FileSpreadsheet } from "lucide-react"
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
import { DashboardArtifactCard, type DashboardArtifact } from "@/components/dashboard-artifact-card"
import { AiComposer } from "@/components/ai-composer"
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
  const [selectedArtifact, setSelectedArtifact] = useState<DashboardArtifact | null>(null)
  const [isExecutingAi, setIsExecutingAi] = useState(false)

  // Map user projects to unified workspace artifacts
  const projectArtifacts: DashboardArtifact[] = projects.map((p: any) => {
    const liveUrl = getValidProjectUrl(p)
    const domain = liveUrl
      ? liveUrl.replace(/^https?:\/\//, "")
      : p.domain || `${(p.businessName || "project").toLowerCase().replace(/\s+/g, "-")}.sycord.site`
    const dateStr = p.createdAt
      ? new Date(p.createdAt).toISOString().slice(0, 10).replace(/-/g, ".")
      : "2026.9.92"
    return {
      id: p._id,
      name: domain,
      type: "website" as const,
      meta: dateStr,
      url: liveUrl || (p.cloudflareUrl ? `https://${p.cloudflareUrl}` : undefined),
      profileImage: p.profileImage,
      rawProject: p,
    }
  })

  // Connected files / sample artifacts (from reference design)
  const sampleArtifacts: DashboardArtifact[] = [
    {
      id: "sample-xls",
      name: "Testfile.xsl",
      type: "spreadsheet",
      meta: "2026.9.92",
    },
  ]

  const allArtifacts: DashboardArtifact[] =
    projectArtifacts.length > 0
      ? [...projectArtifacts, ...(projectArtifacts.length < 3 ? sampleArtifacts : [])]
      : [
          {
            id: "default-site",
            name: "test.sycord.site",
            type: "website",
            meta: "2026.9.92",
            url: "https://sycord.site",
          },
          ...sampleArtifacts,
        ]

  const [artifactFilter, setArtifactFilter] = useState<"all" | "website" | "spreadsheet">("all")

  const q = searchQuery.trim().toLowerCase()
  const filteredArtifacts = allArtifacts.filter((a) => {
    const matchesQuery =
      !q ||
      a.name.toLowerCase().includes(q) ||
      (a.meta && a.meta.toLowerCase().includes(q))
    const matchesFilter =
      artifactFilter === "all" || a.type === artifactFilter
    return matchesQuery && matchesFilter
  })

  const handleAiSubmit = async (
    promptText: string,
    artifact: DashboardArtifact | null,
    modelId: string
  ) => {
    if (artifact && artifact.type === "website" && artifact.rawProject?._id) {
      router.push(
        `/dashboard/sites/${artifact.rawProject._id}/syra?prompt=${encodeURIComponent(
          promptText
        )}&model=${encodeURIComponent(modelId)}`
      )
      return
    }

    setIsExecutingAi(true)
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: promptText.slice(0, 30).trim() || "New AI Workspace",
          businessDescription: promptText,
          websiteType: "service",
          status: "pending",
        }),
      })
      if (res.ok) {
        const data = await res.json()
        const newId = data.projectId || data._id || data.id
        if (newId) {
          router.push(
            `/dashboard/sites/${newId}/syra?prompt=${encodeURIComponent(
              promptText
            )}&model=${encodeURIComponent(modelId)}`
          )
          return
        }
      }
    } catch (err) {
      console.error(err)
    } finally {
      setIsExecutingAi(false)
    }
    setActiveMode("astro")
  }
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
        {/* Minimal Header */}
        <header className="sticky top-0 bg-background/90 backdrop-blur-md z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center focus:outline-none opacity-90 hover:opacity-100 transition-opacity">
              <Image
                src="/brand-logo.png"
                alt="Sycord"
                width={26}
                height={26}
                priority
                className="object-contain shrink-0"
              />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="User account menu"
                  className="relative size-7.5 rounded-full bg-[#a855f7] flex items-center justify-center text-white font-semibold text-xs transition-transform active:scale-[0.95] outline-none cursor-pointer shadow-sm hover:brightness-105 overflow-hidden"
                >
                  {session?.user?.image ? (
                    <img
                      src={session.user.image}
                      alt={session.user.name || "User"}
                      className="size-full object-cover"
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

        <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-3 sm:pt-4 pb-8 flex-1 flex flex-col justify-between min-h-[calc(100vh-56px)]">
          <div className="space-y-4">
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

            {/* Filter Pills matching exact uploaded image */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setArtifactFilter("all")}
                className={cn(
                  "h-8 px-4 rounded-[14px] text-xs font-medium transition-all select-none cursor-pointer",
                  artifactFilter === "all"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#181818] border border-[#2a2a2a] text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#202020]"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setArtifactFilter("website")}
                className={cn(
                  "h-8 px-3 rounded-[14px] text-xs font-medium transition-all inline-flex items-center gap-1.5 select-none cursor-pointer",
                  artifactFilter === "website"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#181818] border border-[#2a2a2a] text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#202020]"
                )}
              >
                <Monitor className="size-3.5" strokeWidth={1.75} />
                <span>Websites</span>
              </button>
              <button
                type="button"
                onClick={() => setArtifactFilter("spreadsheet")}
                className={cn(
                  "h-8 px-3 rounded-[14px] text-xs font-medium transition-all inline-flex items-center gap-1.5 select-none cursor-pointer",
                  artifactFilter === "spreadsheet"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#181818] border border-[#2a2a2a] text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#202020]"
                )}
              >
                <FileSpreadsheet className="size-3.5" strokeWidth={1.75} />
                <span>Files</span>
              </button>
            </div>

            {/* Artifacts grid / rail matching minimal folder card + dashed + card */}
            <div className="pt-1">
              {isLoading ? (
                <div className="flex items-center gap-3 overflow-hidden py-1">
                  {[1, 2].map((i) => (
                    <div key={i} className="w-[116px] sm:w-[124px] h-[78px] sm:h-[82px] rounded-[18px] sm:rounded-[20px] border border-[#252525] bg-[#181818] animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 overflow-x-auto no-scrollbar pb-2 pt-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap scroll-smooth">
                  {filteredArtifacts.map((artifact) => (
                    <DashboardArtifactCard
                      key={artifact.id}
                      artifact={artifact}
                      isSelected={selectedArtifact?.id === artifact.id}
                      onSelect={(art) => {
                        setSelectedArtifact((prev) => (prev?.id === art.id ? null : art))
                      }}
                      onOpen={(art) => {
                        if (art.type === "website" && art.rawProject?._id) {
                          router.push(`/dashboard/sites/${art.rawProject._id}`)
                        } else if (art.url) {
                          window.open(art.url, "_blank", "noopener,noreferrer")
                        }
                      }}
                    />
                  ))}

                  {/* Minimalist Dashed "+ New" Card from Screenshot */}
                  <button
                    type="button"
                    onClick={() => router.push("/dashboard/create")}
                    title="Create new project or artifact"
                    aria-label="Create new project or artifact"
                    className="flex items-center justify-center w-[116px] sm:w-[124px] h-[78px] sm:h-[82px] rounded-[18px] sm:rounded-[20px] border border-dashed border-[#2f2f2f] hover:border-[#404040] bg-[#141414]/50 hover:bg-[#181818] transition-all cursor-pointer select-none group shrink-0 active:scale-[0.98]"
                  >
                    <div className="size-7 rounded-full bg-[#1e1e1e] group-hover:bg-[#252525] flex items-center justify-center transition-colors">
                      <Plus className="size-3.5 text-[#9e9e9e] group-hover:text-white transition-colors" strokeWidth={2.5} />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* If in Astro mode, show full Astro Dashboard tools */}
            {activeMode === "astro" && (
              <div className="rounded-[22px] border border-border bg-surface/40 p-4 sm:p-5 mt-4">
                <div className="flex items-center justify-between pb-3 mb-2 border-b border-border">
                  <span className="text-xs font-medium text-text-muted">Astro AI Workspace Active</span>
                  <button
                    type="button"
                    onClick={() => setActiveMode("projects")}
                    className="text-xs text-indigo-400 hover:text-indigo-300"
                  >
                    ← Back to Artifacts View
                  </button>
                </div>
                <AstroDashboard />
              </div>
            )}
          </div>

          {/* AI Input / Chat Composer (Bottom positioned, matching uploaded layout) */}
          <div className="pt-6 pb-2">
            <AiComposer
              selectedArtifact={selectedArtifact}
              onClearArtifact={() => setSelectedArtifact(null)}
            />
          </div>
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
