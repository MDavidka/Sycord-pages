"use client"

import React, { useState, useEffect, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { type GeneratedPage } from "@/lib/types"
import {
  Trash2,
  Plus,
  ExternalLink,
  AlertCircle,
  Loader2,
  ArrowLeft,
  ShoppingCart,
  Zap,
  Package,
  Sparkles,
  Menu,
  Layout,
  Tag,
  BarChart3,
  Users,
  History,
  FileText,
  CreditCard,
  LogOut,
  User,
  Rocket,
  Globe,
  Save,
  Smartphone,
  Monitor,
  Eye,
  EyeOff,
  CheckCircle2,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileType,
  ChevronRight,
  Code,
  Lock,
  Database,
  Settings,
  BookOpen,
  Layers,
  TrendingUp,
  Wallet,
  BadgeCheck,
  Coins,
  RefreshCw,
  Key,
  Mail,
  Github,
  ChevronDown,
  Shield,
  Search,
  Send,
  AlertTriangle,
  MoreHorizontal,
  ArrowUpRight,
  Copy,
  Check,
  Clock,
  TrendingDown,
  Wrench,
} from "lucide-react"
import { currencySymbols } from "@/lib/webshop-types"
import { Switch } from "@/components/ui/switch"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
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
import { useSession, signOut } from "next-auth/react"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import { SitePreviewDashboard } from "@/components/site-preview-dashboard"
import { AnimatedRollingSidebar, AnimatedRollingSidebarDesktop } from "@/components/animated-rolling-sidebar"
import { PagesDeployPanel } from "@/components/pages-deploy-panel"
import {
  ProjectIntegrationsDialog,
  type IntegrationRequestPayload,
} from "@/components/project-integrations-dialog"
import { getMcpProvider } from "@/lib/mcp-providers"
import { ProjectSyraSessionCard } from "@/components/project-syra-session-card"
import type { ProjectChatSessionSummary } from "@/lib/types"

import { INTEGRATION_CATALOG, type IntegrationCategory, type IntegrationDefinition } from "@/lib/integrations"

// ─── Deployment Settings Card ─────────────────────────────────────────────────
// Shown in the Settings tab. Displays the Syte workspace UUID, domain, live URL,
// deploy status, and a Deploy to Production button.
function DeploymentSettingsCard({ projectId, project }: { projectId: string; project: any }) {
  const uuid: string | null = project?.syteWorkspaceUuid ?? null
  const initialDomain: string | null = project?.syteDomain ?? null
  const initialUrl: string | null = project?.syteUrl ?? null
  const initialStatus: string | null = project?.deployStatus ?? null
  const initialConnectError: string | null = project?.syteConnectError ?? null

  const [deploying, setDeploying] = useState(false)
  const [pollStatus, setPollStatus] = useState<string | null>(initialStatus)
  const [liveUrl, setLiveUrl] = useState<string | null>(initialUrl)
  const [syteDomain, setSyteDomain] = useState<string | null>(initialDomain)
  const [deployError, setDeployError] = useState<string | null>(initialConnectError)
  const [copied, setCopied] = useState(false)

  const copyUuid = async () => {
    if (!uuid) return
    try {
      await navigator.clipboard.writeText(uuid)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }
  }

  const handleDeploy = async () => {
    if (!projectId || deploying) return
    setDeploying(true)
    setDeployError(null)
    try {
      const res = await fetch("/api/workspace/sycord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "issue_deployment", projectId }),
      })
      const data = await res.json()
      if (!res.ok || !data.ok) {
        setDeployError(data.error || `Deploy failed (${res.status})`)
        setDeploying(false)
        return
      }
      setPollStatus("deploying")
      // Poll container_get until running
      let attempts = 0
      const poll = async () => {
        attempts++
        try {
          const pr = await fetch(
            `/api/workspace/sycord?action=container_get&projectId=${encodeURIComponent(projectId)}`,
          )
          const pd = await pr.json()
          if (pd.running) {
            setPollStatus("running")
            setLiveUrl(pd.url ?? liveUrl)
            setSyteDomain(pd.domain ?? syteDomain)
            setDeploying(false)
            return
          }
          if (pd.status && pd.status !== "deploying") {
            setPollStatus(pd.status)
          }
        } catch { /* ignore */ }
        if (attempts < 60) {
          setTimeout(poll, 5000)
        } else {
          setDeployError("Deploy timed out — check the Syte dashboard for logs.")
          setDeploying(false)
        }
      }
      setTimeout(poll, 5000)
    } catch (e: any) {
      setDeployError(e.message || "Network error")
      setDeploying(false)
    }
  }

  const statusColor =
    pollStatus === "running"
      ? "text-green-500"
      : pollStatus === "deploying"
      ? "text-yellow-500"
      : pollStatus === "created"
      ? "text-blue-400"
      : pollStatus === "failed"
      ? "text-red-400"
      : "text-muted-foreground"

  const statusLabel =
    pollStatus === "running"
      ? "Live"
      : pollStatus === "deploying"
      ? "Deploying…"
      : pollStatus === "created"
      ? "Ready to deploy"
      : pollStatus === "failed"
      ? "Workspace setup failed"
      : pollStatus ?? "—"

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-4 w-4" />
          Deployment
        </CardTitle>
        <CardDescription>
          Syte workspace UUID, domain, and one-click production deploy.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* UUID */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Workspace UUID</Label>
          {uuid ? (
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-md bg-black/30 border border-white/10 px-3 py-1.5 text-xs font-mono text-foreground truncate">
                {uuid}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 shrink-0"
                onClick={copyUuid}
                title="Copy UUID"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          ) : pollStatus === "failed" ? (
            <p className="text-xs text-red-400">
              Syte workspace setup failed{deployError ? `: ${deployError}` : "."} Retry deploy or recreate the project.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              Workspace is being created — it will appear here shortly.
            </p>
          )}
        </div>

        {/* Domain / URL */}
        {(syteDomain || liveUrl) && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Site URL</Label>
            <a
              href={liveUrl ?? `https://${syteDomain}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-primary hover:underline truncate"
            >
              <Globe className="h-3.5 w-3.5 shrink-0" />
              {syteDomain ?? liveUrl}
              <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
            </a>
          </div>
        )}

        {/* Status */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Status</span>
          <span className={`text-xs font-medium flex items-center gap-1.5 ${statusColor}`}>
            {pollStatus === "deploying" && <Loader2 className="h-3 w-3 animate-spin" />}
            {pollStatus === "running" && <span className="inline-block h-2 w-2 rounded-full bg-green-500" />}
            {statusLabel}
          </span>
        </div>

        {/* Deploy error */}
        {deployError && (
          <p className="text-xs text-destructive">{deployError}</p>
        )}

        {/* Deploy button */}
        <Button
          onClick={handleDeploy}
          disabled={deploying || !uuid}
          className="w-full"
        >
          {deploying ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Deploying…
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4 mr-2" />
              Deploy to Production
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  )
}

const headerComponents = {
  simple: { name: "Simple", description: "A clean, minimalist header" },
  centered: { name: "Centered", description: "Logo and navigation centered" },
  hero: { name: "Hero", description: "Large header with a call to action" },
  luxe: { name: "Luxe", description: "Elegant header with premium feel" },
  split: { name: "Split", description: "Header split into two sections" },
}

const heroComponents = {
  none: { name: "None", description: "No hero section" },
  basic: { name: "Basic", description: "Simple title and subtitle" },
  image: { name: "Image", description: "Hero with background image" },
  carousel: { name: "Carousel", description: "Rotating hero images" },
  video: { name: "Video", description: "Hero with background video" },
}

const productComponents = {
  grid: { name: "Grid", description: "Products in a grid layout" },
  list: { name: "List", description: "Products in a vertical list" },
  masonry: { name: "Masonry", description: "Masonry grid for products" },
  carousel: { name: "Carousel", description: "Scrollable product carousel" },
}

const paymentOptions = [
  { id: "stripe", name: "Stripe", description: "Credit cards and digital wallets" },
  { id: "paypal", name: "PayPal", description: "PayPal payments" },
  { id: "bank", name: "Bank Transfer", description: "Direct bank transfers" },
]

type DeploymentMode = "api"

const formatDeploymentMode = (_mode?: string | null) => (
  "API deployment"
)

const detectDeploymentModeFromPages = (_pages: GeneratedPage[]): DeploymentMode => {
  return "api"
}

// File tree node interface
interface FileTreeNode {
  name: string
  type: 'file' | 'folder'
  path: string
  children?: FileTreeNode[]
  page?: GeneratedPage
}

// Helper function to get file icon based on extension
const getFileIcon = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
      return FileCode
    case 'json':
      return FileType
    case 'css':
      return FileType
    case 'html':
      return FileText
    case 'md':
      return FileText
    default:
      return File
  }
}

// Build file tree from flat file list
const buildFileTree = (pages: GeneratedPage[]): FileTreeNode[] => {
  const root: FileTreeNode[] = []
  
  pages.forEach(page => {
    const parts = page.name.split('/')
    let currentLevel = root
    
    parts.forEach((part, index) => {
      const isFile = index === parts.length - 1
      const path = parts.slice(0, index + 1).join('/')
      
      let existing = currentLevel.find(n => n.name === part)
      
      if (!existing) {
        const newNode: FileTreeNode = {
          name: part,
          type: isFile ? 'file' : 'folder',
          path: path,
          page: isFile ? page : undefined,
          children: isFile ? undefined : []
        }
        currentLevel.push(newNode)
        existing = newNode
      }
      
      if (!isFile && existing.children) {
        currentLevel = existing.children
      }
    })
  })
  
  // Sort: folders first, then files, alphabetically
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'folder' ? -1 : 1
      }
      return a.name.localeCompare(b.name)
    }).map(node => ({
      ...node,
      children: node.children ? sortNodes(node.children) : undefined
    }))
  }
  
  return sortNodes(root)
}

// File Tree Item Component
const FileTreeItem = ({ 
  node, 
  depth = 0, 
  onSelectFile, 
  selectedPage,
  onDeleteFile,
  expandedFolders,
  toggleFolder
}: { 
  node: FileTreeNode
  depth?: number
  onSelectFile: (page: GeneratedPage) => void
  selectedPage: GeneratedPage | null
  onDeleteFile: (name: string) => void
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
}) => {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedPage?.name === node.page?.name
  const FileIcon = node.type === 'file' ? getFileIcon(node.name) : (isExpanded ? FolderOpen : Folder)
  
  return (
    <div>
      <button
        onClick={() => {
          if (node.type === 'folder') {
            toggleFolder(node.path)
          } else if (node.page) {
            onSelectFile(node.page)
          }
        }}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-white/5 transition-colors group",
          isSelected && "bg-primary/10 text-primary"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
      >
        {node.type === 'folder' ? (
          <ChevronRight className={cn(
            "h-3 w-3 text-muted-foreground transition-transform",
            isExpanded && "rotate-90"
          )} />
        ) : (
          <span className="w-3" />
        )}
        <FileIcon className={cn(
          "h-4 w-4 flex-shrink-0",
          node.type === 'folder' ? "text-yellow-500" : "text-blue-400"
        )} />
        <span className="truncate flex-1 text-left">{node.name}</span>
        {node.type === 'file' && node.page?.usedFor && (
          <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded hidden group-hover:block truncate max-w-[100px]">
            {node.page.usedFor}
          </span>
        )}
      </button>
      {node.type === 'folder' && isExpanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileTreeItem 
              key={i} 
              node={child} 
              depth={depth + 1}
              onSelectFile={onSelectFile}
              selectedPage={selectedPage}
              onDeleteFile={onDeleteFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// File Tree View Component
const FileTreeView = ({ 
  pages, 
  onSelectFile, 
  selectedPage,
  onDeleteFile 
}: { 
  pages: GeneratedPage[]
  onSelectFile: (page: GeneratedPage) => void
  selectedPage: GeneratedPage | null
  onDeleteFile: (name: string) => void
}) => {
  const getInitialExpandedFolders = () => {
    const folders = new Set<string>()
    pages.forEach(page => {
      const parts = page.name.split('/')
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join('/'))
      }
    })
    return folders
  }
  
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(getInitialExpandedFolders)
  
  const toggleFolder = (path: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }
  
  const tree = buildFileTree(pages)
  
  return (
    <div className="py-2 max-h-[400px] overflow-y-auto custom-scrollbar">
      {tree.map((node, i) => (
        <FileTreeItem 
          key={i} 
          node={node}
          onSelectFile={onSelectFile}
          selectedPage={selectedPage}
          onDeleteFile={onDeleteFile}
          expandedFolders={expandedFolders}
          toggleFolder={toggleFolder}
        />
      ))}
    </div>
  )
}

// Plan credit allocation (€/month) per subscription tier
const PLAN_CREDITS: Record<string, number> = {
  "Sycord Enterprise": 25,
  "Sycord+": 5,
  Sycord: 2,
}
const DEFAULT_PLAN_CREDIT = 2

// Visit-dropdown pill colors. Kept as constants so the "live" and "preview"
// accents remain consistent if the overview visit dropdown is reused/extended.
const VISIT_PILL_LIVE_BG = "#1f7a3a"
const VISIT_PILL_LIVE_SHADOW = "0 2px 10px rgba(31,122,58,0.35)"
const VISIT_PILL_PREVIEW_BG = "#a37a34"
const VISIT_PILL_PREVIEW_SHADOW = "0 2px 10px rgba(163,122,52,0.3)"

// Fallback TLD options (replaced by real Cloudflare API prices when available)
const FALLBACK_TLD_OPTIONS = [
  { tld: ".com", price: 10.44 },
  { tld: ".net", price: 11.44 },
  { tld: ".org", price: 11.44 },
  { tld: ".co",  price: 28.98 },
  { tld: ".io",  price: 32.94 },
  { tld: ".dev", price: 14.28 },
  { tld: ".app", price: 14.28 },
  { tld: ".store", price: 5.00 },
  { tld: ".online", price: 3.98 },
] as const

const CloudflareProviderIcon = () => (
  <img
    src="/cloudflare-icon.svg"
    alt="Cloudflare"
    className="h-6 w-6 shrink-0 rounded-md"
  />
)

const PLAN_LABELS: Record<string, string> = {
  "Sycord Enterprise": "Enterprise",
  "Sycord+": "Sycord+",
  Sycord: "Sycord",
}

const getPlanLabel = (subscription: string) =>
  PLAN_LABELS[subscription] ?? "Sycord"

// Extract SidebarContent to a separate component to avoid re-renders
const SidebarContent = ({
  project,
  activeTab,
  setActiveTab,
  setIsSidebarOpen,
  navGroups,
  router,
  getWebsiteIcon,
  databaseConnected,
  session,
  subscription,
  planCredit,
  userInitials,
  onManageAccess,
}: any) => {
  const WebsiteIcon = getWebsiteIcon()
  const planLabel = getPlanLabel(subscription)

  // Initialise open groups from each group's defaultOpen flag
  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const g of navGroups) {
      if (g.defaultOpen) initial.add(g.key)
    }
    return initial
  })

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Auto-open group containing the active tab
  useEffect(() => {
    for (const g of navGroups) {
      if (g.items.some((i: any) => i.id === activeTab)) {
        setOpenGroups((prev) => {
          if (prev.has(g.key)) return prev
          const next = new Set(prev)
          next.add(g.key)
          return next
        })
        break
      }
    }
  }, [activeTab, navGroups])

  return (
    <div className="flex flex-col h-full p-4">
      <div className="flex items-center gap-3 mb-6 px-2 text-foreground">
        <div className="p-2 rounded-lg bg-primary/10 flex-shrink-0">
          <WebsiteIcon className="h-5 w-5 text-primary" />
        </div>
        <span className="font-bold text-lg truncate">{project?.businessName || "Site Settings"}</span>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto custom-scrollbar">
        {navGroups.map((group: any) => {
          const isOpen = openGroups.has(group.key)
          const groupHasActive = group.items.some((i: any) => i.id === activeTab)
          return (
            <div key={group.key} className="mb-1">
              {/* Folder header */}
              <button
                onClick={() => toggleGroup(group.key)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 text-xs font-semibold uppercase tracking-wider",
                  groupHasActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 shrink-0 transition-transform" />
                  : <ChevronRight className="h-3.5 w-3.5 shrink-0 transition-transform" />
                }
                <span className="flex-1 text-left">{group.title}</span>
              </button>

              {/* Folder items */}
              {isOpen && (
                <div className="mt-0.5 ml-3 pl-3 border-l border-white/[0.08] space-y-0.5">
                  {group.items.map((item: any) => {
                    const Icon = item.icon
                    const isActive = activeTab === item.id
                    const isLocked = item.requiresDatabase && !databaseConnected
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          if (isLocked) return
                          setActiveTab(item.id)
                          setIsSidebarOpen(false)
                        }}
                        disabled={isLocked}
                        title={isLocked ? "Connect a database to unlock this feature" : undefined}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm font-medium text-left",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : isLocked
                            ? "text-muted-foreground/40 cursor-not-allowed"
                            : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate flex-1 text-left">{item.label}</span>
                        {item.badge && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border border-white/25 bg-transparent text-foreground/70 shrink-0">
                            {item.badge}
                          </span>
                        )}
                        {isLocked && <Lock className="h-3 w-3 shrink-0 opacity-50" />}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Manage Access button */}
      <div className="mt-4">
        <button
          onClick={onManageAccess}
          className="inline-flex items-center gap-2.5 px-3 py-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors text-sm font-medium text-foreground"
        >
          <span className="h-7 w-7 rounded-full bg-purple-500 flex items-center justify-center text-[11px] font-bold text-white shrink-0">
            {userInitials.charAt(0)}
          </span>
          Manage access
        </button>
      </div>

      {/* Account + Plan + Credit */}
      <div className="mt-3 pt-3 border-t border-white/10 space-y-3">
        {/* Account row */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5">
          <div className="h-6 w-6 rounded-full bg-white/20 flex items-center justify-center text-[10px] font-bold text-foreground shrink-0">
            {userInitials}
          </div>
          <span className="flex-1 text-xs font-medium truncate text-foreground">
            {session?.user?.name || "User"}
          </span>
          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 bg-white/10 text-foreground">
            {planLabel}
          </span>
        </div>

        {/* Credit bar */}
        <div className="px-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Coins className="h-3 w-3" />
              Monthly Credit
            </span>
            <span className="text-[11px] font-semibold text-foreground">{planCredit}€</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full bg-primary" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    </div>
  )
}

function openIntegrationOAuthPopup(projectId: string, addonId: string): Window | null {
  const url = `/api/mcp/oauth/start?projectId=${encodeURIComponent(projectId)}&addon=${encodeURIComponent(addonId)}&integrationMode=true`
  const width = 520
  const height = 720
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))
  return window.open(
    url,
    'sycord-mcp-oauth',
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  )
}

export default function SiteSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [project, setProject] = useState<any>(null)
  const [settings, setSettings] = useState<any>(null)
  const [products, setProducts] = useState<any[]>([])
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [projectLoading, setProjectLoading] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(true)
  const [productsLoading, setProductsLoading] = useState(true)

  const [newProduct, setNewProduct] = useState({
    name: "",
    description: "",
    price: 0,
    image: "",
    category: "",
    inStock: true,
  })
  const [isAddingProduct, setIsAddingProduct] = useState(false)
  const [productError, setProductError] = useState<string | null>(null)

  const [activeTab, setActiveTab] = useState<
    "overview" | "domain" | "pages" | "ai" | "settings" | "items" | "promotions" | "payments" | "customers" | "posts" | "segments" | "integrations"
  >("overview")
  /** Keep Syra iframe mounted after first open so tab switches are instant. */
  const [syraEverOpened, setSyraEverOpened] = useState(false)
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isDesktopSidebarExpanded, setIsDesktopSidebarExpanded] = useState(false)
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop")
  const [copiedDomain, setCopiedDomain] = useState(false)
  const copyTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
  }, [])
  const { data: session } = useSession()

  const openSyra = React.useCallback(() => {
    if (!id) return
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches) {
      window.location.assign(`/dashboard/sites/${id}/syra`)
      return
    }
    setSyraEverOpened(true)
    setActiveTab("ai")
  }, [id])

  // Prefetch Syra shell as soon as the project page mounts (desktop)
  useEffect(() => {
    if (!id || typeof window === "undefined") return
    if (window.matchMedia("(max-width: 768px)").matches) return
    const href = `/dashboard/sites/${id}/syra`
    const link = document.createElement("link")
    link.rel = "prefetch"
    link.href = href
    link.as = "document"
    document.head.appendChild(link)
    return () => {
      link.remove()
    }
  }, [id])

  useEffect(() => {
    if (activeTab === "ai") setSyraEverOpened(true)
  }, [activeTab])

  // Subscription / plan
  const [subscription, setSubscription] = useState<string>("Sycord")

  // Payout balance (fetched or 0)
  const [payoutBalance, setPayoutBalance] = useState<number>(0)

  // Manage access dialog
  const [isManageAccessOpen, setIsManageAccessOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteSent, setInviteSent] = useState(false)
  const [inviteRole, setInviteRole] = useState<"Editor" | "Viewer">("Editor")
  const [isSendingInvite, setIsSendingInvite] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const isValidInviteEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(inviteEmail)

  // Delete project state
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Renamed to match the button name and be consistent
  const saving = isSaving
  const setSaving = setIsSaving

  // Swipe to open detection
  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  const minSwipeDistance = 30

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null)
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    // Trigger sidebar on any right swipe (swipe to open)
    if (isRightSwipe) {
        setIsSidebarOpen(true)
    }
  }

  // Settings State
  const [shopName, setShopName] = useState("")
  const [profileImage, setProfileImage] = useState("")
  const [logoLoadError, setLogoLoadError] = useState(false)

  // AI Generated Pages State (Lifted)
  const [generatedPages, setGeneratedPages] = useState<GeneratedPage[]>([])
  
  // Selected page for preview in Pages tab
  const [selectedPage, setSelectedPage] = useState<GeneratedPage | null>(null)

  // Deployment State
  const [isDeploying, setIsDeploying] = useState(false)
  const [deployProgress, setDeployProgress] = useState(0)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [deployError, setDeployError] = useState<string | null>(null)
  const [deployResult, setDeployResult] = useState<{ url?: string; message?: string; build?: boolean; running?: boolean; health_ok?: boolean; domain?: string; port?: number } | null>(null)
  const [deploymentRuntime, setDeploymentRuntime] = useState<any>(null)
  const deploymentMode = useMemo(
    () => (generatedPages.length > 0 ? detectDeploymentModeFromPages(generatedPages) : "api") as DeploymentMode,
    [generatedPages, project],
  )

  // Auto-Fix State
  const [logs, setLogs] = useState<string[]>([])
  const [hasDeployError, setHasDeployError] = useState(false)

  const runnerErrorDetails = useMemo(() => {
    if (!Array.isArray(logs) || logs.length === 0) return null
    const errorPattern = /(deployment failed|companion server|repo not found|missing git credentials|invalid repo_id|error|exception)/i
    const relevant = logs.filter((line) => errorPattern.test(line))
    if (relevant.length === 0) return null
    return relevant.slice(-10).join("\n")
  }, [logs])

  // Database / Firebase connection state
  const [databaseConnected, setDatabaseConnected] = useState(false)

  // Integration connect form state
  const [expandedIntegration, setExpandedIntegration] = useState<string | null>(null)
  const [integrationEnvValue, setIntegrationEnvValue] = useState("")
  const [showAddEnv, setShowAddEnv] = useState(false)
  const [newEnvKey, setNewEnvKey] = useState("")
  const [newEnvValue, setNewEnvValue] = useState("")
  const [integrationCategory, setIntegrationCategory] = useState<string>("All")
  const [connectedIntegrations, setConnectedIntegrations] = useState<Set<string>>(new Set())
  const [showIntegrationToken, setShowIntegrationToken] = useState(false)
  const [integrationSaveError, setIntegrationSaveError] = useState<string | null>(null)
  const [integrationDialogOpen, setIntegrationDialogOpen] = useState(false)
  const [integrationRequest, setIntegrationRequest] = useState<IntegrationRequestPayload | null>(null)
  const [domainSearch, setDomainSearch] = useState("")
  const [domainTldPrices, setDomainTldPrices] = useState<Array<{ tld: string; price: number; currency: string }>>([])
  const [domainChecks, setDomainChecks] = useState<Record<string, { available: boolean | null; purchaseUrl: string; loading: boolean }>>({})
  const [isDomainCheckLoading, setIsDomainCheckLoading] = useState(false)
  const [tldPricesLoaded, setTldPricesLoaded] = useState(false)

  // Overview mini AI chat state
  const [overviewChatInput, setOverviewChatInput] = useState("")
  const [chatSessionSummary, setChatSessionSummary] = useState<ProjectChatSessionSummary | null>(null)

  // Fetch real TLD prices from Cloudflare (via our API)
  const fetchTldPrices = async () => {
    if (tldPricesLoaded) return
    try {
      const res = await fetch("/api/domains/tlds")
      if (res.ok) {
        const data = await res.json()
        if (data.success && Array.isArray(data.tlds)) {
          setDomainTldPrices(data.tlds)
          setTldPricesLoaded(true)
          return
        }
      }
    } catch (e) {
      console.error("Failed to fetch TLD prices:", e)
    }
    // Fallback
    setDomainTldPrices(FALLBACK_TLD_OPTIONS.map(t => ({ tld: t.tld, price: t.price, currency: "USD" })))
    setTldPricesLoaded(true)
  }

  // Check if a specific domain is available via Cloudflare
  const checkDomainAvailability = async (slug: string, tld: string) => {
    const fullDomain = `${slug}${tld}`
    setDomainChecks(prev => ({ ...prev, [fullDomain]: { available: null, purchaseUrl: "", loading: true } }))
    try {
      const res = await fetch(`/api/domains/check?domain=${encodeURIComponent(fullDomain)}`)
      if (res.ok) {
        const data = await res.json()
        setDomainChecks(prev => ({
          ...prev,
          [fullDomain]: {
            available: data.available,
            purchaseUrl: data.purchaseUrl || `https://www.cloudflare.com/products/registrar/`,
            loading: false,
          }
        }))
        return
      }
    } catch (e) {
      console.error(`Failed to check domain ${fullDomain}:`, e)
    }
    setDomainChecks(prev => ({
      ...prev,
      [fullDomain]: { available: null, purchaseUrl: `https://www.cloudflare.com/products/registrar/`, loading: false }
    }))
  }

  // Check all TLDs at once for the current slug
  const checkAllDomains = async (slug: string) => {
    if (!slug) return
    setIsDomainCheckLoading(true)
    const tlds = domainTldPrices.length > 0
      ? domainTldPrices.map(t => t.tld)
      : FALLBACK_TLD_OPTIONS.map(t => t.tld)
    await Promise.allSettled(tlds.map(tld => checkDomainAvailability(slug, tld)))
    setIsDomainCheckLoading(false)
  }

  // The effective TLD list to display (real prices or fallback)
  const effectiveTldOptions = domainTldPrices.length > 0
    ? domainTldPrices
    : FALLBACK_TLD_OPTIONS.map(t => ({ tld: t.tld, price: t.price, currency: "USD" }))

  const fetchLogs = async (repoIdOverride?: string) => {
    const targetId = repoIdOverride || project?.githubRepoId
    if (!targetId) return

    try {
        const res = await fetch(`/api/deploy/${targetId}/logs?limit=120`)
        if (res.ok) {
            const data = await res.json()
            if (data.success && Array.isArray(data.logs)) {
                setLogs(data.logs)
                // Extract URL from logs if present
                const combinedLogs = data.logs.join('\n')
                const urlMatch = combinedLogs.match(/(https:\/\/[a-zA-Z0-9.-]+)/)

                if (urlMatch && urlMatch[1]) {
                    const url = urlMatch[1].trim().replace(/\.$/, '')
                    setProject((prev: any) => ({ ...prev, cloudflareUrl: url }))
                    setDeployResult((prev: any) => ({ ...prev, url, message: "Deployment complete" }))
                    setDeploySuccess(true)
                    setHasDeployError(false)
                }

                // Simple error detection in logs
                const combined = combinedLogs.toLowerCase()
                const successFound = combined.includes('deployment complete') || combined.includes('success') || combined.includes('companion server')

                const errorFound = !successFound && data.logs.some((log: string) =>
                    log.toLowerCase().includes('error') ||
                    log.toLowerCase().includes('fail') ||
                    log.toLowerCase().includes('exception')
                )

                // Only set error if we haven't already found success (URL extraction above sets it to false)
                if (!urlMatch) {
                    setHasDeployError(errorFound)
                }
            }
        }
    } catch (e) {
        console.error("Failed to fetch logs", e)
    }
  }

  useEffect(() => {
    if (!id) return

    // Use AbortController so a quick nav away on mobile cancels the
    // in-flight requests instead of keeping the request cycle alive.
    const controller = new AbortController()

    const fetchAllData = async () => {
      console.log(`[v0] Settings page: Starting data fetch for project ${id}`)
      try {
        const fetchProject = fetch(`/api/projects/${id}`, { signal: controller.signal })
          .then(async (r) => {
            if (r.status === 304) return null
            return r.json()
          })
          .then((data) => {
            console.log("[v0] Project data fetched:", data ? "Success" : "Empty")
            if (!data) return
            if (data.message) throw new Error(data.message)
            setProject(data)
            if (data.deploymentRuntime) setDeploymentRuntime(data.deploymentRuntime)
            setShopName(data.businessName || "")
            setProfileImage(data.profileImage || "")
            setLogoLoadError(false) // Reset error state when loading new data
            if (data.firebaseConnected) setDatabaseConnected(true)

            if (data.pages && Array.isArray(data.pages)) {
              setGeneratedPages(
                data.pages.map((p: any) => ({
                  name: p.name,
                  code: p.content,
                  timestamp: p.updatedAt ? new Date(p.updatedAt).getTime() : Date.now(),
                  usedFor: p.usedFor || ''
                })),
              )
            }
            if (data.lastDeployError) {
              setDeployError(data.lastDeployError)
              setHasDeployError(true)
            }
            setProjectLoading(false)
          })
          .catch((err) => {
            if (err?.name === "AbortError") return
            console.error("[v0] Settings page: Error fetching project:", err)
            setProjectLoading(false)
          })

        const fetchSettings = fetch(`/api/projects/${id}/settings`, { signal: controller.signal })
          .then((r) => r.json())
          .then((data) => {
            console.log("[v0] Settings data fetched")
            setSettings(data)
            setSettingsLoading(false)
          })
          .catch((err) => {
            if (err?.name === "AbortError") return
            console.error("[v0] Settings page: Error fetching settings:", err)
            setSettingsLoading(false)
          })

        const fetchProducts = fetch(`/api/projects/${id}/products`, { signal: controller.signal })
          .then((r) => r.json())
          .then((data) => {
            console.log("[v0] Products data fetched")
            setProducts(Array.isArray(data) ? data : [])
            setProductsLoading(false)
          })
          .catch((err) => {
            if (err?.name === "AbortError") return
            console.error("[v0] Settings page: Error fetching products:", err)
            setProductsLoading(false)
          })

        const fetchChatSession = fetch(`/api/projects/${id}/chat?summary=true`, { signal: controller.signal })
          .then((r) => r.json())
          .then((data) => {
            setChatSessionSummary(data?.session ?? null)
          })
          .catch((err) => {
            if (err?.name === "AbortError") return
            console.error("[v0] Settings page: Error fetching chat session:", err)
          })

        await Promise.all([fetchProject, fetchSettings, fetchProducts, fetchChatSession])
        console.log("[v0] All data fetches completed")
        if (!controller.signal.aborted) fetchLogs()
      } catch (error) {
        if ((error as any)?.name === "AbortError") return
        console.error("[v0] Error in fetchAllData:", error)
      } finally {
        if (!controller.signal.aborted) setIsInitialLoading(false)
      }
    }

    fetchAllData()

    // Cancel any in-flight fetches when the component unmounts or id changes.
    return () => controller.abort()
  }, [id])

  useEffect(() => {
    if (activeTab !== "overview" || !id) return

    fetch(`/api/projects/${id}/chat?summary=true`)
      .then((r) => r.json())
      .then((data) => setChatSessionSummary(data?.session ?? null))
      .catch(() => {})
  }, [activeTab, id])

  // Fetch subscription info
  useEffect(() => {
    fetch("/api/user/status")
      .then((r) => r.json())
      .then((data) => {
        if (data.subscription) setSubscription(data.subscription)
      })
      .catch(() => { console.warn("[Sycord] Could not fetch user status from /api/user/status; defaulting to free Sycord plan credits.") })
  }, [])

  // Syra iframe back button → return to project overview tab (desktop iframe only)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === "syra-navigate-back") {
        setActiveTab("overview")
      }
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [])

  // Mobile: Syra must load as a top-level page so COOP/COEP headers apply
  useEffect(() => {
    if (activeTab !== "ai" || !id) return
    if (window.matchMedia("(max-width: 768px)").matches && !window.location.pathname.endsWith("/syra")) {
      window.location.assign(`/dashboard/sites/${id}/syra`)
    }
  }, [activeTab, id])

  // Fetch already-connected integrations when the integrations tab becomes active
  useEffect(() => {
    if (activeTab !== "integrations" || !project?._id) return
    fetch(`/api/projects/${project._id}/env`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data.envVars)) {
          const ids = data.envVars
            .filter((v: any) => v.integration)
            .map((v: any) => v.integration as string)
          setConnectedIntegrations(new Set(ids))
        }
      })
      .catch((err) => { console.error("[Integrations] Failed to load connected integrations:", err) })
  }, [activeTab, project?._id])

  useEffect(() => {
    const onMcpOAuthMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; ok?: boolean; addon?: string; error?: string; connectError?: string } | null
      if (!data || data.type !== 'sycord-integration-oauth') return

      if (!data.ok) {
        setIntegrationSaveError(data.connectError || data.error || 'OAuth connection failed')
        return
      }

      if (data.addon) {
        setConnectedIntegrations((prev) => new Set([...prev, data.addon as string]))
        setExpandedIntegration(null)
      }
    }

    window.addEventListener('message', onMcpOAuthMessage)
    return () => window.removeEventListener('message', onMcpOAuthMessage)
  }, [])

  useEffect(() => {
    const handleIntegrationRequest = (event: Event) => {
      const customEvent = event as CustomEvent<IntegrationRequestPayload>
      setIntegrationRequest(customEvent.detail ?? null)
      setActiveTab("integrations")
      setIntegrationDialogOpen(true)
    }

    window.addEventListener("sycord:integration-request", handleIntegrationRequest as EventListener)
    return () => {
      window.removeEventListener("sycord:integration-request", handleIntegrationRequest as EventListener)
    }
  }, [])

  // Fetch real TLD prices when the domain tab is opened
  useEffect(() => {
    if (activeTab === "domain") {
      fetchTldPrices()
    }
  }, [activeTab])

  // Reset logo load error when profile image changes
  useEffect(() => {
    setLogoLoadError(false)
  }, [profileImage])

  const handleStyleSelect = (style: string) => {
    console.log("[v0] Selected style:", style)
    setSelectedStyle(style)
  }

  const handleComponentSelect = async (componentType: string, componentValue: string) => {
    console.log(`[v0] Selecting ${componentType}: ${componentValue}`)
    setSettings((prev: any) => ({
      ...prev,
      [componentType]: componentValue,
    }))
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setProfileImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)

    try {
      // Update project details if business name or profile image changed
      let projectUpdateNeeded = false
      const updatedProjectData = { ...project }
      if (project?.businessName !== shopName) {
        updatedProjectData.businessName = shopName
        projectUpdateNeeded = true
      }
      
      // Update profile image if changed
      if (project?.profileImage !== profileImage) {
        updatedProjectData.profileImage = profileImage
        projectUpdateNeeded = true
      }

      if (projectUpdateNeeded) {
        const projectResponse = await fetch(`/api/projects/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedProjectData),
        })
        if (!projectResponse.ok) {
          const errorData = await projectResponse.json()
          throw new Error(errorData.message || "Failed to update project details")
        }
        setProject(updatedProjectData) // Update local state
      }

      // Update settings
      const settingsPayload = {
        ...settings,
        shopName: shopName,
        profileImage: profileImage || settings?.profileImage,
      }

      const settingsResponse = await fetch(`/api/projects/${id}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsPayload),
      })

      const settingsResponseData = await settingsResponse.json()

      if (!settingsResponse.ok) {
        throw new Error(settingsResponseData.message || "Failed to save settings")
      }

      setSettings(settingsPayload) // Update local state
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (error: any) {
      setSaveError(error.message || "An error occurred while saving")
      console.error("[v0] Save error:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProject = async () => {
    if (!id) return
    setIsDeleting(true)
    try {
      // Call the delete API
      const response = await fetch(`/api/projects/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Failed to delete project")
      }

      // Also delete from Dokploy if there's an applicationId
      if (project?.applicationId) {
        try {
          await fetch("/api/deploy/coolify", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicationId: project.applicationId,
              projectId: project.projectId,
            }),
          })
        } catch (err) {
          console.error("Error deleting from Dokploy:", err)
        }
      }

      setIsDeleteDialogOpen(false)
      // Redirect to dashboard after successful deletion
      router.push("/dashboard")
    } catch (error) {
      console.error("Error deleting project:", error)
      alert(error instanceof Error ? error.message : "Failed to delete project")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleAddProduct = async () => {
    setProductError(null)

    if (!newProduct.name || !newProduct.name.trim()) {
      setProductError("Product name is required")
      return
    }

    if (newProduct.price < 0) {
      setProductError("Price cannot be negative")
      return
    }

    setIsAddingProduct(true)

    try {
      const response = await fetch(`/api/projects/${id}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newProduct),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to add product")
      }

      const addedProduct = await response.json()
      setProducts([...products, addedProduct])
      setNewProduct({
        name: "",
        description: "",
        price: 0,
        image: "",
        category: "",
        inStock: true,
      })
    } catch (error: any) {
      setProductError(error.message || "An error occurred while adding the product")
      console.error("[v0] Add product error:", error)
    } finally {
      setIsAddingProduct(false)
    }
  }

  const handleDeleteProduct = async (productId: string, productName: string) => {
    if (!confirm(`Are you sure you want to delete "${productName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/projects/${id}/products?productId=${productId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete product")
      }

      setProducts(products.filter((p) => p._id !== productId))
    } catch (error: any) {
      console.error("[v0] Delete product error:", error)
      alert("Failed to delete product. Please try again.")
    }
  }

  const handleDeletePage = async (pageName: string) => {
    if (!confirm(`Are you sure you want to delete ${pageName}? This cannot be undone.`)) return

    try {
      const response = await fetch(`/api/projects/${id}/pages?name=${encodeURIComponent(pageName)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to delete page")
      }

      setGeneratedPages(prev => prev.filter(p => p.name !== pageName))
    } catch (error: any) {
      alert(error.message)
    }
  }

  const startAutoFix = () => {
    openSyra()
  }

  const handleDeploy = async () => {
    if (isDeploying) return

    let progressTimer: ReturnType<typeof setInterval> | null = null

    try {
      setIsDeploying(true)
      setDeployProgress(8)
      setDeploySuccess(false)
      setDeployResult(null)
      setDeployError(null)
      setHasDeployError(false)

      progressTimer = setInterval(() => {
        setDeployProgress((current) => Math.min(current + 8, 88))
      }, 900)

      if (generatedPages.length > 0) {
        for (const page of generatedPages) {
          const saveResponse = await fetch(`/api/projects/${id}/pages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: page.name,
              content: page.code,
              usedFor: page.usedFor || "",
            }),
          })

          if (!saveResponse.ok) {
            const error = await saveResponse.json().catch(() => ({}))
            throw new Error(error?.message || error?.error || `Failed to save ${page.name}`)
          }
        }
      }

      setDeployProgress((current) => Math.max(current, 35))

      const response = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || data.success === false) {
        throw new Error(data?.error || data?.message || "Deployment failed")
      }

      setDeployProgress(100)
      setDeploySuccess(true)
      setDeployResult({
        url: data.url || data.cloudflareUrl,
        domain: data.domain,
        message: data.message || `Deployment complete (${formatDeploymentMode(deploymentMode)})`,
        build: true,
        running: true,
        health_ok: true,
      })
      setDeploymentRuntime((current: any) => ({
        ...(current || {}),
        mode: "api",
        domain: data.domain,
        url: data.url || data.cloudflareUrl,
        status: "deployed",
        health: "healthy",
        message: data.message || null,
        repoId: data.repoId || current?.repoId || null,
      }))
      if (data.url || data.cloudflareUrl) {
        setProject((prev: any) => ({ ...prev, cloudflareUrl: data.url || data.cloudflareUrl, githubRepoId: data.repoId || prev?.githubRepoId }))
      }
      setHasDeployError(false)
      fetchLogs(data.repoId || project?.githubRepoId)
    } catch (err: any) {
      const message = err?.message || "Deployment failed"
      setDeployError(message)
      setDeployProgress(0)
      setHasDeployError(true)
      setDeploymentRuntime((current: any) => ({
        ...(current || {}),
        mode: "api",
        status: "failed",
        health: "unhealthy",
        lastDeployError: message,
      }))
      fetchLogs(project?.githubRepoId)
    } finally {
      if (progressTimer) clearInterval(progressTimer)
      setIsDeploying(false)
    }
  }

  if (isInitialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4 text-foreground" />
          <p className="text-foreground">Loading site settings...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <p className="text-muted-foreground mb-4">This project no longer exists or you don't have access to it.</p>
          <Button onClick={() => router.push("/dashboard")}>Return to Dashboard</Button>
        </div>
      </div>
    )
  }

  const getWebsiteIcon = () => {
    const style = project.style || "default"
    switch (style) {
      case "default":
        return Package
      case "browse":
        return Sparkles
      case "ai":
        return Zap
      default:
        return Package
    }
  }

  const siteType = project.siteType || (databaseConnected ? "shop" : "default")

  const navGroups = [
    {
      key: "main",
      title: "Main",
      defaultOpen: true,
      items: [
        { id: "overview", label: "Overview", icon: Layout },
        { id: "domain", label: "Domain", icon: Globe },
        { id: "pages", label: "Pages", icon: FileText },
        { id: "ai", label: "Syra", icon: Zap },
      ],
    },
    ...(siteType === "blog"
      ? [
          {
            key: "blog",
            title: "Blog",
            defaultOpen: true,
            items: [
              { id: "posts", label: "Posts", icon: BookOpen },
              { id: "segments", label: "Segments", icon: Layers },
            ],
          },
        ]
      : []),
    ...(siteType === "shop" || databaseConnected
      ? [
          {
            key: "shop",
            title: "Shop",
            defaultOpen: true,
            items: [
              { id: "items", label: "Products", icon: ShoppingCart },
              { id: "promotions", label: "Promotions", icon: TrendingUp },
              { id: "customers", label: "Client", icon: Users },
              { id: "payments", label: "Payout", icon: Wallet, badge: `${payoutBalance} lei` },
            ],
          },
        ]
      : []),
    {
      key: "utility",
      title: "Utility",
      defaultOpen: false,
      items: [
        { id: "integrations", label: "Integrations", icon: Database },
        { id: "settings", label: "Settings", icon: Settings },
      ],
    },
  ]

  const planCredit = PLAN_CREDITS[subscription] ?? DEFAULT_PLAN_CREDIT

  const userInitials = session?.user?.name?.split(" ").map((n) => n[0]).join("").toUpperCase() || "U"
  const previewUrl = project?.cloudflareUrl || null
  const displayUrl = previewUrl ? previewUrl.replace(/^https?:\/\//, "") : null

  return (
    <div 
      className="flex h-[100dvh] overflow-hidden relative"
      style={{ backgroundColor: "#18191B" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {isDeploying && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-[70] h-1 bg-white/10">
          <div
            className="h-full rounded-r-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${Math.max(deployProgress, 8)}%` }}
          />
        </div>
      )}
      {/* Desktop Sidebar - Rolling Animation Style */}
      <aside 
        className="hidden md:block shrink-0 transition-[width] duration-300 ease-out" 
        style={{ width: isDesktopSidebarExpanded ? 280 : 72 }}
      >
        <AnimatedRollingSidebarDesktop
          isOpen={true}
          onClose={() => {}}
          isExpanded={isDesktopSidebarExpanded}
          onExpandChange={setIsDesktopSidebarExpanded}
          project={project}
          activeTab={activeTab}
          setActiveTab={setActiveTab as any}
          navGroups={navGroups}
          getWebsiteIcon={getWebsiteIcon}
          databaseConnected={databaseConnected}
          session={session as any}
          subscription={subscription}
          planCredit={planCredit}
          userInitials={userInitials}
          onManageAccess={() => setIsManageAccessOpen(true)}
        />
      </aside>

      {/* Mobile Sidebar — sits behind main content, revealed when content slides right
           z-index stacking: sidebar container z-0 < main content z-10 < close overlay z-[60] */}
      <div className="md:hidden absolute inset-y-0 left-0 z-0" style={{ width: "70%" }}>
        <AnimatedRollingSidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          project={project}
          activeTab={activeTab}
          setActiveTab={setActiveTab as any}
          navGroups={navGroups}
          getWebsiteIcon={getWebsiteIcon}
          databaseConnected={databaseConnected}
          session={session as any}
          subscription={subscription}
          planCredit={planCredit}
          userInitials={userInitials}
          onManageAccess={() => { setIsSidebarOpen(false); setIsManageAccessOpen(true) }}
        />
      </div>

      {/* Main Content — slides right on mobile to reveal sidebar */}
      <motion.div
        className={cn("flex-1 flex flex-col min-w-0 relative z-10 main-content-panel", isSidebarOpen && "sidebar-open")}
        animate={{ x: isSidebarOpen ? "70%" : 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30, mass: 0.9 }}
        style={{
          backgroundColor: "#18191B",
          overflow: "hidden",
        }}
      >
        {/* Header — hidden on the Glovix (ai) tab so it renders full-screen with its own header */}
        {activeTab !== "ai" && (
        <header className={cn("border-b border-white/10 bg-background/50 backdrop-blur-sm z-20 shrink-0")}>
          <div className="flex items-center justify-between h-14 px-4 md:px-6">
            {/* Mobile: hamburger + site name */}
            <div className="flex items-center gap-2 md:hidden">
              <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)} className="-ml-2">
                <Menu className="h-5 w-5" />
              </Button>
              <span className="font-semibold text-base truncate max-w-[140px]">{project?.businessName}</span>
            </div>

            {/* Desktop: breadcrumb */}
            <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
              <button onClick={() => router.push("/dashboard")} className="hover:text-foreground transition-colors">Dashboard</button>
              <span>/</span>
              <span className="text-foreground font-medium">{project?.businessName}</span>
              <span>/</span>
              <span className="capitalize text-foreground">{activeTab.replace("-", " ")}</span>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex bg-white/5 border-white/10 hover:bg-white/10"
                onClick={() => previewUrl && window.open(previewUrl, "_blank")}
                disabled={!previewUrl}
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Visit Site
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                      <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
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
                  <DropdownMenuItem onClick={() => router.push("/profile")}><User className="mr-2 h-4 w-4"/>Profile</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })} className="text-destructive"><LogOut className="mr-2 h-4 w-4"/>Log out</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
        )}

        {/* Tap overlay to close sidebar on mobile */}
        {isSidebarOpen && (
          <div
            className="absolute inset-0 z-[60] md:hidden"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Manage Access — sycord connect dialog */}
        <AnimatePresence>
          {isManageAccessOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-black/50 backdrop-blur-md"
                onClick={() => { setIsManageAccessOpen(false); setInviteSent(false); setInviteEmail(""); setInviteRole("Editor"); setInviteError(null) }}
              />
              {/* Dialog card */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2"
              >
                <div className="rounded-3xl bg-[#1c1c1e] p-6 shadow-2xl">
                  {/* Header */}
                  <div className="flex items-center gap-2 mb-6">
                    <BookOpen className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">sycord connect</span>
                  </div>

                  {inviteSent ? (
                    <div className="flex flex-col items-center gap-3 py-6 text-center">
                      <CheckCircle2 className="h-10 w-10 text-green-400" />
                      <p className="text-sm font-semibold text-foreground">Invite sent!</p>
                      <p className="text-xs text-muted-foreground">{inviteEmail} will receive an email shortly.</p>
                      <button
                        className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => { setInviteSent(false); setInviteEmail(""); setInviteRole("Editor"); setInviteError(null) }}
                      >
                        Invite another
                      </button>
                    </div>
                  ) : (
                    <>
                      {/* Two avatar circles */}
                      <div className="flex items-center justify-center gap-6 mb-6">
                        {/* Current user — filled purple */}
                        <div className="h-16 w-16 rounded-full bg-purple-500 ring-4 ring-[#3a3a3c] flex items-center justify-center text-xl font-bold text-white shrink-0">
                          {userInitials.charAt(0)}
                        </div>
                        {/* Invitee — empty placeholder */}
                        <div className="h-16 w-16 rounded-full bg-[#3a3a3c] ring-4 ring-[#2a2a2c]" />
                      </div>

                      {/* Email input */}
                      <Input
                        type="email"
                        placeholder="colleague@example.com"
                        aria-label="Invite by email address"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="bg-transparent border border-white/15 rounded-xl text-foreground placeholder:text-muted-foreground/40 focus:border-white/30 mb-4"
                      />

                      {/* Permission description */}
                      <p className="text-xs text-muted-foreground text-center mb-5 leading-relaxed">
                        invited <strong className="text-foreground font-semibold">user can manage</strong> website, edit product(s) on websites and have full access on their website
                      </p>

                      {/* Action button */}
                      {inviteError && (
                        <p className="text-xs text-red-400 text-center mb-2">{inviteError}</p>
                      )}
                      <button
                        disabled={!isValidInviteEmail || isSendingInvite}
                        onClick={async () => {
                          if (!isValidInviteEmail || isSendingInvite) return
                          setIsSendingInvite(true)
                          setInviteError(null)
                          try {
                            const res = await fetch("/api/collab/invite", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                projectId: project?._id?.toString(),
                                inviteeEmail: inviteEmail,
                              }),
                            })
                            const data = await res.json()
                            if (!res.ok) {
                              setInviteError(data.message || "Failed to send invite")
                            } else {
                              setInviteSent(true)
                            }
                          } catch {
                            setInviteError("Network error. Please try again.")
                          } finally {
                            setIsSendingInvite(false)
                          }
                        }}
                        className="w-full py-3 rounded-full bg-[#3a3a3c] hover:bg-[#4a4a4c] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm font-medium text-foreground"
                      >
                        {isSendingInvite ? "Sending..." : "Send invite"}
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {project?._id && (
          <ProjectIntegrationsDialog
            projectId={project._id}
            open={integrationDialogOpen}
            onOpenChange={setIntegrationDialogOpen}
            request={integrationRequest}
            onSaved={({ integrationIds }) => {
              if (integrationIds.length > 0) {
                setConnectedIntegrations((prev) => new Set([...prev, ...integrationIds]))
              }
              if (integrationIds.some((integrationId) => ["mongodb", "supabase", "firebase", "neon", "upstash"].includes(integrationId))) {
                setDatabaseConnected(true)
              }
            }}
          />
        )}


        <main className={cn("flex-1 relative", activeTab === "ai" ? "p-0 overflow-hidden" : "overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8 custom-scrollbar")}>
          <div className={cn("mx-auto", activeTab === "ai" ? "h-full w-full max-w-none p-0 pb-0 space-y-0" : "max-w-6xl space-y-8 pb-8")}>

            {/* TAB CONTENT: OVERVIEW */}
            {activeTab === "overview" && (() => {
              const recentChanges = generatedPages
                .slice()
                .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
              const visibleChanges = recentChanges.slice(0, 4)

              const authorName =
                (session?.user?.name as string | undefined) ||
                (session?.user?.email as string | undefined)?.split("@")[0] ||
                "you"
              const authorInitial = authorName.charAt(0).toUpperCase()
              const authorImage = (session?.user?.image as string | undefined) || undefined

              // Relative time formatter (e.g., "2h ago", "yesterday", "3d ago")
              const relTime = (ts?: number) => {
                if (!ts) return ""
                const diff = Date.now() - ts
                const mins = Math.floor(diff / 60000)
                if (mins < 1) return "just now"
                if (mins < 60) return `${mins}m ago`
                const hrs = Math.floor(mins / 60)
                if (hrs < 24) return `${hrs}h ago`
                const days = Math.floor(hrs / 24)
                if (days === 1) return "yesterday"
                if (days < 7) return `${days}d ago`
                const weeks = Math.floor(days / 7)
                if (weeks < 4) return `${weeks}w ago`
                const d = new Date(ts)
                return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear().toString().slice(2)}`
              }

              // Visitor stats — 7-day sparkline
              const visitorCount = (project as any)?.visitorCount7d ?? 10
              const sparkPoints: number[] = (project as any)?.visitorTrend7d || [4, 5, 4, 6, 7, 9, 10]
              const sparkMax = Math.max(...sparkPoints, 1)
              const sparkMin = Math.min(...sparkPoints, 0)
              const sparkW = 260
              const sparkH = 80
              const sparkPathPoints = sparkPoints.map((v, i) => {
                const x = (i / (sparkPoints.length - 1)) * sparkW
                const range = Math.max(sparkMax - sparkMin, 1)
                const y = sparkH - ((v - sparkMin) / range) * (sparkH - 12) - 6
                return { x, y }
              })
              const sparkLine = sparkPathPoints
                .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
                .join(" ")
              const sparkArea = `${sparkLine} L${sparkW},${sparkH} L0,${sparkH} Z`

              // Week-over-week delta — treat "0 baseline" as a "new" pill instead of false 100%
              const firstHalf = sparkPoints.slice(0, Math.floor(sparkPoints.length / 2))
              const secondHalf = sparkPoints.slice(Math.floor(sparkPoints.length / 2))
              const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0)
              const firstAvg = avg(firstHalf)
              const secondAvg = avg(secondHalf)
              const deltaPct = firstAvg === 0 ? null : Math.round(((secondAvg - firstAvg) / firstAvg) * 100)
              const isUp = deltaPct === null ? secondAvg > 0 : deltaPct >= 0

              const pagesCount = generatedPages.length
              const lastUpdateTs = recentChanges[0]?.timestamp

              const copyDomain = async () => {
                if (!displayUrl) return
                try {
                  await navigator.clipboard.writeText(displayUrl)
                  setCopiedDomain(true)
                  if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current)
                  copyTimeoutRef.current = setTimeout(() => setCopiedDomain(false), 1800)
                } catch { /* ignore */ }
              }

              return (
                <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-6 lg:space-y-7">

                  {/* ── ROW 1: Preview (left) + Domain info & buttons (right, only on lg) ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">

                    {/* Preview box */}
                    <div
                      className="lg:col-span-7 relative w-full overflow-hidden rounded-[22px] group/preview"
                      style={{ background: "#252527", aspectRatio: "16/10", border: "1px solid rgba(255,255,255,0.08)" }}
                    >
                      {previewUrl ? (
                        <iframe
                          src={previewUrl}
                          title={`Preview of ${displayUrl}`}
                          className="absolute inset-0 w-[1440px] h-[900px] border-0 origin-top-left pointer-events-none select-none"
                          sandbox="allow-scripts"
                          tabIndex={-1}
                          ref={(el) => {
                            if (el && el.parentElement) {
                              const scale = el.parentElement.offsetWidth / 1440
                              el.style.transform = `scale(${scale})`
                            }
                          }}
                        />
                      ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: "#2e2e30" }}>
                            <Globe className="h-6 w-6 text-zinc-500" />
                          </div>
                          <p className="text-sm font-semibold text-zinc-300">No deployment yet</p>
                          <p className="text-xs text-zinc-600 max-w-[200px] text-center">Deploy your site to see a live preview</p>
                        </div>
                      )}

                      {/* Vignette overlay */}
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(to bottom, transparent 50%, rgba(28,28,30,0.7) 100%)" }}
                      />

                      {/* Open-in-new hover affordance */}
                      {previewUrl && (
                        <button
                          type="button"
                          onClick={() => window.open(previewUrl, "_blank", "noopener,noreferrer")}
                          className="absolute top-3 right-3 h-9 w-9 rounded-full flex items-center justify-center bg-black/50 backdrop-blur-md text-zinc-100 opacity-0 group-hover/preview:opacity-100 transition-all hover:scale-110 hover:bg-black/70 z-10"
                          style={{ border: "1px solid rgba(255,255,255,0.15)" }}
                          aria-label="Open site in new tab"
                          title="Open site"
                        >
                          <ArrowUpRight className="h-4 w-4" />
                        </button>
                      )}

                      {/* "Your site is now live!" banner */}
                      {previewUrl && (
                        <div className="absolute bottom-0 left-0" style={{ zIndex: 10 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              padding: "12px 20px",
                              borderTopRightRadius: "22px",
                              background: "#22a846",
                            }}
                          >
                            <CheckCircle2 aria-hidden="true" style={{ width: "15px", height: "15px", color: "rgba(255,255,255,0.95)", flexShrink: 0 }} />
                            <span style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", lineHeight: 1.2, whiteSpace: "nowrap" }}>
                              Your site is now live!
                            </span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Domain + buttons */}
                    <div className="lg:col-span-5 flex flex-col gap-4 sm:gap-5">
                      {/* Project profile row: [logo] domain  +  [visit ▾] */}
                      <div className="flex items-center gap-3 sm:gap-4">
                        {/* Logo / status square (subtly pulses when live) */}
                        <div className="relative shrink-0">
                          <div
                            className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl flex items-center justify-center overflow-hidden"
                            role="status"
                            aria-label={previewUrl ? "Site is live" : "Site not deployed"}
                          >
                            {profileImage && !logoLoadError ? (
                              <img
                                src={profileImage}
                                alt="Site logo"
                                className="w-full h-full object-cover"
                                onError={() => setLogoLoadError(true)}
                              />
                            ) : null}
                          </div>
                          {previewUrl && (
                            <span
                              aria-hidden="true"
                              className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-[#1C1C1E]"
                            />
                          )}
                        </div>

                        {/* Domain name (copyable) */}
                        <button
                          type="button"
                          onClick={copyDomain}
                          disabled={!displayUrl}
                          className="group/dom flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1 text-left disabled:cursor-default"
                          title={displayUrl ? "Click to copy" : undefined}
                        >
                          <h2 className="text-[18px] sm:text-[22px] lg:text-[26px] leading-tight font-bold text-zinc-100 truncate min-w-0 group-hover/dom:text-white transition-colors">
                            {displayUrl || "Not deployed"}
                          </h2>
                          {displayUrl && (
                            <span
                              className={cn(
                                "shrink-0 h-6 w-6 sm:h-7 sm:w-7 rounded-lg flex items-center justify-center transition-all",
                                copiedDomain
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "text-zinc-500 opacity-70 sm:opacity-0 sm:group-hover/dom:opacity-100 hover:bg-white/[0.06] hover:text-zinc-200"
                              )}
                              aria-hidden="true"
                            >
                              {copiedDomain ? <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
                            </span>
                          )}
                        </button>

                        {/* Visit dropdown (trigger) — opens a scrollable panel with live + preview pills */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              disabled={!previewUrl}
                              aria-label="Open visit options"
                              className="group/visit shrink-0 h-10 sm:h-12 pl-3.5 sm:pl-5 pr-2.5 sm:pr-3 rounded-full flex items-center gap-1.5 sm:gap-2 text-[13px] sm:text-[15px] font-semibold text-zinc-200 transition-all hover:bg-white/[0.05] hover:border-white/25 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed"
                              style={{ border: "1.5px solid rgba(255,255,255,0.14)" }}
                            >
                              <span>visit</span>
                              <ChevronDown className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-zinc-400 transition-transform group-data-[state=open]/visit:rotate-180" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            sideOffset={8}
                            className="bg-[#1c1c1c] border border-white/[0.08] rounded-2xl p-1.5 min-w-[180px] max-h-[260px] overflow-y-auto custom-scrollbar"
                          >
                            {/* live */}
                            <DropdownMenuItem
                              onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}
                              disabled={!previewUrl}
                              className="rounded-full p-0 focus:bg-transparent data-[highlighted]:bg-transparent"
                            >
                              <div
                                className="w-full h-9 sm:h-10 px-4 rounded-full flex items-center gap-2 text-[13px] sm:text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                style={{ background: VISIT_PILL_LIVE_BG, boxShadow: VISIT_PILL_LIVE_SHADOW }}
                              >
                                <ArrowUpRight className="h-4 w-4" />
                                <span>live</span>
                              </div>
                            </DropdownMenuItem>
                            {/* preview */}
                            <DropdownMenuItem
                              onClick={() => previewUrl && window.open(previewUrl, "_blank", "noopener,noreferrer")}
                              disabled={!previewUrl}
                              className="rounded-full p-0 mt-1.5 focus:bg-transparent data-[highlighted]:bg-transparent"
                            >
                              <div
                                className="w-full h-9 sm:h-10 px-4 rounded-full flex items-center gap-2 text-[13px] sm:text-[14px] font-semibold text-white transition-transform hover:scale-[1.02] active:scale-[0.98]"
                                style={{ background: VISIT_PILL_PREVIEW_BG, boxShadow: VISIT_PILL_PREVIEW_SHADOW }}
                              >
                                <ArrowUpRight className="h-4 w-4" />
                                <span>preview</span>
                              </div>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Secondary quick-actions: Changes + Settings */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setActiveTab("pages")}
                          className="group/qa h-9 sm:h-10 px-3.5 sm:px-4 rounded-full flex items-center gap-2 text-[12px] sm:text-[13px] font-semibold text-zinc-300 hover:text-zinc-100 transition-all hover:bg-white/[0.04] active:scale-[0.97]"
                          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400 group-hover/qa:text-zinc-200 transition-colors" />
                          <span>Changes</span>
                          {generatedPages.length > 0 && (
                            <span className="min-w-[18px] h-[18px] px-1.5 rounded-full flex items-center justify-center text-[10px] font-bold tabular-nums bg-white/[0.08] text-zinc-300">
                              {generatedPages.length}
                            </span>
                          )}
                        </button>
                        <button
                          onClick={() => setActiveTab("settings")}
                          className="group/qa h-9 sm:h-10 px-3.5 sm:px-4 rounded-full flex items-center gap-2 text-[12px] sm:text-[13px] font-semibold text-zinc-300 hover:text-zinc-100 transition-all hover:bg-white/[0.04] active:scale-[0.97]"
                          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
                        >
                          <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-zinc-400 group-hover/qa:text-zinc-200 transition-colors" />
                          <span>Settings</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* ── ROW 2: Stat cards ── */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 lg:gap-5 pt-2">

                    {/* Visitors card with sparkline + delta */}
                    <div
                      className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] p-4 sm:p-5 lg:p-6 flex flex-col gap-3 sm:gap-4 min-h-[160px] sm:min-h-[190px] transition-colors hover:bg-white/[0.02]"
                      style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                          >
                            <Eye className="h-4 w-4 text-zinc-400" />
                          </div>
                          <p className="text-[15px] sm:text-[16px] text-zinc-200 min-w-0 truncate">
                            <span className="font-bold">{visitorCount} visitor{visitorCount !== 1 ? "s" : ""}</span>
                            <span className="text-zinc-400"> in 7 days</span>
                          </p>
                        </div>
                        <span
                          className={cn(
                            "shrink-0 inline-flex items-center gap-1 h-6 px-2 rounded-full text-[11px] font-semibold tabular-nums",
                            deltaPct === null
                              ? "bg-sky-500/10 text-sky-400"
                              : isUp
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-rose-500/10 text-rose-400"
                          )}
                        >
                          {deltaPct === null ? (
                            <>
                              <TrendingUp className="h-3 w-3" />
                              new
                            </>
                          ) : (
                            <>
                              {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                              {isUp ? "+" : ""}
                              {deltaPct}%
                            </>
                          )}
                        </span>
                      </div>

                      {/* Sparkline with area fill */}
                      <div className="flex-1 flex items-end min-h-[80px]">
                        <svg
                          viewBox={`0 0 ${sparkW} ${sparkH}`}
                          className="w-full h-full overflow-visible"
                          preserveAspectRatio="none"
                          aria-hidden="true"
                        >
                          <defs>
                            <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
                              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                            </linearGradient>
                          </defs>
                          <path d={sparkArea} fill="url(#sparkFill)" />
                          <path
                            d={sparkLine}
                            fill="none"
                            stroke="rgba(255,255,255,0.6)"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            vectorEffect="non-scaling-stroke"
                          />
                          {/* Last-point dot */}
                          {sparkPathPoints.length > 0 && (
                            <circle
                              cx={sparkPathPoints[sparkPathPoints.length - 1].x}
                              cy={sparkPathPoints[sparkPathPoints.length - 1].y}
                              r="3"
                              fill="#ffffff"
                            />
                          )}
                        </svg>
                      </div>

                      {/* Axis labels */}
                      <div className="flex items-center justify-between text-[11px] text-zinc-600 -mt-1 tabular-nums">
                        <span>7d ago</span>
                        <span>Today</span>
                      </div>
                    </div>

                    {/* Pages card */}
                    <div
                      className="relative overflow-hidden rounded-[18px] sm:rounded-[22px] p-4 sm:p-5 lg:p-6 flex flex-col gap-3 sm:gap-4 min-h-[160px] sm:min-h-[190px] transition-colors hover:bg-white/[0.02]"
                      style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.12)" }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center"
                          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <FileText className="h-4 w-4 text-zinc-400" />
                        </div>
                        <p className="text-[15px] sm:text-[16px] text-zinc-200">
                          <span className="font-bold">{pagesCount} page{pagesCount !== 1 ? "s" : ""}</span>
                          <span className="text-zinc-400"> on this site</span>
                        </p>
                      </div>

                      {pagesCount > 0 ? (
                        <div className="flex-1 flex flex-col gap-1.5 min-h-0">
                          {generatedPages.slice(0, 3).map((p, i) => (
                            <div
                              key={(p.name || "p") + i}
                              className="flex items-center gap-2 text-[13px] text-zinc-400 truncate"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-zinc-600 shrink-0" />
                              <span className="truncate">{p.name || "untitled"}</span>
                            </div>
                          ))}
                          {pagesCount > 3 && (
                            <div className="text-[12px] text-zinc-600 pl-3.5">+ {pagesCount - 3} more</div>
                          )}
                          {lastUpdateTs && (
                            <div className="mt-auto pt-2 text-[11px] text-zinc-600 flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              Last updated {relTime(lastUpdateTs)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center">
                          <p className="text-[13px] text-zinc-600">Generate a page to get started</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <ProjectSyraSessionCard
                    session={chatSessionSummary}
                    onOpenChat={openSyra}
                  />

                  {/* ── ROW 3: Recent activity ── */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-zinc-500" />
                        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-zinc-500">Recent activity</h3>
                      </div>
                      {recentChanges.length > 4 && (
                        <button
                          onClick={() => setActiveTab("pages")}
                          className="text-[12px] font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
                        >
                          View all ({recentChanges.length})
                        </button>
                      )}
                    </div>

                    {visibleChanges.length > 0 ? (
                      <ul className="space-y-1">
                        {visibleChanges.map((page, idx) => (
                          <li
                            key={(page.name || "page") + idx}
                            className="flex items-center gap-2.5 sm:gap-3 py-2 px-2 -mx-2 rounded-xl hover:bg-white/[0.025] transition-colors"
                          >
                            <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0 border border-white/[0.08]">
                              {authorImage && <AvatarImage src={authorImage} alt={authorName} />}
                              <AvatarFallback className="bg-[#2e2e30] text-zinc-300 text-[12px] sm:text-[13px] font-bold">
                                {authorInitial}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-[13px] sm:text-[15px] text-zinc-300 truncate">
                                <span className="text-zinc-400">changes made by </span>
                                <span className="font-semibold text-zinc-100">{authorName}</span>
                              </p>
                              {page.name && (
                                <p className="text-[11px] sm:text-[12px] text-zinc-500 truncate mt-0.5">
                                  <FileText className="inline h-3 w-3 mr-1 -mt-0.5" />
                                  {page.name}
                                </p>
                              )}
                            </div>
                            {page.timestamp && (
                              <span className="shrink-0 text-[11px] sm:text-[12px] text-zinc-500 flex items-center gap-1 tabular-nums">
                                <Clock className="h-3 w-3" />
                                {relTime(page.timestamp)}
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="flex items-center gap-3 py-4 px-4 rounded-2xl" style={{ border: "1px dashed rgba(255,255,255,0.1)" }}>
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ background: "#2e2e30", border: "1px solid rgba(255,255,255,0.08)" }}
                        >
                          <History className="h-4 w-4 text-zinc-500" />
                        </div>
                        <p className="text-[14px] text-zinc-500">No changes yet — use Syra to build your site</p>
                      </div>
                    )}
                  </div>

                </div>
              )
            })()}



            {/* TAB CONTENT: DOMAIN */}
            {activeTab === "domain" && (() => {
              const slug = domainSearch.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/^-+|-+$/g, "") || ""

              return (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 max-w-2xl font-[Inter,system-ui,sans-serif]">
                  {/* Video preview */}
                  <div className="relative rounded-2xl overflow-hidden bg-black/30 border border-white/[0.06]">
                    <video
                      src="/domain.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      aria-label="Domain setup demonstration"
                      className="w-full rounded-2xl"
                    />
                  </div>

                  {/* Included free subdomain */}
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest px-1">Included with your plan</p>
                    <div className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#1C1C1E] border border-white/[0.06]">
                      <Globe className="h-5 w-5 text-zinc-400 shrink-0" />
                      <span className="flex-1 text-sm font-mono text-white truncate tracking-tight">
                        {displayUrl || `${project?.businessName?.toLowerCase().replace(/[^a-z0-9]/g, "") || "yoursite"}.sycord.com`}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-full">free</span>
                        <span className="flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          owned
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Domain search — modernized */}
                  <div className="space-y-2.5">
                    <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest px-1">Find a custom domain</p>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                      <input
                        type="text"
                        value={domainSearch}
                        onChange={(e) => {
                          setDomainSearch(e.target.value)
                          // Reset checks when search changes
                          setDomainChecks({})
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && slug) checkAllDomains(slug)
                        }}
                        placeholder="Search for a domain name…"
                        className="w-full h-12 pl-11 pr-28 rounded-2xl bg-[#1F1F23] border border-white/[0.08] text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500/40 transition-all font-[Inter,system-ui,sans-serif] tracking-tight"
                      />
                      <button
                        onClick={() => slug && checkAllDomains(slug)}
                        disabled={!slug || isDomainCheckLoading}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 px-4 rounded-xl bg-white/[0.08] hover:bg-white/[0.14] text-xs font-semibold text-zinc-300 hover:text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                      >
                        {isDomainCheckLoading ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Search className="h-3.5 w-3.5" />
                        )}
                        Check
                      </button>
                    </div>
                  </div>

                  {/* TLD results — sorted: available (cheapest first) → unknown → taken */}
                  <div className="space-y-2">
                    {slug.length > 0 ? (() => {
                      const rank = (avail: boolean | null | undefined) =>
                        avail === true ? 0 : avail === undefined || avail === null ? 1 : 2
                      const sorted = [...effectiveTldOptions].sort((a, b) => {
                        const ra = rank(domainChecks[`${slug}${a.tld}`]?.available)
                        const rb = rank(domainChecks[`${slug}${b.tld}`]?.available)
                        if (ra !== rb) return ra - rb
                        return a.price - b.price
                      })
                      // Best-match = first available (cheapest, already sorted)
                      const bestMatchTld = sorted.find(
                        ({ tld }) => domainChecks[`${slug}${tld}`]?.available === true
                      )?.tld

                      return sorted.map(({ tld, price }) => {
                        const fullDomain = `${slug}${tld}`
                        const check = domainChecks[fullDomain]
                        const isAvailable = check?.available
                        const isUnavailable = check?.available === false
                        const isChecking = check?.loading
                        const isBestMatch = tld === bestMatchTld
                        const purchaseUrl = check?.purchaseUrl || `https://dash.cloudflare.com/?to=/:account/domains/register/${encodeURIComponent(fullDomain)}`

                        return (
                          <div
                            key={tld}
                            className={cn(
                              "flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 rounded-2xl border transition-all",
                              isUnavailable
                                ? "bg-[#1C1C1E] border-red-500/20 opacity-60"
                                : isBestMatch
                                  ? "bg-[#1C1C1E] border-emerald-500/40 hover:border-emerald-500/60 cursor-pointer shadow-[0_0_0_3px_rgba(16,185,129,0.06)]"
                                  : isAvailable
                                    ? "bg-[#1C1C1E] border-emerald-500/20 hover:border-emerald-500/40 cursor-pointer"
                                    : "bg-[#1C1C1E] border-white/[0.06] hover:border-white/[0.14] cursor-pointer"
                            )}
                            onClick={() => {
                              if (!isUnavailable) {
                                window.open(purchaseUrl, "_blank", "noopener,noreferrer")
                              }
                            }}
                          >
                            <CloudflareProviderIcon />
                            <span className="flex-1 text-[13px] sm:text-sm font-medium text-white tracking-tight truncate">{fullDomain}</span>
                            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                              {isBestMatch && (
                                <span className="hidden sm:inline-flex text-[10px] font-bold bg-emerald-500 text-white px-2 py-0.5 rounded-full">best match</span>
                              )}
                              {isChecking ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                              ) : isAvailable ? (
                                <span className="text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full">available</span>
                              ) : isUnavailable ? (
                                <span className="text-[10px] font-semibold bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">taken</span>
                              ) : null}
                              <span className="text-[13px] sm:text-sm font-semibold text-white/60 tabular-nums">${price.toFixed(2)}/yr</span>
                              {!isUnavailable && (
                                <ExternalLink className="hidden sm:block h-3.5 w-3.5 text-zinc-600" />
                              )}
                            </div>
                          </div>
                        )
                      })
                    })() : effectiveTldOptions.map(({ tld }) => (
                      <div
                        key={tld}
                        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-[#1C1C1E] border border-white/[0.06]"
                      >
                        <div className="h-6 w-6 rounded-md bg-white/[0.06] shrink-0 animate-pulse" />
                        <div className="flex-1 h-3.5 rounded-full bg-white/[0.06] animate-pulse" />
                        <div className="h-3.5 w-14 rounded-full bg-white/[0.06] shrink-0 animate-pulse" />
                      </div>
                    ))}
                  </div>

                  {/* Powered by Cloudflare badge */}
                  <div className="flex items-center justify-center gap-2 pt-2 pb-4">
                    <CloudflareProviderIcon />
                    <span className="text-[11px] text-zinc-600 font-medium">Powered by Cloudflare Registrar</span>
                  </div>
                </div>
              )
            })()}

            {/* TAB CONTENT: ITEMS / PRODUCTS */}
            {activeTab === "items" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Products</h2>
                  <Button onClick={() => document.getElementById('add-product-form')?.scrollIntoView({ behavior: 'smooth' })}>
                    <Plus className="h-4 w-4 mr-2" /> Add Product
                  </Button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {/* Product List */}
                  <Card className="bg-card/50 backdrop-blur-sm border-white/10">
                    <CardHeader>
                      <CardTitle>Inventory ({products.length})</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {productsLoading ? (
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                      ) : products.length === 0 ? (
                        <div className="text-center py-12">
                          <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-20" />
                          <p className="text-muted-foreground">No products found.</p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                           {products.map((product) => (
                             <div key={product._id} className="group flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-lg bg-black/20 border border-white/5 hover:border-white/10 transition-colors">
                                <div className="h-16 w-16 bg-white/5 rounded-md overflow-hidden flex-shrink-0">
                                   {product.image ? (
                                     <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                                   ) : (
                                     <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                                       <Package className="h-6 w-6 opacity-50" />
                                     </div>
                                   )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium truncate">{product.name}</h4>
                                  <p className="text-sm text-muted-foreground truncate">{product.category || 'Uncategorized'}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className="text-sm font-semibold">{(currencySymbols as Record<string, string>)[settings?.currency || "USD"]}{product.price}</span>
                                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded ${product.inStock ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                      {product.inStock ? 'In Stock' : 'Out of Stock'}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => handleDeleteProduct(product._id, product.name)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                             </div>
                           ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Add Product Form */}
                  <Card id="add-product-form" className="bg-card/50 backdrop-blur-sm border-white/10">
                    <CardHeader>
                      <CardTitle>Add New Product</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                       <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="space-y-2">
                           <Label>Product Name</Label>
                           <Input
                             value={newProduct.name}
                             onChange={(e) => setNewProduct({...newProduct, name: e.target.value})}
                             placeholder="e.g. Premium T-Shirt"
                             className="bg-black/20"
                           />
                         </div>
                         <div className="space-y-2">
                           <Label>Price</Label>
                           <Input
                             type="number"
                             value={newProduct.price}
                             onChange={(e) => setNewProduct({...newProduct, price: parseFloat(e.target.value)})}
                             className="bg-black/20"
                           />
                         </div>
                         <div className="space-y-2">
                           <Label>Category</Label>
                           <Input
                             value={newProduct.category}
                             onChange={(e) => setNewProduct({...newProduct, category: e.target.value})}
                             className="bg-black/20"
                           />
                         </div>
                         <div className="space-y-2">
                           <Label>Image URL</Label>
                           <Input
                             value={newProduct.image}
                             onChange={(e) => setNewProduct({...newProduct, image: e.target.value})}
                             className="bg-black/20"
                           />
                         </div>
                         <div className="md:col-span-2 space-y-2">
                           <Label>Description</Label>
                           <Input
                             value={newProduct.description}
                             onChange={(e) => setNewProduct({...newProduct, description: e.target.value})}
                             className="bg-black/20"
                           />
                         </div>
                       </div>
                       <div className="flex items-center gap-2 pt-2">
                         <Switch
                           checked={newProduct.inStock}
                           onCheckedChange={(c: boolean) => setNewProduct({...newProduct, inStock: c})}
                         />
                         <Label>In Stock</Label>
                       </div>
                       <Button onClick={handleAddProduct} disabled={isAddingProduct} className="w-full mt-2">
                         {isAddingProduct ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Plus className="h-4 w-4 mr-2"/>}
                         Save Product
                       </Button>
                       {productError && <p className="text-sm text-destructive text-center">{productError}</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {/* TAB CONTENT: GLOVIX (AI BUILDER) — desktop iframe; mobile uses full-page /syra.
                Keep iframe mounted after first open so switching tabs does not remount Syra. */}
            {(activeTab === "ai" || syraEverOpened) && (
              <div
                className={cn(
                  "h-full w-full flex-col",
                  activeTab === "ai" ? "hidden md:flex" : "hidden",
                )}
                aria-hidden={activeTab !== "ai"}
              >
                <div className="flex-1 bg-background overflow-hidden relative min-h-[60vh] md:min-h-0">
                  {id ? (
                    <iframe
                      key={id}
                      src={`/dashboard/sites/${id}/syra`}
                      className="absolute inset-0 h-full w-full border-0 bg-[#18191B]"
                      title="Syra AI Builder"
                      allow="cross-origin-isolated; clipboard-read; clipboard-write"
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <AlertCircle className="h-6 w-6 text-destructive mr-2" />
                      <span className="text-destructive">Project ID error</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB CONTENT: PAYOUTS (formerly Payments) */}
            {activeTab === "payments" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <h2 className="text-2xl font-bold">Payouts</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                   {paymentOptions.map((option) => (
                     <Card key={option.id} className="bg-card/50 backdrop-blur-sm border-white/10 hover:border-primary/50 transition-all">
                        <CardHeader>
                          <CardTitle>{option.name}</CardTitle>
                          <CardDescription>{option.description}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <Button variant="outline" className="w-full">Configure</Button>
                        </CardContent>
                     </Card>
                   ))}
                </div>
              </div>
            )}

            {/* TAB CONTENT: PAGES */}
            {activeTab === "pages" && (
              <PagesDeployPanel
                pages={generatedPages}
                projectId={id}
                projectName={shopName}
                onDeletePage={handleDeletePage}
                onDeleteAll={async () => {
                  if (!confirm("Delete ALL generated pages? This cannot be undone.")) return
                  try {
                    const res = await fetch(`/api/projects/${id}/pages?all=true`, { method: "DELETE" })
                    if (res.ok) {
                      setGeneratedPages([])
                      setSelectedPage(null)
                    } else {
                      throw new Error("Failed to delete all pages")
                    }
                  } catch (e: any) {
                    alert(e.message)
                  }
                }}
                onDeploy={handleDeploy}
                onGoToAI={openSyra}
                isDeploying={isDeploying}
                deployProgress={deployProgress}
                deployError={deployError}
                deployResult={deployResult}
                deploymentRuntime={deploymentRuntime}
                hasDeployError={hasDeployError}
                onFetchLogs={() => fetchLogs()}
                runnerErrorDetails={runnerErrorDetails}
              />
            )}

            {/* TAB CONTENT: INTEGRATIONS */}
            {activeTab === "integrations" && (() => {
              const iconByCategory: Record<IntegrationCategory, React.ElementType> = {
                Database: Database,
                Auth: Lock,
                Payments: Wallet,
                Email: Mail,
                AI: Sparkles,
                Storage: Database,
                Services: Wrench,
              }

              const filtered = integrationCategory === "All" ? INTEGRATION_CATALOG : INTEGRATION_CATALOG.filter((i) => i.category === integrationCategory)

              const renderIntegrationIcon = (integration: IntegrationDefinition, color: string) => {
                switch (integration.id) {
                  case "mongodb":
                    return (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={color}>
                        <path d="M17.193 9.555c-1.264-5.58-4.252-7.414-4.573-8.115-.28-.394-.53-.954-.735-1.44-.036.495-.055.685-.523 1.184-.723.566-4.438 3.682-4.74 10.02-.282 5.912 4.27 9.435 4.888 9.884l.07.05A73.49 73.49 0 0111.91 24h.481c.114-1.032.284-2.056.51-3.07.417-.296.604-.463.85-.693a11.342 11.342 0 003.639-8.464c.01-.814-.103-1.662-.197-2.218zm-5.336 8.195s0-8.291.275-8.29c.213 0 .49 10.695.49 10.695-.381-.045-.765-1.76-.765-2.405z" />
                      </svg>
                    )
                  case "supabase":
                  case "supabase-auth":
                    return (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={color}>
                        <path d="M11.9 1.036c-.015-.986-1.26-1.41-1.874-.637L.764 12.05C.131 12.876.712 14.064 1.748 14.064h9.545a.2.2 0 01.2.2L11.9 22.964c.015.986 1.26 1.41 1.874.637l9.262-11.652c.633-.825.052-2.013-1.016-2.013H13.55a.2.2 0 01-.2-.2L11.9 1.036z" />
                      </svg>
                    )
                  case "firebase":
                    return (
                      <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <path fill="#FFA000" d="M3.89 15.672L6.255.461A.25.25 0 016.975.31l2.21 4.303 2.3-4.303a.25.25 0 01.44.12l.63 15.046z" />
                        <path fill="#F57F17" d="M11.53 14.03l2.528-14.96.025-.07a.25.25 0 01.44.12l.63 15.046z" />
                        <path fill="#FFCA28" d="M3.89 15.672l.01-.048 1.27-12.975.73 1.57L4.88 13.66l9.13-5.176L12 20z" />
                      </svg>
                    )
                  case "stripe":
                    return (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={color}>
                        <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305z" />
                      </svg>
                    )
                  case "openai":
                    return (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={color}>
                        <path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 004.981 4.18a5.985 5.985 0 00-3.998 2.9 6.046 6.046 0 00.743 7.097 5.98 5.98 0 00.51 4.911 6.051 6.051 0 006.515 2.9A5.985 5.985 0 0013.26 24a6.056 6.056 0 005.772-4.206 5.99 5.99 0 003.997-2.9 6.056 6.056 0 00-.747-7.073zM13.26 22.43a4.476 4.476 0 01-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 00.392-.681v-6.737l2.02 1.168a.071.071 0 01.038.052v5.583a4.504 4.504 0 01-4.494 4.494zM3.6 18.304a4.47 4.47 0 01-.535-3.014l.142.085 4.783 2.759a.771.771 0 00.78 0l5.843-3.369v2.332a.08.08 0 01-.033.062L9.74 19.95a4.5 4.5 0 01-6.14-1.646zM2.34 7.896a4.485 4.485 0 012.366-1.973V11.6a.766.766 0 00.388.676l5.815 3.355-2.02 1.168a.076.076 0 01-.071 0l-4.83-2.786A4.504 4.504 0 012.34 7.872zm16.597 3.855l-5.843-3.37 2.019-1.168a.076.076 0 01.071 0l4.83 2.791a4.494 4.494 0 01-.676 8.105v-5.678a.79.79 0 00-.41-.676zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 00-.785 0L9.409 9.23V6.897a.066.066 0 01.028-.061l4.83-2.787a4.5 4.5 0 016.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 01-.038-.057V6.075a4.5 4.5 0 017.375-3.453l-.142.08L8.704 5.46a.795.795 0 00-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5-.005-2.999z" />
                      </svg>
                    )
                  case "github":
                    return (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={color}>
                        <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
                      </svg>
                    )
                  case "paypal":
                    return (
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={color}>
                        <path d="M7.076 21.337H2.47a.641.641 0 01-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.01 1.15 1.304 2.42 1.012 4.287-.023.143-.047.288-.077.437-.983 5.05-4.349 6.797-8.647 6.797h-2.19c-.524 0-.968.382-1.05.9l-1.12 7.106zm14.146-14.42a3.35 3.35 0 00-.607-.541c-.013.076-.026.175-.041.254-.93 4.778-4.005 7.201-9.138 7.201h-2.19a.563.563 0 00-.556.479l-1.187 7.527h-.506l-.24 1.516a.56.56 0 00.554.647h3.882c.46 0 .85-.334.922-.788.06-.26.76-4.852.816-5.09a.932.932 0 01.923-.788h.58c3.76 0 6.705-1.528 7.565-5.946.36-1.847.174-3.388-.777-4.471z" />
                      </svg>
                    )
                  default:
                    const IconComponent = iconByCategory[integration.category]
                    return IconComponent ? <IconComponent className="w-5 h-5" style={{ color }} /> : null
                }
              }

              return (
                <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 max-w-4xl">
                  {/* Video preview */}
                  <div className="relative rounded-2xl overflow-hidden bg-black/30 border border-white/[0.06]">
                    <video
                      src="/Integration.mp4"
                      autoPlay
                      loop
                      muted
                      playsInline
                      aria-label="Integration setup demonstration"
                      className="w-full rounded-2xl"
                    />
                  </div>

                  {/* Category filter pills */}
                  <div className="relative">
                    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
                      {["All", "Database", "Auth", "Payments", "Services"].map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setIntegrationCategory(cat)}
                          className={`px-4 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-colors border ${
                            integrationCategory === cat
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-white/[0.06] text-zinc-400 hover:bg-white/10 border-white/[0.06]"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {/* Right-edge fade to indicate scrollable content */}
                    <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent" />
                  </div>

                  {/* Integration cards grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map((integration) => (
                      <div
                        key={integration.id}
                        className="rounded-2xl bg-[#1C1C1E] border border-white/[0.06] p-4 flex flex-col hover:border-white/[0.14] transition-colors"
                      >
                        {/* Icon */}
                        <div
                          className="h-12 w-12 rounded-xl flex items-center justify-center mb-3"
                          style={{ backgroundColor: integration.iconBg }}
                        >
                          {renderIntegrationIcon(integration, integration.iconColor || "currentColor")}
                        </div>

                        {/* Name + badge */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-semibold text-white">{integration.name}</span>
                          {integration.free && (
                            <span className="text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-full">
                              free
                            </span>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-[11px] text-zinc-400 leading-relaxed mb-3">{integration.description}</p>

                        {/* Connect / Connected state */}
                        {connectedIntegrations.has(integration.id) ? (
                          <div className="mt-auto flex items-center gap-1.5 text-emerald-400 text-[11px] font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Connected
                          </div>
                        ) : expandedIntegration === integration.id ? (
                          getMcpProvider(integration.id)?.authType === 'oauth' ? (
                            <div className="space-y-2 mt-auto animate-in fade-in duration-150">
                              <Button
                                size="sm"
                                className="w-full h-8 text-[11px] rounded-lg"
                                onClick={() => openIntegrationOAuthPopup(project?._id || "", integration.id)}
                              >
                                Connect {integration.name} (OAuth)
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="w-full h-8 text-[11px] rounded-lg text-zinc-400 hover:text-zinc-200"
                                onClick={() => { setExpandedIntegration(null); setIntegrationSaveError(null) }}
                              >
                                Cancel
                              </Button>
                              {integrationSaveError && (
                                <p className="text-[10px] text-red-400 mt-2">{integrationSaveError}</p>
                              )}
                            </div>
                          ) : (
                          <div className="space-y-2 mt-auto animate-in fade-in duration-150">
                            <div className="relative">
                              <Input
                                placeholder={integration.placeholders?.[integration.envKeys[0]] || "Enter value..."}
                                type={showIntegrationToken ? "text" : "password"}
                                value={integrationEnvValue}
                                onChange={(e) => { setIntegrationEnvValue(e.target.value); setIntegrationSaveError(null) }}
                                className="h-8 bg-white/[0.03] border-white/[0.06] text-xs font-mono pr-8"
                                autoFocus
                              />
                              <button
                                type="button"
                                onClick={() => setShowIntegrationToken((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                              >
                                {showIntegrationToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                            {integrationSaveError && (
                              <p className="text-[10px] text-red-400">{integrationSaveError}</p>
                            )}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="h-7 text-[11px] flex-1 rounded-lg"
                                disabled={!integrationEnvValue.trim()}
                                onClick={async () => {
                                  setIntegrationSaveError(null)
                                  try {
                                    const res = await fetch(`/api/projects/${project._id}/env`, {
                                      method: "POST",
                                      headers: { "Content-Type": "application/json" },
                                      body: JSON.stringify({
                                        key: integration.envKeys[0],
                                        value: integrationEnvValue.trim(),
                                        integration: integration.id,
                                      }),
                                    })
                                    if (!res.ok) throw new Error("Failed to save")
                                    setConnectedIntegrations((prev) => new Set([...prev, integration.id]))
                                    if (integration.category === "Database") {
                                      setDatabaseConnected(true)
                                    }
                                    setExpandedIntegration(null)
                                    setIntegrationEnvValue("")
                                    setShowIntegrationToken(false)
                                  } catch {
                                    setIntegrationSaveError("Failed to save. Please try again.")
                                  }
                                }}
                              >
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 text-[11px] rounded-lg text-zinc-500"
                                onClick={() => { setExpandedIntegration(null); setIntegrationEnvValue(""); setShowIntegrationToken(false); setIntegrationSaveError(null) }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        )) : (
                          <button
                            onClick={() => { setExpandedIntegration(integration.id); setIntegrationEnvValue(""); setShowIntegrationToken(false); setIntegrationSaveError(null) }}
                            className="mt-auto w-full py-1.5 rounded-lg text-[11px] font-medium bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200 transition-colors border border-white/[0.06]"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Custom Environment Variables */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">Custom Environment Variables</p>
                      <button
                        onClick={() => setShowAddEnv(!showAddEnv)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] text-xs font-medium text-zinc-300 hover:bg-white/10 transition-colors border border-white/[0.06]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Custom Env
                      </button>
                    </div>
                    {showAddEnv && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3 animate-in fade-in duration-200">
                        <p className="text-xs font-medium text-white/60">Add Custom Environment Variable</p>
                        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                          <Input
                            placeholder="KEY_NAME"
                            value={newEnvKey}
                            onChange={(e) => setNewEnvKey(e.target.value)}
                            className="h-9 bg-white/[0.03] border-white/[0.06] text-sm font-mono flex-1"
                          />
                          <Input
                            placeholder="value"
                            value={newEnvValue}
                            onChange={(e) => setNewEnvValue(e.target.value)}
                            className="h-9 bg-white/[0.03] border-white/[0.06] text-sm flex-1"
                          />
                          <Button
                            size="sm"
                            className="h-9 px-4 text-xs rounded-lg"
                            disabled={!newEnvKey.trim()}
                            onClick={async () => {
                              if (!newEnvKey.trim()) return
                              try {
                                const res = await fetch(`/api/projects/${project._id}/env`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ key: newEnvKey.trim(), value: newEnvValue }),
                                })
                                if (!res.ok) throw new Error("Failed to save")
                                setNewEnvKey("")
                                setNewEnvValue("")
                                setShowAddEnv(false)
                              } catch (err) {
                                console.error("[Integrations] Failed to save custom env var:", err)
                              }
                            }}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* TAB CONTENT: SETTINGS */}
            {activeTab === "settings" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
                <h2 className="text-lg font-semibold">Settings</h2>

                <Card className="bg-card/50 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <CardTitle>Site Details</CardTitle>
                    <CardDescription>Update your site name and basic information.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="site-name">Site Name</Label>
                      <Input
                        id="site-name"
                        value={shopName}
                        onChange={(e) => setShopName(e.target.value)}
                        placeholder="My Website"
                        className="bg-black/20"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="site-logo">Site Logo URL</Label>
                      <Input
                        id="site-logo"
                        value={profileImage}
                        onChange={(e) => setProfileImage(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        className="bg-black/20"
                      />
                      <p className="text-xs text-muted-foreground">
                        Enter a URL for your site logo. This will appear in the overview and as your site icon.
                      </p>
                    </div>
                    {displayUrl && (
                      <div className="space-y-2">
                        <Label>Site URL</Label>
                        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-black/20 border border-white/10 text-sm text-muted-foreground">
                          <Globe className="h-4 w-4 shrink-0" />
                          <span className="truncate">{displayUrl}</span>
                          <button
                            onClick={() => previewUrl && window.open(previewUrl, "_blank")}
                            className="ml-auto shrink-0 hover:text-foreground transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="pt-2 flex items-center gap-3">
                      <Button onClick={handleSave} disabled={saving}>
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                        Save Changes
                      </Button>
                      {saveSuccess && (
                        <span className="text-sm text-green-500 flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" /> Saved
                        </span>
                      )}
                      {saveError && <span className="text-sm text-destructive">{saveError}</span>}
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-card/50 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <CardTitle>Your Plan</CardTitle>
                    <CardDescription>Current subscription and monthly credit allocation.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-white/5">
                      <BadgeCheck className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{getPlanLabel(subscription)}</p>
                        <p className="text-xs text-muted-foreground">Active subscription</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Coins className="h-4 w-4" /> Monthly Credit</span>
                        <span className="font-semibold">{planCredit}€ / month</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: "100%" }} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {planCredit}€ available this month
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <DeploymentSettingsCard projectId={id} project={project} />

                <Card className="bg-card/50 backdrop-blur-sm border-destructive/20">
                  <CardHeader>
                    <CardTitle className="text-destructive">Delete Project</CardTitle>
                    <CardDescription>Permanently delete this project and all its data. This action cannot be undone.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={() => setIsDeleteDialogOpen(true)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Project
                    </Button>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB CONTENT: PROMOTIONS (Shop) */}
            {activeTab === "promotions" && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <TrendingUp className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Promotions</h3>
                <p className="text-muted-foreground max-w-md">
                  Create discount codes and promotions for your shop. Coming soon.
                </p>
              </div>
            )}

            {/* TAB CONTENT: CLIENT (Shop) */}
            {activeTab === "customers" && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Client</h3>
                <p className="text-muted-foreground max-w-md">
                  Manage your customers and client relationships. Coming soon.
                </p>
              </div>
            )}

            {/* TAB CONTENT: POSTS (Blog) */}
            {activeTab === "posts" && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <BookOpen className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Posts</h3>
                <p className="text-muted-foreground max-w-md">
                  Create and manage blog posts. Coming soon.
                </p>
              </div>
            )}

            {/* TAB CONTENT: SEGMENTS (Blog) */}
            {activeTab === "segments" && (
              <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed border-white/10 rounded-xl bg-white/5 animate-in fade-in slide-in-from-bottom-2">
                <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-4">
                  <Layers className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Segments</h3>
                <p className="text-muted-foreground max-w-md">
                  Organize your blog content into segments. Coming soon.
                </p>
              </div>
            )}

          </div>
        </main>
      </motion.div>

      {/* Delete Project Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure you want to delete this project?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{project?.businessName}" and all its data, including any deployed instances. This action cannot be undone.
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
    </div>
  )
}
