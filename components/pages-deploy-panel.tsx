"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Rocket,
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Trash2,
  Sparkles,
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileType,
  ChevronRight,
  Code,
  ExternalLink,
  Copy,
  Terminal,
  Clock,
  XCircle,
  Globe,
  Server,
  Activity,
  LayoutTemplate,
  Zap,
} from "lucide-react"
import type { GeneratedPage } from "@/components/ai-website-builder"

interface FileTreeNode {
  name: string
  type: "file" | "folder"
  path: string
  children?: FileTreeNode[]
  page?: GeneratedPage
}

function getFileIcon(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase()
  switch (ext) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
      return FileCode
    case "json":
      return FileType
    case "css":
    case "scss":
      return FileType
    case "html":
      return FileText
    case "md":
      return FileText
    default:
      return File
  }
}

function buildFileTree(pages: GeneratedPage[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  for (const page of pages) {
    const parts = page.name.split("/")
    let currentLevel = root
    for (let index = 0; index < parts.length; index++) {
      const part = parts[index]
      const isFile = index === parts.length - 1
      const currentPath = parts.slice(0, index + 1).join("/")
      let existing = currentLevel.find((n) => n.name === part)
      if (!existing) {
        const newNode: FileTreeNode = {
          name: part,
          type: isFile ? "file" : "folder",
          path: currentPath,
          page: isFile ? page : undefined,
          children: isFile ? undefined : [],
        }
        currentLevel.push(newNode)
        existing = newNode
      }
      if (!isFile && existing.children) {
        currentLevel = existing.children
      }
    }
  }
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] =>
    nodes
      .sort((a, b) => {
        if (a.type !== b.type) return a.type === "folder" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      .map((node) => ({ ...node, children: node.children ? sortNodes(node.children) : undefined }))
  return sortNodes(root)
}

function FileTreeItem({
  node,
  depth = 0,
  onSelectFile,
  selectedPage,
  onDeleteFile,
  expandedFolders,
  toggleFolder,
}: {
  node: FileTreeNode
  depth?: number
  onSelectFile: (page: GeneratedPage) => void
  selectedPage: GeneratedPage | null
  onDeleteFile: (name: string) => void
  expandedFolders: Set<string>
  toggleFolder: (path: string) => void
}) {
  const isExpanded = expandedFolders.has(node.path)
  const isSelected = selectedPage?.name === node.page?.name
  const IconComp = node.type === "file" ? getFileIcon(node.name) : isExpanded ? FolderOpen : Folder

  return (
    <div>
      <button
        onClick={() => {
          if (node.type === "folder") toggleFolder(node.path)
          else if (node.page) onSelectFile(node.page)
        }}
        className={cn(
          "w-full flex items-center gap-1.5 py-1.5 px-2 text-[13px] rounded-md transition-all duration-150 group",
          isSelected
            ? "bg-blue-500/20 text-blue-300 font-medium"
            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
        )}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        {node.type === "folder" ? (
          <ChevronRight
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <IconComp
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            node.type === "folder" ? "text-amber-500" : "text-blue-400",
          )}
        />
        <span className="truncate flex-1 text-left">{node.name}</span>
        {node.type === "file" && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteFile(node.path)
            }}
            className="h-5 w-5 shrink-0 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-400 hover:text-red-300 flex items-center justify-center transition-all"
          >
            <Trash2 className="h-2.5 w-2.5" />
          </button>
        )}
      </button>
      {node.type === "folder" && isExpanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <FileTreeItem
              key={`${child.path}-${i}`}
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

export type DeployStatus = {
  running?: boolean
  build?: boolean | string
  health?: string
  health_ok?: boolean
  port?: number | null
  domain?: string
  url?: string
  processName?: string
  status?: string
  lastDeployError?: string | null
  lastDeployAt?: string
  warning?: string | null
}

export type PagesDeployPanelProps = {
  pages: GeneratedPage[]
  projectId: string
  projectName?: string
  onDeletePage: (name: string) => void
  onDeleteAll: () => void
  onDeploy: () => void
  onGoToAI: () => void
  isDeploying: boolean
  deployError: string | null
  deployResult?: DeployStatus | null
  deploymentRuntime?: DeployStatus | null
  hasDeployError?: boolean
  onFetchLogs?: () => void
  runnerErrorDetails?: string | null
}

export function PagesDeployPanel({
  pages,
  projectName,
  onDeletePage,
  onDeleteAll,
  onDeploy,
  onGoToAI,
  isDeploying,
  deployError,
  deployResult,
  deploymentRuntime,
  hasDeployError,
  onFetchLogs,
  runnerErrorDetails,
}: PagesDeployPanelProps) {
  const [selectedPage, setSelectedPage] = useState<GeneratedPage | null>(null)
  const [activeFileTab, setActiveFileTab] = useState<GeneratedPage | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const computeExpandedFolders = useMemo(() => {
    const folders = new Set<string>()
    for (const page of pages) {
      const parts = page.name.split("/")
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join("/"))
      }
    }
    return folders
  }, [pages])

  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(computeExpandedFolders)

  const handleSelectFile = (page: GeneratedPage) => {
    setSelectedPage(page)
    setActiveFileTab(page)
  }

  const handleCopyCode = () => {
    if (!activeFileTab) return
    navigator.clipboard.writeText(activeFileTab.code)
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const runtime = deployResult || deploymentRuntime
  const isRunning = runtime?.status === "running" || runtime?.running === true
  const isHealthy = runtime?.health === "healthy" || runtime?.health_ok === true
  const hasLiveUrl = Boolean(runtime?.url)
  const tree = useMemo(() => buildFileTree(pages), [pages])

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
              <LayoutTemplate className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold tracking-tight text-white">Pages</h2>
              <p className="text-xs text-zinc-500 mt-0.5">
                {pages.length} file{pages.length !== 1 ? "s" : ""} ready to deploy
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pages.length > 0 && (
            <>
              <Button
                onClick={onDeploy}
                disabled={isDeploying}
                className="gap-2 font-medium shadow-lg shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700"
              >
                {isDeploying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Deploy
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDeleteAll}
                className="gap-2 border-red-500/30 text-red-400 hover:text-red-300 hover:bg-red-500/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Clear All
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onGoToAI}
            className="gap-2 border-purple-500/30 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
          >
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
        </div>
      </div>

      {/* Deployment Status Card */}
      {runtime && (
        <Card className="border-white/10 bg-gradient-to-r from-slate-900/40 to-slate-800/20 backdrop-blur-sm overflow-hidden">
          <CardContent className="p-6 space-y-4">
            {/* Status Row */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-3 w-3 rounded-full",
                    isRunning && isHealthy
                      ? "bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                      : isRunning
                        ? "bg-amber-400 animate-pulse shadow-[0_0_12px_rgba(251,191,36,0.4)]"
                        : "bg-red-400 shadow-[0_0_12px_rgba(239,68,68,0.3)]"
                  )}
                />
                <span className="text-sm font-semibold text-zinc-200">
                  {isRunning && isHealthy
                    ? "✓ Live & Healthy"
                    : isRunning
                      ? "⚠ Running"
                      : "✗ Offline"}
                </span>
              </div>

              {hasLiveUrl && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-8 gap-1.5 text-xs border-emerald-500/30 text-emerald-400 hover:text-emerald-300"
                  >
                    <a href={runtime.url || runtime.domain} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5" />
                      Visit Site
                    </a>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-zinc-200"
                    onClick={() => {
                      navigator.clipboard.writeText(runtime.url || runtime.domain || "")
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
              <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Status</div>
                <div className="text-sm font-semibold text-zinc-200">
                  {runtime?.status || (isRunning ? "Running" : "Offline")}
                </div>
              </div>
              <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Health</div>
                <div className="text-sm font-semibold text-zinc-200">
                  {runtime?.health_ok || runtime?.health === "healthy" ? "✓ Healthy" : runtime?.health || "—"}
                </div>
              </div>
              {runtime?.port && (
                <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Port</div>
                  <div className="text-sm font-semibold text-zinc-200">{runtime.port}</div>
                </div>
              )}
              {runtime?.lastDeployAt && (
                <div className="rounded-lg bg-white/5 p-3 border border-white/5">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Last Deploy</div>
                  <div className="text-sm font-semibold text-zinc-200 truncate">
                    {new Date(runtime.lastDeployAt).toLocaleDateString()}
                  </div>
                </div>
              )}
            </div>

            {/* Warning Banner */}
            {runtime?.warning && (
              <div className="flex items-start gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm text-amber-300/90">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="flex-1">{runtime.warning}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Error Banner */}
      {(deployError || runnerErrorDetails || hasDeployError) && (
        <Card className="border-red-500/30 bg-red-500/[0.05] backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-5 w-5 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-red-300 mb-2">Deployment Error</p>
                <pre className="text-xs whitespace-pre-wrap break-words rounded-lg bg-black/40 border border-red-500/20 p-3 text-red-200/70 max-h-32 overflow-y-auto font-mono">
                  {deployError || runnerErrorDetails || "Deployment failed. Check runner logs for details."}
                </pre>
                {onFetchLogs && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onFetchLogs}
                    className="mt-3 h-7 text-xs gap-1.5 border-red-500/30 text-red-300 hover:text-red-200 hover:bg-red-500/10"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh Logs
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {pages.length === 0 ? (
        <Card className="border-dashed border-zinc-700/50 bg-gradient-to-br from-slate-900/50 to-slate-800/30">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="rounded-full bg-gradient-to-br from-slate-700/50 to-slate-800/50 p-4 mb-4 border border-slate-700/50">
              <FileText className="h-8 w-8 text-slate-500" />
            </div>
            <h3 className="text-lg font-semibold text-zinc-200 mb-1.5">No pages yet</h3>
            <p className="text-sm text-zinc-400 mb-6 max-w-sm">
              Generate a website with AI to get started. Your pages will appear here and be ready to deploy.
            </p>
            <Button onClick={onGoToAI} className="gap-2 bg-purple-600 hover:bg-purple-700">
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* File Explorer */}
          <Card className="lg:col-span-1 border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-800/40 backdrop-blur-sm overflow-hidden flex flex-col">
            <CardHeader className="pb-3 pt-4 px-4 border-b border-white/5">
              <CardTitle className="text-sm flex items-center gap-2">
                <Folder className="h-4 w-4 text-blue-400" />
                Files ({pages.length})
              </CardTitle>
              <CardDescription className="text-[11px] text-zinc-500">Click to preview</CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {tree.map((node, i) => (
                  <FileTreeItem
                    key={`${node.path}-${i}`}
                    node={node}
                    onSelectFile={handleSelectFile}
                    selectedPage={selectedPage}
                    onDeleteFile={onDeletePage}
                    expandedFolders={expandedFolders}
                    toggleFolder={toggleFolder}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Code Preview */}
          <Card className="lg:col-span-2 border-white/10 bg-gradient-to-b from-slate-900/60 to-slate-800/40 backdrop-blur-sm overflow-hidden flex flex-col">
            <CardHeader className="pb-3 pt-4 px-4 flex-shrink-0 border-b border-white/5">
              {activeFileTab ? (
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-sm font-semibold truncate text-zinc-200">{activeFileTab.name}</span>
                    {activeFileTab.usedFor && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                        {activeFileTab.usedFor}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-zinc-500 tabular-nums">
                      {activeFileTab.code.length.toLocaleString()} bytes
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                      onClick={handleCopyCode}
                    >
                      {copiedCode ? (
                        <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-zinc-400 hover:text-red-400 hover:bg-red-500/10"
                      onClick={() => onDeletePage(activeFileTab.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-zinc-500">
                  <Terminal className="h-4 w-4" />
                  <span className="text-sm">Select a file to preview</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col min-h-0">
              {activeFileTab ? (
                <div className="flex-1 overflow-auto bg-black/40 border-t border-white/5 flex">
                  <div className="select-none text-[10px] text-zinc-600 font-mono leading-6 py-3 text-right pr-3 pl-2 bg-black/20 border-r border-white/5 shrink-0">
                    {activeFileTab.code.split("\n").map((_, i) => (
                      <div key={i}>{i + 1}</div>
                    ))}
                  </div>
                  <pre className="flex-1 p-4 text-[12px] font-mono leading-6 text-zinc-300 overflow-auto custom-scrollbar whitespace-pre">
                    <code>{activeFileTab.code}</code>
                  </pre>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-black/20 border-t border-white/5 min-h-[300px]">
                  <div className="text-center">
                    <Terminal className="h-12 w-12 text-zinc-700 mx-auto mb-3 opacity-50" />
                    <p className="text-sm text-zinc-500">Select a file from the explorer to view code</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
