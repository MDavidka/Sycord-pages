"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
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

interface SystemPromptsState {
  builderPlan: string
  builderCode: string
  builderBuild: string
  builderFunction: string
  builderCheatSheet: string
}

const SYSTEM_PROMPT_KEYS: (keyof SystemPromptsState)[] = [
  "builderPlan",
  "builderCode",
  "builderBuild",
  "builderFunction",
  "builderCheatSheet",
]

const tabs = [
  { id: "overview" as const, label: "Overview", icon: BarChart3 },
  { id: "users" as const, label: "Users", icon: Users },
  { id: "server" as const, label: "Server", icon: Server },
  { id: "vps" as const, label: "VPS Runner", icon: Activity },
  { id: "tickets" as const, label: "Tickets", icon: AlertCircle },
  { id: "models" as const, label: "Model Config", icon: Settings },
  { id: "paptos" as const, label: "Legal", icon: BookOpen },
]

type TabId = "overview" | "users" | "server" | "vps" | "tickets" | "models" | "paptos"

export default function AdminPage() {
  const router = useRouter()
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
  const [vpsStatus, setVpsStatus] = useState<any>(null)
  const [vpsLoading, setVpsLoading] = useState(false)
  const [vpsLogs, setVpsLogs] = useState<string[]>([])
  const [vpsAction, setVpsAction] = useState<string | null>(null)
  const [vpsLogType, setVpsLogType] = useState<string>("all")
  const [vpsLogLines, setVpsLogLines] = useState<number>(200)

  // PAP & TOS State
  const [privacyPolicy, setPrivacyPolicy] = useState("Edit your privacy policy here...")
  const [termsOfService, setTermsOfService] = useState("Edit your terms of service here...")

  // Model Config State
  const [thinkerModel, setThinkerModel] = useState("nvidia/nemotron-3-super-120b-a12b:free")
  const [coderModel, setCoderModel] = useState("minimax/minimax-m2.5:free")
  const [modelConfigLoading, setModelConfigLoading] = useState(false)
  const [systemPrompts, setSystemPrompts] = useState<SystemPromptsState>({
    builderPlan: "",
    builderCode: "",
    builderBuild: "",
    builderFunction: "",
    builderCheatSheet: "",
  })
  const [promptsLoading, setPromptsLoading] = useState(false)

  useEffect(() => {
    if (session?.user?.email !== "dmarton336@gmail.com") {
      router.push("/dashboard")
      return
    }

    fetchUsers()
    fetchMonitors()
  }, [session, router])

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
      const res = await fetch("/api/vps/status")
      if (res.ok) {
        const data = await res.json()
        setVpsStatus(data)
      }
    } catch (err) {
      console.error("Failed to fetch VPS status:", err)
    } finally {
      setVpsLoading(false)
    }
  }

  const fetchVpsLogs = async (type?: string, lines?: number) => {
    try {
      const logType = type || vpsLogType
      const logLines = lines || vpsLogLines
      const res = await fetch(`/api/vps/logs?lines=${logLines}&type=${logType}`)
      if (res.ok) {
        const data = await res.json()
        setVpsLogs(Array.isArray(data.logs) ? data.logs : [])
      }
    } catch (err) {
      console.error("Failed to fetch VPS logs:", err)
    }
  }

  const handleVpsAction = async (action: "start" | "stop" | "restart") => {
    setVpsAction(action)
    try {
      const res = await fetch("/api/vps/restart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        toast.success(`Runner ${action} successful`)
        setTimeout(fetchVpsStatus, 2000)
      } else {
        toast.error(data.error || `Failed to ${action} runner`)
      }
    } catch (err) {
      toast.error(`Failed to ${action} runner`)
    } finally {
      setVpsAction(null)
    }
  }

  // Model Config functions
  const fetchModelConfig = async () => {
    setModelConfigLoading(true)
    try {
      const res = await fetch("/api/admin/model-config")
      if (res.ok) {
        const data = await res.json()
        if (data.thinkerModel) setThinkerModel(data.thinkerModel)
        if (data.coderModel) setCoderModel(data.coderModel)
      }
    } catch (err) {
      console.error("Failed to fetch model config:", err)
    } finally {
      setModelConfigLoading(false)
    }
  }

  const saveModelConfig = async () => {
    setModelConfigLoading(true)
    try {
      const res = await fetch("/api/admin/model-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thinkerModel, coderModel }),
      })
      if (res.ok) {
        toast.success("Model configuration saved successfully")
      } else {
        toast.error("Failed to save model configuration")
      }
    } catch (err) {
      console.error("Failed to save model config:", err)
      toast.error("Failed to save model configuration")
    } finally {
      setModelConfigLoading(false)
    }
  }

  const fetchSystemPrompts = async () => {
    setPromptsLoading(true)
    try {
      const res = await fetch("/api/admin/prompts")
      if (!res.ok) {
        toast.error("Failed to load AI prompts")
        return
      }
      const data = await res.json()
      const nextPrompts = SYSTEM_PROMPT_KEYS.reduce<SystemPromptsState>((acc, key) => {
        acc[key] = typeof data[key] === "string" ? data[key] : ""
        return acc
      }, {} as SystemPromptsState)
      setSystemPrompts(nextPrompts)
    } catch (err) {
      console.error("Failed to fetch AI prompts:", err)
      toast.error("Failed to load AI prompts")
    } finally {
      setPromptsLoading(false)
    }
  }

  const saveSystemPrompts = async () => {
    setPromptsLoading(true)
    try {
      const res = await fetch("/api/admin/prompts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(systemPrompts),
      })
      if (res.ok) {
        toast.success("AI prompts saved successfully")
      } else {
        toast.error("Failed to save AI prompts")
      }
    } catch (err) {
      console.error("Failed to save AI prompts:", err)
      toast.error("Failed to save AI prompts")
    } finally {
      setPromptsLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === "models") {
      fetchModelConfig()
      fetchSystemPrompts()
    }
  }, [activeTab])

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

        {/* VPS Runner Tab */}
        {activeTab === "vps" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">VPS Runner</h2>
                <p className="text-sm text-white/40">Manage the Flask deployment runner on VPS</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { fetchVpsStatus(); fetchVpsLogs(); }}
                className="text-white/40 hover:text-white"
              >
                <RotateCcw className="h-4 w-4 mr-1.5" />
                Refresh
              </Button>
            </div>

            {/* Connection Status */}
            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="h-12 w-12 rounded-xl bg-white/[0.06] flex items-center justify-center">
                  <Server className="h-6 w-6 text-zinc-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-white">Ubuntu Server</h3>
                    {vpsLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                    ) : vpsStatus?.online ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-green-500/30 text-green-500 bg-green-500/5 rounded-full">
                        Connected
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 border-red-500/30 text-red-500 bg-red-500/5 rounded-full">
                        Offline
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-white/30 mt-0.5">
                    {vpsStatus?.uptime ? `Uptime: ${vpsStatus.uptime}` : "Click refresh to check status"}
                  </p>
                </div>
              </div>

              {/* Runner Status Indicators */}
              {vpsStatus && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 pt-4 border-t border-white/[0.04]">
                  <div className="text-center">
                    <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.runner ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-[11px] text-white/40">Flask Runner</p>
                  </div>
                  <div className="text-center">
                    <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.tunnel ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-[11px] text-white/40">Tunnel</p>
                  </div>
                  <div className="text-center">
                    <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.httpOk ? 'bg-green-500' : 'bg-red-500'}`} />
                    <p className="text-[11px] text-white/40">HTTP</p>
                  </div>
                  <div className="text-center">
                    <div className={`h-2 w-2 rounded-full mx-auto mb-1.5 ${vpsStatus.npmInstalled ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <p className="text-[11px] text-white/40">npm</p>
                  </div>
                </div>
              )}

              {/* CPU / RAM / Disk Stats */}
              {vpsStatus?.online && (vpsStatus.cpu !== null || vpsStatus.mem?.percent !== null) && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4 pt-4 border-t border-white/[0.04]">
                  {/* CPU */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Cpu className="h-3.5 w-3.5 text-blue-400" />
                      <span className="text-[11px] font-medium text-white/50">CPU</span>
                      <span className="ml-auto text-xs font-semibold text-white">{vpsStatus.cpu != null ? `${vpsStatus.cpu}%` : "—"}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (vpsStatus.cpu ?? 0) > 80 ? 'bg-red-500' : (vpsStatus.cpu ?? 0) > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${Math.min(vpsStatus.cpu ?? 0, 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* RAM */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Activity className="h-3.5 w-3.5 text-purple-400" />
                      <span className="text-[11px] font-medium text-white/50">RAM</span>
                      <span className="ml-auto text-xs font-semibold text-white">
                        {vpsStatus.mem?.used != null && vpsStatus.mem?.total != null
                          ? `${vpsStatus.mem.used} / ${vpsStatus.mem.total} MB`
                          : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          (vpsStatus.mem?.percent ?? 0) > 85 ? 'bg-red-500' : (vpsStatus.mem?.percent ?? 0) > 60 ? 'bg-yellow-500' : 'bg-purple-500'
                        }`}
                        style={{ width: `${Math.min(vpsStatus.mem?.percent ?? 0, 100)}%` }}
                      />
                    </div>
                    {vpsStatus.mem?.percent != null && (
                      <p className="text-[10px] text-white/30 mt-1">{vpsStatus.mem.percent}% used</p>
                    )}
                  </div>

                  {/* Disk */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <HardDrive className="h-3.5 w-3.5 text-emerald-400" />
                      <span className="text-[11px] font-medium text-white/50">Disk</span>
                      <span className="ml-auto text-xs font-semibold text-white">
                        {vpsStatus.disk?.used && vpsStatus.disk?.total
                          ? `${vpsStatus.disk.used} / ${vpsStatus.disk.total}`
                          : "—"}
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          parseInt(vpsStatus.disk?.percent || "0") > 85 ? 'bg-red-500' : parseInt(vpsStatus.disk?.percent || "0") > 60 ? 'bg-yellow-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: vpsStatus.disk?.percent || "0%" }}
                      />
                    </div>
                    {vpsStatus.disk?.percent && (
                      <p className="text-[10px] text-white/30 mt-1">{vpsStatus.disk.percent} used</p>
                    )}
                  </div>
                </div>
              )}

              {/* Warnings */}
              {vpsStatus?.warnings && vpsStatus.warnings.length > 0 && (
                <div className="mt-3 pt-3 border-t border-white/[0.04]">
                  {vpsStatus.warnings.map((w: string, i: number) => (
                    <p key={i} className="text-xs text-yellow-500/70 flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      {w}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              <Button
                onClick={() => handleVpsAction("start")}
                disabled={!!vpsAction}
                className="bg-green-600 hover:bg-green-700 text-white rounded-xl"
              >
                {vpsAction === "start" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
                Start
              </Button>
              <Button
                onClick={() => handleVpsAction("restart")}
                disabled={!!vpsAction}
                variant="outline"
                className="border-white/10 text-white/60 hover:text-white rounded-xl"
              >
                {vpsAction === "restart" ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <RotateCcw className="h-4 w-4 mr-1.5" />}
                Restart
              </Button>
              <Button
                onClick={() => handleVpsAction("stop")}
                disabled={!!vpsAction}
                variant="outline"
                className="border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl"
              >
                Stop
              </Button>
            </div>

            {/* Logs Section */}
            <div className="rounded-2xl bg-black/40 border border-white/[0.06] p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] text-white/30 uppercase tracking-wider font-semibold">Server Logs</p>
                <div className="flex items-center gap-2">
                  {/* Log type selector */}
                  <div className="flex rounded-lg overflow-hidden border border-white/[0.06]">
                    {(["all", "runner", "tunnel", "server"] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => { setVpsLogType(type); fetchVpsLogs(type); }}
                        className={`px-2.5 py-1 text-[10px] font-medium transition-colors ${
                          vpsLogType === type
                            ? "bg-white/10 text-white"
                            : "text-white/30 hover:text-white/60 hover:bg-white/[0.04]"
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                  {/* Line count */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center gap-1 px-2 py-1 rounded-lg border border-white/[0.06] text-[10px] font-medium text-white/40 hover:text-white/60 transition-colors">
                        {vpsLogLines} lines
                        <ChevronDown className="h-2.5 w-2.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[80px]">
                      {[50, 100, 200, 500].map((n) => (
                        <DropdownMenuItem
                          key={n}
                          onClick={() => { setVpsLogLines(n); fetchVpsLogs(undefined, n); }}
                          className="text-xs"
                        >
                          {n} lines
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              {vpsLogs.length > 0 ? (
                <div className="max-h-[600px] overflow-y-auto font-mono text-xs text-zinc-400 space-y-0.5 custom-scrollbar">
                  {vpsLogs.map((line, i) => (
                    <p key={i} className={
                      line.toLowerCase().includes('error') || line.toLowerCase().includes('exception')
                        ? 'text-red-400'
                        : line.toLowerCase().includes('warn')
                          ? 'text-yellow-400'
                          : line.toLowerCase().includes('success') || line.toLowerCase().includes('deployed')
                            ? 'text-green-400'
                            : ''
                    }>
                      {line}
                    </p>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-white/20 text-center py-8">No logs available. Click Refresh to load.</p>
              )}
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

        {/* Model Config Tab */}
        {activeTab === "models" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">AI Model Configuration</h2>
              <p className="text-sm text-white/40">Configure test model provider settings for thinker and coder models</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Thinker Model (Plan Generator)
                  </h3>
                  <p className="text-xs text-white/30 mt-1">Model used for generating architectural plans via OpenRouter</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-white/50">Model Identifier</label>
                  <Input
                    className="font-mono text-xs bg-white/[0.02] border-white/[0.06] text-white/70 rounded-xl"
                    value={thinkerModel}
                    onChange={(e) => setThinkerModel(e.target.value)}
                    placeholder="e.g., nvidia/nemotron-3-super-120b-a12b:free"
                  />
                  <p className="text-[10px] text-white/20">
                    Current: {thinkerModel || "Not configured"}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Coder Model (Code Generator)
                  </h3>
                  <p className="text-xs text-white/30 mt-1">Model used for generating website code via OpenRouter</p>
                </div>
                <div className="space-y-2">
                  <label className="text-xs text-white/50">Model Identifier</label>
                  <Input
                    className="font-mono text-xs bg-white/[0.02] border-white/[0.06] text-white/70 rounded-xl"
                    value={coderModel}
                    onChange={(e) => setCoderModel(e.target.value)}
                    placeholder="e.g., minimax/minimax-m2.5:free"
                  />
                  <p className="text-[10px] text-white/20">
                    Current: {coderModel || "Not configured"}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={saveModelConfig}
                disabled={modelConfigLoading}
                className="bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.06] rounded-xl"
              >
                {modelConfigLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </Button>
              <Button
                onClick={fetchModelConfig}
                disabled={modelConfigLoading}
                variant="outline"
                className="bg-white/[0.02] text-white/60 hover:bg-white/5 border-white/[0.06] rounded-xl"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reload
              </Button>
            </div>

            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 text-xs text-white/50">
                  <p className="font-medium text-white/70">Configuration Notes:</p>
                  <ul className="space-y-1 list-disc list-inside">
                    <li>These models are used when the "test" model (openrouter/test) is selected in the AI Builder</li>
                    <li>Thinker model handles architectural planning and question generation</li>
                    <li>Coder model handles actual website code generation</li>
                    <li>Changes take effect immediately for new generation requests</li>
                    <li>Make sure the model IDs are valid OpenRouter model identifiers</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white">AI Builder Step Prompts (Editable)</h3>
                <p className="text-xs text-white/30 mt-1">
                  These prompts power the new pipeline: Plan JSON → Function JSON → Orchestration (non-AI) → Build.
                </p>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-white/50">Step 1 — Style JSON Planning Prompt (builderPlan)</p>
                <Textarea
                  id="prompt-builder-plan"
                  className="font-mono text-xs min-h-[180px] bg-white/[0.02] border-white/[0.06] text-white/70 leading-relaxed rounded-xl"
                  value={systemPrompts.builderPlan}
                  onChange={(e) => setSystemPrompts(prev => ({ ...prev, builderPlan: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs text-white/50">Step 2 — Function JSON Prompt (builderFunction)</p>
                <Textarea
                  id="prompt-builder-function"
                  className="font-mono text-xs min-h-[220px] bg-white/[0.02] border-white/[0.06] text-white/70 leading-relaxed rounded-xl"
                  value={systemPrompts.builderFunction}
                  onChange={(e) => setSystemPrompts(prev => ({ ...prev, builderFunction: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs text-white/50">Shared Configuration — Cheat Sheet (builderCheatSheet)</p>
                <Textarea
                  id="prompt-builder-cheat-sheet"
                  className="font-mono text-xs min-h-[140px] bg-white/[0.02] border-white/[0.06] text-white/70 leading-relaxed rounded-xl"
                  value={systemPrompts.builderCheatSheet}
                  onChange={(e) => setSystemPrompts(prev => ({ ...prev, builderCheatSheet: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs text-white/50">Legacy Code Prompt (builderCode)</p>
                <Textarea
                  id="prompt-builder-code"
                  className="font-mono text-xs min-h-[140px] bg-white/[0.02] border-white/[0.06] text-white/70 leading-relaxed rounded-xl"
                  value={systemPrompts.builderCode}
                  onChange={(e) => setSystemPrompts(prev => ({ ...prev, builderCode: e.target.value }))}
                />
              </div>

              <div className="space-y-3">
                <p className="text-xs text-white/50">Step 4 — Build Prompt (builderBuild)</p>
                <Textarea
                  id="prompt-builder-build"
                  className="font-mono text-xs min-h-[160px] bg-white/[0.02] border-white/[0.06] text-white/70 leading-relaxed rounded-xl"
                  value={systemPrompts.builderBuild}
                  onChange={(e) => setSystemPrompts(prev => ({ ...prev, builderBuild: e.target.value }))}
                />
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={saveSystemPrompts}
                  disabled={promptsLoading}
                  className="bg-white/5 text-white/80 hover:bg-white/10 border border-white/[0.06] rounded-xl"
                >
                  {promptsLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving prompts...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Prompt Steps
                    </>
                  )}
                </Button>
                <Button
                  onClick={fetchSystemPrompts}
                  disabled={promptsLoading}
                  variant="outline"
                  className="bg-white/[0.02] text-white/60 hover:bg-white/5 border-white/[0.06] rounded-xl"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reload Prompts
                </Button>
              </div>
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
