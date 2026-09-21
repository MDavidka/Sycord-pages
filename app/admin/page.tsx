"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Users,
  Cpu,
  Server,
  LifeBuoy,
  LogOut,
  Search,
  Shield,
  AlertTriangle,
  Ban,
  CheckCircle2,
  Activity,
  Coins,
  ChevronRight,
  ExternalLink,
  Plus,
  Minus,
  RefreshCw,
  Loader2,
  ArrowRight,
  Send,
  Megaphone,
  Database,
  Radio,
  Clock,
  Layers,
  Sparkles,
  Zap,
  CheckCheck,
  Globe2,
  Lock,
  ArrowUpRight,
  FileText,
  UserCheck,
  Menu,
  X,
  SlidersHorizontal,
  Sliders,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Menubar,
  MenubarMenu,
  MenubarTrigger,
  MenubarContent,
  MenubarItem,
  MenubarSeparator,
} from "@/components/ui/menubar"
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { MetricCard } from "@/components/moderator/metric-card"
import { CreditDialog } from "@/components/moderator/credit-dialog"
import { BanDialog } from "@/components/moderator/ban-dialog"
import { WarnDialog } from "@/components/moderator/warn-dialog"
import { AnnouncementDialog } from "@/components/moderator/announcement-dialog"
import type {
  ReportItem,
  ModerationAuditLog,
  ServerAnnouncement,
  SupportTicket,
  MonitoringNodeItem,
  MonitoringDatabaseItem,
  MonitoringAnomalyItem,
} from "@/lib/moderator-types"

type ModeratorTab = "general" | "users" | "providers" | "servers" | "tickets"

export default function ModeratorPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [activeTab, setActiveTab] = useState<ModeratorTab>("general")
  const [loading, setLoading] = useState(true)

  // Overview metrics state
  const [metrics, setMetrics] = useState({
    reports: { total: 0, changeText: "— vs. last week" },
    warnings: { total: 0, changeText: "— vs. last week" },
    bans: { total: 0, changeText: "— vs. last week" },
    resolved: { total: 0, changeText: "— vs. last week" },
  })
  const [recentReports, setRecentReports] = useState<ReportItem[]>([])

  // Users state
  const [users, setUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [usersLoading, setUsersLoading] = useState(false)
  const [selectedUser, setSelectedUser] = useState<any | null>(null)

  // Dialogs
  const [creditDialogOpen, setCreditDialogOpen] = useState(false)
  const [creditActionType, setCreditActionType] = useState<"add" | "remove">("add")
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [warnDialogOpen, setWarnDialogOpen] = useState(false)
  const [targetUser, setTargetUser] = useState<any | null>(null)
  const [announcementDialogOpen, setAnnouncementDialogOpen] = useState(false)

  // Usage & Providers state
  const [usageData, setUsageData] = useState<{
    period: string
    summary: { totalInputTokens: number; totalOutputTokens: number; totalTokens: number; totalRequests: number }
    models: any[]
  }>({
    period: "7d",
    summary: { totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, totalRequests: 0 },
    models: [],
  })
  const [usageLoading, setUsageLoading] = useState(false)
  const [usagePeriod, setUsagePeriod] = useState("7d")

  // Servers monitoring state
  const [serverMonitoring, setServerMonitoring] = useState<{
    overview?: any
    databases: MonitoringDatabaseItem[]
    nodes: MonitoringNodeItem[]
    anomalies: MonitoringAnomalyItem[]
  }>({
    databases: [],
    nodes: [],
    anomalies: [],
  })
  const [serverLoading, setServerLoading] = useState(false)

  // Tickets & Announcements state
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [announcements, setAnnouncements] = useState<ServerAnnouncement[]>([])
  const [ticketReplyText, setTicketReplyText] = useState<Record<string, string>>({})
  const [ticketsLoading, setTicketsLoading] = useState(false)
  const [auditLogs, setAuditLogs] = useState<ModerationAuditLog[]>([])

  // Auth Guard
  useEffect(() => {
    if (status === "loading") return
    if (session?.user?.email !== "dmarton336@gmail.com") {
      router.push("/dashboard")
    }
  }, [session, status, router])

  // Load General Overview on Mount
  useEffect(() => {
    fetchOverview()
  }, [])

  // Tab-specific data fetching
  useEffect(() => {
    if (activeTab === "users") fetchUsers()
    if (activeTab === "providers") fetchUsage()
    if (activeTab === "servers") fetchServerMonitoring()
    if (activeTab === "tickets") {
      fetchTickets()
      fetchAnnouncements()
      fetchAuditLogs()
    }
  }, [activeTab])

  // Debounced search for users
  useEffect(() => {
    if (activeTab !== "users") return
    const timer = setTimeout(() => {
      fetchUsers(userSearch)
    }, 300)
    return () => clearTimeout(timer)
  }, [userSearch])

  const fetchOverview = async () => {
    setLoading(true)
    try {
      const [overviewRes, monRes] = await Promise.all([
        fetch("/api/moderator/overview").then((r) => r.json()).catch(() => null),
        fetch("/api/moderator/monitoring").then((r) => r.json()).catch(() => null),
      ])
      if (overviewRes?.ok) {
        setMetrics(overviewRes.metrics)
        setRecentReports(overviewRes.recentReports || [])
      }
      if (monRes?.ok) {
        setServerMonitoring(monRes)
      }
    } catch (e) {
      console.error("Error fetching overview:", e)
    } finally {
      setLoading(false)
    }
  }

  const fetchUsers = async (query = "") => {
    setUsersLoading(true)
    try {
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(query)}&limit=50`)
      const data = await res.json()
      if (data.ok && Array.isArray(data.users)) {
        setUsers(data.users)
      } else if (Array.isArray(data)) {
        setUsers(data)
      }
    } catch (e) {
      console.error("Error fetching users:", e)
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchUsage = async (period = usagePeriod) => {
    setUsageLoading(true)
    try {
      const res = await fetch(`/api/moderator/usage?period=${encodeURIComponent(period)}`)
      const data = await res.json()
      if (data.ok) {
        setUsageData(data)
      }
    } catch (e) {
      console.error("Error fetching usage:", e)
    } finally {
      setUsageLoading(false)
    }
  }

  const fetchServerMonitoring = async () => {
    setServerLoading(true)
    try {
      const res = await fetch("/api/moderator/monitoring")
      const data = await res.json()
      if (data.ok) {
        setServerMonitoring(data)
      }
    } catch (e) {
      console.error("Error fetching monitoring:", e)
    } finally {
      setServerLoading(false)
    }
  }

  const fetchTickets = async () => {
    setTicketsLoading(true)
    try {
      const res = await fetch("/api/moderator/tickets")
      const data = await res.json()
      if (data.ok) setTickets(data.tickets || [])
    } catch (e) {
      console.error("Error fetching tickets:", e)
    } finally {
      setTicketsLoading(false)
    }
  }

  const fetchAnnouncements = async () => {
    try {
      const res = await fetch("/api/announcements")
      const data = await res.json()
      if (data.ok) setAnnouncements(data.announcements || [])
    } catch (e) {
      console.error("Error fetching announcements:", e)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch("/api/moderator/audit?limit=30")
      const data = await res.json()
      if (data.ok) setAuditLogs(data.logs || [])
    } catch (e) {
      console.error("Error fetching audit logs:", e)
    }
  }

  const handleResolveReport = async (reportId: string, status: "resolved" | "dismissed") => {
    try {
      const res = await fetch("/api/moderator/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, status }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Case marked as ${status}`)
        fetchOverview()
      } else {
        toast.error(data.error || "Failed to update case")
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleToggleAnnouncement = async (id: string, currentActive: boolean) => {
    try {
      const res = await fetch("/api/announcements", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active: !currentActive }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(`Announcement ${!currentActive ? "activated" : "deactivated"}`)
        fetchAnnouncements()
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const handleTicketAction = async (ticketId: string, status?: string) => {
    const reply = ticketReplyText[ticketId] || ""
    try {
      const res = await fetch("/api/moderator/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId,
          status,
          replyMessage: reply.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success("Ticket updated successfully")
        setTicketReplyText((prev) => ({ ...prev, [ticketId]: "" }))
        fetchTickets()
      } else {
        toast.error(data.error || "Failed to update ticket")
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#181818] text-[#E5E7EB] flex flex-col md:flex-row antialiased font-sans">
      {/* Mobile Top Navbar with Sycord Icon & Menu trigger */}
      <div className="md:hidden flex items-center justify-between h-14 px-4 bg-[#1c1c1e] border-b border-[#2A2C30] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#242528] border border-[#2A2C30] p-1 flex items-center justify-center shrink-0">
            <Image src="/logo.png" alt="Sycord Logo" width={22} height={22} className="rounded object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#E5E7EB] leading-none">Sycord</span>
              <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium">
                Moderator
              </Badge>
            </div>
            <p className="text-[10px] text-[#777B82] leading-none mt-1">Control Console</p>
          </div>
        </div>

        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-[#E5E7EB] hover:bg-[#242528]">
              <Menu className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="bg-[#1c1c1e] border-r border-[#2A2C30] text-[#E5E7EB] p-0 w-72 flex flex-col">
            <SheetHeader className="h-14 px-4 border-b border-[#2A2C30] flex flex-row items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#242528] border border-[#2A2C30] p-1 flex items-center justify-center shrink-0">
                  <Image src="/logo.png" alt="Sycord Logo" width={22} height={22} className="rounded object-contain" />
                </div>
                <div>
                  <SheetTitle className="text-xs font-semibold text-[#E5E7EB] leading-none text-left">Sycord Mod</SheetTitle>
                  <p className="text-[10px] text-[#777B82] leading-none mt-1 text-left">Moderator View</p>
                </div>
              </div>
            </SheetHeader>

            {/* Mobile Nav Links */}
            <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
              {[
                { id: "general", label: "General", icon: LayoutDashboard },
                { id: "users", label: "Users", icon: Users },
                { id: "providers", label: "Providers & Usage", icon: Cpu },
                { id: "servers", label: "Servers", icon: Server },
                { id: "tickets", label: "Tickets & Announcements", icon: LifeBuoy },
              ].map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id as ModeratorTab)
                      setMobileMenuOpen(false)
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors select-none text-left",
                      isActive
                        ? "bg-[#242528] text-white border border-[#2A2C30]"
                        : "text-[#A7AAB0] hover:text-[#E5E7EB] hover:bg-[#202124]"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0 text-zinc-400" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>

            <div className="p-3 border-t border-[#2A2C30] space-y-2">
              <Button
                variant="ghost"
                onClick={() => router.push("/dashboard")}
                className="w-full justify-start h-8 px-2.5 text-xs text-[#A7AAB0] hover:text-white hover:bg-[#242528] gap-2"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Exit to Dashboard</span>
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Primary Moderator Navigation Sidebar (Desktop) */}
      <aside className="hidden md:flex w-60 bg-[#1c1c1e] border-r border-[#2A2C30] flex-col shrink-0">
        <div className="h-14 px-4 border-b border-[#2A2C30] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#242528] border border-[#2A2C30] p-1 flex items-center justify-center shrink-0">
              <Image src="/logo.png" alt="Sycord Logo" width={22} height={22} className="rounded object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-[#E5E7EB] leading-none">Sycord</p>
                <Badge variant="outline" className="text-[9px] px-1 py-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400 font-medium">
                  Mod
                </Badge>
              </div>
              <p className="text-[10px] text-[#777B82] leading-none mt-1">Moderator View</p>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-[#2A2C30] text-[#A7AAB0]">
            v1.0
          </Badge>
        </div>

        {/* Navigation Items */}
        <nav className="p-2 space-y-1 flex-1">
          <button
            onClick={() => setActiveTab("general")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors select-none text-left",
              activeTab === "general"
                ? "bg-[#242528] text-white border border-[#2A2C30]"
                : "text-[#A7AAB0] hover:text-[#E5E7EB] hover:bg-[#202124]"
            )}
          >
            <LayoutDashboard className="w-4 h-4 shrink-0 text-zinc-400" />
            <span>General</span>
          </button>

          <button
            onClick={() => setActiveTab("users")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors select-none text-left",
              activeTab === "users"
                ? "bg-[#242528] text-white border border-[#2A2C30]"
                : "text-[#A7AAB0] hover:text-[#E5E7EB] hover:bg-[#202124]"
            )}
          >
            <Users className="w-4 h-4 shrink-0 text-zinc-400" />
            <span>Users</span>
          </button>

          <button
            onClick={() => setActiveTab("providers")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors select-none text-left",
              activeTab === "providers"
                ? "bg-[#242528] text-white border border-[#2A2C30]"
                : "text-[#A7AAB0] hover:text-[#E5E7EB] hover:bg-[#202124]"
            )}
          >
            <Cpu className="w-4 h-4 shrink-0 text-zinc-400" />
            <span>Providers & Usage</span>
          </button>

          <button
            onClick={() => setActiveTab("servers")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors select-none text-left",
              activeTab === "servers"
                ? "bg-[#242528] text-white border border-[#2A2C30]"
                : "text-[#A7AAB0] hover:text-[#E5E7EB] hover:bg-[#202124]"
            )}
          >
            <Server className="w-4 h-4 shrink-0 text-zinc-400" />
            <span>Servers</span>
          </button>

          <button
            onClick={() => setActiveTab("tickets")}
            className={cn(
              "w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors select-none text-left",
              activeTab === "tickets"
                ? "bg-[#242528] text-white border border-[#2A2C30]"
                : "text-[#A7AAB0] hover:text-[#E5E7EB] hover:bg-[#202124]"
            )}
          >
            <LifeBuoy className="w-4 h-4 shrink-0 text-zinc-400" />
            <span>Tickets & Announcements</span>
          </button>
        </nav>

        {/* Footer & Exit to Dashboard */}
        <div className="p-3 border-t border-[#2A2C30] space-y-1.5">
          <Button
            variant="ghost"
            onClick={() => router.push("/dashboard")}
            className="w-full justify-start h-8 px-2.5 text-xs text-[#A7AAB0] hover:text-white hover:bg-[#242528] gap-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Exit to Dashboard</span>
          </Button>
          <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-[#777B82]">
            <span className="truncate">{session?.user?.email}</span>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="hover:text-red-400 transition-colors">
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Moderator View Surface */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 space-y-5">
        {/* Openable Top Menubar with fast controls & tools */}
        <div className="flex items-center justify-between bg-[#1c1c1e] border border-[#2A2C30] rounded-xl px-3 py-1.5 shadow-sm">
          <Menubar className="bg-transparent border-0 h-auto p-0 gap-1 text-xs">
            <MenubarMenu>
              <MenubarTrigger className="text-xs px-2.5 py-1 text-[#A7AAB0] hover:text-white hover:bg-[#242528] rounded-md cursor-pointer data-[state=open]:bg-[#242528] data-[state=open]:text-white flex items-center gap-1.5">
                <Menu className="w-3.5 h-3.5 text-zinc-400" />
                <span>Navigate</span>
              </MenubarTrigger>
              <MenubarContent className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] text-xs">
                <MenubarItem onClick={() => setActiveTab("general")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <LayoutDashboard className="w-3.5 h-3.5 text-zinc-400" />
                  <span>General Overview</span>
                </MenubarItem>
                <MenubarItem onClick={() => setActiveTab("users")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <Users className="w-3.5 h-3.5 text-zinc-400" />
                  <span>User Management</span>
                </MenubarItem>
                <MenubarItem onClick={() => setActiveTab("providers")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <Cpu className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Providers & Token Usage</span>
                </MenubarItem>
                <MenubarItem onClick={() => setActiveTab("servers")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <Server className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Infrastructure & Servers</span>
                </MenubarItem>
                <MenubarItem onClick={() => setActiveTab("tickets")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <LifeBuoy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Tickets & Announcements</span>
                </MenubarItem>
                <MenubarSeparator className="bg-[#2A2C30]" />
                <MenubarItem onClick={() => router.push("/dashboard")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Return to Dashboard</span>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="text-xs px-2.5 py-1 text-[#A7AAB0] hover:text-white hover:bg-[#242528] rounded-md cursor-pointer data-[state=open]:bg-[#242528] data-[state=open]:text-white flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-zinc-400" />
                <span>Actions</span>
              </MenubarTrigger>
              <MenubarContent className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] text-xs">
                <MenubarItem onClick={() => setAnnouncementDialogOpen(true)} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Broadcast Announcement</span>
                </MenubarItem>
                <MenubarItem onClick={() => { setActiveTab("users"); fetchUsers() }} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <Search className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Lookup User</span>
                </MenubarItem>
                <MenubarSeparator className="bg-[#2A2C30]" />
                <MenubarItem onClick={fetchOverview} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <RefreshCw className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Refresh Metrics</span>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>

            <MenubarMenu>
              <MenubarTrigger className="text-xs px-2.5 py-1 text-[#A7AAB0] hover:text-white hover:bg-[#242528] rounded-md cursor-pointer data-[state=open]:bg-[#242528] data-[state=open]:text-white flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-zinc-400" />
                <span>System</span>
              </MenubarTrigger>
              <MenubarContent className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] text-xs">
                <MenubarItem onClick={() => setActiveTab("servers")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <Server className="w-3.5 h-3.5 text-emerald-400" />
                  <span>View All Server Nodes</span>
                </MenubarItem>
                <MenubarItem onClick={() => setActiveTab("servers")} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <Database className="w-3.5 h-3.5 text-blue-400" />
                  <span>Database Cluster (Germany)</span>
                </MenubarItem>
                <MenubarSeparator className="bg-[#2A2C30]" />
                <MenubarItem onClick={() => { setActiveTab("tickets"); fetchAuditLogs() }} className="gap-2 focus:bg-[#242528] focus:text-white cursor-pointer">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Moderation Audit Trail</span>
                </MenubarItem>
              </MenubarContent>
            </MenubarMenu>
          </Menubar>

          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-[#777B82]">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              All systems nominal
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                fetchOverview()
                if (activeTab === "users") fetchUsers(userSearch)
                if (activeTab === "providers") fetchUsage()
                if (activeTab === "servers") fetchServerMonitoring()
                if (activeTab === "tickets") { fetchTickets(); fetchAnnouncements(); fetchAuditLogs() }
                toast.success("Moderator data refreshed")
              }}
              className="h-7 px-2 text-xs text-[#A7AAB0] hover:text-white hover:bg-[#242528] gap-1"
            >
              <RefreshCw className={cn("w-3 h-3", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
        </div>
        {/* =========================================================================
            TAB 1: GENERAL (DASHBOARD OVERVIEW)
           ========================================================================= */}
        {activeTab === "general" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2C30] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Moderator View</h1>
                <p className="text-xs md:text-sm text-[#A7AAB0] mt-0.5">
                  Monitor, review and keep the platform safe
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-[#1c1c1e] border-[#2A2C30] text-[#A7AAB0] text-xs px-2.5 py-1">
                  Last 7 days
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchOverview}
                  className="h-8 px-2 text-[#A7AAB0] hover:text-white hover:bg-[#202124]"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* 4 Primary Moderation Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="Reports"
                value={metrics.reports.total}
                changeText={metrics.reports.changeText}
                icon={AlertTriangle}
                iconColor="text-amber-400"
              />
              <MetricCard
                title="Warnings"
                value={metrics.warnings.total}
                changeText={metrics.warnings.changeText}
                icon={Shield}
                iconColor="text-yellow-400"
              />
              <MetricCard
                title="Bans"
                value={metrics.bans.total}
                changeText={metrics.bans.changeText}
                icon={Ban}
                iconColor="text-red-400"
              />
              <MetricCard
                title="Resolved"
                value={metrics.resolved.total}
                changeText={metrics.resolved.changeText}
                icon={CheckCircle2}
                iconColor="text-emerald-400"
              />
            </div>

            {/* Recent Reports / Cases & Quick Access Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left 2 Cols: Recent Reports */}
              <Card className="lg:col-span-2 bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
                <CardHeader className="p-4 border-b border-[#2A2C30] flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Recent Reports
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("users")}
                    className="h-7 text-xs text-[#A7AAB0] hover:text-white"
                  >
                    View all users
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {recentReports.length === 0 ? (
                    <div className="p-8 text-center space-y-1.5">
                      <CheckCircle2 className="w-6 h-6 text-zinc-500 mx-auto" />
                      <p className="text-xs font-medium text-[#E5E7EB]">No recent reports</p>
                      <p className="text-[11px] text-[#777B82]">When users report content, it will appear here.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#2A2C30]">
                      {recentReports.map((report) => (
                        <div key={report.id} className="p-3.5 flex items-center justify-between hover:bg-[#202124] transition-colors">
                          <div className="space-y-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white truncate">{report.reportedUserEmail}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase font-mono px-1.5 py-0 border-[#2A2C30]",
                                  report.status === "open" && "text-amber-400 border-amber-500/30",
                                  report.status === "resolved" && "text-emerald-400 border-emerald-500/30",
                                  report.status === "dismissed" && "text-zinc-400"
                                )}
                              >
                                {report.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-[#A7AAB0] line-clamp-1">{report.reason}</p>
                            <p className="text-[10px] text-[#777B82]">Reporter: {report.reporterEmail}</p>
                          </div>
                          {report.status === "open" && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolveReport(report.id, "resolved")}
                                className="h-7 px-2.5 text-xs border-[#2A2C30] hover:bg-emerald-950/30 hover:text-emerald-300"
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleResolveReport(report.id, "dismissed")}
                                className="h-7 px-2 text-xs text-[#A7AAB0] hover:text-zinc-200"
                              >
                                Dismiss
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right 1 Col: Quick Access & Fast Server Status */}
              <div className="space-y-4">
                {/* Quick Actions Card */}
                <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
                  <CardHeader className="p-4 border-b border-[#2A2C30]">
                    <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-1.5">
                    <Button
                      variant="ghost"
                      onClick={() => setActiveTab("users")}
                      className="w-full justify-start h-8 px-2.5 text-xs text-[#A7AAB0] hover:text-white hover:bg-[#242528] gap-2.5"
                    >
                      <Search className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Search & Inspect User</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setActiveTab("tickets")}
                      className="w-full justify-start h-8 px-2.5 text-xs text-[#A7AAB0] hover:text-white hover:bg-[#242528] gap-2.5"
                    >
                      <LifeBuoy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Open Support Tickets</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setAnnouncementDialogOpen(true)}
                      className="w-full justify-start h-8 px-2.5 text-xs text-[#A7AAB0] hover:text-white hover:bg-[#242528] gap-2.5"
                    >
                      <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Broadcast Server Announcement</span>
                    </Button>
                  </CardContent>
                </Card>

                {/* Fast Server Monitoring Widget */}
                <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
                  <CardHeader className="p-4 border-b border-[#2A2C30] flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      System Status
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("servers")}
                      className="h-7 text-xs text-[#A7AAB0] hover:text-white gap-1"
                    >
                      <span>View servers</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#202124] border border-[#2A2C30]/50">
                      <span className="text-[#A7AAB0]">Frontend</span>
                      <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Operational
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#202124] border border-[#2A2C30]/50">
                      <span className="text-[#A7AAB0]">Backend (Syte API)</span>
                      <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Operational
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-[#202124] border border-[#2A2C30]/50">
                      <span className="text-[#A7AAB0]">Database (Germany)</span>
                      <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Operational (14ms)
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            TAB 2: USERS (SEARCH, INSPECTION, CREDITS, BAN)
           ========================================================================= */}
        {activeTab === "users" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2C30] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Users</h1>
                <p className="text-xs md:text-sm text-[#A7AAB0] mt-0.5">
                  Inspect registered users, credit allocations, login IPs, and moderation controls
                </p>
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[#777B82]" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search user, email, IP, project..."
                  className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] pl-9 h-9 text-xs focus-visible:ring-1 focus-visible:ring-zinc-400"
                />
              </div>
            </div>

            {/* Users Table */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#202124] border-b border-[#2A2C30] text-[#A7AAB0] font-medium">
                    <tr>
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Login IP</th>
                      <th className="py-2.5 px-3">Projects</th>
                      <th className="py-2.5 px-3">Credits</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2C30]">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#A7AAB0]">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                          Loading users...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-[#A7AAB0]">
                          No users found matching query.
                        </td>
                      </tr>
                    ) : (
                      users.map((u) => (
                        <tr key={u.userId} className="hover:bg-[#202124]/60 transition-colors">
                          <td className="py-3 px-4 font-medium text-white flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#2A2C30] flex items-center justify-center text-[10px] font-bold text-[#E5E7EB]">
                              {(u.name || u.email || "U").charAt(0).toUpperCase()}
                            </div>
                            <span className="truncate max-w-[140px]">{u.name || "User"}</span>
                          </td>
                          <td className="py-3 px-3 text-[#E5E7EB] font-mono text-[11px] truncate max-w-[160px]">
                            {u.email}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-[#A7AAB0]">
                            {u.ip || "—"}
                          </td>
                          <td className="py-3 px-3 text-[#A7AAB0]">
                            {u.projectCount || u.websites?.length || 0}
                          </td>
                          <td className="py-3 px-3 font-semibold text-emerald-400">
                            {u.credits ?? 10}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 border-[#2A2C30]",
                                u.isBlocked
                                  ? "text-red-400 border-red-500/30 bg-red-950/20"
                                  : "text-emerald-400 border-emerald-500/30"
                              )}
                            >
                              {u.isBlocked ? "Banned" : "Active"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Add credits */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTargetUser(u)
                                  setCreditActionType("add")
                                  setCreditDialogOpen(true)
                                }}
                                title="Add credits"
                                className="h-7 w-7 p-0 border-[#2A2C30] text-emerald-400 hover:bg-emerald-950/30"
                              >
                                <Plus className="w-3 h-3" />
                              </Button>

                              {/* Remove credits */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTargetUser(u)
                                  setCreditActionType("remove")
                                  setCreditDialogOpen(true)
                                }}
                                title="Remove credits"
                                className="h-7 w-7 p-0 border-[#2A2C30] text-zinc-400 hover:bg-[#242528]"
                              >
                                <Minus className="w-3 h-3" />
                              </Button>

                              {/* Warn user */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTargetUser(u)
                                  setWarnDialogOpen(true)
                                }}
                                title="Send warning"
                                className="h-7 w-7 p-0 border-[#2A2C30] text-amber-400 hover:bg-amber-950/30"
                              >
                                <AlertTriangle className="w-3 h-3" />
                              </Button>

                              {/* Ban / Unban */}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setTargetUser(u)
                                  setBanDialogOpen(true)
                                }}
                                title={u.isBlocked ? "Unban user" : "Ban user"}
                                className={cn(
                                  "h-7 w-7 p-0 border-[#2A2C30]",
                                  u.isBlocked
                                    ? "text-emerald-400 hover:bg-emerald-950/30"
                                    : "text-red-400 hover:bg-red-950/30"
                                )}
                              >
                                {u.isBlocked ? <UserCheck className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* =========================================================================
            TAB 3: PROVIDERS & USAGE (GLOBAL MODELS ONLY — NO CUSTOM CRUD / NO OMNI AGENT)
           ========================================================================= */}
        {activeTab === "providers" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2C30] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Providers & AI Usage</h1>
                <p className="text-xs md:text-sm text-[#A7AAB0] mt-0.5">
                  Monitor global models token throughput, request counts, error rates, and operational latency
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={usagePeriod}
                  onChange={(e) => {
                    setUsagePeriod(e.target.value)
                    fetchUsage(e.target.value)
                  }}
                  className="bg-[#1c1c1e] border border-[#2A2C30] text-[#E5E7EB] h-8 rounded-lg px-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-zinc-400"
                >
                  <option value="today">Today</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => fetchUsage(usagePeriod)}
                  className="h-8 px-2 text-[#A7AAB0] hover:text-white"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", usageLoading && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                title="Total Tokens"
                value={usageData.summary.totalTokens.toLocaleString()}
                changeText={`${usagePeriod} recorded`}
                icon={Cpu}
                iconColor="text-emerald-400"
              />
              <MetricCard
                title="Input Tokens"
                value={usageData.summary.totalInputTokens.toLocaleString()}
                changeText="Prompt & tools input"
                icon={Layers}
                iconColor="text-blue-400"
              />
              <MetricCard
                title="Output Tokens"
                value={usageData.summary.totalOutputTokens.toLocaleString()}
                changeText="Synthesized generation"
                icon={Sparkles}
                iconColor="text-purple-400"
              />
              <MetricCard
                title="Total Requests"
                value={usageData.summary.totalRequests.toLocaleString()}
                changeText="AI Turn completions"
                icon={Activity}
                iconColor="text-amber-400"
              />
            </div>

            {/* Global Models Table */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="p-4 border-b border-[#2A2C30] flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Global AI Models</CardTitle>
                  <p className="text-[11px] text-[#777B82] mt-0.5">Centrally configured platform foundation models</p>
                </div>
                <Badge variant="outline" className="text-[10px] text-zinc-400 border-[#2A2C30]">
                  Global Only
                </Badge>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#202124] border-b border-[#2A2C30] text-[#A7AAB0] font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Model</th>
                      <th className="py-2.5 px-3">Provider</th>
                      <th className="py-2.5 px-3">Context</th>
                      <th className="py-2.5 px-3">Input</th>
                      <th className="py-2.5 px-3">Output</th>
                      <th className="py-2.5 px-3">Total Tokens</th>
                      <th className="py-2.5 px-3">Requests</th>
                      <th className="py-2.5 px-3">Errors</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2C30]">
                    {usageLoading ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-[#A7AAB0]">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                          Loading global models metrics...
                        </td>
                      </tr>
                    ) : usageData.models.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-[#A7AAB0]">
                          No active models configured.
                        </td>
                      </tr>
                    ) : (
                      usageData.models.map((m) => (
                        <tr key={m.id} className="hover:bg-[#202124]/60 transition-colors">
                          <td className="py-3 px-4 font-semibold text-white">
                            {m.name}
                            <p className="text-[10px] text-[#777B82] font-mono font-normal">{m.id}</p>
                          </td>
                          <td className="py-3 px-3 text-[#A7AAB0]">{m.provider}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-[#A7AAB0]">
                            {(m.contextWindow / 1000).toFixed(0)}k
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">
                            {m.inputTokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">
                            {m.outputTokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] font-semibold text-emerald-400">
                            {m.totalTokens.toLocaleString()}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{m.requests}</td>
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-400">
                            {m.errors} <span className="text-[10px] text-[#777B82]">({m.errorRate})</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{m.avgLatencyMs}ms</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] px-1.5 py-0 border-[#2A2C30]",
                                m.status === "operational"
                                  ? "text-emerald-400 border-emerald-500/30"
                                  : "text-amber-400 border-amber-500/30"
                              )}
                            >
                              {m.status}
                            </Badge>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* =========================================================================
            TAB 4: SERVERS (MULTI-DATABASE & SEGMENTED NODE MONITORING)
           ========================================================================= */}
        {activeTab === "servers" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2C30] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Servers & Infrastructure</h1>
                <p className="text-xs md:text-sm text-[#A7AAB0] mt-0.5">
                  Real-time infrastructure health, segmented worker nodes, and multi-region database instances
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={fetchServerMonitoring}
                className="h-8 text-xs border-[#2A2C30] gap-1.5 text-[#A7AAB0] hover:text-white"
              >
                <RefreshCw className={cn("w-3.5 h-3.5", serverLoading && "animate-spin")} />
                Refresh Health
              </Button>
            </div>

            {/* Core Infrastructure Components */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Frontend Card */}
              <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
                <CardHeader className="p-4 border-b border-[#2A2C30] flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Globe2 className="w-4 h-4 text-blue-400" />
                    Frontend Service
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                    Operational
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Uptime:</span>
                    <span className="font-semibold text-white">99.98%</span>
                  </div>
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Edge Response Time:</span>
                    <span className="font-semibold text-white">42ms</span>
                  </div>
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Memory Usage:</span>
                    <span className="font-semibold text-white">34%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Backend Card */}
              <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
                <CardHeader className="p-4 border-b border-[#2A2C30] flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Server className="w-4 h-4 text-emerald-400" />
                    Backend (Syte API)
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                    Operational
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Uptime:</span>
                    <span className="font-semibold text-white">99.95%</span>
                  </div>
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Throughput:</span>
                    <span className="font-semibold text-white">124 req/min</span>
                  </div>
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Error Rate:</span>
                    <span className="font-semibold text-white">0.01%</span>
                  </div>
                </CardContent>
              </Card>

              {/* Database Cluster Overview Card */}
              <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
                <CardHeader className="p-4 border-b border-[#2A2C30] flex flex-row items-center justify-between">
                  <CardTitle className="text-xs font-semibold flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    Database Cluster
                  </CardTitle>
                  <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                    Operational
                  </Badge>
                </CardHeader>
                <CardContent className="p-4 space-y-2.5 text-xs">
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Active Instances:</span>
                    <span className="font-semibold text-white">2 Nodes</span>
                  </div>
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Primary Instance:</span>
                    <span className="font-semibold text-white">Germany (Frankfurt)</span>
                  </div>
                  <div className="flex justify-between text-[#A7AAB0]">
                    <span>Average Latency:</span>
                    <span className="font-semibold text-white">13ms</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Multi-Database Instances Architecture */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="p-4 border-b border-[#2A2C30]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Database className="w-4 h-4 text-purple-400" />
                  Database Nodes (Multi-Instance Support)
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#202124] border-b border-[#2A2C30] text-[#A7AAB0] font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Instance Name</th>
                      <th className="py-2.5 px-3">Region</th>
                      <th className="py-2.5 px-3">Engine</th>
                      <th className="py-2.5 px-3">Connections</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-3">Storage</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2C30]">
                    {serverMonitoring.databases.map((db) => (
                      <tr key={db.id} className="hover:bg-[#202124]/60 transition-colors">
                        <td className="py-3 px-4 font-semibold text-white flex items-center gap-2">
                          <Database className="w-3.5 h-3.5 text-zinc-400" />
                          {db.name}
                        </td>
                        <td className="py-3 px-3 font-mono text-[11px] text-[#A7AAB0]">{db.region}</td>
                        <td className="py-3 px-3 text-[#A7AAB0]">{db.provider}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{db.activeConnections} active</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{db.latencyMs}ms</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{db.storageUsedMb} MB / {db.storageLimitMb} MB</td>
                        <td className="py-3 px-4">
                          <Badge variant="outline" className="text-[10px] text-emerald-400 border-emerald-500/30">
                            {db.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Segmented Infrastructure Nodes */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
              <CardHeader className="p-4 border-b border-[#2A2C30]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Layers className="w-4 h-4 text-blue-400" />
                  Segmented Infrastructure Nodes
                </CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#202124] border-b border-[#2A2C30] text-[#A7AAB0] font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Node ID</th>
                      <th className="py-2.5 px-3">Role</th>
                      <th className="py-2.5 px-3">Region</th>
                      <th className="py-2.5 px-3">CPU</th>
                      <th className="py-2.5 px-3">Memory</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-4">Uptime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2A2C30]">
                    {serverMonitoring.nodes.map((node) => (
                      <tr key={node.id} className="hover:bg-[#202124]/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-medium text-white">{node.name}</td>
                        <td className="py-3 px-3">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 border-[#2A2C30] text-zinc-300">
                            {node.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-3 text-[#A7AAB0]">{node.region}</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{node.cpuPercent}%</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{node.memoryPercent}%</td>
                        <td className="py-3 px-3 font-mono text-[11px] text-zinc-300">{node.latencyMs}ms</td>
                        <td className="py-3 px-4 font-semibold text-emerald-400">{node.uptimePercent}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Anomaly Monitoring */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
              <CardHeader className="p-4 border-b border-[#2A2C30]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  Anomaly Detection
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {serverMonitoring.anomalies.length === 0 ? (
                  <div className="text-center py-6 space-y-1">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto" />
                    <p className="text-xs font-semibold text-white">No active anomalies</p>
                    <p className="text-[11px] text-[#777B82]">All monitored telemetry thresholds are operating within standard parameters.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {serverMonitoring.anomalies.map((anom) => (
                      <div key={anom.id} className="p-3 rounded-lg bg-[#242528] border border-amber-500/20 flex items-start justify-between">
                        <div>
                          <p className="text-xs font-semibold text-amber-300">{anom.title}</p>
                          <p className="text-[11px] text-[#A7AAB0] mt-0.5">{anom.description}</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                          {anom.severity}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* =========================================================================
            TAB 5: TICKETS & ANNOUNCEMENTS (SUPPORT & BROADCASTS & AUDIT LOGS)
           ========================================================================= */}
        {activeTab === "tickets" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#2A2C30] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Tickets & Announcements</h1>
                <p className="text-xs md:text-sm text-[#A7AAB0] mt-0.5">
                  Review support requests, broadcast dashboard announcements, and inspect moderation audit logs
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => setAnnouncementDialogOpen(true)}
                className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
              >
                <Megaphone className="w-3.5 h-3.5" />
                <span>New Announcement</span>
              </Button>
            </div>

            {/* Announcements Manager */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
              <CardHeader className="p-4 border-b border-[#2A2C30]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Megaphone className="w-4 h-4 text-emerald-400" />
                  Active Server Announcements
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {announcements.length === 0 ? (
                  <p className="text-xs text-[#777B82] text-center py-4">No active announcements</p>
                ) : (
                  <div className="space-y-2.5">
                    {announcements.map((ann) => (
                      <div key={ann.id} className="p-3.5 rounded-lg bg-[#242528] border border-[#2A2C30] flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{ann.title}</span>
                            <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0 border-[#2A2C30] text-zinc-300">
                              {ann.type}
                            </Badge>
                          </div>
                          <p className="text-xs text-[#A7AAB0]">{ann.message}</p>
                          <p className="text-[10px] text-[#777B82]">By: {ann.creatorEmail} • {new Date(ann.createdAt).toLocaleDateString()}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleToggleAnnouncement(ann.id, ann.active)}
                          className="h-7 text-xs border-[#2A2C30] text-[#A7AAB0] hover:text-white"
                        >
                          {ann.active ? "Deactivate" : "Activate"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Support Tickets Section */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
              <CardHeader className="p-4 border-b border-[#2A2C30]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <LifeBuoy className="w-4 h-4 text-blue-400" />
                  Support Tickets
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {tickets.length === 0 ? (
                  <p className="text-xs text-[#777B82] text-center py-4">No open tickets</p>
                ) : (
                  <div className="space-y-4">
                    {tickets.map((t) => (
                      <div key={t.id} className="p-4 rounded-xl bg-[#242528] border border-[#2A2C30] space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="text-xs font-bold text-white">{t.subject}</span>
                            <p className="text-[11px] text-[#A7AAB0]">From: {t.userEmail} • {new Date(t.createdAt).toLocaleString()}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] uppercase font-mono px-1.5 py-0 border-[#2A2C30]",
                              t.status === "open" && "text-amber-400 border-amber-500/30",
                              t.status === "resolved" && "text-emerald-400 border-emerald-500/30",
                              t.status === "closed" && "text-zinc-400"
                            )}
                          >
                            {t.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-zinc-300 bg-[#1c1c1e] p-2.5 rounded-lg border border-[#2A2C30]/50">{t.message}</p>

                        {/* Moderator Reply Box */}
                        {t.status !== "closed" && (
                          <div className="space-y-2 pt-1">
                            <Input
                              value={ticketReplyText[t.id] || ""}
                              onChange={(e) => setTicketReplyText((prev) => ({ ...prev, [t.id]: e.target.value }))}
                              placeholder="Type a response to the user..."
                              className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] text-xs h-8 focus-visible:ring-1 focus-visible:ring-zinc-400"
                            />
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleTicketAction(t.id, "resolved")}
                                className="h-7 text-xs border-[#2A2C30] hover:bg-emerald-950/30 hover:text-emerald-300"
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleTicketAction(t.id)}
                                disabled={!ticketReplyText[t.id]?.trim()}
                                className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white gap-1"
                              >
                                <Send className="w-3 h-3" />
                                Reply
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Moderation Audit Log */}
            <Card className="bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB] rounded-xl shadow-sm">
              <CardHeader className="p-4 border-b border-[#2A2C30]">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  Moderation Audit Log
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {auditLogs.length === 0 ? (
                  <p className="text-xs text-[#777B82] text-center py-6">No recorded audit actions yet</p>
                ) : (
                  <div className="divide-y divide-[#2A2C30] text-xs max-h-80 overflow-y-auto custom-scrollbar">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-3 flex items-center justify-between hover:bg-[#202124]/40">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white font-mono uppercase text-[11px]">{log.action.replace("_", " ")}</span>
                            <span className="text-[#A7AAB0]">target: {log.targetIdentifier || log.targetId}</span>
                          </div>
                          {log.reason && <p className="text-[11px] text-[#777B82] mt-0.5">Reason: {log.reason}</p>}
                        </div>
                        <div className="text-right text-[10px] text-[#777B82]">
                          <p>{log.moderatorEmail}</p>
                          <p>{new Date(log.createdAt).toLocaleTimeString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Reusable Dialogs */}
      <CreditDialog
        open={creditDialogOpen}
        onOpenChange={setCreditDialogOpen}
        user={targetUser}
        actionType={creditActionType}
        onSuccess={() => fetchUsers(userSearch)}
      />

      <BanDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        user={targetUser}
        onSuccess={() => fetchUsers(userSearch)}
      />

      <WarnDialog
        open={warnDialogOpen}
        onOpenChange={setWarnDialogOpen}
        user={targetUser}
        onSuccess={() => fetchUsers(userSearch)}
      />

      <AnnouncementDialog
        open={announcementDialogOpen}
        onOpenChange={setAnnouncementDialogOpen}
        onSuccess={fetchAnnouncements}
      />
    </div>
  )
}
