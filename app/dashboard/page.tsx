"use client"

import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Monitor,
  FileText,
  FileSpreadsheet,
  FilePlus,
  FolderPlus,
  Upload,
  FolderUp,
  ExternalLink,
  MoreHorizontal,
} from "lucide-react"
import { useState, useEffect, Suspense, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { CollabInvitePopup, type CollabInvite } from "@/components/collab-invite-popup"

const MAX_FREE_PROJECTS = 3

interface CustomFileItem {
  id: string
  name: string
  type: "document" | "spreadsheet" | "folder"
  meta?: string
  url?: string
}

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
    <div className="rounded-[20px] border border-[#232326] bg-[#121214] p-4 flex items-center justify-between">
      <div className="flex items-center gap-3.5 flex-1 min-w-0">
        <Skeleton className="size-11 rounded-[14px] shrink-0 bg-[#1e1e24]" />
        <div className="space-y-1.5 flex-1 min-w-0">
          <Skeleton className="h-4 w-32 bg-[#1e1e24] rounded-[6px]" />
          <Skeleton className="h-3 w-24 bg-[#18181e] rounded-[4px]" />
        </div>
      </div>
      <Skeleton className="h-8 w-16 rounded-[12px] bg-[#1e1e24] shrink-0 ml-3" />
    </div>
  )
}

function DashboardContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [debugError, setDebugError] = useState<string | null>(null)
  const [userStatus, setUserStatus] = useState<{ isBlocked: boolean; subscription: string; isPremium: boolean }>({ isBlocked: false, subscription: "Free", isPremium: false })
  const [pendingInvites, setPendingInvites] = useState<CollabInvite[]>([])
  const [projectToDelete, setProjectToDelete] = useState<{ id: string; name: string } | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [artifactFilter, setArtifactFilter] = useState<"all" | "website" | "file">("all")

  const fileUploadInputRef = useRef<HTMLInputElement>(null)
  const folderUploadInputRef = useRef<HTMLInputElement>(null)
  const [customFiles, setCustomFiles] = useState<CustomFileItem[]>([])

  const handleCreateFile = () => {
    const filename = prompt("Enter new file name (e.g. index.ts, notes.md):", "newfile.txt")
    if (!filename?.trim()) return
    const newFile: CustomFileItem = {
      id: `custom-file-${Date.now()}`,
      name: filename.trim(),
      type: filename.endsWith(".xls") || filename.endsWith(".xlsx") || filename.endsWith(".csv") ? "spreadsheet" : "document",
      meta: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    }
    setCustomFiles((prev) => [newFile, ...prev])
  }

  const handleCreateFolder = () => {
    const foldername = prompt("Enter new folder name:", "new-folder")
    if (!foldername?.trim()) return
    const newFolder: CustomFileItem = {
      id: `custom-folder-${Date.now()}`,
      name: foldername.trim(),
      type: "folder",
      meta: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    }
    setCustomFiles((prev) => [newFolder, ...prev])
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const newItems: CustomFileItem[] = Array.from(files).map((f) => ({
      id: `uploaded-${Date.now()}-${f.name}`,
      name: f.name,
      type: f.name.endsWith(".xls") || f.name.endsWith(".xlsx") || f.name.endsWith(".csv") ? "spreadsheet" : "document",
      meta: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    }))
    setCustomFiles((prev) => [...newItems, ...prev])
  }

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    const rootName = (files[0] as any).webkitRelativePath?.split("/")[0] || "uploaded-folder"
    const newFolder: CustomFileItem = {
      id: `uploaded-folder-${Date.now()}`,
      name: rootName,
      type: "folder",
      meta: new Date().toISOString().slice(0, 10).replace(/-/g, "."),
    }
    setCustomFiles((prev) => [newFolder, ...prev])
  }

  useEffect(() => {
    const openCreate = searchParams.get("open_create_modal")
    const error = searchParams.get("error")
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
      fetch("/api/projects", { cache: "no-store" }).then((r) => (r.ok ? r.json() : [])),
      fetch("/api/user/status", { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("/api/announcements", { cache: "no-store" }).then((r) => (r.ok ? r.json() : { announcements: [] })),
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
      const res = await fetch(`/api/projects/${projectToDelete.id}`, { method: "DELETE" })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.message || "Failed")
      }
      setProjects((prev: any) => prev.filter((p: any) => p._id !== projectToDelete.id))
      const project: any = projects.find((p: any) => p._id === projectToDelete.id)
      if (project?.dokployApplicationId || project?.applicationId) {
        fetch("/api/deploy/coolify", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: project.dokployApplicationId || project.applicationId,
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
      <div className="min-h-screen md:ml-16 px-4 pt-6 pb-20 md:pb-6">
        <div className="max-w-xl mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-28 bg-zinc-800/80" />
            <Skeleton className="size-8 rounded-full bg-zinc-800/80" />
          </div>
          <Skeleton className="h-11 w-full rounded-[16px] bg-zinc-800/60" />
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <CardSkeleton key={i} />
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

  const userInitials = session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "D"

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
            <a
              href="mailto:admin@sycord.com"
              className="inline-flex items-center justify-center rounded-xl bg-primary text-primary-foreground px-6 py-3 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Contact Support
            </a>
            <div>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Filter projects and files by search query
  const q = searchQuery.trim().toLowerCase()

  const filteredProjects = projects.filter((p: any) => {
    if (artifactFilter === "file") return false
    const name = (p.businessName || "").toLowerCase()
    const domain = (p.domain || p.cloudflareUrl || "").toLowerCase()
    return !q || name.includes(q) || domain.includes(q)
  })

  const filteredCustomFiles = customFiles.filter((f) => {
    if (artifactFilter === "website") return false
    return !q || f.name.toLowerCase().includes(q)
  })

  const displayDemoProject =
    !isLoading && projects.length === 0 && customFiles.length === 0 && artifactFilter !== "file"

  return (
    <>
      <div className="min-h-screen bg-background md:ml-16 text-foreground">
        {/* Top Header */}
        <header className="sticky top-0 bg-background/90 backdrop-blur-md z-50">
          <div className="max-w-xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center focus:outline-none opacity-90 hover:opacity-100 transition-opacity">
              <Image
                src="/brand-logo.png"
                alt="Sycord"
                width={28}
                height={28}
                priority
                className="object-contain shrink-0"
              />
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="User account menu"
                  className="relative size-8 rounded-full bg-[#a855f7] flex items-center justify-center text-white font-semibold text-xs transition-transform active:scale-[0.95] outline-none cursor-pointer shadow-sm hover:brightness-105 overflow-hidden"
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
              <DropdownMenuContent
                className="w-56 bg-surface border border-border text-foreground rounded-[18px] p-1.5 shadow-2xl"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="font-normal px-2.5 py-2">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-foreground">{session?.user?.name}</p>
                    <p className="text-xs leading-none text-text-muted">{session?.user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem className="rounded-[10px] text-xs text-text-secondary hover:text-foreground hover:bg-surface-muted cursor-pointer">
                  <User className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Profile</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => router.push("/subscriptions")}
                  className="rounded-[10px] text-xs text-text-secondary hover:text-foreground hover:bg-surface-muted cursor-pointer"
                >
                  <CreditCard className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Plans</span>
                </DropdownMenuItem>
                <DropdownMenuItem className="rounded-[10px] text-xs text-text-secondary hover:text-foreground hover:bg-surface-muted cursor-pointer">
                  <Settings className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Settings</span>
                </DropdownMenuItem>
                {session?.user?.email === "dmarton336@gmail.com" && (
                  <>
                    <DropdownMenuSeparator className="bg-border" />
                    <DropdownMenuItem
                      onClick={() => router.push("/admin")}
                      className="rounded-[10px] text-xs cursor-pointer"
                    >
                      <Shield className="mr-2 size-4 text-emerald-400" strokeWidth={1.75} />
                      <span className="text-emerald-400 font-medium">Moderator View</span>
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-border" />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="rounded-[10px] text-xs text-destructive hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                >
                  <LogOut className="mr-2 size-4" strokeWidth={1.75} />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="max-w-xl mx-auto px-4 sm:px-6 pt-4 pb-16">
          <div className="space-y-6">
            {/* Announcements if any */}
            {announcements.length > 0 && (
              <div className="space-y-2">
                {announcements.map((ann) => (
                  <div
                    key={ann.id || ann._id}
                    className={cn(
                      "flex items-start gap-3 p-3.5 rounded-[18px] border text-xs leading-relaxed",
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

            {/* Filter Pills matching exact reference image */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-1">
              <button
                type="button"
                onClick={() => setArtifactFilter("all")}
                className={cn(
                  "h-8 px-4 rounded-[12px] text-xs font-medium transition-all select-none cursor-pointer",
                  artifactFilter === "all"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#18181a] border border-[#27272a] text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]"
                )}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setArtifactFilter("website")}
                className={cn(
                  "h-8 px-3.5 rounded-[12px] text-xs font-medium transition-all inline-flex items-center gap-1.5 select-none cursor-pointer",
                  artifactFilter === "website"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#18181a] border border-[#27272a] text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]"
                )}
              >
                <Monitor className="size-3.5" strokeWidth={1.75} />
                <span>Websites</span>
              </button>
              <button
                type="button"
                onClick={() => setArtifactFilter("file")}
                className={cn(
                  "h-8 px-3.5 rounded-[12px] text-xs font-medium transition-all inline-flex items-center gap-1.5 select-none cursor-pointer",
                  artifactFilter === "file"
                    ? "bg-white text-black font-semibold shadow-sm"
                    : "bg-[#18181a] border border-[#27272a] text-zinc-400 hover:text-zinc-200 hover:bg-[#202024]"
                )}
              >
                <FileSpreadsheet className="size-3.5" strokeWidth={1.75} />
                <span>Files</span>
              </button>
            </div>

            {/* Inline Search Bar + Plus Button */}
            <div className="flex items-center gap-3 pt-2">
              <div className="relative flex-1">
                <Input
                  type="text"
                  placeholder="Enter text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 sm:h-12 bg-[#121214] border border-[#26262a] hover:border-[#38383f] focus-visible:border-zinc-400 text-sm text-foreground rounded-[16px] px-4 placeholder:text-zinc-500 shadow-sm transition-colors"
                />
              </div>

              {/* Hidden file upload inputs */}
              <input
                type="file"
                ref={fileUploadInputRef}
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
              <input
                type="file"
                ref={folderUploadInputRef}
                // @ts-ignore
                webkitdirectory=""
                directory=""
                multiple
                className="hidden"
                onChange={handleFolderUpload}
              />

              {/* Inline Plus Button with Dropdown Action Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Create or upload options"
                    className="size-11 sm:size-12 rounded-[16px] bg-white hover:bg-zinc-200 text-black flex items-center justify-center shrink-0 shadow-sm transition-all active:scale-[0.96] outline-none cursor-pointer"
                  >
                    <Plus className="size-5" strokeWidth={2.2} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-52 bg-[#18181a] border border-[#2a2a2e] text-[#EDEDED] rounded-[18px] p-1.5 shadow-2xl z-50"
                >
                  <DropdownMenuItem
                    onClick={() => router.push("/dashboard/create")}
                    className="rounded-[10px] text-xs py-2 px-2.5 gap-2.5 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <Monitor className="size-4 text-sky-400" />
                    <span>Create website</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.08]" />
                  <DropdownMenuItem
                    onClick={handleCreateFile}
                    className="rounded-[10px] text-xs py-2 px-2.5 gap-2.5 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <FilePlus className="size-4 text-zinc-400" />
                    <span>Create file</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCreateFolder}
                    className="rounded-[10px] text-xs py-2 px-2.5 gap-2.5 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <FolderPlus className="size-4 text-zinc-400" />
                    <span>Create folder</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator className="bg-white/[0.08]" />
                  <DropdownMenuItem
                    onClick={() => fileUploadInputRef.current?.click()}
                    className="rounded-[10px] text-xs py-2 px-2.5 gap-2.5 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <Upload className="size-4 text-zinc-400" />
                    <span>Upload file</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => folderUploadInputRef.current?.click()}
                    className="rounded-[10px] text-xs py-2 px-2.5 gap-2.5 hover:bg-white/[0.08] cursor-pointer"
                  >
                    <FolderUp className="size-4 text-zinc-400" />
                    <span>Upload folder</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Projects & Artifacts List (Nudged exactly like reference image) */}
            <div className="space-y-3 pt-3">
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((i) => (
                    <CardSkeleton key={i} />
                  ))}
                </div>
              ) : (
                <>
                  {/* Real User Projects */}
                  {filteredProjects.map((project: any) => {
                    const liveUrl = getValidProjectUrl(project)
                    const displayDomain = liveUrl
                      ? liveUrl.replace(/^https?:\/\//, "")
                      : project.domain || `${(project.businessName || "project").toLowerCase().replace(/\s+/g, "-")}.sycord.site`

                    return (
                      <div
                        key={project._id}
                        className="group relative flex items-center justify-between rounded-[20px] border border-[#232326] bg-[#121214] hover:bg-[#161619] hover:border-[#333338] text-foreground p-3.5 sm:p-4 transition-all duration-150 shadow-sm"
                      >
                        <Link
                          href={`/dashboard/sites/${project._id}/syra`}
                          className="flex items-center gap-3.5 min-w-0 flex-1 focus:outline-none"
                        >
                          {/* Octopus / Website Icon */}
                          <div className="size-11 rounded-[14px] bg-[#181824] border border-[#272738] flex items-center justify-center shrink-0 overflow-hidden group-hover:border-sky-500/30 transition-colors">
                            {project.profileImage ? (
                              <img
                                src={project.profileImage}
                                alt={project.businessName || "Project"}
                                className="size-full object-cover"
                                onError={(e) => {
                                  ;(e.currentTarget as HTMLElement).style.display = "none"
                                }}
                              />
                            ) : (
                              <div className="size-full flex items-center justify-center text-sky-400">
                                <svg className="size-6 text-sky-400 fill-current" viewBox="0 0 24 24">
                                  <path d="M12 2a6 6 0 0 0-6 6v1c0 .6.4 1 1 1h.1c.5 0 .9-.4 1-.9.4-2.3 2.1-4.1 4.5-4.1s4.1 1.8 4.5 4.1c.1.5.5.9 1 .9h.1c.6 0 1-.4 1-1V8a6 6 0 0 0-6-6zm-7 9c-.6 0-1 .4-1 1v4c0 1.7 1.3 3 3 3 .6 0 1-.4 1-1s-.4-1-1-1c-.6 0-1-.4-1-1v-4c0-.6-.4-1-1-1zm14 0c-.6 0-1 .4-1 1v4c0 .6-.4 1-1 1s-1 .4-1 1c0 .6.4 1 1 1 1.7 0 3-1.3 3-3v-4c0-.6-.4-1-1-1zm-10 1c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1s1-.4 1-1v-5c0-.6-.4-1-1-1zm6 0c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1s1-.4 1-1v-5c0-.6-.4-1-1-1zm-3 1c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1z" />
                                </svg>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <h3 className="text-sm sm:text-base font-semibold text-zinc-100 group-hover:text-white transition-colors leading-tight truncate">
                              {project.businessName || "your project name"}
                            </h3>
                            <span className="text-xs text-zinc-400 font-normal transition-colors truncate mt-0.5">
                              {displayDomain}
                            </span>
                          </div>
                        </Link>

                        {/* Action Menu */}
                        <div className="flex items-center gap-2 shrink-0 ml-3">
                          <Link
                            href={`/dashboard/sites/${project._id}/syra`}
                            className="hidden sm:inline-flex items-center justify-center h-8 px-3.5 rounded-[12px] bg-[#1a1a1e] hover:bg-[#24242a] border border-[#2c2c32] text-xs font-medium text-zinc-300 hover:text-white transition-all active:scale-[0.97]"
                          >
                            Open AI Chat
                          </Link>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Project options"
                                className="size-8 rounded-[10px] text-zinc-400 hover:text-white hover:bg-[#202024]"
                              >
                                <MoreHorizontal className="size-4" strokeWidth={1.75} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-40 bg-[#18181a] border border-[#2a2a2e] text-[#EDEDED] shadow-2xl rounded-[16px] p-1.5 z-50"
                            >
                              <DropdownMenuItem asChild>
                                <Link
                                  href={`/dashboard/sites/${project._id}`}
                                  className="cursor-pointer flex items-center gap-2 text-xs hover:bg-white/[0.08] rounded-[10px] py-2 px-2.5 text-zinc-300 hover:text-white"
                                >
                                  <Settings className="size-3.5 text-zinc-400" strokeWidth={1.75} />
                                  <span>Settings</span>
                                </Link>
                              </DropdownMenuItem>
                              {liveUrl && (
                                <DropdownMenuItem asChild>
                                  <a
                                    href={liveUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cursor-pointer flex items-center gap-2 text-xs hover:bg-white/[0.08] rounded-[10px] py-2 px-2.5 text-zinc-300 hover:text-white"
                                  >
                                    <ExternalLink className="size-3.5 text-zinc-400" strokeWidth={1.75} />
                                    <span>Visit Live</span>
                                  </a>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator className="bg-white/[0.08]" />
                              <DropdownMenuItem
                                onClick={() => setProjectToDelete({ id: project._id, name: project.businessName || "Project" })}
                                className="cursor-pointer flex items-center gap-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-[10px] py-2 px-2.5"
                              >
                                <Trash2 className="size-3.5 text-rose-400" strokeWidth={1.75} />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    )
                  })}

                  {/* Demo project placeholder if no projects exist */}
                  {displayDemoProject && (
                    <div
                      onClick={() => router.push("/dashboard/create")}
                      className="group relative flex items-center justify-between rounded-[20px] border border-[#232326] bg-[#121214] hover:bg-[#161619] hover:border-[#333338] text-foreground p-3.5 sm:p-4 transition-all duration-150 shadow-sm cursor-pointer"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="size-11 rounded-[14px] bg-[#181824] border border-[#272738] flex items-center justify-center shrink-0 overflow-hidden group-hover:border-sky-500/30 transition-colors">
                          <div className="size-full flex items-center justify-center text-sky-400">
                            <svg className="size-6 text-sky-400 fill-current" viewBox="0 0 24 24">
                              <path d="M12 2a6 6 0 0 0-6 6v1c0 .6.4 1 1 1h.1c.5 0 .9-.4 1-.9.4-2.3 2.1-4.1 4.5-4.1s4.1 1.8 4.5 4.1c.1.5.5.9 1 .9h.1c.6 0 1-.4 1-1V8a6 6 0 0 0-6-6zm-7 9c-.6 0-1 .4-1 1v4c0 1.7 1.3 3 3 3 .6 0 1-.4 1-1s-.4-1-1-1c-.6 0-1-.4-1-1v-4c0-.6-.4-1-1-1zm14 0c-.6 0-1 .4-1 1v4c0 .6-.4 1-1 1s-1 .4-1 1c0 .6.4 1 1 1 1.7 0 3-1.3 3-3v-4c0-.6-.4-1-1-1zm-10 1c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1s1-.4 1-1v-5c0-.6-.4-1-1-1zm6 0c-.6 0-1 .4-1 1v5c0 .6.4 1 1 1s1-.4 1-1v-5c0-.6-.4-1-1-1zm-3 1c-.6 0-1 .4-1 1v4c0 .6.4 1 1 1s1-.4 1-1v-4c0-.6-.4-1-1-1z" />
                            </svg>
                          </div>
                        </div>

                        <div className="flex flex-col min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold text-zinc-100 group-hover:text-white transition-colors leading-tight truncate">
                            your project name
                          </h3>
                          <span className="text-xs text-zinc-400 font-normal transition-colors truncate mt-0.5">
                            test.sycord.site
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="inline-flex items-center justify-center h-8 px-3.5 rounded-[12px] bg-[#1a1a1e] group-hover:bg-[#24242a] border border-[#2c2c32] text-xs font-medium text-zinc-300 group-hover:text-white transition-all">
                          Create
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Custom & Uploaded Files */}
                  {filteredCustomFiles.map((file) => (
                    <div
                      key={file.id}
                      className="group relative flex items-center justify-between rounded-[20px] border border-[#232326] bg-[#121214] hover:bg-[#161619] hover:border-[#333338] text-foreground p-3.5 sm:p-4 transition-all duration-150 shadow-sm"
                    >
                      <div className="flex items-center gap-3.5 min-w-0 flex-1">
                        <div className="size-11 rounded-[14px] bg-[#181824] border border-[#272738] flex items-center justify-center shrink-0 text-zinc-300">
                          {file.type === "spreadsheet" ? (
                            <FileSpreadsheet className="size-5 text-emerald-400" strokeWidth={1.8} />
                          ) : file.type === "folder" ? (
                            <Folder className="size-5 text-amber-400" strokeWidth={1.8} />
                          ) : (
                            <FileText className="size-5 text-sky-400" strokeWidth={1.8} />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <h3 className="text-sm sm:text-base font-semibold text-zinc-100 group-hover:text-white transition-colors leading-tight truncate">
                            {file.name}
                          </h3>
                          <span className="text-xs text-zinc-400 font-normal transition-colors truncate mt-0.5">
                            {file.meta || "Connected File"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <button
                          type="button"
                          onClick={() => setCustomFiles((prev) => prev.filter((f) => f.id !== file.id))}
                          className="size-8 rounded-[10px] text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Trash2 className="size-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Empty search result */}
                  {!displayDemoProject &&
                    filteredProjects.length === 0 &&
                    filteredCustomFiles.length === 0 && (
                      <div className="text-center py-12 border border-dashed border-[#26262a] rounded-[20px] p-6 bg-[#121214]/40">
                        <p className="text-sm text-zinc-400">No projects or files found matching &quot;{searchQuery}&quot;</p>
                        <button
                          type="button"
                          onClick={() => router.push("/dashboard/create")}
                          className="mt-3 inline-flex items-center gap-1.5 text-xs text-sky-400 hover:text-sky-300 font-medium cursor-pointer"
                        >
                          <Plus className="size-3.5" />
                          <span>Create new website</span>
                        </button>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </main>
      </div>

      {pendingInvites.length > 0 && (
        <CollabInvitePopup
          invite={pendingInvites[0]}
          onDismiss={() => setPendingInvites((prev) => prev.slice(1))}
        />
      )}

      <Dialog open={!!debugError} onOpenChange={(open) => !open && setDebugError(null)}>
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
            <Button variant="outline" onClick={() => setDebugError(null)} className="border-red-200 hover:bg-red-100">
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{projectToDelete?.name}&quot; and all its data. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleDeleteProject()
              }}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
        <div className="min-h-screen md:ml-16 px-4 pt-6">
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <Skeleton className="h-6 w-28 bg-zinc-800/80" />
              <Skeleton className="size-8 rounded-full bg-zinc-800/80" />
            </div>
            <Skeleton className="h-11 w-full rounded-[16px] bg-zinc-800/60" />
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  )
}
