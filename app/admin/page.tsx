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
import { CONNECTION_PROVIDERS, type ConnectionProviderDef } from "@/lib/connection-providers"
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
  ExternalLink,
  Terminal,
  Monitor,
  Play,
  Square,
  RefreshCw,
  Wrench,
  CheckCircle2,
  XCircle,
  Copy,
  CheckCheck,
  Webhook,
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
  { id: "deployer" as const, label: "Deployer", icon: Monitor },
  { id: "tickets" as const, label: "Tickets", icon: AlertCircle },
  { id: "paptos" as const, label: "Legal", icon: BookOpen },
  { id: "connections" as const, label: "Connections", icon: Webhook },
]

type TabId = "overview" | "users" | "server" | "deployer" | "tickets" | "paptos" | "connections"

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

  // PAP & TOS State
  const [privacyPolicy, setPrivacyPolicy] = useState("Edit your privacy policy here...")
  const [termsOfService, setTermsOfService] = useState("Edit your terms of service here...")

  // Deployer Setup State (env-driven — no on-screen credentials)
  const [deployerSetupRunning, setDeployerSetupRunning] = useState(false)
  const [deployerSetupLogs, setDeployerSetupLogs] = useState<string[]>([])
  const [deployerSetupResult, setDeployerSetupResult] = useState<any>(null)
  const [deployerSetupError, setDeployerSetupError] = useState<string | null>(null)
  const [preflight, setPreflight] = useState<any>(null)
  const [preflightLoading, setPreflightLoading] = useState(false)
  const [tunnelStatus, setTunnelStatus] = useState<string | null>(null)
  const [skipCloudflare, setSkipCloudflare] = useState(false)
  const [connectionCopied, setConnectionCopied] = useState<string | null>(null)

  const connectionCallbackUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/connection/oauth/callback` : '/api/connection/oauth/callback'

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text)
    setConnectionCopied(key)
    setTimeout(() => setConnectionCopied(null), 2000)
  }

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

  // Deployer setup functions
  const fetchPreflight = async () => {
    setPreflightLoading(true)
    try {
      const res = await fetch("/api/admin/vps-runner/preflight", { headers: { Accept: "application/json" } })
      const data = await res.json()
      setPreflight(data)
    } catch (err: any) {
      setPreflight({ error: err?.message || "Preflight request failed" })
    } finally {
      setPreflightLoading(false)
    }
  }

  const runDeployerSetup = async (reset = false) => {
    setDeployerSetupRunning(true)
    setDeployerSetupLogs([])
    setDeployerSetupResult(null)
    setDeployerSetupError(null)
    setTunnelStatus(null)

    try {
      const res = await fetch("/api/admin/vps-runner/setup/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseDomain: "sycord.site",
          skipCloudflare,
          resetTunnel: reset,
        }),
      })

      if (!res.ok || !res.body) throw new Error("Setup stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const blocks = buffer.split("\n\n")
        buffer = blocks.pop() || ""

        for (const block of blocks) {
          const eventLine = block.split("\n").find(l => l.startsWith("event:"))
          const dataLine = block.split("\n").find(l => l.startsWith("data:"))
          if (!eventLine || !dataLine) continue
          const eventType = eventLine.slice(6).trim()
          try {
            const data = JSON.parse(dataLine.slice(5).trim())
            if (eventType === "log") {
              setDeployerSetupLogs(prev => [...prev, data.line || ""])
            } else if (eventType === "stage") {
              setDeployerSetupLogs(prev => [...prev, `[${data.status.toUpperCase()}] ${data.stage}: ${data.message}`])
            } else if (eventType === "result") {
              setDeployerSetupResult(data)
              toast.success("Deployer setup completed")
            } else if (eventType === "tunnel") {
              if (data.type === "status") {
                setTunnelStatus(data.running ? "active" : "inactive")
                if (data.reset) {
                  toast.success("Tunnel reset and rebuilt successfully")
                  setDeployerSetupResult({ success: true, reset: true })
                }
              }
            } else if (eventType === "error") {
              setDeployerSetupError(data.error || "Setup failed")
              toast.error(data.error || "Setup failed")
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setDeployerSetupError(err?.message || "Setup failed")
      toast.error(err?.message || "Setup failed")
    } finally {
      setDeployerSetupRunning(false)
      fetchPreflight()
    }
  }



  useEffect(() => {
    const tab = searchParams.get("tab")
    if (tab && tabs.some((item) => item.id === tab)) setActiveTab(tab as TabId)
  }, [searchParams])

  useEffect(() => {
    if (activeTab === "deployer" && !preflight && !preflightLoading) {
      fetchPreflight()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])
  return (
    <div className="min-h-screen bg-[#18191B]">
      {/* Header */}
      <header className="border-b border-white/5 sticky top-0 bg-[#18191B]/95 backdrop-blur-xl z-50">
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


        {/* Deployer Tab */}
        {activeTab === "deployer" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Setup Deployer</h2>
              <p className="text-sm text-white/40">Configure and deploy the Sycord deployment server on your Ubuntu VPS</p>
            </div>

            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-purple-400" />
                  <h3 className="text-sm font-semibold text-white">Deployer Status</h3>
                </div>
                <Button
                  onClick={fetchPreflight}
                  disabled={preflightLoading}
                  variant="ghost"
                  size="sm"
                  className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl text-xs"
                >
                  <RotateCcw className={`h-3.5 w-3.5 mr-1.5 ${preflightLoading ? "animate-spin" : ""}`} />
                  {preflightLoading ? "Checking..." : "Refresh"}
                </Button>
              </div>

              <p className="text-[11px] text-white/40">
                All credentials are read from the server environment — no IP or root password needed here.
                Run setup once the checks below are green.
              </p>

              {/* Overall readiness banner */}
              {preflight && !preflight.error && (
                <div className={`rounded-xl border p-3 flex items-center gap-2 ${
                  preflight.ready ? "border-emerald-500/30 bg-emerald-500/10" : "border-amber-500/30 bg-amber-500/10"
                }`}>
                  {preflight.ready ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                  )}
                  <span className={`text-xs font-medium ${preflight.ready ? "text-emerald-200" : "text-amber-200"}`}>
                    {preflight.ready
                      ? "All credentials verified — ready to run setup"
                      : "Some checks need attention before setup will succeed"}
                  </span>
                </div>
              )}

              {/* Granular checks */}
              {preflight && !preflight.error && (
                <div className="grid gap-3 lg:grid-cols-2">
                  {/* Environment variables */}
                  <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Environment</h4>
                    {[
                      { label: "VM host", c: preflight.env?.vpsHost?.ok, d: preflight.env?.vpsHost?.source ? `${preflight.env.vpsHost.source} = ${preflight.env.vpsHost.value}` : "not set (VPS_HOST / VPS_SSH_HOST)" },
                      { label: "VM root password", c: preflight.env?.vpsPassword?.ok, d: preflight.env?.vpsPassword?.source || "not set (VPS_ROOT_PSW / VPS_SSH_ROOT_PASSWORD)" },
                      { label: "CLOUDFLARE_API_KEY", c: preflight.env?.cloudflareApiKey?.ok, d: preflight.env?.cloudflareApiKey?.ok ? "set" : "not set" },
                      { label: "CLOUDFLARE_ACCOUNT_ID", c: preflight.env?.cloudflareAccountId?.ok, d: preflight.env?.cloudflareAccountId?.ok ? "set" : "not set" },
                      { label: "CLOUDFLARE_ZONE_ID", c: preflight.env?.cloudflareZoneId?.ok, d: preflight.env?.cloudflareZoneId?.ok ? "set" : "not set" },
                    ].map((row) => (
                      <div key={row.label} className="flex items-start gap-2">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${row.c ? "bg-emerald-500" : "bg-red-500"}`} />
                        <div className="min-w-0">
                          <p className="text-xs text-white/80">{row.label}</p>
                          <p className="text-[10px] text-white/40 font-mono truncate">{row.d}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Connectivity + Cloudflare */}
                  <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4 space-y-2">
                    <h4 className="text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Connectivity</h4>
                    {[
                      { label: "SSH to VM", c: preflight.ssh?.ok, d: preflight.ssh?.detail },
                      { label: `Cloudflare account (${preflight.cloudflare?.authMode || "token"})`, c: preflight.cloudflare?.account?.ok, d: preflight.cloudflare?.account?.detail },
                      { label: "Cloudflare zone", c: preflight.cloudflare?.zone?.ok, d: preflight.cloudflare?.zone?.detail },
                      { label: "Cloudflare tunnel", c: preflight.cloudflare?.tunnel?.ok, d: preflight.cloudflare?.tunnel?.detail },
                    ].map((row) => (
                      <div key={row.label} className="flex items-start gap-2">
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${row.c ? "bg-emerald-500" : "bg-red-500"}`} />
                        <div className="min-w-0">
                          <p className="text-xs text-white/80">{row.label}</p>
                          <p className="text-[10px] text-white/40 font-mono break-words">{row.d}</p>
                        </div>
                      </div>
                    ))}
                    {preflight.diagnostics && (
                      <div className="pt-2 mt-2 border-t border-white/5 space-y-2">
                        {[
                          { label: "Runner :5050", c: preflight.checks?.runnerRunning },
                          { label: "Nginx :80", c: preflight.checks?.nginxRunning },
                          { label: "cloudflared service", c: preflight.checks?.cloudflaredRunning },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full shrink-0 ${row.c ? "bg-emerald-500" : "bg-zinc-600"}`} />
                            <p className="text-xs text-white/70">{row.label}: <span className={row.c ? "text-emerald-300" : "text-zinc-500"}>{row.c ? "active" : "down"}</span></p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {preflight?.error && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  Preflight failed: {preflight.error}
                </div>
              )}

              {/* Actions */}
              <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                <h4 className="text-sm font-medium text-white/70 mb-3">Actions</h4>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={() => runDeployerSetup(false)}
                    disabled={deployerSetupRunning}
                    className="bg-purple-600 hover:bg-purple-700 rounded-xl text-xs"
                  >
                    {deployerSetupRunning ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Wrench className="h-3.5 w-3.5 mr-1.5" />}
                    {deployerSetupRunning ? "Running..." : "Run Setup"}
                  </Button>
                  <Button
                    onClick={() => { if (confirm("This will reinstall the Cloudflare tunnel service on the VM. Continue?")) runDeployerSetup(true) }}
                    disabled={deployerSetupRunning}
                    variant="outline"
                    className="border-red-500/30 text-red-300 hover:bg-red-500/10 rounded-xl text-xs"
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Reset Tunnel
                  </Button>
                </div>
                <label className="flex items-center gap-2 mt-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={skipCloudflare}
                    onChange={(e) => setSkipCloudflare(e.target.checked)}
                    className="w-3.5 h-3.5 rounded border-white/20 bg-black/40"
                  />
                  <span className="text-[11px] text-white/50">Skip Cloudflare Tunnel setup (runner only)</span>
                </label>
              </div>

              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Cloud className="h-4 w-4 text-blue-300" />
                  <span className="text-xs font-medium text-blue-200">Cloudflare Tunnel (automatic)</span>
                </div>
                <p className="text-[11px] text-blue-100/70 leading-relaxed">
                  The tunnel is provisioned automatically through the Cloudflare API — no browser
                  login required. Setup creates one named tunnel, points <span className="font-mono">*.sycord.site</span>{" "}
                  at it, and runs cloudflared on the VM as a 24/7 service. Every deployed project is then
                  reachable at <span className="font-mono">&lt;project&gt;.sycord.site</span>.
                </p>
              </div>

              {tunnelStatus === "active" && (
                <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  <span className="text-xs text-emerald-200">Cloudflare Tunnel connected</span>
                </div>
              )}

              {tunnelStatus === "inactive" && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-400" />
                    <span className="text-xs text-amber-200">
                      Tunnel installed but no edge connections yet — check the VM can reach Cloudflare on outbound port 7844.
                    </span>
                  </div>
                </div>
              )}

              {/* Raw debug */}
              {preflight && (
                <details className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                  <summary className="text-xs font-medium text-white/60 cursor-pointer select-none">Raw preflight JSON</summary>
                  <pre className="text-[10px] text-white/50 font-mono whitespace-pre-wrap mt-3 max-h-64 overflow-y-auto">
                    {JSON.stringify(preflight, null, 2)}
                  </pre>
                </details>
              )}
            </div>

            {/* Setup Logs */}
            {(deployerSetupLogs.length > 0 || deployerSetupRunning || deployerSetupError || deployerSetupResult) && (
              <div className="rounded-2xl bg-black/40 border border-white/[0.08] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-white/40" />
                    <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Setup Output</span>
                    {deployerSetupRunning && <span className="text-[10px] text-amber-400 animate-pulse">Running...</span>}
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto font-mono text-[11px] leading-5 p-4">
                  {deployerSetupLogs.length === 0 ? (
                    <p className="text-zinc-600 text-center py-8">Waiting for output...</p>
                  ) : (
                    deployerSetupLogs.map((line, i) => (
                      <p key={i} className={`${
                        /error|fail|ERR/i.test(line) ? "text-red-300" :
                        /warn/i.test(line) ? "text-amber-300" :
                        /success|complete|ok|active/i.test(line) ? "text-emerald-300" :
                        "text-zinc-400"
                      }`}>{line}</p>
                    ))
                  )}
                </div>
              </div>
            )}

            {deployerSetupResult && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                <CheckCircle2 className="h-4 w-4 inline mr-2" />
                Deployer setup completed successfully.
                {deployerSetupResult.runnerUrl && <span className="block mt-1 text-xs">Runner: {deployerSetupResult.runnerUrl}</span>}
              </div>
            )}

            {deployerSetupError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
                <XCircle className="h-4 w-4 inline mr-2" />
                {deployerSetupError}
              </div>
            )}
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

        {/* Connections Tab */}
        {activeTab === "connections" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div>
              <h2 className="text-lg font-semibold text-white">Connection OAuth Redirect URL</h2>
              <p className="text-sm text-white/40">Configure this URL in your connection provider dashboards for OAuth</p>
            </div>

            <div className="rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/30 mb-1.5 uppercase tracking-wide">OAuth Callback URL</p>
                  <code className="text-sm text-emerald-300 font-mono break-all">{connectionCallbackUrl}</code>
                  <button
                      onClick={() => copyToClipboard(connectionCallbackUrl, "callback")}
                      className="ml-2 px-2 py-1 rounded text-xs font-medium bg-white/10 hover:bg-white/20 text-white/70 transition-colors"
                  >
                      {connectionCopied === "callback" ? "Copied" : "Copy URL"}
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-white mb-3">Configured Providers</h3>
              <p className="text-xs text-white/30 -mt-2 mb-4">OAuth credentials set via server environment variables</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {CONNECTION_PROVIDERS.map((provider: ConnectionProviderDef) => (
                <div
                  key={provider.id}
                  className="rounded-xl bg-white/[0.03] backdrop-blur-xl border border-white/[0.06] p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.04]">
                      <img
                        src={provider.logo}
                        alt={provider.name}
                        className="size-5 object-contain opacity-70"
                      />
                    </div>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-white">{provider.name}</span>
                        <Badge
                          className={`text-[10px] px-1.5 py-0 h-5 ${
                            provider.authType === 'oauth'
                              ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                              : provider.authType === 'api_key'
                              ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          }`}
                          variant="outline"
                        >
                          {provider.authType === 'oauth' ? 'OAuth 2.0' : provider.authType === 'api_key' ? 'API Key' : 'Built-in'}
                        </Badge>
                      </div>
                      <p className="text-xs text-white/40 leading-relaxed">{provider.description}</p>
                      {provider.authType === 'oauth' && (
                        <div className="space-y-1.5 pt-1">
                          {provider.oauthClientIdEnv && (
                            <div className="flex items-center justify-between gap-2">
                              <code className="text-[11px] text-white/30 font-mono">{provider.oauthClientIdEnv}</code>
                              <button
                                onClick={() => copyToClipboard(provider.oauthClientIdEnv || '', `${provider.id}-id`)}
                                className="text-white/20 hover:text-white/40 transition-colors"
                              >
                                {connectionCopied === `${provider.id}-id` ? (
                                  <CheckCheck className="size-3 text-emerald-400" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>
                          )}
                          {provider.oauthClientSecretEnv && (
                            <div className="flex items-center justify-between gap-2">
                              <code className="text-[11px] text-white/30 font-mono">{provider.oauthClientSecretEnv}</code>
                              <button
                                onClick={() => copyToClipboard(provider.oauthClientSecretEnv || '', `${provider.id}-secret`)}
                                className="text-white/20 hover:text-white/40 transition-colors"
                              >
                                {connectionCopied === `${provider.id}-secret` ? (
                                  <CheckCheck className="size-3 text-emerald-400" />
                                ) : (
                                  <Copy className="size-3" />
                                )}
                              </button>
                            </div>
                          )}
                          {provider.oauthScopes && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {provider.oauthScopes.map((scope) => (
                                <code key={scope} className="text-[10px] text-white/25 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">{scope}</code>
                              ))}
                            </div>
                          )}
                          {provider.authorizeUrl && (
                            <p className="text-[11px] text-white/20 font-mono truncate">
                              Auth: {provider.authorizeUrl}
                            </p>
                          )}
                        </div>
                      )}
                      {provider.authType === 'api_key' && provider.envKeys && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {provider.envKeys.map((key) => (
                            <code key={key} className="text-[10px] text-white/25 font-mono bg-white/[0.03] px-1.5 py-0.5 rounded">{key}</code>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>
    </div>
  )
}
