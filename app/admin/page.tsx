"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ADMIN_EMAIL } from "@/lib/admin-email"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import Image from "next/image"
import Link from "next/link"
import {
  AlertCircle,
  Users,
  Zap,
  Shield,
  Trash2,
  Mail,
  Search,
  Menu,
  X,
  ArrowLeft,
  LogOut,
  BarChart3,
  Server,
  Activity,
  Check,
  Cloud,
  Database,
  Globe2,
  HardDrive,
  Network,
  Cpu,
  Wifi,
  Lock,
  Upload,
  Image as ImageIcon,
  Loader2,
  Save,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Ban,
  UserCheck,
  Settings,
  User,
  ChevronDown,
  Calendar,
  ExternalLink
} from "lucide-react"

const availableIcons = [
  { name: "Server", icon: Server },
  { name: "Cloud", icon: Cloud },
  { name: "Database", icon: Database },
  { name: "Globe", icon: Globe2 },
  { name: "Network", icon: Network },
  { name: "Storage", icon: HardDrive },
  { name: "CPU", icon: Cpu },
  { name: "Wifi", icon: Wifi },
  { name: "Shield", icon: Shield },
  { name: "Lock", icon: Lock },
  { name: "Activity", icon: Activity },
]

interface User {
  userId: string
  email: string
  name: string
  projectCount: number
  isPremium: boolean
  isBlocked: boolean
  subscription: string
  ip: string
  createdAt: string
  websites: Array<{ id: string; businessName: string; subdomain: string }>
}

const tabs = [
  { id: "overview" as const, label: "Overview", icon: BarChart3 },
  { id: "users" as const, label: "Users", icon: Users },
  { id: "server" as const, label: "Server", icon: Server },
  { id: "runner" as const, label: "Runner", icon: Activity },
  { id: "tickets" as const, label: "Tickets", icon: AlertCircle },
  { id: "paptos" as const, label: "Legal", icon: BookOpen },
]

type TabId = "overview" | "users" | "server" | "runner" | "tickets" | "paptos"

type RunnerStatus = {
  success: boolean
  online: boolean
  version?: string
  uptimeSeconds?: number
  hostname?: string
  nodeVersion?: string
  npmVersion?: string
  cloudflared?: {
    installed: boolean
    running: boolean
    tunnelName?: string
  }
  proxy?: {
    type: "nginx" | "caddy"
    running: boolean
  }
  cpu?: {
    usagePercent: number
    cores: number
    loadAvg: number[]
  }
  memory?: {
    totalMb: number
    usedMb: number
    freeMb: number
    usagePercent: number
  }
  disk?: {
    totalGb: number
    usedGb: number
    freeGb: number
    usagePercent: number
  }
  websites?: {
    total: number
    running: number
    stopped: number
    failed: number
    healthy: number
    unhealthy: number
  }
  updatedAt?: string
  error?: string
}

type RunnerSetupStatus = {
  setupComplete: boolean
  nodeOk: boolean
  npmOk: boolean
  pm2Ok: boolean
  proxyOk: boolean
  cloudflaredOk: boolean
  directoriesOk: boolean
  serviceOk: boolean
  missingDependencies: string[]
  lastSetupAt?: string
  logs?: string[]
}

type RunnerWebsite = {
  id: string
  projectId?: string
  name?: string
  domain?: string
  port?: number
  processName?: string
  status?: string
  health?: string
  cpu?: string | number
  memory?: string | number
  restartCount?: number
  lastDeploy?: string
  lastHealthCheck?: string
  lastError?: string
}

type RunnerAction = "start" | "stop" | "setup" | "destroy"
type WebsiteAction = "start" | "stop" | "restart" | "health-check" | "destroy-runtime"
type RunnerLogType = "deploy" | "build" | "runtime" | "error" | "health"

export default function AdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [activeTab, setActiveTab] = useState<TabId>("overview")
  const [monitors, setMonitors] = useState<any[]>([])
  const [monitorsLoading, setMonitorsLoading] = useState(false)
  const [editingIcon, setEditingIcon] = useState<string | null>(null)
  const [uploadingIcon, setUploadingIcon] = useState<string | null>(null)

  // VPS Runner State
  const [vpsStatus, setVpsStatus] = useState<RunnerStatus | null>(null)
  const [vpsLoading, setVpsLoading] = useState(false)
  const [vpsLogs, setVpsLogs] = useState<string[]>([])
  const [vpsAction, setVpsAction] = useState<RunnerAction | null>(null)
  const [vpsLogType, setVpsLogType] = useState<RunnerLogType>("runtime")
  const [vpsLogLines, setVpsLogLines] = useState<number>(200)
  const [vpsWebsites, setVpsWebsites] = useState<RunnerWebsite[]>([])
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null)
  const [runnerSetupStatus, setRunnerSetupStatus] = useState<RunnerSetupStatus | null>(null)
  const [runnerSetupLoading, setRunnerSetupLoading] = useState(false)
  const [runnerSetupLogs, setRunnerSetupLogs] = useState<string[]>([])
  const [runnerSetupLogsOpen, setRunnerSetupLogsOpen] = useState(false)
  const [logsAutoRefresh, setLogsAutoRefresh] = useState(false)
  const [destroyDialogOpen, setDestroyDialogOpen] = useState(false)
  const [destroyConfirm, setDestroyConfirm] = useState("")
  const [destroyOptions, setDestroyOptions] = useState({
    deleteRuntime: false,
    deleteLogs: false,
    deleteProxy: false,
  })

  // PAP & TOS State
  const [privacyPolicy, setPrivacyPolicy] = useState("Edit your privacy policy here...")
  const [termsOfService, setTermsOfService] = useState("Edit your terms of service here...")

  useEffect(() => {
    if (session?.user?.email !== ADMIN_EMAIL) {
      router.push("/dashboard")
      return
    }

    fetchUsers()
    fetchMonitors()
  }, [session, router])

  useEffect(() => {
    const tabParam = searchParams.get("tab")
    if (!tabParam) return
    // Support legacy vps tab links.
    if (tabParam === "runner" || tabParam === "vps") {
      setActiveTab("runner")
      return
    }
    if (["overview", "users", "server", "tickets", "paptos"].includes(tabParam)) {
      setActiveTab(tabParam as TabId)
    }
  }, [searchParams])

  useEffect(() => {
    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        user.name.toLowerCase().includes(query) ||
        user.userId.toLowerCase().includes(query),
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  useEffect(() => {
    if (activeTab === "runner") {
      refreshRunner()
    }
  }, [activeTab])

  useEffect(() => {
    if (!selectedWebsiteId) {
      setVpsLogs([])
      return
    }
    fetchVpsLogs(selectedWebsiteId)
  }, [selectedWebsiteId, vpsLogType, vpsLogLines])

  useEffect(() => {
    if (!logsAutoRefresh || !selectedWebsiteId) return
    const interval = setInterval(() => {
      fetchVpsLogs(selectedWebsiteId)
    }, 8000)
    return () => clearInterval(interval)
  }, [logsAutoRefresh, selectedWebsiteId, vpsLogType, vpsLogLines])

  useEffect(() => {
    if (!vpsWebsites.length) return
    if (!selectedWebsiteId || !vpsWebsites.some((site) => site.id === selectedWebsiteId)) {
      setSelectedWebsiteId(vpsWebsites[0].id)
    }
  }, [vpsWebsites, selectedWebsiteId])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/users")
      if (!response.ok) throw new Error("Failed to fetch users")
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error("[v0] Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMonitors = async () => {
    try {
      setMonitorsLoading(true)
      const response = await fetch("/api/servers/status")
      if (response.ok) {
        const data = await response.json()
        setMonitors(data.servers || [])
      }
    } catch (error) {
      console.error("Error fetching monitors:", error)
    } finally {
      setMonitorsLoading(false)
    }
  }

  const updateMonitorIcon = async (id: string, icon: string, iconType: string = 'preset') => {
    try {
      const response = await fetch("/api/admin/monitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, icon, iconType }),
      })
      if (response.ok) {
        setMonitors(monitors.map(m => m.id === id ? { ...m, providerIcon: icon, iconType } : m))
        setEditingIcon(null)
      }
    } catch (error) {
      console.error("Error updating monitor icon:", error)
    }
  }

  const handleIconUpload = async (id: string, event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file (PNG, JPG, etc.)')
      return
    }

    if (file.size > 1024 * 1024) {
      toast.error('Image must be smaller than 1MB')
      return
    }

    setUploadingIcon(id)

    try {
      const reader = new FileReader()
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string
        await updateMonitorIcon(id, dataUrl, 'custom')
        toast.success('Icon uploaded successfully')
        setUploadingIcon(null)
      }
      reader.onerror = () => {
        toast.error('Error reading file')
        setUploadingIcon(null)
      }
      reader.readAsDataURL(file)
    } catch (error) {
      console.error("Error uploading icon:", error)
      toast.error('Error uploading icon')
      setUploadingIcon(null)
    }
  }

  const togglePremium = async (userId: string, isPremium: boolean) => {
    try {
      setUpdatingUser(userId)
      const response = await fetch(`/api/admin/users/${userId}/premium`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPremium: !isPremium }),
      })

      if (!response.ok) throw new Error("Failed to update premium status")

      setUsers(users.map((user) => (user.userId === userId ? { ...user, isPremium: !isPremium } : user)))

      console.log("[v0] Premium status updated for user:", userId)
    } catch (error) {
      console.error("[v0] Error updating premium:", error)
    } finally {
      setUpdatingUser(null)
    }
  }

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName} and all their websites? This cannot be undone.`)) {
      return
    }

    try {
      setUpdatingUser(userId)
      const response = await fetch(`/api/admin/users/${userId}/delete`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete user")

      setUsers(users.filter((user) => user.userId !== userId))
      console.log("[v0] User deleted:", userId)
    } catch (error) {
      console.error("[v0] Error deleting user:", error)
      alert("Failed to delete user")
    } finally {
      setUpdatingUser(null)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const formatDateTime = (value?: string) => {
    if (!value) return "—"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "—"
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatUptime = (seconds?: number) => {
    if (!seconds || Number.isNaN(seconds)) return "—"
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const toggleBlock = async (userId: string, isBlocked: boolean) => {
    try {
      setUpdatingUser(userId)
      const response = await fetch(`/api/admin/users/${userId}/block`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !isBlocked }),
      })

      if (!response.ok) throw new Error("Failed to update block status")

      setUsers(users.map((user) => (user.userId === userId ? { ...user, isBlocked: !isBlocked } : user)))
      toast.success(`User ${!isBlocked ? "blocked" : "unblocked"} successfully`)
    } catch (error) {
      console.error("[v0] Error updating block status:", error)
      toast.error("Failed to update block status")
    } finally {
      setUpdatingUser(null)
    }
  }

  const saveSubscription = async (userId: string, subscription: string) => {
    try {
      setUpdatingUser(userId)
      const response = await fetch(`/api/admin/users/${userId}/subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription }),
      })

      if (!response.ok) throw new Error("Failed to update subscription")

      const isPremium = subscription !== "Free"
      setUsers(users.map((user) => (user.userId === userId ? { ...user, subscription, isPremium } : user)))
      toast.success(`Subscription updated to ${subscription}`)
    } catch (error) {
      console.error("[v0] Error updating subscription:", error)
      toast.error("Failed to update subscription")
    } finally {
      setUpdatingUser(null)
    }
  }

  const userInitials = session?.user?.name
    ?.split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase() || "A"

  const blockedCount = users.filter(u => u.isBlocked).length

  // VPS Runner functions
  const fetchVpsStatus = async () => {
    setVpsLoading(true)
    try {
      const [statusRes, websitesRes] = await Promise.all([
        fetch("/api/admin/vps-runner/status"),
        fetch("/api/admin/vps-runner/websites"),
      ])
      const statusData = await statusRes.json().catch(() => null)
      if (statusData) {
        setVpsStatus(statusData)
      }
      const websitesData = await websitesRes.json().catch(() => null)
      if (websitesData?.websites) {
        setVpsWebsites(websitesData.websites)
      } else if (Array.isArray(websitesData)) {
        setVpsWebsites(websitesData)
      }
    } catch (err) {
      console.error("Failed to fetch VPS status:", err)
      setVpsStatus({ success: false, online: false, error: "Runner offline" })
    } finally {
      setVpsLoading(false)
    }
  }

  const fetchRunnerSetupStatus = async (includeLogs: boolean = false) => {
    setRunnerSetupLoading(true)
    try {
      const res = await fetch(`/api/admin/vps-runner/setup${includeLogs ? "?logs=1" : ""}`)
      const data = await res.json().catch(() => null)
      if (data?.success) {
        setRunnerSetupStatus(data)
        if (Array.isArray(data.logs)) {
          setRunnerSetupLogs(data.logs)
        }
      } else if (data?.error) {
        toast.error(data.error)
      }
    } catch (err) {
      console.error("Failed to fetch setup status:", err)
    } finally {
      setRunnerSetupLoading(false)
    }
  }

  const refreshRunner = async () => {
    await Promise.all([fetchVpsStatus(), fetchRunnerSetupStatus()])
  }

  const handleWebsiteAction = async (id: string, action: WebsiteAction) => {
    try {
      const res = await fetch(`/api/admin/vps-runner/websites/${id}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success(`Website ${action} successful`)
        setTimeout(fetchVpsStatus, 1000)
      } else {
        toast.error(data.error || `Failed to ${action} website`)
      }
    } catch (err) {
      toast.error(`Failed to ${action} website`)
    }
  }

  const fetchVpsLogs = async (id?: string) => {
    try {
      const targetId = id || selectedWebsiteId
      if (!targetId) return
      const res = await fetch(
        `/api/admin/vps-runner/websites/${targetId}/logs?type=${vpsLogType}&limit=${vpsLogLines}`,
      )
      const data = await res.json().catch(() => null)
      setVpsLogs(Array.isArray(data?.logs) ? data.logs : [])
    } catch (err) {
      console.error("Failed to fetch VPS logs:", err)
    }
  }

  const handleVpsAction = async (
    action: RunnerAction,
    options?: { deleteRuntime: boolean; deleteLogs: boolean; deleteProxy: boolean },
  ) => {
    setVpsAction(action)
    try {
      const res = await fetch("/api/admin/vps-runner/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, options }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success(`Runner ${action} successful`)
        setTimeout(fetchVpsStatus, 2000)
        if (action === "setup") {
          setTimeout(() => fetchRunnerSetupStatus(true), 2000)
        }
      } else {
        toast.error(data.error || `Failed to ${action} runner`)
      }
    } catch (err) {
      toast.error(`Failed to ${action} runner`)
    } finally {
      setVpsAction(null)
    }
  }

  const runSetupWizard = async () => {
    setRunnerSetupLoading(true)
    try {
      const res = await fetch("/api/admin/vps-runner/setup", { method: "POST" })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success(data.message || "Setup completed")
        await fetchRunnerSetupStatus(true)
        await fetchVpsStatus()
      } else {
        toast.error(data.error || "Setup failed")
      }
    } catch (error) {
      toast.error("Setup failed")
    } finally {
      setRunnerSetupLoading(false)
    }
  }

  const handleCopyLogs = async () => {
    if (!vpsLogs.length) return
    try {
      await navigator.clipboard.writeText(vpsLogs.join("\n"))
      toast.success("Logs copied to clipboard")
    } catch (error) {
      toast.error("Failed to copy logs")
    }
  }

  const handleDownloadLogs = () => {
    if (!vpsLogs.length) return
    const content = vpsLogs.join("\n")
    const blob = new Blob([content], { type: "text/plain" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    const fileName = `${selectedWebsiteId || "runner"}-${vpsLogType}.log`
    anchor.href = url
    anchor.download = fileName
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const handleDestroyRunner = async () => {
    if (destroyConfirm !== "DESTROY") return
    await handleVpsAction("destroy", destroyOptions)
    setDestroyDialogOpen(false)
    setDestroyConfirm("")
    setDestroyOptions({ deleteRuntime: false, deleteLogs: false, deleteProxy: false })
  }

  const selectedWebsite = vpsWebsites.find((site) => site.id === selectedWebsiteId)
  const websiteStats = {
    total: vpsStatus?.websites?.total ?? vpsWebsites.length,
    running:
      vpsStatus?.websites?.running ??
      vpsWebsites.filter((site) => site.status === "running").length,
    failed:
      vpsStatus?.websites?.failed ??
      vpsWebsites.filter((site) => site.status === "failed").length,
    healthy:
      vpsStatus?.websites?.healthy ??
      vpsWebsites.filter((site) => site.health === "healthy").length,
    unhealthy:
      vpsStatus?.websites?.unhealthy ??
      vpsWebsites.filter((site) => site.health === "unhealthy").length,
  }

  const cpuUsage = vpsStatus?.cpu?.usagePercent
  const memoryUsage = vpsStatus?.memory?.usagePercent
  const diskUsage = vpsStatus?.disk?.usagePercent
  const setupChecks = [
    { key: "nodeOk", label: "Node.js LTS" },
    { key: "npmOk", label: "npm" },
    { key: "pm2Ok", label: "PM2 / service" },
    { key: "proxyOk", label: "Proxy (Nginx/Caddy)" },
    { key: "cloudflaredOk", label: "Cloudflared" },
    { key: "directoriesOk", label: "Directories" },
    { key: "serviceOk", label: "Runner service" },
  ] as const

  return (
    <div className="min-h-screen bg-[#101010]">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 bg-[#101010]/95 backdrop-blur-xl z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4 md:gap-6">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={28} height={28} />
              <span className="text-lg font-semibold text-white">Sycord</span>
              <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 bg-white/5 text-white/70 border-white/10 font-semibold rounded-full">
                Admin
              </Badge>
            </Link>

            {/* Desktop Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-1">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      activeTab === tab.id
                        ? "text-white bg-white/10"
                        : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            {/* Mobile Navigation */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-[#1a1a1a] border-white/5">
                <div className="flex items-center gap-2 mb-6 mt-4">
                  <Image src="/logo.png" alt="Logo" width={28} height={28} />
                  <span className="text-lg font-semibold text-white">Admin Panel</span>
                </div>
                <nav className="flex flex-col gap-1">
                  {tabs.map((tab) => {
                    const Icon = tab.icon
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors text-left ${
                          activeTab === tab.id
                            ? "text-white bg-white/10"
                            : "text-white/40 hover:text-white/70 hover:bg-white/5"
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                        {tab.label}
                      </button>
                    )
                  })}
                  <div className="border-t border-white/5 mt-4 pt-4">
                    <button
                      onClick={() => router.push("/dashboard")}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-white/40 hover:text-white/70 hover:bg-white/5 w-full text-left"
                    >
                      <ArrowLeft className="h-5 w-5" />
                      Back to Dashboard
                    </button>
                  </div>
                </nav>
              </SheetContent>
            </Sheet>

            {/* User Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                  <Avatar className="h-9 w-9">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                    <AvatarFallback className="bg-purple-500 text-white text-xs font-semibold">{userInitials}</AvatarFallback>
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
                <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  <span>Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push("/subscriptions")}>
                  <Zap className="mr-2 h-4 w-4" />
                  <span>Plans</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6 md:py-8 max-w-7xl">

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Overview</h2>
              <p className="text-sm text-white/40">Platform statistics at a glance</p>
            </div>

            <div className="overflow-x-auto scrollbar-hide pb-2">
              <div className="flex gap-4 w-max md:w-full md:grid md:grid-cols-4">
                <div className="w-40 md:w-auto rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5">
                  <div className="h-9 w-9 rounded-xl bg-white/5 flex items-center justify-center mb-3">
                    <Users className="h-4 w-4 text-white/60" />
                  </div>
                  <p className="text-2xl font-bold text-white">{users.length}</p>
                  <p className="text-xs text-white/30 mt-1">Total Users</p>
                </div>

                <div className="w-40 md:w-auto rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5">
                  <div className="h-9 w-9 rounded-xl bg-yellow-500/10 flex items-center justify-center mb-3">
                    <Zap className="h-4 w-4 text-yellow-500" />
                  </div>
                  <p className="text-2xl font-bold text-white">{users.filter((u) => u.isPremium).length}</p>
                  <p className="text-xs text-white/30 mt-1">Premium</p>
                </div>

                <div className="w-40 md:w-auto rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5">
                  <div className="h-9 w-9 rounded-xl bg-blue-500/10 flex items-center justify-center mb-3">
                    <Globe2 className="h-4 w-4 text-blue-500" />
                  </div>
                  <p className="text-2xl font-bold text-white">
                    {users.reduce((acc, u) => acc + u.projectCount, 0)}
                  </p>
                  <p className="text-xs text-white/30 mt-1">Websites</p>
                </div>

                <div className="w-40 md:w-auto rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5">
                  <div className="h-9 w-9 rounded-xl bg-red-500/10 flex items-center justify-center mb-3">
                    <Ban className="h-4 w-4 text-red-500" />
                  </div>
                  <p className="text-2xl font-bold text-white">{blockedCount}</p>
                  <p className="text-xs text-white/30 mt-1">Blocked</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Users</h2>
                <p className="text-sm text-white/40">{users.length} registered accounts</p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30" />
                <Input
                  placeholder="Search users..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-10 bg-white/[0.03] border-white/[0.06] text-sm text-white placeholder:text-white/30 rounded-xl focus:ring-white/10"
                />
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-white/30 mb-3" />
                <p className="text-sm text-white/30">Loading users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.06]">
                <Users className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm font-medium text-white/60">No users found</p>
                <p className="text-xs text-white/30 mt-1">Try adjusting your search</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredUsers.map((user) => (
                  <div key={user.userId} className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] overflow-hidden">
                    <div className="p-4 sm:p-5">
                      <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <Avatar className="h-12 w-12 flex-shrink-0">
                          <AvatarFallback className="bg-white/5 text-white/60 text-sm font-semibold rounded-xl">
                            {user.name.charAt(0).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        {/* User Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-sm font-semibold text-white">{user.name}</h3>
                            {user.email === "dmarton336@gmail.com" && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-white/5 text-white/50 border-white/10 rounded-full">Admin</Badge>
                            )}
                            {user.isPremium && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-yellow-500/10 text-yellow-500 border-yellow-500/20 rounded-full">
                                {user.subscription === "Sycord Enterprise" ? "Enterprise" : "Sycord+"}
                              </Badge>
                            )}
                            {user.isBlocked && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 bg-red-500/10 text-red-500 border-red-500/20 rounded-full">Blocked</Badge>
                            )}
                          </div>

                          <p className="text-[11px] text-white/20 font-mono mt-0.5">#{user.userId.slice(-8)}</p>

                          <div className="flex items-center gap-1.5 mt-1">
                            <Mail className="h-3 w-3 text-white/20 flex-shrink-0" />
                            <span className="text-xs text-white/40 truncate">{user.email}</span>
                          </div>

                          {/* Websites */}
                          {user.websites.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-3">
                              {user.websites.map((website) => (
                                <a
                                  key={website.id}
                                  href={`https://${website.subdomain}.pages.dev`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] rounded-lg px-2 py-1 text-xs transition-colors group"
                                >
                                  <Globe2 className="h-3 w-3 text-white/20" />
                                  <span className="font-medium text-white/60">{website.businessName}</span>
                                  <ExternalLink className="h-2.5 w-2.5 text-white/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </a>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Right side: joined date */}
                        <div className="hidden sm:block text-right flex-shrink-0">
                          <p className="text-[11px] text-white/20">joined:</p>
                          <p className="text-xs text-white/40">{formatDate(user.createdAt)}</p>
                        </div>
                      </div>

                      {/* Actions row */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/[0.04]">
                        {/* Plan selector dropdown */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={updatingUser === user.userId}
                              className="h-8 flex items-center gap-2 px-3 rounded-lg bg-white/[0.04] border border-white/[0.06] text-xs font-medium text-white/50 hover:bg-white/[0.08] hover:text-white/70 transition-colors disabled:opacity-50"
                            >
                              <Settings className="h-3.5 w-3.5" />
                              {user.subscription || (user.isPremium ? "Sycord+" : "Free")}
                              <ChevronDown className="h-3 w-3 text-white/30" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="min-w-[140px]">
                            <DropdownMenuLabel className="text-[10px] text-muted-foreground">Change Plan</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => saveSubscription(user.userId, "Free")} className="text-xs">
                              Free
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => saveSubscription(user.userId, "Sycord+")} className="text-xs">
                              <Zap className="h-3 w-3 mr-1.5 text-yellow-500" />
                              Sycord+
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => saveSubscription(user.userId, "Sycord Enterprise")} className="text-xs">
                              <Shield className="h-3 w-3 mr-1.5 text-purple-500" />
                              Enterprise
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>

                        <div className="flex-1" />

                        {/* Suspend button */}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleBlock(user.userId, user.isBlocked)}
                          disabled={updatingUser === user.userId}
                          className={`h-8 px-3 rounded-lg text-[11px] font-medium border transition-colors ${
                            user.isBlocked
                              ? "bg-green-500/10 border-green-500/20 text-green-400 hover:bg-green-500/20 hover:text-green-300"
                              : "bg-white/[0.03] border-white/[0.06] text-white/40 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20"
                          }`}
                        >
                          {user.isBlocked ? (
                            <><UserCheck className="h-3 w-3 mr-1.5" />Unsuspend</>
                          ) : (
                            <><Ban className="h-3 w-3 mr-1.5" />Suspend</>
                          )}
                        </Button>

                        {/* Delete */}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/20 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
                          onClick={() => deleteUser(user.userId, user.name)}
                          disabled={updatingUser === user.userId}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Server Tab */}
        {activeTab === "server" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Server Monitors</h2>
              <p className="text-sm text-white/40">Service status and configuration</p>
            </div>

            {monitorsLoading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-white/30 mb-3" />
                <p className="text-sm text-white/30">Loading monitors...</p>
              </div>
            ) : monitors.length === 0 ? (
              <div className="text-center py-16 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.06]">
                <Server className="h-10 w-10 text-white/10 mx-auto mb-3" />
                <p className="text-sm font-medium text-white/60">No monitors found</p>
                <p className="text-xs text-white/30 mt-1">Check your Cronitor configuration</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {monitors.map((monitor) => (
                  <div key={monitor.id} className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5">
                      <div className="flex items-start gap-3 mb-4">
                        <div className={`mt-0.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${
                          monitor.statusCode === 200
                            ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.4)]'
                            : 'bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.4)]'
                        }`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-white truncate">{monitor.name}</p>
                          <p className="text-[11px] text-white/30 font-mono truncate mt-0.5">{monitor.id}</p>
                        </div>
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 py-0 h-5 flex-shrink-0 rounded-full ${
                            monitor.statusCode === 200
                              ? 'border-green-500/30 text-green-500 bg-green-500/5'
                              : 'border-red-500/30 text-red-500 bg-red-500/5'
                          }`}
                        >
                          {monitor.statusCode === 200 ? 'Online' : 'Offline'}
                        </Badge>
                      </div>

                      <div className="border-t border-white/[0.04] pt-4">
                        {editingIcon === monitor.id ? (
                          <div className="space-y-3 bg-white/[0.03] p-3 rounded-xl border border-white/[0.06]">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-white">Choose Icon</p>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-white/40 hover:text-white" onClick={() => setEditingIcon(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            <div>
                              <p className="text-[11px] text-white/30 mb-2">Presets</p>
                              <div className="flex flex-wrap gap-1.5">
                                {availableIcons.map((item) => {
                                  const Icon = item.icon
                                  return (
                                    <button
                                      key={item.name}
                                      onClick={() => updateMonitorIcon(monitor.id, item.name, 'preset')}
                                      className={`p-2 rounded-lg transition-colors ${
                                        monitor.providerIcon === item.name && monitor.iconType !== 'custom'
                                          ? 'bg-white/10 text-white ring-1 ring-white/20'
                                          : 'text-white/30 hover:text-white/60 hover:bg-white/5'
                                      }`}
                                      title={item.name}
                                    >
                                      <Icon className="h-4 w-4" />
                                    </button>
                                  )
                                })}
                              </div>
                            </div>

                            <div className="border-t border-white/[0.04] pt-3">
                              <p className="text-[11px] text-white/30 mb-2">Custom (PNG/JPG, max 1MB)</p>
                              <label
                                htmlFor={`icon-upload-${monitor.id}`}
                                className="flex items-center justify-center gap-2 px-3 py-2 bg-white/10 text-white rounded-lg cursor-pointer hover:bg-white/15 transition-colors text-xs font-medium"
                              >
                                {uploadingIcon === monitor.id ? (
                                  <>
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-3.5 w-3.5" />
                                    Upload Image
                                  </>
                                )}
                                <input
                                  type="file"
                                  id={`icon-upload-${monitor.id}`}
                                  className="hidden"
                                  accept="image/*"
                                  onChange={(e) => handleIconUpload(monitor.id, e)}
                                  disabled={uploadingIcon === monitor.id}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 px-2.5 py-1.5 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                              {monitor.iconType === 'custom' ? (
                                <img
                                  src={monitor.providerIcon}
                                  alt="Custom icon"
                                  className="h-4 w-4 object-contain"
                                />
                              ) : (
                                (() => {
                                  const iconName = monitor.providerIcon || "Server"
                                  const iconEntry = availableIcons.find(i => i.name.toLowerCase() === iconName.toLowerCase())
                                  const Icon = iconEntry ? iconEntry.icon : Server
                                  return <Icon className="h-4 w-4 text-white/40" />
                                })()
                              )}
                              <span className="text-xs font-medium text-white/60">
                                {monitor.iconType === 'custom' ? 'Custom' : (monitor.providerIcon || "Server")}
                              </span>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditingIcon(monitor.id)}
                              className="h-8 text-xs text-white/30 hover:text-white/60"
                            >
                              <ImageIcon className="h-3.5 w-3.5 mr-1.5" />
                              Change
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Runner Tab */}
        {activeTab === "runner" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Runner</h2>
                <p className="text-sm text-white/40">
                  Manage the Ubuntu mini-server that builds and runs generated Next.js websites.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {vpsLoading ? (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-white/10 text-white/40 bg-white/5 rounded-full">
                    Checking...
                  </Badge>
                ) : vpsStatus?.online ? (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-green-500/30 text-green-500 bg-green-500/5 rounded-full">
                    Online
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-red-500/30 text-red-500 bg-red-500/5 rounded-full">
                    Offline
                  </Badge>
                )}
                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-white/10 text-white/50 bg-white/5 rounded-full">
                  Version: {vpsStatus?.version || "—"}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 border-white/10 text-white/50 bg-white/5 rounded-full">
                  Heartbeat: {formatDateTime(vpsStatus?.updatedAt)}
                </Badge>
                <Badge
                  variant="outline"
                  className={`text-[10px] px-2 py-0 h-5 rounded-full ${
                    vpsStatus?.cloudflared?.running
                      ? "border-blue-500/30 text-blue-400 bg-blue-500/5"
                      : "border-white/10 text-white/40 bg-white/5"
                  }`}
                >
                  Tunnel: {vpsStatus?.cloudflared?.running ? "Online" : "Offline"}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshRunner}
                  className="text-white/40 hover:text-white"
                >
                  <RotateCcw className="h-4 w-4 mr-1.5" />
                  Refresh
                </Button>
              </div>
            </div>

            {/* Performance cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Cpu className="h-4 w-4 text-blue-400" />
                  CPU Usage
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">{cpuUsage != null ? `${cpuUsage}%` : "—"}</p>
                  <p className="text-[11px] text-white/30">{vpsStatus?.cpu?.cores ? `${vpsStatus.cpu.cores} cores` : "—"}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Activity className="h-4 w-4 text-purple-400" />
                  Memory Usage
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">
                    {memoryUsage != null ? `${memoryUsage}%` : "—"}
                  </p>
                  <p className="text-[11px] text-white/30">
                    {vpsStatus?.memory?.usedMb != null && vpsStatus?.memory?.totalMb != null
                      ? `${vpsStatus.memory.usedMb} / ${vpsStatus.memory.totalMb} MB`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <HardDrive className="h-4 w-4 text-emerald-400" />
                  Disk Usage
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">{diskUsage != null ? `${diskUsage}%` : "—"}</p>
                  <p className="text-[11px] text-white/30">
                    {vpsStatus?.disk?.usedGb != null && vpsStatus?.disk?.totalGb != null
                      ? `${vpsStatus.disk.usedGb} / ${vpsStatus.disk.totalGb} GB`
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Calendar className="h-4 w-4 text-white/40" />
                  Uptime
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">{formatUptime(vpsStatus?.uptimeSeconds)}</p>
                  <p className="text-[11px] text-white/30">{vpsStatus?.hostname || "—"}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Server className="h-4 w-4 text-blue-300" />
                  Running Websites
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">{websiteStats.running}</p>
                  <p className="text-[11px] text-white/30">Total {websiteStats.total}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <AlertCircle className="h-4 w-4 text-red-400" />
                  Failed Websites
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">{websiteStats.failed}</p>
                  <p className="text-[11px] text-white/30">Stopped {vpsStatus?.websites?.stopped ?? "—"}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Check className="h-4 w-4 text-green-400" />
                  Healthy
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">{websiteStats.healthy}</p>
                  <p className="text-[11px] text-white/30">Unhealthy {websiteStats.unhealthy}</p>
                </div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <Cloud className="h-4 w-4 text-blue-400" />
                  Cloudflared
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-2xl font-semibold text-white">
                    {vpsStatus?.cloudflared?.running ? "Running" : "Stopped"}
                  </p>
                  <p className="text-[11px] text-white/30">
                    {vpsStatus?.cloudflared?.tunnelName || "Tunnel"}
                  </p>
                </div>
              </div>
            </div>

            {/* Action bar */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Runner Actions</h3>
                  <p className="text-xs text-white/40">Start, stop, setup, or destroy the mini-server runtime.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={() => handleVpsAction("start")}
                    disabled={!!vpsAction}
                    className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
                  >
                    {vpsAction === "start" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Start
                  </Button>
                  <Button
                    onClick={() => handleVpsAction("stop")}
                    disabled={!!vpsAction}
                    variant="outline"
                    className="border-orange-500/30 text-orange-400 hover:bg-orange-500/10 rounded-xl"
                  >
                    {vpsAction === "stop" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Stop
                  </Button>
                  <Button
                    onClick={() => handleVpsAction("setup")}
                    disabled={!!vpsAction}
                    variant="outline"
                    className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 rounded-xl"
                  >
                    {vpsAction === "setup" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Setup
                  </Button>
                  <Dialog open={destroyDialogOpen} onOpenChange={setDestroyDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        disabled={!!vpsAction}
                        variant="outline"
                        className="border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl"
                      >
                        <Trash2 className="h-4 w-4 mr-1.5" />
                        Destroy
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-[#141414] border-white/10 text-white">
                      <DialogHeader>
                        <DialogTitle>Destroy runner runtime?</DialogTitle>
                        <DialogDescription className="text-white/40">
                          This stops websites and removes runtime artifacts. Type DESTROY to confirm.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <Input
                          placeholder="Type DESTROY to confirm"
                          value={destroyConfirm}
                          onChange={(event) => setDestroyConfirm(event.target.value)}
                          className="bg-white/[0.03] border-white/10 text-white placeholder:text-white/30"
                        />
                        <div className="space-y-2">
                          <label className="flex items-center gap-2 text-xs text-white/60">
                            <Checkbox
                              checked={destroyOptions.deleteRuntime}
                              onCheckedChange={(value) =>
                                setDestroyOptions((prev) => ({ ...prev, deleteRuntime: Boolean(value) }))
                              }
                            />
                            Delete runtime files
                          </label>
                          <label className="flex items-center gap-2 text-xs text-white/60">
                            <Checkbox
                              checked={destroyOptions.deleteLogs}
                              onCheckedChange={(value) =>
                                setDestroyOptions((prev) => ({ ...prev, deleteLogs: Boolean(value) }))
                              }
                            />
                            Delete logs (optional)
                          </label>
                          <label className="flex items-center gap-2 text-xs text-white/60">
                            <Checkbox
                              checked={destroyOptions.deleteProxy}
                              onCheckedChange={(value) =>
                                setDestroyOptions((prev) => ({ ...prev, deleteProxy: Boolean(value) }))
                              }
                            />
                            Delete proxy configs
                          </label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="ghost"
                          className="text-white/60"
                          onClick={() => setDestroyDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleDestroyRunner}
                          disabled={destroyConfirm !== "DESTROY" || vpsAction === "destroy"}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          {vpsAction === "destroy" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                          Destroy
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>

            {/* Setup wizard panel */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 space-y-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">Setup Wizard</h3>
                  <p className="text-xs text-white/40">Verify dependencies and provisioning steps for the mini-server.</p>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-2 py-0 h-5 rounded-full ${
                        runnerSetupStatus?.setupComplete
                          ? "border-green-500/30 text-green-400 bg-green-500/5"
                          : "border-yellow-500/30 text-yellow-400 bg-yellow-500/5"
                      }`}
                    >
                      {runnerSetupStatus?.setupComplete ? "Setup complete" : "Setup incomplete"}
                    </Badge>
                    <span className="text-[11px] text-white/30">
                      Last run: {formatDateTime(runnerSetupStatus?.lastSetupAt)}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    onClick={runSetupWizard}
                    disabled={runnerSetupLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                  >
                    {runnerSetupLoading ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                    Run setup wizard
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 text-white/60 hover:text-white rounded-xl"
                    onClick={() => fetchRunnerSetupStatus()}
                    disabled={runnerSetupLoading}
                  >
                    Refresh status
                  </Button>
                  <Button
                    variant="ghost"
                    className="text-white/40 hover:text-white"
                    onClick={() => {
                      const nextOpen = !runnerSetupLogsOpen
                      setRunnerSetupLogsOpen(nextOpen)
                      if (nextOpen) {
                        fetchRunnerSetupStatus(true)
                      }
                    }}
                  >
                    {runnerSetupLogsOpen ? "Hide setup logs" : "View setup logs"}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {setupChecks.map((check) => {
                  const ok = runnerSetupStatus ? runnerSetupStatus[check.key] : false
                  return (
                    <div key={check.key} className="rounded-xl bg-black/20 border border-white/[0.06] p-3 flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-white">{check.label}</p>
                        <p className="text-[11px] text-white/30">{ok ? "Ready" : "Needs setup"}</p>
                      </div>
                      {ok ? (
                        <Check className="h-4 w-4 text-green-400" />
                      ) : (
                        <X className="h-4 w-4 text-yellow-400" />
                      )}
                    </div>
                  )
                })}
              </div>

              {runnerSetupStatus?.missingDependencies?.length ? (
                <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-3 text-xs text-yellow-200">
                  Missing dependencies: {runnerSetupStatus.missingDependencies.join(", ")}
                </div>
              ) : null}

              {runnerSetupLogsOpen && (
                <div className="rounded-xl bg-black/50 border border-white/[0.08] p-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Setup Logs</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-white/40 hover:text-white"
                      onClick={() => fetchRunnerSetupStatus(true)}
                    >
                      Refresh Logs
                    </Button>
                  </div>
                  {runnerSetupLogs.length ? (
                    <div className="max-h-64 overflow-y-auto font-mono text-xs text-zinc-400 space-y-0.5 custom-scrollbar">
                      {runnerSetupLogs.map((line, index) => (
                        <p key={index}>{line}</p>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-white/20 text-center py-6">No setup logs available.</p>
                  )}
                </div>
              )}
            </div>

            {/* Website health table */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-white">Websites</h3>
                  <p className="text-xs text-white/40">Deployment health for each project on the runner.</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="border-white/10 text-white/60 hover:text-white rounded-xl"
                  onClick={fetchVpsStatus}
                >
                  Refresh list
                </Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-white/60">
                  <thead>
                    <tr className="text-left text-[11px] text-white/30">
                      <th className="py-2 pr-4">Project</th>
                      <th className="py-2 pr-4">Domain</th>
                      <th className="py-2 pr-4">Port</th>
                      <th className="py-2 pr-4">Process</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Health</th>
                      <th className="py-2 pr-4">CPU</th>
                      <th className="py-2 pr-4">Memory</th>
                      <th className="py-2 pr-4">Restarts</th>
                      <th className="py-2 pr-4">Last Deploy</th>
                      <th className="py-2 pr-4">Last Health</th>
                      <th className="py-2 pr-4">Last Error</th>
                      <th className="py-2 pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vpsWebsites.length === 0 ? (
                      <tr>
                        <td colSpan={13} className="py-6 text-center text-white/30">
                          No websites deployed.
                        </td>
                      </tr>
                    ) : (
                      vpsWebsites.map((site) => (
                        <tr key={site.id} className="border-t border-white/[0.04]">
                          <td className="py-3 pr-4">
                            <div>
                              <p className="text-white/80 font-medium">{site.name || site.projectId || site.id}</p>
                              <p className="text-[10px] text-white/30">{site.id}</p>
                            </div>
                          </td>
                          <td className="py-3 pr-4">{site.domain || "—"}</td>
                          <td className="py-3 pr-4">{site.port ?? "—"}</td>
                          <td className="py-3 pr-4">{site.processName || "—"}</td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 rounded-full ${
                                site.status === "running"
                                  ? "border-green-500/30 text-green-500 bg-green-500/5"
                                  : site.status === "failed"
                                    ? "border-red-500/30 text-red-500 bg-red-500/5"
                                    : "border-white/10 text-white/40 bg-white/5"
                              }`}
                            >
                              {site.status || "unknown"}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 h-5 rounded-full ${
                                site.health === "healthy"
                                  ? "border-green-500/30 text-green-500 bg-green-500/5"
                                  : site.health === "unhealthy"
                                    ? "border-red-500/30 text-red-500 bg-red-500/5"
                                    : "border-white/10 text-white/40 bg-white/5"
                              }`}
                            >
                              {site.health || "unknown"}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">{site.cpu ?? "—"}</td>
                          <td className="py-3 pr-4">{site.memory ?? "—"}</td>
                          <td className="py-3 pr-4">{site.restartCount ?? "—"}</td>
                          <td className="py-3 pr-4">{site.lastDeploy ? formatDateTime(site.lastDeploy) : "—"}</td>
                          <td className="py-3 pr-4">
                            {site.lastHealthCheck ? formatDateTime(site.lastHealthCheck) : "—"}
                          </td>
                          <td className="py-3 pr-4 text-red-400">{site.lastError || "—"}</td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-white/10 text-white/60"
                                onClick={() => handleWebsiteAction(site.id, "start")}
                              >
                                Start
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-white/10 text-white/60"
                                onClick={() => handleWebsiteAction(site.id, "stop")}
                              >
                                Stop
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-white/10 text-white/60"
                                onClick={() => handleWebsiteAction(site.id, "restart")}
                              >
                                Restart
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-white/10 text-white/60"
                                onClick={() => handleWebsiteAction(site.id, "health-check")}
                              >
                                Health Check
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-white/10 text-white/60"
                                onClick={() => {
                                  setSelectedWebsiteId(site.id)
                                  fetchVpsLogs(site.id)
                                }}
                              >
                                Logs
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 border-red-500/20 text-red-400 hover:bg-red-500/10"
                                onClick={() => handleWebsiteAction(site.id, "destroy-runtime")}
                              >
                                Destroy Runtime
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Logs viewer */}
            <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Logs</p>
                  <p className="text-xs text-white/40">
                    {selectedWebsite ? `${selectedWebsite.name || selectedWebsite.id} • ${selectedWebsite.domain || "—"}` : "Select a website to view logs"}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-full bg-white/[0.03] border border-white/[0.06] p-1">
                    {(["deploy", "build", "runtime", "error", "health"] as RunnerLogType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => setVpsLogType(type)}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                          vpsLogType === type
                            ? "bg-white/10 text-white"
                            : "text-white/40 hover:text-white/70"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/40">
                    Auto-refresh
                    <Switch checked={logsAutoRefresh} onCheckedChange={setLogsAutoRefresh} />
                  </div>
                  <Input
                    type="number"
                    min={50}
                    max={1000}
                    value={vpsLogLines}
                    onChange={(event) => {
                      const value = Number.parseInt(event.target.value, 10)
                      if (Number.isNaN(value)) return
                      setVpsLogLines(Math.min(Math.max(value, 50), 1000))
                    }}
                    className="h-8 w-24 bg-white/[0.03] border-white/10 text-xs text-white/60"
                  />
                  <Button size="sm" variant="ghost" className="h-7" onClick={() => fetchVpsLogs()}>
                    Refresh
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={handleCopyLogs}>
                    Copy
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7" onClick={handleDownloadLogs}>
                    Download
                  </Button>
                </div>
              </div>
              <div className="mt-4">
                {vpsLogs.length > 0 ? (
                  <div className="max-h-[600px] overflow-y-auto font-mono text-xs space-y-0.5 custom-scrollbar">
                    {vpsLogs.map((line, i) => {
                      const lowered = line.toLowerCase()
                      const lineClass = lowered.includes("error")
                        ? "text-red-400"
                        : lowered.includes("warn")
                          ? "text-yellow-400"
                          : "text-zinc-400"
                      return (
                        <p key={i} className={lineClass}>
                          {line}
                        </p>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-white/20 text-center py-8">No logs available.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tickets Tab */}
        {activeTab === "tickets" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Tickets</h2>
              <p className="text-sm text-white/40">Support ticket management</p>
            </div>
            <div className="flex flex-col items-center justify-center py-20 rounded-2xl bg-white/[0.02] border border-dashed border-white/[0.06]">
              <AlertCircle className="h-10 w-10 text-white/10 mb-3" />
              <p className="text-sm font-medium text-white/60">Coming soon</p>
              <p className="text-xs text-white/30 mt-1">Support ticket system is under development</p>
            </div>
          </div>
        )}


        {/* PAP & TOS Tab */}
        {activeTab === "paptos" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Legal Documents</h2>
              <p className="text-sm text-white/40">Privacy policy and terms of service</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Privacy Policy</h3>
                  <p className="text-xs text-white/30">Adatvédelmi Irányelvek</p>
                </div>
                <Textarea
                  className="font-mono text-xs min-h-[280px] bg-white/[0.02] border-white/[0.06] text-white/70 leading-relaxed resize-none rounded-xl"
                  value={privacyPolicy}
                  onChange={(e) => setPrivacyPolicy(e.target.value)}
                />
                <Button
                  onClick={() => toast.success("Privacy policy saved")}
                  size="sm"
                  className="h-8 text-xs bg-white/5 text-white/60 hover:bg-white/10 border border-white/[0.06] rounded-xl"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </Button>
              </div>

              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 space-y-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">Terms of Service</h3>
                  <p className="text-xs text-white/30">ÁSZF</p>
                </div>
                <Textarea
                  className="font-mono text-xs min-h-[280px] bg-white/[0.02] border-white/[0.06] text-white/70 leading-relaxed resize-none rounded-xl"
                  value={termsOfService}
                  onChange={(e) => setTermsOfService(e.target.value)}
                />
                <Button
                  onClick={() => toast.success("Terms of service saved")}
                  size="sm"
                  className="h-8 text-xs bg-white/5 text-white/60 hover:bg-white/10 border border-white/[0.06] rounded-xl"
                >
                  <Save className="h-3.5 w-3.5 mr-1.5" />
                  Save Changes
                </Button>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
