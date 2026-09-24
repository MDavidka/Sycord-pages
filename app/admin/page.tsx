"use client"

import React, { useState, useEffect } from "react"
import Image from "next/image"
import Link from "next/link"
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
  Filter,
  MoreHorizontal,
  Check,
  ChevronsUpDown,
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover"
import {
  Command,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command"
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
  const [periodComboboxOpen, setPeriodComboboxOpen] = useState(false)

  const PERIOD_OPTIONS = [
    { value: "today", label: "Today" },
    { value: "7d", label: "Last 7 Days" },
    { value: "30d", label: "Last 30 Days" },
  ]

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
  const userInitials = session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "M"

  const navItems = [
    { id: "general" as ModeratorTab, label: "General", icon: LayoutDashboard },
    { id: "users" as ModeratorTab, label: "Users", icon: Users },
    { id: "providers" as ModeratorTab, label: "Providers & Usage", icon: Cpu },
    { id: "servers" as ModeratorTab, label: "Servers", icon: Server },
    { id: "tickets" as ModeratorTab, label: "Tickets & Broadcasts", icon: LifeBuoy },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground antialiased flex flex-col selection:bg-zinc-800 selection:text-white">
      {/* Global Dashboard-Style Sticky Header */}
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Brand & Mode Tag */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-muted/50 transition-colors"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <Image
                src="/logo.png"
                alt="Sycord Logo"
                width={26}
                height={26}
                className="rounded object-contain shrink-0 transition-transform group-hover:scale-105"
                priority
              />
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-foreground tracking-tight">Sycord</span>
                <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 text-[10px] font-semibold uppercase tracking-wider gap-1 px-2 py-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Mod Panel
                </Badge>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Tabs (Dashboard Segmented Style) */}
          <div className="hidden lg:flex items-center">
            <div className="inline-flex items-center justify-center rounded-lg bg-zinc-900/80 p-1 border border-zinc-800/80 text-muted-foreground shadow-xs">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-all select-none",
                      isActive
                        ? "bg-zinc-800 text-zinc-100 shadow-xs"
                        : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Header Controls & User Menu */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                fetchOverview()
                if (activeTab === "users") fetchUsers(userSearch)
                if (activeTab === "providers") fetchUsage()
                if (activeTab === "servers") fetchServerMonitoring()
                if (activeTab === "tickets") {
                  fetchTickets()
                  fetchAnnouncements()
                  fetchAuditLogs()
                }
                toast.success("Moderator data synchronized")
              }}
              className="h-8 px-2.5 text-xs border-border bg-background/50 hover:bg-muted/60 text-muted-foreground hover:text-foreground gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 ring-1 ring-border">
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-zinc-900 border-zinc-800 text-zinc-100" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none text-white">{session?.user?.name || "Moderator"}</p>
                    <p className="text-xs leading-none text-zinc-400 truncate">{session?.user?.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem onClick={() => router.push("/dashboard")} className="cursor-pointer hover:bg-zinc-800">
                  <ExternalLink className="mr-2 h-4 w-4 text-zinc-400" />
                  <span>Exit to Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setAnnouncementDialogOpen(true)} className="cursor-pointer hover:bg-zinc-800">
                  <Megaphone className="mr-2 h-4 w-4 text-emerald-400" />
                  <span>Broadcast Notice</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-destructive focus:text-destructive cursor-pointer hover:bg-zinc-800"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile / Tablet Horizontal Navigation Scrollbar */}
        <div className="lg:hidden border-t border-border/60 overflow-x-auto custom-scrollbar px-4 py-2 bg-background/50">
          <div className="flex items-center gap-1.5 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all select-none",
                    isActive
                      ? "bg-zinc-800 text-zinc-100 border border-zinc-700/60 shadow-xs"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Sheet */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="bg-[#111111] border-r border-[#27272a] text-zinc-100 p-0 w-72 flex flex-col">
          <SheetHeader className="h-14 px-4 border-b border-[#27272a] flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="Sycord Logo" width={22} height={22} className="rounded object-contain shrink-0" />
              <div>
                <SheetTitle className="text-xs font-semibold text-white leading-none text-left">Sycord Moderator</SheetTitle>
                <p className="text-[10px] text-zinc-400 leading-none mt-1 text-left">Control & Safety Console</p>
              </div>
            </div>
          </SheetHeader>

          <div className="p-3 space-y-1.5 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    setMobileMenuOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors select-none text-left",
                    isActive
                      ? "bg-zinc-800 text-white border border-zinc-700/60"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>

          <div className="p-3 border-t border-[#27272a] space-y-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="w-full justify-start h-8 px-2.5 text-xs text-zinc-300 hover:text-white border-[#27272a] bg-zinc-900 gap-2"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Exit to Dashboard</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Moderator View Surface */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* =========================================================================
            TAB 1: GENERAL (DASHBOARD OVERVIEW)
           ========================================================================= */}
        {activeTab === "general" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">Moderator View</h1>
                <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                  Monitor, review and keep the platform safe
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-card border-border text-muted-foreground text-xs px-2.5 py-1">
                  Last 7 days
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={fetchOverview}
                  className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-accent"
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
              <Card className="lg:col-span-2 bg-card border-border text-card-foreground rounded-xl shadow-xs py-0 gap-0">
                <CardHeader className="p-4 sm:p-5 border-b border-border flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    Recent Reports
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab("users")}
                    className="h-7 text-xs text-zinc-400 hover:text-white"
                  >
                    View all users
                  </Button>
                </CardHeader>
                <CardContent className="p-0">
                  {recentReports.length === 0 ? (
                    <div className="p-8 text-center space-y-1.5">
                      <CheckCircle2 className="w-6 h-6 text-zinc-500 mx-auto" />
                      <p className="text-xs font-medium text-zinc-200">No recent reports</p>
                      <p className="text-[11px] text-zinc-500">When users report content, it will appear here.</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-[#27272a]/70">
                      {recentReports.map((report) => (
                        <div key={report.id} className="p-3.5 sm:p-4 flex items-center justify-between hover:bg-zinc-900/50 transition-colors">
                          <div className="space-y-1 min-w-0 pr-3">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white truncate">{report.reportedUserEmail}</span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase font-mono px-1.5 py-0 border",
                                  report.status === "open" && "text-amber-400 border-amber-500/30 bg-amber-950/10",
                                  report.status === "resolved" && "text-emerald-400 border-emerald-500/30 bg-emerald-950/10",
                                  report.status === "dismissed" && "text-zinc-400 border-zinc-700"
                                )}
                              >
                                {report.status}
                              </Badge>
                            </div>
                            <p className="text-xs text-zinc-400 line-clamp-1">{report.reason}</p>
                            <p className="text-[10px] text-zinc-500">Reporter: {report.reporterEmail}</p>
                          </div>
                          {report.status === "open" && (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolveReport(report.id, "resolved")}
                                className="h-7 px-2.5 text-xs border-zinc-800 hover:bg-emerald-950/30 hover:text-emerald-300 text-zinc-300"
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleResolveReport(report.id, "dismissed")}
                                className="h-7 px-2 text-xs text-zinc-400 hover:text-zinc-200"
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
                <Card className="bg-[#111111] border-[#27272a] text-zinc-100 rounded-xl shadow-sm py-0 gap-0">
                  <CardHeader className="p-4 border-b border-[#27272a]">
                    <CardTitle className="text-sm font-semibold text-white">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="p-3 space-y-1.5">
                    <Button
                      variant="ghost"
                      onClick={() => setActiveTab("users")}
                      className="w-full justify-start h-8 px-2.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 gap-2.5"
                    >
                      <Search className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Search & Inspect User</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setActiveTab("tickets")}
                      className="w-full justify-start h-8 px-2.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 gap-2.5"
                    >
                      <LifeBuoy className="w-3.5 h-3.5 text-zinc-400" />
                      <span>Open Support Tickets</span>
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => setAnnouncementDialogOpen(true)}
                      className="w-full justify-start h-8 px-2.5 text-xs text-zinc-300 hover:text-white hover:bg-zinc-800 gap-2.5"
                    >
                      <Megaphone className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Broadcast Notice</span>
                    </Button>
                  </CardContent>
                </Card>

                {/* Fast Server Monitoring Widget */}
                <Card className="bg-[#111111] border-[#27272a] text-zinc-100 rounded-xl shadow-sm py-0 gap-0">
                  <CardHeader className="p-4 border-b border-[#27272a] flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 text-white">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      System Health
                    </CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActiveTab("servers")}
                      className="h-7 text-xs text-zinc-400 hover:text-white gap-1"
                    >
                      <span>Servers</span>
                      <ArrowRight className="w-3 h-3" />
                    </Button>
                  </CardHeader>
                  <CardContent className="p-3 space-y-2 text-xs">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800">
                      <span className="text-zinc-400">Frontend (Edge)</span>
                      <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Operational
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800">
                      <span className="text-zinc-400">Backend API</span>
                      <span className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        Operational
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800">
                      <span className="text-zinc-400">Database (Germany)</span>
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
          <div className="space-y-5 max-w-4xl mx-auto animate-in fade-in duration-150">
            {/* Search Bar & Filter Action Row (Exact Image Match) */}
            <div className="flex items-center gap-2.5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-zinc-500" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Search users..."
                  className="bg-zinc-900/60 border-zinc-800/80 text-zinc-100 pl-10 h-9 rounded-full text-xs focus-visible:ring-1 focus-visible:ring-zinc-700"
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-3 rounded-xl border-zinc-800/80 bg-zinc-900/60 text-zinc-400 hover:text-white"
              >
                <Filter className="w-3.5 h-3.5" />
              </Button>
            </div>

            {/* Users Card Container (Matching Image rounded container) */}
            <Card className="bg-zinc-900/40 border-zinc-800/80 text-zinc-100 rounded-2xl p-4 sm:p-5 shadow-xs py-4 gap-0 space-y-4">
              {usersLoading ? (
                <div className="p-10 text-center text-zinc-500">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-zinc-400" />
                  Loading users...
                </div>
              ) : users.length === 0 ? (
                <div className="p-10 text-center text-zinc-500 text-xs">
                  No registered users found.
                </div>
              ) : (
                users.map((u) => (
                  <div
                    key={u.userId}
                    className="p-4 rounded-xl bg-zinc-900/80 border border-zinc-800/60 flex items-center justify-between gap-4 hover:border-zinc-700/80 transition-all"
                  >
                    {/* Left: Avatar Initial & Email/IP info (Exact Image Layout) */}
                    <div className="flex items-center gap-3.5 min-w-0">
                      <Avatar className="h-10 w-10 rounded-xl ring-0 shrink-0">
                        <AvatarImage src={u.image || ""} alt={u.name} />
                        <AvatarFallback className="bg-amber-950/40 border border-amber-800/30 text-amber-200 text-sm font-bold rounded-xl">
                          {(u.email || u.name || "U").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-semibold text-white text-sm truncate">{u.email || u.name}</p>
                        <p className="text-[11px] text-zinc-500 font-mono">{u.ip || "Unknown IP"}</p>
                      </div>
                    </div>

                    {/* Right: Quick Action Buttons (Exact matching icon buttons from image) */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTargetUser(u)
                          setCreditActionType("add")
                          setCreditDialogOpen(true)
                        }}
                        title="Add Credits"
                        className="h-8 w-8 p-0 rounded-lg border-zinc-800 bg-zinc-900 text-emerald-400 hover:text-emerald-300 hover:bg-zinc-800"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTargetUser(u)
                          setWarnDialogOpen(true)
                        }}
                        title="Warn User"
                        className="h-8 w-8 p-0 rounded-lg border-zinc-800 bg-zinc-900 text-amber-400 hover:text-amber-300 hover:bg-zinc-800"
                      >
                        <AlertTriangle className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTargetUser(u)
                          setBanDialogOpen(true)
                        }}
                        title={u.isBlocked ? "Unban User" : "Ban User"}
                        className={cn(
                          "h-8 w-8 p-0 rounded-lg border-zinc-800 bg-zinc-900 hover:bg-zinc-800",
                          u.isBlocked ? "text-emerald-400" : "text-red-400"
                        )}
                      >
                        {u.isBlocked ? <UserCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                      </Button>
                    </div>
                  </div>
                ))
              )}
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
                <Popover open={periodComboboxOpen} onOpenChange={setPeriodComboboxOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={periodComboboxOpen}
                      className="h-8 w-36 justify-between bg-[#1c1c1e] border-[#2A2C30] text-xs text-[#E5E7EB] hover:bg-[#242528] hover:text-white"
                    >
                      {PERIOD_OPTIONS.find((p) => p.value === usagePeriod)?.label || "Select period"}
                      <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-36 p-0 bg-[#1c1c1e] border-[#2A2C30] text-[#E5E7EB]">
                    <Command className="bg-[#1c1c1e] text-[#E5E7EB]">
                      <CommandList>
                        <CommandGroup>
                          {PERIOD_OPTIONS.map((period) => (
                            <CommandItem
                              key={period.value}
                              value={period.value}
                              onSelect={(currentValue) => {
                                setUsagePeriod(currentValue)
                                setPeriodComboboxOpen(false)
                                fetchUsage(currentValue)
                              }}
                              className="text-xs cursor-pointer hover:bg-[#242528] flex items-center justify-between"
                            >
                              <span>{period.label}</span>
                              <Check
                                className={cn(
                                  "h-3.5 w-3.5",
                                  usagePeriod === period.value ? "opacity-100" : "opacity-0"
                                )}
                              />
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>

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
            TAB 4: SERVERS & INFRASTRUCTURE (EXACT MATCH TO DESIGN SPEC)
           ========================================================================= */}
        {activeTab === "servers" && (
          <div className="space-y-6 max-w-5xl mx-auto animate-in fade-in duration-150">
            {/* Header with Title & Refresh */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">Servers & Infrastructure</h1>
                <p className="text-xs md:text-sm text-[#71717a] mt-0.5">
                  Real-time infrastructure health, service metrics, and system anomaly telemetry
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#71717a] hidden sm:inline">
                  Last updated {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchServerMonitoring}
                  className="h-8 text-xs bg-[#111111] hover:bg-[#18181b] border-[#27272a] text-zinc-300 hover:text-white gap-1.5"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", serverLoading && "animate-spin")} />
                  Refresh
                </Button>
              </div>
            </div>

            {/* 3 Core Services: Frontend, Backend, Database */}
            <div className="space-y-4">
              {/* Frontend Service Card */}
              <Card className="bg-[#111111] border-[#27272a] text-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center text-zinc-300">
                      <Globe2 className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Frontend Service</h3>
                      <p className="text-xs text-[#71717a]">Web app & edge network</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Operational
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400/70 ml-0.5" />
                  </div>
                </div>
                <div className="p-4 sm:p-5 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-[#0c0c0e]">
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Uptime</span>
                    <span className="text-lg font-semibold text-white mt-1 block">99.98%</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Edge Response</span>
                    <span className="text-lg font-semibold text-white mt-1 block">42ms</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Memory Usage</span>
                    <span className="text-lg font-semibold text-white mt-1 block">34%</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Region</span>
                    <span className="text-lg font-semibold text-white mt-1 block">Global (CDN)</span>
                  </div>
                </div>
              </Card>

              {/* Backend (Syte API) Card */}
              <Card className="bg-[#111111] border-[#27272a] text-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center text-zinc-300">
                      <Server className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Backend (Syte API)</h3>
                      <p className="text-xs text-[#71717a]">API, workers & queue</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Operational
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400/70 ml-0.5" />
                  </div>
                </div>
                <div className="p-4 sm:p-5 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-[#0c0c0e]">
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Uptime</span>
                    <span className="text-lg font-semibold text-white mt-1 block">99.95%</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Throughput</span>
                    <span className="text-lg font-semibold text-white mt-1 block">124 req/min</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Error Rate</span>
                    <span className="text-lg font-semibold text-white mt-1 block">0.12%</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Memory Usage</span>
                    <span className="text-lg font-semibold text-white mt-1 block">58%</span>
                  </div>
                </div>
              </Card>

              {/* Database Card */}
              <Card className="bg-[#111111] border-[#27272a] text-white rounded-xl shadow-sm overflow-hidden">
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#27272a]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-[#18181b] border border-[#27272a] flex items-center justify-center text-zinc-300">
                      <Database className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">Database</h3>
                      <p className="text-xs text-[#71717a]">Primary database instance</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium w-fit">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Operational
                    <ChevronRight className="w-3.5 h-3.5 text-emerald-400/70 ml-0.5" />
                  </div>
                </div>
                <div className="p-4 sm:p-5 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 bg-[#0c0c0e]">
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Uptime</span>
                    <span className="text-lg font-semibold text-white mt-1 block">99.99%</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Latency</span>
                    <span className="text-lg font-semibold text-white mt-1 block">18ms</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Active Connections</span>
                    <span className="text-lg font-semibold text-white mt-1 block">24</span>
                  </div>
                  <div>
                    <span className="text-[11px] font-medium text-[#71717a] uppercase tracking-wider block">Region</span>
                    <span className="text-lg font-semibold text-white mt-1 block">Germany (DE)</span>
                  </div>
                </div>
              </Card>
            </div>

            {/* Bottom 2 Grid: Worker Nodes & Anomalies */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Worker Nodes Card */}
              <Card className="bg-[#111111] border-[#27272a] text-white rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="p-4 flex items-center justify-between border-b border-[#27272a]">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Worker Nodes</h3>
                      <p className="text-xs text-[#71717a]">Segmented infrastructure nodes</p>
                    </div>
                    <button className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                      View All
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="divide-y divide-[#27272a]/60">
                    <div className="p-3.5 px-4 flex items-center justify-between hover:bg-[#18181b]/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-mono text-xs font-medium text-white">worker-1</span>
                        <span className="text-[11px] text-[#71717a]">DE</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                        <span>2.1% CPU</span>
                        <span className="text-[#71717a]">•</span>
                        <span>512 MB</span>
                      </div>
                    </div>
                    <div className="p-3.5 px-4 flex items-center justify-between hover:bg-[#18181b]/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-mono text-xs font-medium text-white">worker-2</span>
                        <span className="text-[11px] text-[#71717a]">DE</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                        <span>3.4% CPU</span>
                        <span className="text-[#71717a]">•</span>
                        <span>498 MB</span>
                      </div>
                    </div>
                    <div className="p-3.5 px-4 flex items-center justify-between hover:bg-[#18181b]/50 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400" />
                        <span className="font-mono text-xs font-medium text-white">worker-3</span>
                        <span className="text-[11px] text-[#71717a]">DE</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400 font-mono">
                        <span>1.8% CPU</span>
                        <span className="text-[#71717a]">•</span>
                        <span>476 MB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Anomalies Card */}
              <Card className="bg-[#111111] border-[#27272a] text-white rounded-xl shadow-sm overflow-hidden flex flex-col justify-between">
                <div>
                  <div className="p-4 flex items-center justify-between border-b border-[#27272a]">
                    <div>
                      <h3 className="text-sm font-semibold text-white">Anomalies</h3>
                      <p className="text-xs text-[#71717a]">Recent system alerts and unusual activity</p>
                    </div>
                    <button className="text-xs font-medium text-zinc-400 hover:text-white flex items-center gap-1 transition-colors">
                      View All
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="p-6 sm:p-8 flex flex-col items-center justify-center text-center space-y-2.5 my-auto">
                    <div className="w-10 h-10 rounded-full bg-[#18181b] border border-[#27272a] flex items-center justify-center text-emerald-400">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-sm font-medium text-white">No anomalies detected</p>
                    <p className="text-xs text-[#71717a] max-w-[240px]">All systems are running normally within standard parameters.</p>
                  </div>
                </div>
              </Card>
            </div>
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
