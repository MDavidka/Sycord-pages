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
  Database,
  Server,
  LifeBuoy,
  Megaphone,
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
  Sparkles,
  Zap,
  Globe2,
  Lock,
  Layers,
  ArrowUpRight,
  Menu,
  X,
  ChevronsUpDown,
  Check,
  Edit3,
  Save,
  Radio,
  Sliders,
  RotateCcw,
  ShieldCheck,
  Power,
  Flame,
  Gauge,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

import { MetricCard } from "@/components/moderator/metric-card"
import { CreditDialog } from "@/components/moderator/credit-dialog"
import { BanDialog } from "@/components/moderator/ban-dialog"
import { WarnDialog } from "@/components/moderator/warn-dialog"
import { DatabaseMigrateModal } from "@/components/moderator/database-migrate-modal"
import { DatabaseInspectModal } from "@/components/moderator/database-inspect-modal"
import { ServerPerformanceOverview } from "@/components/moderator/server-performance-overview"
import { TelemetryDetailsModal } from "@/components/moderator/telemetry-details-modal"
import { UnderConstructionCard } from "@/components/moderator/under-construction-card"
import { AstroControlCenter } from "@/components/moderator/astro-control-center"
import { ProviderLogo } from "@/components/moderator/provider-logos"
import { ProviderSettingsDialog, type ProviderDetails } from "@/components/moderator/provider-settings-dialog"
import type { DatabaseRecord } from "@/app/api/moderator/databases/route"
import type { TelemetryEvent } from "@/app/api/moderator/telemetry/route"
import type { ReportItem } from "@/lib/moderator-types"
import type { SystemAlert, ServiceStatus } from "@/app/api/moderator/overview/route"

type ModeratorTab =
  | "general"
  | "users"
  | "providers"
  | "databases"
  | "servers"
  | "astro"
  | "tickets"
  | "broadcast"

export default function ModeratorPage() {
  const router = useRouter()
  const { data: session, status } = useSession()

  const [activeTab, setActiveTab] = useState<ModeratorTab>("general")
  const [loading, setLoading] = useState(true)

  // Command Center Overview state
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([])
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([])
  const [pendingReportsCount, setPendingReportsCount] = useState<number>(0)
  const [recentReports, setRecentReports] = useState<ReportItem[]>([])

  // Users state
  const [users, setUsers] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState("")
  const [usersLoading, setUsersLoading] = useState(false)
  const [targetUser, setTargetUser] = useState<any | null>(null)
  const [assigningShardUserId, setAssigningShardUserId] = useState<string | null>(null)


  // Dialogs
  const [creditDialogOpen, setCreditDialogOpen] = useState(false)
  const [creditActionType, setCreditActionType] = useState<"add" | "remove">("add")
  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [warnDialogOpen, setWarnDialogOpen] = useState(false)

  // Providers & Models Library state
  const [selectedProviderId, setSelectedProviderId] = useState<string | null>(null)
  const [adminModels, setAdminModels] = useState<Array<{
    id: string
    originalName: string
    displayName: string
    provider: string
    providerDisplay?: string
    enabledInLibrary: boolean
    contextWindow?: number
    inputCost?: number
    outputCost?: number
    inputCostDisplay?: string
    outputCostDisplay?: string
    tags?: string[]
  }>>([])
  const [adminModelsLoading, setAdminModelsLoading] = useState(false)
  const [modelSearch, setModelSearch] = useState("")
  const [editingModelId, setEditingModelId] = useState<string | null>(null)
  const [editDisplayName, setEditDisplayName] = useState("")
  const [savingModelId, setSavingModelId] = useState<string | null>(null)
  const [providerSettingsOpen, setProviderSettingsOpen] = useState(false)
  const [selectedProviderSettings, setSelectedProviderSettings] = useState<ProviderDetails | null>(null)

  // AI Usage state
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

  // Databases state
  const [databases, setDatabases] = useState<DatabaseRecord[]>([])
  const [databasesConfigured, setDatabasesConfigured] = useState<boolean>(true)
  const [databasesLoading, setDatabasesLoading] = useState(false)
  const [migrateModalOpen, setMigrateModalOpen] = useState(false)
  const [inspectModalOpen, setInspectModalOpen] = useState(false)
  const [selectedInspectDb, setSelectedInspectDb] = useState<DatabaseRecord | null>(null)
  const [suspendConfirmDb, setSuspendConfirmDb] = useState<DatabaseRecord | null>(null)
  const [suspendReason, setSuspendReason] = useState("")
  const [suspendingLoading, setSuspendingLoading] = useState(false)
  const [bulkModelModalOpen, setBulkModelModalOpen] = useState(false)
  const [bulkModelAction, setBulkModelAction] = useState<"disable_all" | "enable_all">("disable_all")
  const [bulkModelLoading, setBulkModelLoading] = useState(false)

  // Servers & Telemetry state
  const [telemetryEvents, setTelemetryEvents] = useState<TelemetryEvent[]>([])
  const [telemetryLoading, setTelemetryLoading] = useState(false)
  const [telemetrySeverityFilter, setTelemetrySeverityFilter] = useState<string>("all")
  const [selectedTelemetryEvent, setSelectedTelemetryEvent] = useState<TelemetryEvent | null>(null)
  const [telemetryModalOpen, setTelemetryModalOpen] = useState(false)

  // VM service action state
  const [vmActionLoading, setVmActionLoading] = useState(false)
  const [restartConfirmOpen, setRestartConfirmOpen] = useState(false)

  // Mobile menu
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Auth Guard
  useEffect(() => {
    if (status === "loading") return
    if (session?.user?.email !== "dmarton336@gmail.com") {
      router.push("/dashboard")
    }
  }, [session, status, router])

  // Initial overview load
  useEffect(() => {
    fetchOverview()
  }, [])

  // Tab-specific data loading
  useEffect(() => {
    if (activeTab === "users") fetchUsers()
    if (activeTab === "providers") {
      fetchAdminModels()
      fetchUsage(usagePeriod)
    }
    if (activeTab === "databases") fetchDatabases()
    if (activeTab === "servers") fetchTelemetry()
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
      const res = await fetch("/api/moderator/overview")
      const data = await res.json()
      if (data?.ok) {
        setSystemAlerts(data.alerts || [])
        setServiceStatuses(data.services || [])
        setPendingReportsCount(data.pendingReportsCount ?? 0)
        setRecentReports(data.recentReports || [])
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
      if (data?.ok && Array.isArray(data.users)) {
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

  const handleAssignShard = async (userId: string, newRegion: string) => {
    setAssigningShardUserId(userId)
    try {
      const res = await fetch(`/api/moderator/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          region: newRegion,
          shardId: `db-${newRegion}`,
          reason: `Moderator reassigned shard to ${newRegion}`,
        }),
      })
      const data = await res.json()
      if (data?.ok) {
        toast.success(`User regional shard updated to ${newRegion}`)
        setUsers((prev) =>
          prev.map((u) => (u.userId === userId ? { ...u, region: newRegion, shardId: `db-${newRegion}` } : u))
        )
      } else {
        toast.error(data?.error || "Failed to update shard")
      }
    } catch (e: any) {
      toast.error("Network error updating user shard")
    } finally {
      setAssigningShardUserId(null)
    }
  }

  const fetchAdminModels = async () => {
    setAdminModelsLoading(true)
    try {
      const res = await fetch("/api/admin/models")
      const data = await res.json()
      if (data?.ok && Array.isArray(data.models)) {
        setAdminModels(data.models)
      }
    } catch (e) {
      console.error("Error fetching models:", e)
    } finally {
      setAdminModelsLoading(false)
    }
  }

  const handleToggleModelInLibrary = async (modelId: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled
    setAdminModels((prev) =>
      prev.map((m) => (m.id === modelId ? { ...m, enabledInLibrary: newEnabled } : m))
    )
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, enabledInLibrary: newEnabled }),
      })
      const data = await res.json()
      if (data?.ok) {
        toast.success(`${modelId} ${newEnabled ? "enabled in" : "hidden from"} library`)
      } else {
        setAdminModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, enabledInLibrary: currentEnabled } : m))
        )
        toast.error(data?.error || "Failed to update model visibility")
      }
    } catch (e) {
      setAdminModels((prev) =>
        prev.map((m) => (m.id === modelId ? { ...m, enabledInLibrary: currentEnabled } : m))
      )
      toast.error("Network error updating model visibility")
    }
  }

  const handleSaveModelDisplayName = async (modelId: string, newDisplayName: string) => {
    const trimmed = newDisplayName.trim()
    if (!trimmed) {
      toast.error("Display name cannot be empty")
      return
    }
    setSavingModelId(modelId)
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelId, displayName: trimmed }),
      })
      const data = await res.json()
      if (data?.ok) {
        setAdminModels((prev) =>
          prev.map((m) => (m.id === modelId ? { ...m, displayName: trimmed } : m))
        )
        setEditingModelId(null)
        setEditDisplayName("")
        toast.success(`Display name updated for ${modelId}`)
      } else {
        toast.error(data?.error || "Failed to update display name")
      }
    } catch (e) {
      toast.error("Network error updating display name")
    } finally {
      setSavingModelId(null)
    }
  }

  const fetchUsage = async (period = usagePeriod) => {
    setUsageLoading(true)
    try {
      const res = await fetch(`/api/moderator/usage?period=${encodeURIComponent(period)}`)
      const data = await res.json()
      if (data?.ok) {
        setUsageData(data)
      }
    } catch (e) {
      console.error("Error fetching usage:", e)
    } finally {
      setUsageLoading(false)
    }
  }

  const fetchDatabases = async () => {
    setDatabasesLoading(true)
    try {
      const res = await fetch("/api/moderator/databases")
      const data = await res.json()
      if (data?.ok) {
        setDatabases(Array.isArray(data.databases) ? data.databases : [])
        setDatabasesConfigured(Boolean(data.configured ?? true))
      }
    } catch (e) {
      console.error("Error fetching databases:", e)
    } finally {
      setDatabasesLoading(false)
    }
  }

  const handleBulkModelsAction = async (action: "disable_all" | "enable_all") => {
    if (!selectedProviderId) return
    setBulkModelLoading(true)
    try {
      const res = await fetch("/api/admin/models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          provider: selectedProviderId,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        toast.success(
          action === "disable_all"
            ? `All ${selectedProviderId} models disabled in library`
            : `All ${selectedProviderId} models enabled in library`
        )
        setBulkModelModalOpen(false)
        fetchAdminModels()
      } else {
        toast.error(data.error || "Failed to update models")
      }
    } catch {
      toast.error("Network error during bulk update")
    } finally {
      setBulkModelLoading(false)
    }
  }

  const openProviderSettings = (providerId: string | null) => {
    if (!providerId) return
    const meta: Record<string, ProviderDetails> = {
      vercel: {
        id: "vercel",
        name: "Vercel AI Gateway",
        provider: "vercel",
        baseUrl: "https://ai-gateway.vercel.sh/v1",
        apiType: "vercel-ai-gateway (OpenAI SSE)",
        modelCount: adminModels.filter((m) => m.provider.toLowerCase().includes("vercel") || (!m.provider.toLowerCase().includes("vertex") && !m.provider.toLowerCase().includes("vyce"))).length,
        gatewayExposed: true,
        validationState: "verified",
        description: "Global edge routing for standard models with edge caching and rate limiting shield.",
      },
      vertex: {
        id: "vertex",
        name: "Google Vertex AI",
        provider: "vertex",
        baseUrl: "https://aiplatform.googleapis.com/v1/projects/673403509107/locations/us-central1/publishers/google",
        apiType: "google-vertex-sse",
        modelCount: adminModels.filter((m) => m.provider.toLowerCase().includes("vertex") || m.provider.toLowerCase().includes("google")).length || 5,
        gatewayExposed: true,
        validationState: "verified",
        description: "Enterprise Google Cloud provider with Gemini 2.5 Flash through Gemini 3.8 Flash models.",
      },
      vyce: {
        id: "vyce",
        name: "Vyce AI",
        provider: "vyce",
        baseUrl: "https://vyceai.com/v1",
        apiType: "openai-compatible-sse",
        modelCount: adminModels.filter((m) => m.provider.toLowerCase().includes("vyce")).length || 3,
        gatewayExposed: true,
        validationState: "verified",
        description: "High-speed inference endpoint optimized for real-time site generation and code changes.",
      },
      custom: {
        id: "custom",
        name: "Direct & Custom Providers",
        provider: "custom",
        baseUrl: "Local VM Runner & Custom Endpoints",
        apiType: "dynamic-custom-sse",
        modelCount: adminModels.filter((m) => m.provider.toLowerCase().includes("custom")).length,
        gatewayExposed: false,
        validationState: "configurable",
        description: "Custom OpenAI-compatible base URLs, direct API keys, and local VM runner models.",
      },
    }

    const matched = meta[providerId] || {
      id: providerId,
      name: providerId.charAt(0).toUpperCase() + providerId.slice(1),
      provider: providerId,
      baseUrl: "Configured API Endpoint",
      apiType: "openai-compatible-sse",
      modelCount: adminModels.filter((m) => m.provider.toLowerCase().includes(providerId)).length,
      gatewayExposed: true,
      validationState: "verified",
      description: `${providerId} model integration and routing.`,
    }

    setSelectedProviderSettings(matched)
    setProviderSettingsOpen(true)
  }

  const handleToggleShardSuspension = async () => {

    if (!suspendConfirmDb) return
    const isCurrentlySuspended = suspendConfirmDb.status === "suspended"
    const action = isCurrentlySuspended ? "resume" : "suspend"

    setSuspendingLoading(true)
    try {
      const res = await fetch("/api/moderator/databases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          databaseId: suspendConfirmDb.id,
          reason: suspendReason || (isCurrentlySuspended ? "Shard resumed by moderator" : "Suspension applied by moderator"),
        }),
      })
      const data = await res.json()
      if (data?.ok) {
        toast.success(
          isCurrentlySuspended
            ? `Shard ${suspendConfirmDb.name} resumed`
            : `Shard ${suspendConfirmDb.name} suspended`
        )
        setSuspendConfirmDb(null)
        setSuspendReason("")
        fetchDatabases()
      } else {
        toast.error(data?.error || "Failed to toggle shard status")
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to update shard status")
    } finally {
      setSuspendingLoading(false)
    }
  }

  const fetchTelemetry = async () => {
    setTelemetryLoading(true)
    try {
      const severityParam = telemetrySeverityFilter !== "all" ? `&severity=${telemetrySeverityFilter}` : ""
      const res = await fetch(`/api/moderator/telemetry?limit=50${severityParam}`)
      const data = await res.json()
      if (data?.ok && Array.isArray(data.events)) {
        setTelemetryEvents(data.events)
      }
    } catch (e) {
      console.error("Error fetching telemetry:", e)
    } finally {
      setTelemetryLoading(false)
    }
  }

  const handleResolveTelemetry = async (eventId: string, resolution_status: "acknowledged" | "resolved") => {
    try {
      const res = await fetch("/api/moderator/telemetry", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId, resolution_status }),
      })
      const data = await res.json()
      if (data?.ok) {
        setTelemetryEvents((prev) =>
          prev.map((evt) => (evt.event_id === eventId ? { ...evt, resolution_status } : evt))
        )
      }
    } catch (e) {
      console.error("Error updating telemetry resolution:", e)
    }
  }

  const handleVmAction = async (action: string) => {
    setVmActionLoading(true)
    try {
      const res = await fetch("/api/admin/vps-runner/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data?.success || res.ok) {
        toast.success(`VM Runner action "${action}" completed successfully`)
      } else {
        toast.info(`Action "${action}" sent to control plane`)
      }
    } catch (e: any) {
      toast.error(`Action error: ${e?.message || "Failed to contact VM"}`)
    } finally {
      setVmActionLoading(false)
      setRestartConfirmOpen(false)
    }
  }

  const handleSyncHandshake = async () => {
    try {
      const res = await fetch("/api/ai/handshake/sync-providers", { method: "POST" })
      const data = await res.json()
      if (data?.ok) {
        toast.success("Synchronized providers with Ubuntu VM runner")
      } else {
        toast.info("Handshake recorded in local control cache")
      }
    } catch {
      toast.info("Handshake ping completed")
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
        toast.success(`Report marked as ${status}`)
        fetchOverview()
      } else {
        toast.error(data.error || "Failed to update case")
      }
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "M"

  const navItems = [
    { id: "general" as ModeratorTab, label: "General", icon: LayoutDashboard },
    { id: "users" as ModeratorTab, label: "Users", icon: Users },
    { id: "providers" as ModeratorTab, label: "Providers", icon: Cpu },
    { id: "databases" as ModeratorTab, label: "Databases", icon: Database },
    { id: "servers" as ModeratorTab, label: "Servers", icon: Server },
    { id: "astro" as ModeratorTab, label: "Astro", icon: Gauge },
    { id: "tickets" as ModeratorTab, label: "Tickets", icon: LifeBuoy },
    { id: "broadcast" as ModeratorTab, label: "Broadcast", icon: Megaphone },
  ]

  // Filter models for selected provider
  const getFilteredModelsForProvider = () => {
    if (!selectedProviderId) return adminModels
    const query = modelSearch.toLowerCase().trim()
    return adminModels.filter((m) => {
      const providerMatches =
        selectedProviderId === "all" ||
        m.provider.toLowerCase() === selectedProviderId.toLowerCase() ||
        (selectedProviderId === "vertex" && (m.provider.includes("vertex") || m.id.includes("gemini"))) ||
        (selectedProviderId === "vercel" && (m.provider.includes("vercel") || m.provider === "openai" || m.provider === "anthropic")) ||
        (selectedProviderId === "vyce" && (m.provider.includes("vyce") || m.id.includes("vyce"))) ||
        (selectedProviderId === "custom" && (m.provider.includes("custom") || m.provider.includes("ollama")))

      if (!providerMatches) return false
      if (!query) return true
      return (
        m.id.toLowerCase().includes(query) ||
        m.displayName.toLowerCase().includes(query) ||
        m.provider.toLowerCase().includes(query)
      )
    })
  }

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased flex flex-col selection:bg-[var(--surface-raised)] selection:text-[var(--foreground)]">
      {/* Global Dashboard Header */}
      <header className="border-b border-[var(--border)] sticky top-0 bg-[var(--background)]/90 backdrop-blur supports-[backdrop-filter]:bg-[var(--background)]/75 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          {/* Brand & Moderator Typography */}
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <Image
                src="/logo.png"
                alt="Sycord Logo"
                width={26}
                height={26}
                className="rounded-[var(--radius-inner)] object-contain shrink-0 transition-transform group-hover:scale-105"
                priority
              />
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-[var(--foreground)] tracking-tight font-[family-name:var(--font-display)]">
                  Sycord
                </span>
                <span className="text-xs font-medium text-[var(--text-muted)] tracking-normal">
                  for Moderators
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Tabs (Master 7 Tabs) */}
          <div className="hidden lg:flex items-center">
            <div className="inline-flex items-center justify-center rounded-[var(--radius-control)] bg-[var(--surface-muted)] p-1 border border-[var(--border)] text-[var(--text-secondary)] shadow-[var(--shadow-card)]">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id)
                      if (item.id === "providers") setSelectedProviderId(null)
                    }}
                    className={cn(
                      "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-[var(--radius-inner)] px-3 py-1.5 text-xs font-medium transition-all select-none",
                      isActive
                        ? "bg-[var(--surface-raised)] text-[var(--foreground)] border border-[var(--border-strong)] shadow-[var(--shadow-floating)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Right Header Controls & Moderator Profile */}
          <div className="flex items-center gap-2 sm:gap-3">

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 sm:h-9 sm:w-9 rounded-full p-0 ring-1 ring-[var(--border)]"
                >
                  <Avatar className="h-8 w-8 sm:h-9 sm:w-9">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                    <AvatarFallback className="bg-[var(--foreground)] text-[var(--background)] text-xs font-semibold">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56 bg-[var(--surface-raised)] border-[var(--border-strong)] text-[var(--foreground)] rounded-[var(--radius-panel)] shadow-[var(--shadow-overlay)]"
                align="end"
                forceMount
              >
                <DropdownMenuLabel className="font-normal p-3">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-semibold leading-none text-[var(--foreground)]">
                      {session?.user?.name || "Moderator"}
                    </p>
                    <p className="text-xs leading-none text-[var(--text-muted)] truncate">
                      {session?.user?.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-[var(--border)]" />
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard")}
                  className="cursor-pointer hover:bg-[var(--surface)] text-xs p-2.5"
                >
                  <ExternalLink className="mr-2 h-4 w-4 text-[var(--text-muted)]" />
                  <span>Exit to User Dashboard</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-[var(--border)]" />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/" })}
                  className="text-[var(--danger)] focus:text-[var(--danger)] cursor-pointer hover:bg-[var(--danger-muted)] text-xs p-2.5"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sign out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Mobile / Tablet Horizontal Navigation Scrollbar */}
        <div className="lg:hidden border-t border-[var(--border)] overflow-x-auto custom-scrollbar px-4 py-2 bg-[var(--background)]">
          <div className="flex items-center gap-1.5 min-w-max">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    if (item.id === "providers") setSelectedProviderId(null)
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 whitespace-nowrap rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-medium transition-all select-none",
                    isActive
                      ? "bg-[var(--surface-raised)] text-[var(--foreground)] border border-[var(--border-strong)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface)]"
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
        <SheetContent
          side="left"
          className="bg-[var(--surface)] border-r border-[var(--border)] text-[var(--foreground)] p-0 w-72 flex flex-col"
        >
          <SheetHeader className="h-14 px-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Image
                src="/logo.png"
                alt="Sycord Logo"
                width={22}
                height={22}
                className="rounded-[var(--radius-inner)] object-contain shrink-0"
              />
              <div>
                <SheetTitle className="text-xs font-semibold text-[var(--foreground)] leading-none text-left">
                  Sycord for Moderators
                </SheetTitle>
                <p className="text-[10px] text-[var(--text-muted)] leading-none mt-1 text-left">
                  Control & Safety Console
                </p>
              </div>
            </div>
          </SheetHeader>

          <div className="p-3 space-y-1 flex-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = activeTab === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id)
                    if (item.id === "providers") setSelectedProviderId(null)
                    setMobileMenuOpen(false)
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--radius-control)] text-xs font-medium transition-colors select-none text-left",
                    isActive
                      ? "bg-[var(--surface-raised)] text-[var(--foreground)] border border-[var(--border-strong)]"
                      : "text-[var(--text-secondary)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>

          <div className="p-3 border-t border-[var(--border)] space-y-2">
            <Button
              variant="outline"
              onClick={() => router.push("/dashboard")}
              className="w-full justify-start h-8 px-2.5 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)] border-[var(--border)] bg-[var(--surface-raised)] gap-2 rounded-[var(--radius-control)]"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Exit to Dashboard</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Main Moderator Viewport */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
        {/* =========================================================================
            TAB 1: GENERAL (COMMAND CENTER: ALERTS, QUICK ACTIONS, OBSERVED TOPOLOGY)
           ========================================================================= */}
        {activeTab === "general" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--foreground)] font-[family-name:var(--font-display)]">
                  Moderator Command Center
                </h1>
                <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5">
                  Platform operational integrity, quick section access, and verified system topology
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchOverview}
                  className="h-8 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)] gap-1.5 rounded-[var(--radius-control)]"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                  <span>Refresh Status</span>
                </Button>
              </div>
            </div>

            {/* SECTION 1: Active Warnings / Calm No Active Warnings State */}
            {systemAlerts.length === 0 ? (
              <div className="p-4 sm:p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] flex items-center gap-3.5 shadow-[var(--shadow-card)]">
                <div className="w-10 h-10 rounded-[var(--radius-inner)] bg-[var(--success-muted)] border border-[var(--success)]/20 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">No Active Warnings</h3>
                    <Badge variant="outline" className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] font-mono px-2 py-0 rounded-[var(--radius-full)]">
                      Nominal
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Storage cluster, VM runtime host, and provider routing services are operating without incident.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {systemAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 rounded-[var(--radius-panel)] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[var(--shadow-card)]",
                      alert.severity === "critical"
                        ? "bg-[var(--danger-muted)] border-[var(--danger)]/30 text-[var(--foreground)]"
                        : alert.severity === "warning"
                        ? "bg-[var(--warning-muted)] border-[var(--warning)]/30 text-[var(--foreground)]"
                        : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)]"
                    )}
                  >
                    <div className="flex items-start sm:items-center gap-3 min-w-0">
                      <div className={cn(
                        "w-8 h-8 rounded-[var(--radius-inner)] border flex items-center justify-center shrink-0 mt-0.5 sm:mt-0",
                        alert.severity === "critical"
                          ? "bg-[var(--danger)]/15 border-[var(--danger)]/30 text-[var(--danger)]"
                          : alert.severity === "warning"
                          ? "bg-[var(--warning)]/15 border-[var(--warning)]/30 text-[var(--warning)]"
                          : "bg-[var(--surface-muted)] border-[var(--border)] text-[var(--info)]"
                      )}>
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-semibold text-[var(--foreground)]">{alert.title}</h4>
                        <p className="text-[11px] text-[var(--text-secondary)] mt-0.5">{alert.description}</p>
                      </div>
                    </div>
                    {alert.targetTab && alert.targetTab !== "general" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setActiveTab(alert.targetTab)
                          if (alert.targetTab === "providers") setSelectedProviderId(null)
                        }}
                        className="h-7 px-3 text-xs border-[var(--border-strong)] bg-[var(--surface-raised)] hover:bg-[var(--surface)] text-[var(--foreground)] rounded-[var(--radius-control)] shrink-0 self-start sm:self-auto gap-1"
                      >
                        <span>Open {alert.targetTab.charAt(0).toUpperCase() + alert.targetTab.slice(1)}</span>
                        <ArrowRight className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* SECTION 2: Operational Dispatch & Quick Actions */}
            <div className="space-y-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                Operational Dispatch & Quick Actions
              </span>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <button
                  onClick={() => {
                    setActiveTab("providers")
                    setSelectedProviderId(null)
                  }}
                  className="group p-3.5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] text-left transition-all shadow-[var(--shadow-card)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                      <Cpu className="w-4 h-4 text-[var(--foreground)]" />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]">
                      AI GATEWAY
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--foreground)] group-hover:text-white flex items-center justify-between">
                      <span>Providers & Models</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      Configure endpoints, model visibility, and costs
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("databases")}
                  className="group p-3.5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] text-left transition-all shadow-[var(--shadow-card)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                      <Database className="w-4 h-4 text-[var(--foreground)]" />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]">
                      STORAGE
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--foreground)] group-hover:text-white flex items-center justify-between">
                      <span>Databases & Shards</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      Inspect user schema records and cluster storage
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("servers")}
                  className="group p-3.5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] text-left transition-all shadow-[var(--shadow-card)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                      <Server className="w-4 h-4 text-[var(--foreground)]" />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]">
                      COMPUTE
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--foreground)] group-hover:text-white flex items-center justify-between">
                      <span>Host Servers & VM</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      Live CPU, RAM load, host runner, and logs
                    </p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("users")}
                  className="group p-3.5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] text-left transition-all shadow-[var(--shadow-card)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                      <Users className="w-4 h-4 text-[var(--foreground)]" />
                    </div>
                    <Badge variant="outline" className="text-[9px] font-mono px-1.5 py-0 bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]">
                      ACCESS
                    </Badge>
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold text-[var(--foreground)] group-hover:text-white flex items-center justify-between">
                      <span>Users & Moderation</span>
                      <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </h3>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5 line-clamp-1">
                      Account directory, regional shards, and credits
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* SECTION 3: Observable Service Health Summary */}
            <Card className="bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-4 shadow-[var(--shadow-card)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--success)]" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] font-mono">
                    Observable Platform Topology
                  </span>
                </div>
                <span className="text-[11px] text-[var(--text-muted)] font-mono">
                  Continuous Status Checks
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {serviceStatuses.map((svc) => {
                  const isHealthy = svc.status === "healthy"
                  const isDegraded = svc.status === "degraded" || svc.status === "unconfigured"
                  return (
                    <div key={svc.id} className="p-3 rounded-[var(--radius-control)] bg-[var(--surface-muted)] border border-[var(--border-subtle)] space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[var(--foreground)]">{svc.name}</span>
                        <span className={cn(
                          "w-2 h-2 rounded-full",
                          isHealthy ? "bg-[var(--success)]" : isDegraded ? "bg-[var(--warning)]" : "bg-[var(--danger)]"
                        )} />
                      </div>
                      <p className="text-[11px] text-[var(--text-muted)]">{svc.location}</p>
                      <p className={cn(
                        "text-[11px] font-mono tabular-nums",
                        isHealthy ? "text-[var(--success)]" : isDegraded ? "text-[var(--warning)]" : "text-[var(--danger)]"
                      )}>
                        {svc.note}
                      </p>
                    </div>
                  )
                })}
              </div>
            </Card>

            {/* Recent Reports / Moderation Feed */}
            <Card className="bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-panel)] shadow-[var(--shadow-card)] overflow-hidden">
              <CardHeader className="p-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Active Moderation Queue</CardTitle>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    User incident flags, safety policy violations, and appeals
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] text-[var(--text-muted)] border-[var(--border)]">
                  {recentReports.length} pending
                </Badge>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-secondary)] font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Subject / Target</th>
                      <th className="py-2.5 px-3">Reporter</th>
                      <th className="py-2.5 px-3">Reason</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {loading ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                          Loading reports queue...
                        </td>
                      </tr>
                    ) : recentReports.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-[var(--text-muted)]">
                          No pending reports in moderation queue. Platform safe.
                        </td>
                      </tr>
                    ) : (
                      recentReports.map((report) => {
                        const targetLabel =
                          report.targetId ||
                          report.reportedUserName ||
                          report.reportedUserEmail ||
                          report.reportedUserId ||
                          "Target"
                        const targetCategory = report.targetType || report.category || "Report"
                        const isOpen =
                          report.status === "open" ||
                          report.status === "reviewing" ||
                          (report.status as any) === "pending"

                        return (
                          <tr key={report.id} className="hover:bg-[var(--surface-raised)]/50 transition-colors">
                            <td className="py-3 px-4">
                              <span className="font-semibold text-[var(--foreground)]">{targetLabel}</span>
                              <p className="text-[10px] text-[var(--text-muted)] capitalize">{targetCategory}</p>
                            </td>
                            <td className="py-3 px-3 text-[var(--text-secondary)]">{report.reporterEmail || "System"}</td>
                            <td className="py-3 px-3 text-[var(--text-secondary)] max-w-xs truncate">{report.reason}</td>
                            <td className="py-3 px-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] uppercase font-mono px-1.5 py-0 rounded-[var(--radius-full)]",
                                  isOpen
                                    ? "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
                                    : "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20"
                                )}
                              >
                                {report.status}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right">
                              {isOpen && (
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleResolveReport(report.id, "dismissed")}
                                    className="h-7 px-2 text-[11px] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--foreground)]"
                                  >
                                    Dismiss
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleResolveReport(report.id, "resolved")}
                                    className="h-7 px-2 text-[11px] bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 font-medium"
                                  >
                                    Resolve
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* =========================================================================
            TAB 2: USERS (LOOKUP, SHARD ASSIGNMENT, CREDITS, WARN, BAN)
           ========================================================================= */}
        {activeTab === "users" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Header & Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--foreground)] font-[family-name:var(--font-display)]">
                  Users Directory
                </h1>
                <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5">
                  Lookup accounts, assign regional database shards, and apply moderation penalties
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fetchUsers(userSearch)}
                  className="h-8 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)] gap-1.5 rounded-[var(--radius-control)]"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", usersLoading && "animate-spin")} />
                  <span>Reload</span>
                </Button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                <Input
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  placeholder="Filter users by email, name, user ID, or IP..."
                  className="pl-9 h-9 text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] rounded-[var(--radius-control)]"
                />
              </div>
              {userSearch && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setUserSearch("")}
                  className="h-9 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]"
                >
                  Clear
                </Button>
              )}
            </div>

            {/* Users Table */}
            <Card className="bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-panel)] shadow-[var(--shadow-card)] overflow-hidden">
              <CardHeader className="p-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-semibold">Registered Accounts</CardTitle>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Select a regional database shard for each user to guarantee optimal local data residency.
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px] text-[var(--text-muted)] border-[var(--border)]">
                  {users.length} accounts
                </Badge>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-secondary)] font-medium">
                    <tr>
                      <th className="py-2.5 px-4">User</th>
                      <th className="py-2.5 px-3">Regional Shard</th>
                      <th className="py-2.5 px-3">Credits Balance</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-4 text-right">Moderation Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {usersLoading ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-[var(--text-muted)]">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading users...
                        </td>
                      </tr>
                    ) : users.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-[var(--text-muted)]">
                          No users matched search criteria.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => {
                        const isAssigning = assigningShardUserId === user.userId
                        return (
                          <tr key={user.userId} className="hover:bg-[var(--surface-raised)]/50 transition-colors">
                            <td className="py-3 px-4">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="h-7 w-7 rounded-full">
                                  <AvatarImage src={user.image || ""} />
                                  <AvatarFallback className="bg-[var(--surface-raised)] text-[var(--foreground)] text-[10px]">
                                    {user.name?.[0]?.toUpperCase() || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <span className="font-semibold text-[var(--foreground)]">{user.name}</span>
                                  <p className="text-[11px] text-[var(--text-muted)] font-mono">{user.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Regional Shard Assignment Selector */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <select
                                  value={user.region || "us-east-1"}
                                  disabled={isAssigning}
                                  onChange={(e) => handleAssignShard(user.userId, e.target.value)}
                                  className="text-xs h-7 px-2 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
                                >
                                  <option value="us-east-1">US East (Master)</option>
                                  <option value="eu-central-1">EU Central (Frankfurt)</option>
                                  <option value="ap-southeast-1">AP Southeast (Singapore)</option>
                                </select>
                                {isAssigning && <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />}
                              </div>
                            </td>

                            {/* Credits Balance with Quick Edit Buttons */}
                            <td className="py-3 px-3">
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono tabular-nums font-semibold text-[var(--foreground)]">
                                  {user.credits ?? 0}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setTargetUser(user)
                                    setCreditActionType("add")
                                    setCreditDialogOpen(true)
                                  }}
                                  className="h-6 w-6 p-0 text-[var(--text-muted)] hover:text-[var(--success)]"
                                  title="Add credits"
                                >
                                  <Plus className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    setTargetUser(user)
                                    setCreditActionType("remove")
                                    setCreditDialogOpen(true)
                                  }}
                                  className="h-6 w-6 p-0 text-[var(--text-muted)] hover:text-[var(--danger)]"
                                  title="Remove credits"
                                >
                                  <Minus className="w-3 h-3" />
                                </Button>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-3 px-3">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-medium px-2 py-0.5 rounded-[var(--radius-full)]",
                                  user.isBlocked
                                    ? "bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/20"
                                    : user.warnings?.length > 0
                                    ? "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
                                    : "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20"
                                )}
                              >
                                {user.isBlocked ? "Banned" : user.warnings?.length > 0 ? "Warned" : "Active"}
                              </Badge>
                            </td>

                            {/* Actions */}
                            <td className="py-3 px-4 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setTargetUser(user)
                                    setWarnDialogOpen(true)
                                  }}
                                  className="h-7 px-2 text-[11px] border-[var(--border)] text-[var(--warning)] hover:bg-[var(--warning-muted)]"
                                >
                                  Warn
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setTargetUser(user)
                                    setBanDialogOpen(true)
                                  }}
                                  className={cn(
                                    "h-7 px-2 text-[11px] border-[var(--border)]",
                                    user.isBlocked
                                      ? "text-[var(--success)] hover:bg-[var(--success-muted)]"
                                      : "text-[var(--danger)] hover:bg-[var(--danger-muted)]"
                                  )}
                                >
                                  {user.isBlocked ? "Unban" : "Ban"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* =========================================================================
            TAB 3: PROVIDERS (MINIMAL CARDS FIRST; SELECTING OPENS MODELS LIST)
           ========================================================================= */}
        {activeTab === "providers" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--foreground)] font-[family-name:var(--font-display)]">
                  {selectedProviderId ? "Provider Models Library" : "AI Providers & Gateway"}
                </h1>
                <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5">
                  {selectedProviderId
                    ? "Configure model library visibility, pricing tiers, and display names"
                    : "Foundation model providers, edge failovers, and token consumption"}
                </p>
              </div>

              {selectedProviderId && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setSelectedProviderId(null)}
                  className="h-8 px-3 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] rounded-[var(--radius-control)] gap-1.5"
                >
                  <span>← Back to Providers</span>
                </Button>
              )}
            </div>

            {/* LEVEL 1: MINIMAL PROVIDER CARDS (When no provider selected) */}
            {!selectedProviderId ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Card 1: Vercel AI Gateway */}
                  <div
                    onClick={() => setSelectedProviderId("vercel")}
                    className="cursor-pointer group p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] transition-all shadow-[var(--shadow-card)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                        <ProviderLogo provider="vercel" size={20} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] rounded-[var(--radius-full)]"
                        >
                          Active
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openProviderSettings("vercel")
                          }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] rounded-[var(--radius-inner)] hover:bg-[var(--surface-muted)] transition-colors"
                          title="Provider Settings"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-white flex items-center gap-1.5">
                        <span>Vercel AI Gateway</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                        Global edge routing for standard models with edge caching and rate limiting shield.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Edge Routing</span>
                      <span className="font-mono text-[var(--foreground)]">Global Active</span>
                    </div>
                  </div>

                  {/* Card 2: Google Vertex AI */}
                  <div
                    onClick={() => setSelectedProviderId("vertex")}
                    className="cursor-pointer group p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] transition-all shadow-[var(--shadow-card)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                        <ProviderLogo provider="vertex" size={20} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] rounded-[var(--radius-full)]"
                        >
                          Verified
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openProviderSettings("vertex")
                          }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] rounded-[var(--radius-inner)] hover:bg-[var(--surface-muted)] transition-colors"
                          title="Provider Settings"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-white flex items-center gap-1.5">
                        <span>Google Vertex AI</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                        Enterprise Google Cloud provider with Gemini 2.5 Flash through Gemini 3.8 Flash models.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Regional Publisher</span>
                      <span className="font-mono text-[var(--foreground)]">us-central1</span>
                    </div>
                  </div>

                  {/* Card 3: Vyce AI */}
                  <div
                    onClick={() => setSelectedProviderId("vyce")}
                    className="cursor-pointer group p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] transition-all shadow-[var(--shadow-card)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                        <ProviderLogo provider="vyce" size={20} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20 text-[10px] rounded-[var(--radius-full)]"
                        >
                          Operational
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openProviderSettings("vyce")
                          }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] rounded-[var(--radius-inner)] hover:bg-[var(--surface-muted)] transition-colors"
                          title="Provider Settings"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-white flex items-center gap-1.5">
                        <span>Vyce AI</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                        High-speed inference endpoint optimized for real-time site generation and code changes.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Inference Endpoint</span>
                      <span className="font-mono text-[var(--foreground)]">vyceai.com/v1</span>
                    </div>
                  </div>

                  {/* Card 4: Direct & Custom Providers */}
                  <div
                    onClick={() => setSelectedProviderId("custom")}
                    className="cursor-pointer group p-5 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] hover:border-[var(--border-strong)] transition-all shadow-[var(--shadow-card)] space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-9 h-9 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center">
                        <ProviderLogo provider="custom" size={20} />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant="outline"
                          className="bg-[var(--info-muted)] text-[var(--info)] border-[var(--info)]/20 text-[10px] rounded-[var(--radius-full)]"
                        >
                          Configurable
                        </Badge>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openProviderSettings("custom")
                          }}
                          className="p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] rounded-[var(--radius-inner)] hover:bg-[var(--surface-muted)] transition-colors"
                          title="Provider Settings"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-white flex items-center gap-1.5">
                        <span>Custom Providers</span>
                        <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                      </h3>
                      <p className="text-xs text-[var(--text-muted)] mt-1 line-clamp-2">
                        Custom OpenAI-compatible base URLs, direct API keys, and local VM runner models.
                      </p>
                    </div>

                    <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                      <span>Direct Runner</span>
                      <span className="font-mono text-[var(--foreground)]">Local Runtime</span>
                    </div>
                  </div>
                </div>

                {/* AI Usage & Metrics Summary */}
                <Card className="bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-5 shadow-[var(--shadow-card)] space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border-subtle)] pb-3">
                    <div>
                      <h3 className="text-sm font-semibold">Aggregated AI Token Throughput</h3>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Real-time token distribution across all providers
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Popover open={periodComboboxOpen} onOpenChange={setPeriodComboboxOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 w-32 justify-between bg-[var(--surface-muted)] border-[var(--border)] text-xs text-[var(--foreground)] rounded-[var(--radius-control)]"
                          >
                            {PERIOD_OPTIONS.find((p) => p.value === usagePeriod)?.label || "Select period"}
                            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-32 p-0 bg-[var(--surface-raised)] border-[var(--border-strong)] text-[var(--foreground)]">
                          <Command className="bg-[var(--surface-raised)] text-[var(--foreground)]">
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
                                    className="text-xs cursor-pointer hover:bg-[var(--surface)] flex items-center justify-between"
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
                        className="h-8 px-2 text-[var(--text-muted)] hover:text-[var(--foreground)]"
                      >
                        <RefreshCw className={cn("w-3.5 h-3.5", usageLoading && "animate-spin")} />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <MetricCard
                      title="Total Tokens"
                      value={usageData.summary.totalTokens.toLocaleString()}
                      changeText={`${usagePeriod} recorded`}
                      icon={Cpu}
                      iconColor="text-[var(--success)]"
                    />
                    <MetricCard
                      title="Prompt Tokens"
                      value={usageData.summary.totalInputTokens.toLocaleString()}
                      changeText="Tool & system context"
                      icon={Layers}
                      iconColor="text-[var(--info)]"
                    />
                    <MetricCard
                      title="Completion Tokens"
                      value={usageData.summary.totalOutputTokens.toLocaleString()}
                      changeText="Synthesized responses"
                      icon={Sparkles}
                      iconColor="text-[var(--foreground)]"
                    />
                    <MetricCard
                      title="Requests"
                      value={usageData.summary.totalRequests.toLocaleString()}
                      changeText="Model executions"
                      icon={Activity}
                      iconColor="text-[var(--warning)]"
                    />
                  </div>
                </Card>
              </div>
            ) : (
              /* LEVEL 2: DETAILED MODELS LIST FOR THE SELECTED PROVIDER */
              <div className="space-y-4">
                {/* Search & Provider Actions */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-muted)]" />
                    <Input
                      value={modelSearch}
                      onChange={(e) => setModelSearch(e.target.value)}
                      placeholder={`Filter models for provider (${selectedProviderId})...`}
                      className="pl-9 h-9 text-base sm:text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] placeholder:text-[var(--text-muted)] rounded-[var(--radius-control)]"
                    />
                  </div>
                  {modelSearch && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setModelSearch("")}
                      className="h-9 px-2 text-xs text-[var(--text-muted)] hover:text-[var(--foreground)]"
                    >
                      Clear
                    </Button>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBulkModelAction("enable_all")
                        setBulkModelModalOpen(true)
                      }}
                      className="h-9 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--foreground)] rounded-[var(--radius-control)] gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-[var(--success)]" />
                      <span>Enable all</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setBulkModelAction("disable_all")
                        setBulkModelModalOpen(true)
                      }}
                      className="h-9 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-raised)] text-[var(--text-secondary)] hover:text-[var(--danger)] rounded-[var(--radius-control)] gap-1"
                    >
                      <Ban className="w-3.5 h-3.5 text-[var(--danger)]" />
                      <span>Disable all</span>
                    </Button>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openProviderSettings(selectedProviderId)}
                      className="h-9 px-3 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-raised)] rounded-[var(--radius-control)] gap-1.5"
                    >
                      <Sliders className="w-3.5 h-3.5" />
                      <span>Settings</span>
                    </Button>
                  </div>
                </div>

                {/* Models Table */}
                <Card className="bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-panel)] shadow-[var(--shadow-card)] overflow-hidden">
                  <CardHeader className="p-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold capitalize">
                        {selectedProviderId} Models & Library Display
                      </CardTitle>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Toggle visibility to expose models in the frontend selector. Edit display names directly.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-[var(--text-muted)] border-[var(--border)]">
                      {getFilteredModelsForProvider().length} models
                    </Badge>
                  </CardHeader>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-secondary)] font-medium">
                        <tr>
                          <th className="py-2.5 px-4 w-16">In Library</th>
                          <th className="py-2.5 px-4">Display Name (Frontend Selector)</th>
                          <th className="py-2.5 px-3">Gateway Model ID</th>
                          <th className="py-2.5 px-3">Provider</th>
                          <th className="py-2.5 px-3">Pricing (In/Out 1M)</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {adminModelsLoading ? (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-[var(--text-muted)]">
                              <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                              Loading provider models catalog...
                            </td>
                          </tr>
                        ) : getFilteredModelsForProvider().length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-12 text-center text-[var(--text-muted)]">
                              No models configured for this provider.
                            </td>
                          </tr>
                        ) : (
                          getFilteredModelsForProvider().map((m) => {
                            const isEditing = editingModelId === m.id
                            return (
                              <tr key={m.id} className="hover:bg-[var(--surface-raised)]/50 transition-colors">
                                {/* Toggle Visibility Switch */}
                                <td className="py-3 px-4">
                                  <Switch
                                    checked={m.enabledInLibrary}
                                    onCheckedChange={() => handleToggleModelInLibrary(m.id, m.enabledInLibrary)}
                                    className="data-[state=checked]:bg-[var(--success)]"
                                  />
                                </td>

                                {/* Display Name with Inline Editor */}
                                <td className="py-3 px-4">
                                  {isEditing ? (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        value={editDisplayName}
                                        onChange={(e) => setEditDisplayName(e.target.value)}
                                        className="h-7 text-xs bg-[var(--surface-muted)] border-[var(--border)] text-[var(--foreground)] w-48 rounded-[var(--radius-inner)]"
                                        autoFocus
                                      />
                                      <Button
                                        size="sm"
                                        onClick={() => handleSaveModelDisplayName(m.id, editDisplayName)}
                                        disabled={savingModelId === m.id}
                                        className="h-7 px-2 text-[11px] bg-[var(--foreground)] text-[var(--background)] font-medium"
                                      >
                                        {savingModelId === m.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Save className="w-3 h-3" />
                                        )}
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingModelId(null)
                                          setEditDisplayName("")
                                        }}
                                        className="h-7 px-2 text-[11px] text-[var(--text-muted)]"
                                      >
                                        <X className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2 group/edit">
                                      <span className="font-semibold text-[var(--foreground)]">{m.displayName}</span>
                                      <button
                                        onClick={() => {
                                          setEditingModelId(m.id)
                                          setEditDisplayName(m.displayName)
                                        }}
                                        className="opacity-0 group-hover/edit:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--foreground)] transition-opacity"
                                        title="Rename in selector"
                                      >
                                        <Edit3 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </td>

                                <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)]">{m.id}</td>
                                <td className="py-3 px-3 capitalize text-[var(--text-muted)]">{m.provider}</td>
                                <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)]">
                                  {m.inputCostDisplay || "$0.00"} / {m.outputCostDisplay || "$0.00"}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[10px] font-mono px-2 py-0.5 rounded-[var(--radius-full)]",
                                      m.enabledInLibrary
                                        ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20"
                                        : "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]"
                                    )}
                                  >
                                    {m.enabledInLibrary ? "Visible" : "Hidden"}
                                  </Badge>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 4: DATABASES (MASTER & REGIONAL SHARDS, SAFE MIGRATION WIZARD)
           ========================================================================= */}
        {activeTab === "databases" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--foreground)] font-[family-name:var(--font-display)]">
                  Databases & Regional Sharding
                </h1>
                <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5">
                  Master control store, regional replica shards, suspension safeguards, and zero-downtime migration
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => setMigrateModalOpen(true)}
                  className="h-8 px-3 text-xs bg-[var(--foreground)] text-[var(--background)] hover:opacity-90 font-medium rounded-[var(--radius-control)] gap-1.5"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Launch Migration Wizard</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchDatabases}
                  className="h-8 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)] gap-1 rounded-[var(--radius-control)]"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", databasesLoading && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Databases Table or Restrained Empty State */}
            {!databasesConfigured || databases.length === 0 ? (
              <div className="py-12 px-6 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)] text-center space-y-3">
                <div className="w-10 h-10 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center mx-auto text-[var(--text-muted)]">
                  <Database className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[var(--foreground)]">No Shards Configured</h3>
                  <p className="text-xs text-[var(--text-muted)] max-w-md mx-auto">
                    Turso / LibSQL database cluster connection is not configured in this environment. Supply <code className="text-[var(--foreground)]">TURSO_DATABASE_URL</code> and auth token to activate cluster routing.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <Card className="bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-panel)] shadow-[var(--shadow-card)] overflow-hidden">
                  <CardHeader className="p-4 border-b border-[var(--border)] flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-semibold">Active Database Clusters & Shards</CardTitle>
                      <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                        Turso-backed document tables and replica nodes. Click Inspect to review safe records.
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] text-[var(--text-muted)] border-[var(--border)]">
                      {databases.length} registered
                    </Badge>
                  </CardHeader>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-secondary)] font-medium">
                        <tr>
                          <th className="py-2.5 px-4">Cluster / Shard Name</th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3">Location</th>
                          <th className="py-2.5 px-3">Status</th>
                          <th className="py-2.5 px-3">Latency</th>
                          <th className="py-2.5 px-3">Storage</th>
                          <th className="py-2.5 px-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--border)]">
                        {databases.map((db) => {
                          const isSuspended = db.status === "suspended"
                          return (
                            <tr key={db.id} className="hover:bg-[var(--surface-raised)]/50 transition-colors">
                              <td className="py-3 px-4 font-semibold text-[var(--foreground)]">
                                <div className="flex items-center gap-2">
                                  <Database className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                                  <span>{db.name}</span>
                                </div>
                              </td>
                              <td className="py-3 px-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-mono px-2 py-0.5 rounded-[var(--radius-inner)]",
                                    db.type === "master"
                                      ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                                      : "bg-[var(--surface-muted)] text-[var(--text-secondary)] border-[var(--border)]"
                                  )}
                                >
                                  {db.type.toUpperCase()}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 text-[var(--text-secondary)]">
                                {db.regionLabel || db.region}
                              </td>
                              <td className="py-3 px-3">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] font-mono px-2 py-0.5 rounded-[var(--radius-full)]",
                                    isSuspended
                                      ? "bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/20"
                                      : "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20"
                                  )}
                                >
                                  {isSuspended ? "Suspended" : "Operational"}
                                </Badge>
                              </td>
                              <td className="py-3 px-3 font-mono text-[var(--foreground)] tabular-nums">
                                {db.latencyMs} ms
                              </td>
                              <td className="py-3 px-3">
                                <div className="space-y-1 w-28">
                                  <div className="h-1.5 w-full bg-[var(--border)] rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-[var(--foreground)] transition-all duration-300"
                                      style={{
                                        width: `${Math.min(100, Math.round((db.storageUsedMb / Math.max(1, db.storageLimitMb || 1000)) * 100))}%`,
                                      }}
                                    />
                                  </div>
                                  <div className="font-mono text-[10px] text-[var(--text-secondary)] tabular-nums">
                                    {db.storageUsedMb} MB / {db.storageLimitMb} MB
                                  </div>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      setSelectedInspectDb(db)
                                      setInspectModalOpen(true)
                                    }}
                                    className="h-7 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:bg-[var(--surface-raised)] rounded-[var(--radius-control)]"
                                  >
                                    Inspect Records
                                  </Button>
                                  {db.type !== "master" && (
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        setSuspendConfirmDb(db)
                                        setSuspendReason("")
                                      }}
                                      className={cn(
                                        "h-7 px-2 text-xs",
                                        isSuspended
                                          ? "text-[var(--success)] hover:text-[var(--success)] hover:bg-[var(--success-muted)]"
                                          : "text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger-muted)]"
                                      )}
                                    >
                                      {isSuspended ? "Resume" : "Suspend"}
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 5: SERVERS (NODES, VM RUNNER SERVICE CONTROLS, TELEMETRY)
           ========================================================================= */}
        {activeTab === "servers" && (
          <div className="space-y-6 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[var(--border)] pb-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--foreground)] font-[family-name:var(--font-display)]">
                  Servers & Control Plane
                </h1>
                <p className="text-xs md:text-sm text-[var(--text-secondary)] mt-0.5">
                  Primary execution VM runner, standby failover node, and centralized telemetry
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={fetchTelemetry}
                  className="h-8 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)] gap-1.5 rounded-[var(--radius-control)]"
                >
                  <RefreshCw className={cn("w-3.5 h-3.5", telemetryLoading && "animate-spin")} />
                  <span>Refresh Telemetry</span>
                </Button>
              </div>
            </div>

            {/* Top Reference Component: System Performance Overview */}
            <ServerPerformanceOverview
              onScrollToDetails={() => {
                const el = document.getElementById("server-operational-events")
                if (el) el.scrollIntoView({ behavior: "smooth" })
              }}
            />

            {/* VM Service Controls Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-[var(--radius-panel)] border border-[var(--border)] bg-[var(--surface)]">
              <div>
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Host Services & Runner Controls</h3>
                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                  Direct supervisor controls for Syte VM runner and gateway sync
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRestartConfirmOpen(true)}
                  disabled={vmActionLoading}
                  className="h-8 px-3 text-xs border-[var(--border)] text-[var(--danger)] hover:bg-[var(--danger-muted)] rounded-[var(--radius-control)] gap-1.5"
                >
                  <Power className="w-3.5 h-3.5" />
                  <span>Restart VM Runner</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleVmAction("flush_cache")}
                  disabled={vmActionLoading}
                  className="h-8 px-3 text-xs border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-raised)] rounded-[var(--radius-control)] gap-1.5"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Flush Cache</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSyncHandshake}
                  className="h-8 px-3 text-xs border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-raised)] rounded-[var(--radius-control)] gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Providers</span>
                </Button>
              </div>
            </div>

            {/* Centralized Request & Error Telemetry Table */}
            <Card id="server-operational-events" className="bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-panel)] shadow-[var(--shadow-card)] overflow-hidden">
              <CardHeader className="p-4 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold">Operational Telemetry & Event Stream</CardTitle>
                  <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                    Unified structured event stream across gateways, omni-router, and Ubuntu VM runner
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={telemetrySeverityFilter}
                    onChange={(e) => {
                      setTelemetrySeverityFilter(e.target.value)
                      setTimeout(fetchTelemetry, 10)
                    }}
                    className="text-xs h-7 px-2 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] text-[var(--foreground)] focus:border-[var(--border-strong)] outline-none"
                  >
                    <option value="all">All Severities</option>
                    <option value="error">Errors & Critical</option>
                    <option value="warning">Warnings</option>
                    <option value="info">Info / Normal</option>
                  </select>
                </div>
              </CardHeader>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-secondary)] font-medium">
                    <tr>
                      <th className="py-2.5 px-4">Time</th>
                      <th className="py-2.5 px-3">Severity</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-4">Operation & Message</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {telemetryLoading ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-[var(--text-muted)]">
                          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                          Loading telemetry events...
                        </td>
                      </tr>
                    ) : telemetryEvents.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-12 text-center text-[var(--text-muted)]">
                          No events recorded matching criteria.
                        </td>
                      </tr>
                    ) : (
                      telemetryEvents.map((evt) => (
                        <tr
                          key={evt.event_id}
                          onClick={() => {
                            setSelectedTelemetryEvent(evt)
                            setTelemetryModalOpen(true)
                          }}
                          className="hover:bg-[var(--surface-raised)]/60 cursor-pointer transition-colors"
                        >
                          <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-muted)] tabular-nums whitespace-nowrap">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </td>
                          <td className="py-3 px-3">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-mono uppercase px-1.5 py-0 rounded-[var(--radius-full)]",
                                evt.severity === "critical" || evt.severity === "error"
                                  ? "bg-[var(--danger-muted)] text-[var(--danger)] border-[var(--danger)]/20"
                                  : evt.severity === "warning"
                                  ? "bg-[var(--warning-muted)] text-[var(--warning)] border-[var(--warning)]/20"
                                  : "bg-[var(--info-muted)] text-[var(--info)] border-[var(--info)]/20"
                              )}
                            >
                              {evt.severity}
                            </Badge>
                          </td>
                          <td className="py-3 px-3 font-semibold text-[var(--foreground)] whitespace-nowrap">
                            {evt.service}
                          </td>
                          <td className="py-3 px-4 max-w-sm truncate text-[var(--text-secondary)]">
                            <span className="font-mono text-[11px] text-[var(--foreground)] mr-1.5">{evt.operation}</span>
                            <span>{evt.message}</span>
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] tabular-nums text-[var(--foreground)]">
                            {evt.http_status}
                          </td>
                          <td className="py-3 px-3 font-mono text-[11px] tabular-nums text-[var(--text-secondary)]">
                            {evt.duration_ms}ms
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedTelemetryEvent(evt)
                                setTelemetryModalOpen(true)
                              }}
                              className="h-6 px-2 text-[10px] text-[var(--text-muted)] hover:text-[var(--foreground)]"
                            >
                              Inspect
                            </Button>
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
            TAB 6: ASTRO (VM DIAGNOSTICS & SAFE AGENT WORKFLOWS)
           ========================================================================= */}
        {activeTab === "astro" && <AstroControlCenter />}

        {/* =========================================================================
            TAB 7: TICKETS ("UNDER CONSTRUCTION" PLACEHOLDER)
           ========================================================================= */}
        {activeTab === "tickets" && (
          <UnderConstructionCard
            title="Support Ticket Desk"
            subtitle="Moderator Support & User Inquiries"
            description="The unified moderator ticketing system is currently undergoing infrastructure and safety database sharding migration. In-progress tickets are safely preserved in storage."
            icon={LifeBuoy}
          />
        )}

        {/* =========================================================================
            TAB 8: BROADCAST ("UNDER CONSTRUCTION" PLACEHOLDER)
           ========================================================================= */}
        {activeTab === "broadcast" && (
          <UnderConstructionCard
            title="System Broadcast Console"
            subtitle="Platform-wide Announcements & Banners"
            description="Global banner announcements and emergency alert broadcasts are undergoing real-time WebSocket delivery and region-shard routing upgrades."
            icon={Megaphone}
          />
        )}
      </main>

      {/* =========================================================================
          REUSABLE MODALS & DIALOGS
         ========================================================================= */}

      {/* Credit Dialog */}
      <CreditDialog
        open={creditDialogOpen}
        onOpenChange={setCreditDialogOpen}
        user={targetUser}
        actionType={creditActionType}
        onSuccess={() => fetchUsers(userSearch)}
      />

      {/* Ban Dialog */}
      <BanDialog
        open={banDialogOpen}
        onOpenChange={setBanDialogOpen}
        user={targetUser}
        onSuccess={() => fetchUsers(userSearch)}
      />

      {/* Warn Dialog */}
      <WarnDialog
        open={warnDialogOpen}
        onOpenChange={setWarnDialogOpen}
        user={targetUser}
        onSuccess={() => fetchUsers(userSearch)}
      />

      {/* Database Safe Migration Wizard Modal */}
      <DatabaseMigrateModal
        open={migrateModalOpen}
        onOpenChange={setMigrateModalOpen}
        databases={databases}
        onSuccess={fetchDatabases}
      />

      {/* Database Live Records Inspection Modal */}
      <DatabaseInspectModal
        open={inspectModalOpen}
        onOpenChange={setInspectModalOpen}
        databaseName={selectedInspectDb?.name || "Turso Master"}
      />

      {/* Scoped Model Bulk Action Confirmation Modal */}
      <Dialog open={bulkModelModalOpen} onOpenChange={setBulkModelModalOpen}>
        <DialogContent className="max-w-md bg-[var(--surface-raised)] border border-[var(--border-strong)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-6 shadow-[var(--shadow-overlay)]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center text-[var(--foreground)]">
                {bulkModelAction === "disable_all" ? <Ban className="w-4 h-4 text-[var(--danger)]" /> : <CheckCircle2 className="w-4 h-4 text-[var(--success)]" />}
              </div>
              <DialogTitle className="text-base font-semibold">
                {bulkModelAction === "disable_all" ? `Disable All ${selectedProviderId} Models?` : `Enable All ${selectedProviderId} Models?`}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[var(--text-muted)]">
              {bulkModelAction === "disable_all"
                ? `This action is scoped to provider "${selectedProviderId}". All its models will be hidden from the user selector. Other providers remain unaffected.`
                : `This action will expose all models under "${selectedProviderId}" in the frontend model selector.`}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setBulkModelModalOpen(false)}
              className="h-8 px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleBulkModelsAction(bulkModelAction)}
              disabled={bulkModelLoading}
              className={cn(
                "h-8 px-3 text-xs font-semibold",
                bulkModelAction === "disable_all"
                  ? "bg-[var(--danger)] text-white hover:opacity-90"
                  : "bg-[var(--success)] text-[var(--background)] hover:opacity-90"
              )}
            >
              {bulkModelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {bulkModelAction === "disable_all" ? "Confirm Disable All" : "Confirm Enable All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shard Suspension Confirmation Safeguard Dialog */}
      <Dialog open={!!suspendConfirmDb} onOpenChange={(v) => !v && setSuspendConfirmDb(null)}>
        <DialogContent className="max-w-md bg-[var(--surface-raised)] border border-[var(--border-strong)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-6 shadow-[var(--shadow-overlay)]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--danger-muted)] border border-[var(--danger)]/30 flex items-center justify-center text-[var(--danger)]">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <DialogTitle className="text-base font-semibold">
                {suspendConfirmDb?.status === "suspended" ? "Resume Regional Shard?" : "Suspend Regional Shard?"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[var(--text-muted)]">
              {suspendConfirmDb?.status === "suspended"
                ? `Resuming will restore write and read access to ${suspendConfirmDb?.name}.`
                : `Suspending ${suspendConfirmDb?.name} will temporarily block writes to prevent data divergence during maintenance.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label className="text-xs font-medium text-[var(--text-secondary)]">Reason for Action</label>
            <Input
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="e.g., Scheduled regional maintenance or migration pre-check"
              className="text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-control)] h-9"
            />
          </div>

          <DialogFooter className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSuspendConfirmDb(null)}
              className="h-8 px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleToggleShardSuspension}
              disabled={suspendingLoading}
              className={cn(
                "h-8 px-3 text-xs font-semibold",
                suspendConfirmDb?.status === "suspended"
                  ? "bg-[var(--success)] text-[var(--background)] hover:opacity-90"
                  : "bg-[var(--danger)] text-white hover:opacity-90"
              )}
            >
              {suspendingLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              {suspendConfirmDb?.status === "suspended" ? "Confirm Resume" : "Confirm Suspension"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* VM Restart Confirmation Dialog */}
      <Dialog open={restartConfirmOpen} onOpenChange={setRestartConfirmOpen}>
        <DialogContent className="max-w-md bg-[var(--surface-raised)] border border-[var(--border-strong)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-6 shadow-[var(--shadow-overlay)]">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--danger-muted)] border border-[var(--danger)]/30 flex items-center justify-center text-[var(--danger)]">
                <Power className="w-4 h-4" />
              </div>
              <DialogTitle className="text-base font-semibold">Restart Syte Runner Service?</DialogTitle>
            </div>
            <DialogDescription className="text-xs text-[var(--text-muted)]">
              This will restart the systemd service <code className="text-[var(--foreground)]">syte-runner</code> on the Ubuntu VM. In-flight build jobs may temporarily pause for ~2 seconds.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="flex items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRestartConfirmOpen(false)}
              className="h-8 px-3 text-xs text-[var(--text-secondary)] hover:text-[var(--foreground)]"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleVmAction("start")}
              disabled={vmActionLoading}
              className="h-8 px-3 text-xs bg-[var(--danger)] text-white hover:opacity-90 font-medium"
            >
              {vmActionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
              Execute Restart
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Provider Details & Settings Dialog */}
      <ProviderSettingsDialog
        open={providerSettingsOpen}
        onOpenChange={setProviderSettingsOpen}
        provider={selectedProviderSettings}
      />
    </div>
  )
}

