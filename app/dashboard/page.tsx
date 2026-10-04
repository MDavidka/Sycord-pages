"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import {
  Settings,
  Plus,
  LogOut,
  User,
  TriangleAlert,
  Search,
  CreditCard,
  Trash2,
  Folder,
  Shield,
  Megaphone,
  ChevronRight,
} from "lucide-react"
import { useState, useEffect, Suspense, useCallback } from "react"
import { motion, useReducedMotion } from "framer-motion"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ProjectDashboardCard } from "@/components/project-dashboard-card"
import {
  DashboardModeToggle,
  type DashboardMode,
} from "@/components/dashboard-mode-toggle"
import { AstroDashboard } from "@/components/astro-dashboard"
import { Skeleton } from "@/components/ui/skeleton"
import {
  CollabInvitePopup,
  type CollabInvite,
} from "@/components/collab-invite-popup"

const MAX_FREE_PROJECTS = 3

function getValidProjectUrl(project: any): string | null {
  const candidate =
    project?.cloudflareUrl ||
    project?.deploymentRuntime?.url ||
    project?.domain ||
    project?.deployment?.domain
  if (!candidate || typeof candidate !== "string") return null
  const withProtocol = /^https?:\/\//i.test(candidate)
    ? candidate
    : `https://${candidate}`
  try {
    const url = new URL(withProtocol)
    if (!url.hostname.includes(".") || url.hostname === "example.com") return null
    return url.toString()
  } catch {
    return null
  }
}

function CardSkeleton() {
  return (
    <div className="rounded-[14px] sm:rounded-2xl p-3.5 sm:p-4 flex flex-col justify-between bg-[#1A1A1A] border border-[#262626] min-h-[96px] sm:min-h-[118px]">
      <div className="flex items-center gap-3">
        <Skeleton className="size-11 sm:size-12 rounded-[10px] sm:rounded-lg shrink-0 bg-[#222222]" />
        <div className="space-y-2 flex-1 min-w-0">
          <Skeleton className="h-4 w-28 bg-[#222222] rounded-[6px]" />
          <Skeleton className="h-3 w-40 bg-[#2A2A2A] rounded-[4px]" />
        </div>
      </div>
      <div className="hidden sm:flex items-center justify-between border-t border-[#262626] pt-3 mt-3">
        <Skeleton className="h-3 w-16 bg-[#222222] rounded-[4px]" />
        <Skeleton className="h-3 w-14 bg-[#222222] rounded-[4px]" />
      </div>
    </div>
  )
}

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const shouldReduceMotion = useReducedMotion()

  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [flaggedDeployments] = useState<Set<string>>(new Set())
  const [debugError, setDebugError] = useState<string | null>(null)
  const [userStatus, setUserStatus] = useState<{
    isBlocked: boolean
    subscription: string
    isPremium: boolean
  }>({ isBlocked: false, subscription: "Free", isPremium: false })
  const [pendingInvites, setPendingInvites] = useState<CollabInvite[]>([])
  const [activeMode, setActiveMode] = useState<DashboardMode>("projects")
  const [projectToDelete, setProjectToDelete] = useState<{
    id: string
    name: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const q = searchQuery.trim().toLowerCase()
  const filtered: any[] = q
    ? projects.filter(
        (p: any) =>
          (p.businessName || "").toLowerCase().includes(q) ||
          (p.cloudflareUrl || p.domain || "").toLowerCase().includes(q)
      )
    : projects

  const ownedProjects = projects.filter((p: any) => !p?.isCollaborator)
  const ownedCount = ownedProjects.length
  const canCreateMore = userStatus.isPremium || ownedCount < MAX_FREE_PROJECTS

  useEffect(() => {
    const openCreate = searchParams.get("open_create_modal")
    const error = searchParams.get("error")
    const mode = searchParams.get("mode")
    if (mode === "astro" || mode === "projects") {
      setActiveMode(mode)
    }
    if (error) {
      setDebugError(error)
      const u = new URL(window.location.href)
      u.searchParams.delete("error")
      window.history.replaceState({}, "", u.toString())
    }
    if (openCreate === "true") {
      const u = new URL(window.location.href)
      u.searchParams.delete("open_create_modal")
      window.history.replaceState({}, "", u.toString())
      router.push("/dashboard/create")
    }
  }, [searchParams, router])

  const [announcements, setAnnouncements] = useState<any[]>([])

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/projects", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : []
      ),
      fetch("/api/user/status", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : null
      ),
      fetch("/api/announcements", { cache: "no-store" }).then((r) =>
        r.ok ? r.json() : { announcements: [] }
      ),
    ])
      .then(([projectsData, statusData, annData]) => {
        setProjects(projectsData)
        if (statusData) setUserStatus(statusData)
        if (annData?.announcements) setAnnouncements(annData.announcements)
      })
      .catch(console.error)
      .finally(() => setIsLoading(false))
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
      const res = await fetch(`/api/projects/${projectToDelete.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message || "Failed")
      }
      setProjects((prev: any) =>
        prev.filter((p: any) => p._id !== projectToDelete.id)
      )
      const project: any = projects.find(
        (p: any) => p._id === projectToDelete.id
      )
      if (project?.dokployApplicationId || project?.applicationId) {
        fetch("/api/deploy/coolify", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId:
              project.dokployApplicationId || project.applicationId,
            projectId: project.dokployProjectId || project.projectId,
          }),
        }).catch(console.error)
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
      <div className="w-full max-w-[430px] lg:max-w-6xl mx-auto min-h-screen px-4 pt-6 pb-12 lg:px-8 lg:py-10 space-y-4 lg:space-y-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-28 bg-[#1A1A1A]" />
          <Skeleton className="size-8 lg:size-9 rounded-full bg-[#1A1A1A]" />
        </div>
        <Skeleton className="h-11 lg:h-9 w-full bg-[#1A1A1A] rounded-[10px] lg:rounded-lg" />
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
          {[1, 2, 3].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    )
  }

  if (status === "unauthenticated") {
    router.push("/login")
    return null
  }

  if (userStatus.isBlocked) {
    return (
      <div className="min-h-screen bg-[#131313] flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="h-20 w-20 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <TriangleAlert className="h-10 w-10 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-2 text-[#F4F4F5]">
              Account Unavailable
            </h1>
            <p className="text-[#71717A]">
              Sycord is currently not available. Please contact support.
            </p>
          </div>
          <div className="pt-4 space-y-3">
            <a
              href="mailto:admin@sycord.com"
              className="inline-flex items-center justify-center rounded-lg bg-white text-[#131313] px-6 py-2.5 text-sm font-medium hover:bg-[#E4E4E7] transition-colors"
            >
              Contact Support
            </a>
            <div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm text-[#71717A] hover:text-[#F4F4F5] transition-colors"
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
      <div className="min-h-screen bg-[#131313] md:ml-16 text-[#F4F4F5]">
        {/* Sticky Header with Workspace Switcher & Breadcrumbs on Desktop */}
        <header className="border-b border-[#262626] sticky top-0 bg-[#131313]/90 backdrop-blur-md z-50">
          <div className="w-full max-w-[430px] lg:max-w-6xl mx-auto px-4 lg:px-8 py-3 flex items-center justify-between">
            {/* Left: Brand Bar + Breadcrumb */}
            <div className="flex items-center gap-3">
              <Link
                href="/"
                className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]"
              >
                <div className="size-6 lg:size-7 rounded-[6px] bg-[#1A1A1A] border border-[#262626] flex items-center justify-center overflow-hidden shrink-0">
                  <Image
                    src="/logo.png"
                    alt="Sycord"
                    width={24}
                    height={24}
                    priority
                    className="size-full object-contain"
                  />
                </div>
                <span className="text-sm lg:text-base font-semibold tracking-tight text-[#F4F4F5]">
                  Sycord
                </span>
              </Link>

              {/* Desktop Workspace & Breadcrumb */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-[#71717A] pl-3 border-l border-[#262626]">
                <span className="font-medium text-[#71717A] hover:text-[#F4F4F5] transition-colors cursor-pointer">
                  {userStatus.isPremium
                    ? userStatus.subscription === "Sycord Enterprise"
                      ? "Enterprise Workspace"
                      : "Sycord+ Workspace"
                    : "Personal Workspace"}
                </span>
                <ChevronRight className="size-3 text-[#71717A]" />
                <span className="text-[#F4F4F5] font-medium">Projects</span>
              </div>
            </div>

            {/* Right: User Avatar Trigger */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="User account menu"
                  className="group relative size-8 lg:size-9 rounded-full bg-[#2E1065] border border-[#4C1D95] flex items-center justify-center text-white font-mono text-xs font-semibold select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313] transition-transform active:scale-95"
                >
                  <span>D</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-[#1A1A1A] border border-[#262626] text-[#F4F4F5] rounded-lg p-1.5 shadow-2xl"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="font-normal px-2.5 py-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-[#F4F4F5]">
                      {session?.user?.name || "Developer"}
                    </p>
                    <p className="text-xs leading-none text-[#71717A]">
                      {session?.user?.email || "dmarton336@gmail.com"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[#262626]" />
                <DropdownMenuItem className="rounded-[6px] text-xs text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#222222] cursor-pointer">
                  <User className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/subscriptions")}
                  className="rounded-[6px] text-xs text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#222222] cursor-pointer"
                >
                  <CreditCard className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Plans &amp; Usage</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-[6px] text-xs text-[#71717A] hover:text-[#F4F4F5] hover:bg-[#222222] cursor-pointer">
                  <Settings className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Settings</span>
                </DropdownMenuItem>
                {session?.user?.email === "dmarton336@gmail.com" && (
                  <>
                    <DropdownMenuSeparator className="bg-[#262626]" />
                    <DropdownMenuItem
                      onClick={() => router.push("/admin")}
                      className="rounded-[6px] text-xs cursor-pointer"
                    >
                      <Shield
                        className="mr-2 size-4 text-emerald-400"
                        strokeWidth={1.75}
                      />
                      <span className="text-emerald-400 font-medium">
                        Moderator View
                      </span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-[#262626]" />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-[6px] text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Viewport Container */}
        <main className="w-full max-w-[430px] lg:max-w-6xl mx-auto px-4 pt-6 pb-12 lg:px-8 lg:py-10 space-y-4 lg:space-y-8">
          {announcements.length > 0 && (
            <div className="space-y-2">
              {announcements.map((ann) => (
                <div
                  key={ann.id || ann._id}
                  className={cn(
                    "flex items-start gap-3 p-3.5 lg:p-4 rounded-lg border text-xs leading-relaxed",
                    ann.type === "warning" || ann.type === "maintenance"
                      ? "bg-amber-500/10 border-amber-500/20 text-amber-200"
                      : ann.type === "important"
                      ? "bg-rose-500/10 border-rose-500/20 text-rose-200"
                      : "bg-[#1A1A1A] border-[#262626] text-[#71717A]"
                  )}
                >
                  <Megaphone
                    className="size-4 shrink-0 mt-0.5 text-[#71717A]"
                    strokeWidth={1.75}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-xs text-[#F4F4F5]">{ann.title}</p>
                    <p className="text-xs text-[#71717A] mt-0.5">{ann.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Section Header: Mobile stacks / splits; Desktop combines into unified toolbar */}
          <div className="flex flex-col gap-3 lg:gap-0 lg:mb-7">
            {/* Top row: Title + "+ New Project" button */}
            <div className="flex items-center justify-between">
              <h1 className="text-xl lg:text-2xl font-semibold tracking-tight text-[#F4F4F5]">
                Projects
              </h1>

              {/* Accent Primary Button ("+ New Project") */}
              <motion.button
                type="button"
                whileHover={
                  shouldReduceMotion
                    ? undefined
                    : { scale: 1.02, transition: { type: "spring", visualDuration: 0.22, bounce: 0.1 } }
                }
                whileTap={
                  shouldReduceMotion
                    ? undefined
                    : { scale: 0.97, transition: { type: "spring", visualDuration: 0.22, bounce: 0.1 } }
                }
                onClick={() => router.push("/dashboard/create")}
                aria-label="Create new project"
                className="inline-flex items-center justify-center gap-1.5 h-[38px] px-3.5 rounded-[10px] text-xs lg:h-9 lg:px-4 lg:rounded-lg lg:text-sm font-medium bg-[#FFFFFF] text-[#131313] hover:bg-[#E4E4E7] transition-colors cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]"
              >
                <Plus className="size-4" strokeWidth={2.25} />
                <span>New Project</span>
              </motion.button>
            </div>

            {/* Controls Bar:
                - Mobile: Vertical sequence with full-width search input & embedded right "3/3" badge, followed by horizontal filter chips
                - Desktop: Unified horizontal toolbar aligning search input (w-80, h-9, radius 8px) and filter chips
            */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mt-1 lg:mt-5">
              {/* Filter Chips Container */}
              <div className="flex overflow-x-auto no-scrollbar gap-2 shrink-0">
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

              {/* Search Field with Embedded Right Counter Badge "3/3" */}
              <div className="relative w-full lg:w-80 flex items-center h-11 lg:h-9 bg-[#1A1A1A] border border-[#262626] focus-within:border-[#383838] rounded-[10px] lg:rounded-lg px-3.5 lg:px-3 transition-colors focus-within:ring-2 focus-within:ring-zinc-400 focus-within:ring-offset-2 focus-within:ring-offset-[#131313]">
                <Search
                  className="size-4 text-[#71717A] shrink-0 mr-2.5"
                  strokeWidth={1.75}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search projects..."
                  className="w-full bg-transparent text-sm lg:text-xs text-[#F4F4F5] placeholder:text-[#71717A] outline-none pr-9"
                />
                {/* Embedded Right Counter Badge */}
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2 h-5 px-1.5 rounded-[6px] bg-[#222222] border border-[#262626] text-[10.5px] font-mono font-medium text-[#71717A] flex items-center justify-center shrink-0 tabular-nums select-none pointer-events-none">
                  {ownedCount}/{MAX_FREE_PROJECTS}
                </div>
              </div>
            </div>
          </div>

          {activeMode === "astro" ? (
            /* ASTRO MODE: Global Agentic AI Workspace */
            <div className="space-y-6 animate-in fade-in duration-150">
              <AstroDashboard />
            </div>
          ) : (
            /* PROJECTS MODE: Responsive Project Stack / Grid */
            <div className="space-y-4 lg:space-y-6">
              {isLoading ? (
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
                  {[1, 2, 3].map((i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : projects.length === 0 ? (
                <div className="border border-dashed border-[#262626] rounded-[14px] lg:rounded-2xl p-8 lg:p-12 text-center bg-[#1A1A1A]/40">
                  <div className="max-w-sm mx-auto space-y-4">
                    <div className="space-y-1">
                      <h3 className="text-base font-medium text-[#F4F4F5]">
                        No projects yet
                      </h3>
                      <p className="text-xs sm:text-sm text-[#71717A]">
                        Create your first project to get started.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push("/dashboard/create")}
                      aria-label="Create new project"
                      className="inline-flex items-center justify-center h-9 px-4 rounded-lg gap-2 text-xs sm:text-sm font-medium bg-[#FFFFFF] text-[#131313] hover:bg-[#E4E4E7] transition-colors cursor-pointer"
                    >
                      <Plus className="size-4" strokeWidth={2} />
                      <span>New Project</span>
                    </button>
                  </div>
                </div>
              ) : q && filtered.length === 0 ? (
                <div className="border border-dashed border-[#262626] rounded-[14px] lg:rounded-2xl p-8 lg:p-12 text-center bg-[#1A1A1A]/40">
                  <div className="max-w-sm mx-auto space-y-2">
                    <Search
                      className="size-5 text-[#71717A] mx-auto opacity-60"
                      strokeWidth={1.75}
                    />
                    <h3 className="text-sm font-medium text-[#F4F4F5]">
                      No results
                    </h3>
                    <p className="text-xs text-[#71717A]">
                      No project matches &quot;{searchQuery}&quot;.
                    </p>
                  </div>
                </div>
              ) : (
                /* Single column vertical stack on mobile (<640px), responsive 2/3 column grid on desktop (>=1024px) */
                <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
                  {/* Subtle "+ New Project" Dashed Card Tile on Desktop */}
                  {canCreateMore && !q && (
                    <motion.button
                      type="button"
                      whileHover={
                        shouldReduceMotion
                          ? undefined
                          : { y: -2, transition: { type: "spring", visualDuration: 0.22, bounce: 0.1 } }
                      }
                      whileTap={
                        shouldReduceMotion
                          ? undefined
                          : { scale: 0.985, transition: { type: "spring", visualDuration: 0.22, bounce: 0.1 } }
                      }
                      onClick={() => router.push("/dashboard/create")}
                      aria-label="Create new project card"
                      className="group relative flex flex-col items-center justify-center min-h-[96px] sm:min-h-[118px] p-4 rounded-[14px] sm:rounded-2xl border border-dashed border-[#262626] hover:border-[#383838] bg-[#1A1A1A]/40 hover:bg-[#1A1A1A] transition-colors text-center cursor-pointer select-none outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#131313]"
                    >
                      <div className="size-9 rounded-lg bg-[#222222] border border-[#262626] flex items-center justify-center mb-1.5 group-hover:border-[#383838] transition-colors">
                        <Plus
                          className="size-4 text-[#71717A] group-hover:text-[#F4F4F5] transition-colors"
                          strokeWidth={2}
                        />
                      </div>
                      <h3 className="text-xs sm:text-sm font-medium text-[#F4F4F5] transition-colors">
                        Create Project
                      </h3>
                      <span className="text-[10.5px] text-[#71717A] font-mono mt-0.5">
                        {ownedCount}/{MAX_FREE_PROJECTS} used
                      </span>
                    </motion.button>
                  )}

                  {filtered.map((project: any) => {
                    const liveUrl = getValidProjectUrl(project)
                    const fallbackHtml = project.pages?.find(
                      (p: any) => p.name === "index.html"
                    )?.content
                    const deploymentKey = String(
                      project.deploymentId || project.githubRepoId || project._id
                    )
                    const isLive =
                      Boolean(liveUrl) && !flaggedDeployments.has(deploymentKey)
                    const projectDomain =
                      liveUrl ||
                      project.cloudflareUrl ||
                      project.domain ||
                      (project.subdomain
                        ? `${project.subdomain}.sycord.com`
                        : "example.com")
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
                        onDelete={() =>
                          setProjectToDelete({
                            id: project._id,
                            name: project.businessName,
                          })
                        }
                      />
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {pendingInvites.length > 0 && (
        <CollabInvitePopup
          invite={pendingInvites[0]}
          onDismiss={() => setPendingInvites((prev) => prev.slice(1))}
        />
      )}

      <Dialog
        open={!!debugError}
        onOpenChange={(open) => !open && setDebugError(null)}
      >
        <DialogContent className="sm:max-w-md border-red-200 bg-red-50 dark:bg-red-950/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <TriangleAlert className="h-5 w-5" />
              Authentication Error
            </DialogTitle>
            <DialogDescription className="text-red-600/90 dark:text-red-400/90">
              An error occurred during authentication.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-white dark:bg-black/20 rounded-md border border-red-100 dark:border-red-900/50 font-mono text-sm break-all">
            {debugError}
          </div>
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => setDebugError(null)}
              className="border-red-200 hover:bg-red-100"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!projectToDelete}
        onOpenChange={(open) => !open && setProjectToDelete(null)}
      >
        <AlertDialogContent className="bg-[#1A1A1A] border border-[#262626] text-[#F4F4F5] rounded-xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#71717A]">
              This will permanently delete &quot;{projectToDelete?.name}&quot; and
              all its data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={isDeleting}
              className="bg-[#222222] border-[#262626] text-[#F4F4F5] hover:bg-[#2A2A2A] rounded-lg"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteProject()
              }}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 rounded-lg"
            >
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
    <Suspense
      fallback={
        <div className="w-full max-w-[430px] lg:max-w-6xl mx-auto min-h-screen px-4 pt-6 pb-12 lg:px-8 lg:py-10 space-y-4 lg:space-y-8">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 bg-[#1A1A1A]" />
            <Skeleton className="size-8 lg:size-9 rounded-full bg-[#1A1A1A]" />
          </div>
          <Skeleton className="h-11 lg:h-9 w-full bg-[#1A1A1A] rounded-[10px] lg:rounded-lg" />
          <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4">
            {[1, 2, 3].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
