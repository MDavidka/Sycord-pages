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
          "w-full flex items-center gap-1.5 py-1 px-2 text-[13px] rounded-md transition-all duration-150 group",
          isSelected
            ? "bg-primary/15 text-primary"
            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-200",
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {node.type === "folder" ? (
          <ChevronRight
            className={cn(
              "h-3 w-3 shrink-0 text-zinc-500 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        ) : (
          <span className="w-3 shrink-0" />
        )}
        <IconComp
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            node.type === "folder" ? "text-yellow-500" : "text-blue-400",
          )}
        />
        <span className="truncate flex-1 text-left">{node.name}</span>
        {node.type === "file" && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onDeleteFile(node.path)
            }}
            className="h-4 w-4 shrink-0 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-zinc-500 hover:text-red-400 flex items-center justify-center transition-all"
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

function FileExplorer({
  pages,
  onSelectFile,
  selectedPage,
  onDeleteFile,
}: {
  pages: GeneratedPage[]
  onSelectFile: (page: GeneratedPage) => void
  selectedPage: GeneratedPage | null
  onDeleteFile: (name: string) => void
}) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(() => {
    const folders = new Set<string>()
    for (const page of pages) {
      const parts = page.name.split("/")
      for (let i = 1; i < parts.length; i++) {
        folders.add(parts.slice(0, i).join("/"))
      }
    }
    return folders
  })

  const toggleFolder = (path: string) => {
    setExpandedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const tree = useMemo(() => buildFileTree(pages), [pages])

  return (
    <div className="py-1">
      {tree.map((node, i) => (
        <FileTreeItem
          key={`${node.path}-${i}`}
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

  const runtime = deployResult || deploymentRuntime
  const isRunning = runtime?.status === "running" || runtime?.running === true
  const isHealthy = runtime?.health === "healthy" || runtime?.health_ok === true
  const hasLiveUrl = Boolean(runtime?.url)

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Pages</h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {pages.length} file{pages.length !== 1 ? "s" : ""} · Next.js server deployment
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {pages.length > 0 && (
            <>
              <Button
                onClick={onDeploy}
                disabled={isDeploying}
                className="gap-2 font-medium shadow-lg shadow-emerald-500/20"
              >
                {isDeploying ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Deploy Changes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onDeleteAll}
                className="gap-2 border-zinc-700/50 text-zinc-400 hover:text-red-400 hover:border-red-500/30"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete All
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={onGoToAI} className="gap-2 border-zinc-700/50">
            <Sparkles className="h-3.5 w-3.5" />
            Generate
          </Button>
        </div>
      </div>

      {runtime && (
        <Card className="border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
          <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
            <div className="flex items-center gap-2.5">
              <div
                className={cn(
                  "h-2 w-2 rounded-full",
                  isRunning && isHealthy ? "bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.5)]" :
                  isRunning ? "bg-amber-400 animate-pulse" :
                  "bg-red-400",
                )}
              />
              <span className="text-sm font-medium text-zinc-200">
                {isRunning && isHealthy ? "Live" : isRunning ? "Running" : "Offline"}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
              <span className="flex items-center gap-1">
                <Activity className="h-3 w-3" />
                Build: {runtime?.build || (isRunning ? "ok" : "—")}
              </span>
              <span className="flex items-center gap-1">
                <Server className="h-3 w-3" />
                Server: {runtime?.status || runtime?.running ? "running" : "stopped"}
              </span>
              <span className="flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Health: {runtime?.health_ok || runtime?.health === "healthy" ? "healthy" : runtime?.health || "—"}
              </span>
              {runtime?.port && (
                <span className="flex items-center gap-1">
                  <Code className="h-3 w-3" />
                  Port: {runtime.port}
                </span>
              )}
            </div>

            {runtime?.lastDeployAt && (
              <span className="text-[11px] text-zinc-600 ml-auto whitespace-nowrap">
                <Clock className="h-3 w-3 inline mr-1" />
                {new Date(runtime.lastDeployAt).toLocaleString()}
              </span>
            )}

            {hasLiveUrl && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-7 gap-1.5 text-xs border-zinc-700/50"
                >
                  <a href={runtime.url || runtime.domain} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-3 w-3" />
                    Visit
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    navigator.clipboard.writeText(runtime.url || runtime.domain || "")
                  }}
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {runtime?.warning && (
            <div className="px-4 pb-3">
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/5 border border-amber-500/15 px-3 py-2 text-xs text-amber-300/90">
                <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                {runtime.warning}
              </div>
            </div>
          )}
        </Card>
      )}

      {(deployError || runnerErrorDetails || hasDeployError) && (
        <Card className="border-red-500/15 bg-red-500/[0.03] backdrop-blur-sm">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-red-300">
                  Deployment Error
                </p>
                <pre className="mt-2 text-xs whitespace-pre-wrap break-words rounded-lg bg-black/40 border border-red-500/15 p-3 text-red-200/80 max-h-48 overflow-y-auto font-mono">
                  {deployError || runnerErrorDetails || "Deployment failed. Check runner logs for details."}
                </pre>
                {onFetchLogs && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onFetchLogs}
                    className="mt-3 h-7 text-xs gap-1.5 border-red-500/20 text-red-300 hover:text-red-200"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh Runner Logs
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pages.length === 0 ? (
        <Card className="border-dashed border-zinc-700/50 bg-zinc-900/20">
          <CardContent className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="rounded-full bg-zinc-800/50 p-4 mb-4">
              <FileText className="h-8 w-8 text-zinc-600" />
            </div>
            <h3 className="text-lg font-medium text-zinc-300 mb-1.5">No pages yet</h3>
            <p className="text-sm text-zinc-500 mb-6 max-w-sm">
              Use the AI builder to generate a website, then deploy it directly from here.
            </p>
            <Button onClick={onGoToAI} className="gap-2">
              <Sparkles className="h-4 w-4" />
              Generate with AI
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-1 border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden">
            <CardHeader className="pb-2 pt-4 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <Folder className="h-4 w-4 text-yellow-500" />
                Project Files
              </CardTitle>
              <CardDescription className="text-[11px]">
                {pages.length} file{pages.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[420px] overflow-y-auto custom-scrollbar border-t border-white/5">
                <FileExplorer
                  pages={pages}
                  onSelectFile={handleSelectFile}
                  selectedPage={selectedPage}
                  onDeleteFile={onDeletePage}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2 border-white/5 bg-white/[0.02] backdrop-blur-sm overflow-hidden flex flex-col">
            <CardHeader className="pb-2 pt-4 px-4 flex-shrink-0">
              {activeFileTab ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileCode className="h-4 w-4 text-blue-400 shrink-0" />
                    <span className="text-sm font-medium truncate text-zinc-200">
                      {activeFileTab.name}
                    </span>
                    {activeFileTab.usedFor && (
                      <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                        {activeFileTab.usedFor}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-[10px] text-zinc-600 tabular-nums">
                      {activeFileTab.code.length.toLocaleString()} bytes
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[11px] text-zinc-500 hover:text-zinc-200"
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
                      className="h-6 w-6 p-0 text-zinc-500 hover:text-red-400"
                      onClick={() => onDeletePage(activeFileTab.name)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-zinc-600" />
                  <span className="text-sm text-zinc-500">Select a file to preview</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="p-0 flex-1 flex flex-col">
              {activeFileTab ? (
                <div className="flex-1 overflow-auto bg-black/30 border-t border-white/5">
                  <div className="flex">
                    <div className="select-none text-[10px] text-zinc-600 font-mono leading-6 py-3 text-right pr-3 pl-2 bg-black/20 border-r border-white/5 min-w-[44px]">
                      {activeFileTab.code.split("\n").map((_, i) => (
                        <div key={i}>{i + 1}</div>
                      ))}
                    </div>
                    <pre className="flex-1 p-3 text-[12px] font-mono leading-6 text-zinc-300 overflow-auto custom-scrollbar whitespace-pre">
                      <code>{activeFileTab.code}</code>
                    </pre>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center bg-black/20 border-t border-white/5 min-h-[420px]">
                  <div className="text-center">
                    <Terminal className="h-8 w-8 text-zinc-700 mx-auto mb-2" />
                    <p className="text-sm text-zinc-500">Select a file from the explorer to preview its contents</p>
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
