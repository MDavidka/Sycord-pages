"use client"

import React, { useState, useRef, useEffect } from "react"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import {
  Loader2,
  Bot,
  Check,
  ChevronDown,
  Sparkles,
  FileCode,
  ArrowRight,
  Rocket,
  Brain,
  Hammer,
  Wrench,
  CheckCircle2,
  Folder,
  FolderOpen,
  ChevronRight,
  Code,
  Bug,
  Layout,
  Paperclip,
  Send,
  Info,
  Circle,
  Zap,
  Cloud,
  Globe,
  Database,
  ThumbsUp,
  ThumbsDown,
  Flag,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

// Model type for the chooser
interface ModelOption {
  id: string
  name: string
  provider: string
  fast?: boolean
}

// Default model is the OpenRouter Qwen3 Coder (free)
const DEFAULT_MODEL_ID = "qwen/qwen3-coder:free"

const MODELS: ModelOption[] = [
  { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro (Preview)", provider: "Google" },
  { id: "gemini-3.1-flash-lite-preview", name: "Gemini 3.1 Flash Lite ⚡", provider: "Google", fast: true },
  { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash", provider: "Google" },
  { id: "gemini-1.5-pro", name: "Gemini 1.5 Pro", provider: "Google" },
  { id: "deepseek-v3.2-exp", name: "DeepSeek V3", provider: "DeepSeek" },
  { id: "qwen/qwen3-coder:free", name: "Coder model", provider: "OpenRouter" },
  { id: "liquid/lfm-2.5-1.2b-thinking:free", name: "Thinking model", provider: "OpenRouter" },
]

// Log-analysis constants — keep in sync with dashboard page fetchLogs
const LOG_SUCCESS_PATTERNS = ['take a peek over at', 'deployment complete', 'pages.dev']
const LOG_ERROR_PATTERNS   = ['error', 'fail', 'exception']

// How long to wait after deploy before the first log check (build pipeline startup time)
const DEPLOY_LOG_CHECK_DELAY_MS = 8000

type GenerationPhase =
  | "idle"
  | "planning"       // Step 1: Plan
  | "searching"      // Step 2: Web Search
  | "clarifying"     // Step 3: Optional Questions
  | "structuring"    // Step 4: Structure / sitemap
  | "integrating"    // Step 5: Integration check
  | "building"       // Step 6: Content & Build
  | "deploying"      // Step 7: Review & Deploy
  | "done"
  | "fixing"         // Auto-fix compatibility

interface Message {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  code?: string
  plan?: string
  pageName?: string
  isIntermediate?: boolean
  isErrorLog?: boolean
}

export interface GeneratedPage {
  name: string
  code: string
  timestamp: number
  usedFor?: string
}

// --- FILE TREE COMPONENT (VISUALIZATION) ---
interface FileNode {
  name: string
  path: string
  type: 'file' | 'folder'
  children?: FileNode[]
  status: 'pending' | 'generating' | 'done'
}

const FileTreeVisualizer = ({ pages, currentFile }: { pages: GeneratedPage[], currentFile?: string }) => {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ 'root': true, 'src': true })

  // Build tree from pages
  const buildTree = () => {
    const root: FileNode[] = []
    const addNode = (path: string, status: 'done' | 'generating') => {
      const parts = path.split('/')
      let current = root
      let currentPath = ''

      parts.forEach((part, i) => {
        currentPath = currentPath ? `${currentPath}/${part}` : part
        const isFile = i === parts.length - 1
        let node = current.find(n => n.name === part)

        if (!node) {
          node = {
            name: part,
            path: currentPath,
            type: isFile ? 'file' : 'folder',
            children: isFile ? undefined : [],
            status: isFile ? status : 'done'
          }
          current.push(node)
        } else if (isFile && status === 'generating') {
           node.status = 'generating'
        }

        if (!isFile && node.children) {
          current = node.children
        }
      })
    }

    pages.forEach(p => addNode(p.name, 'done'))
    if (currentFile) addNode(currentFile, 'generating')

    const sortNodes = (nodes: FileNode[]) => {
        nodes.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
            return a.name.localeCompare(b.name)
        })
        nodes.forEach(n => { if(n.children) sortNodes(n.children) })
    }
    sortNodes(root)
    return root
  }

  const tree = buildTree()

  const renderNode = (node: FileNode, depth: number) => {
    const isExp = expanded[node.path] ?? true
    const Icon = node.type === 'folder' ? (isExp ? FolderOpen : Folder) : FileCode
    const isGenerating = node.status === 'generating'

    return (
      <div key={node.path}>
        <div
          className={cn(
            "flex items-center gap-2 py-1.5 px-2 text-xs rounded-md hover:bg-white/5 cursor-pointer select-none transition-colors",
            isGenerating && "bg-white/5 animate-pulse",
            node.status === 'done' && node.type === 'file' && "text-zinc-400"
          )}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => {
              if (node.type === 'folder') {
                  setExpanded(p => ({...p, [node.path]: !isExp}))
              }
          }}
        >
          {node.type === 'folder' && (
              <ChevronRight className={cn("h-3 w-3 transition-transform text-zinc-500", isExp && "rotate-90")} />
          )}
          {node.type === 'file' && <span className="w-3" />}

          <Icon className={cn(
              "h-3.5 w-3.5",
              node.type === 'folder' ? "text-zinc-500" : "text-zinc-400",
              isGenerating && "text-white"
          )} />

          <span className={cn("truncate flex-1 font-mono", isGenerating ? "text-white" : "text-zinc-400")}>{node.name}</span>

          {isGenerating && <Loader2 className="h-3 w-3 animate-spin text-white" />}
        </div>
        {node.type === 'folder' && isExp && node.children && (
            <div>{node.children.map(c => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="font-mono bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-3 min-h-[200px] max-h-[400px] overflow-y-auto custom-scrollbar">
      <div className="text-[10px] text-zinc-500 mb-3 flex items-center gap-2 uppercase tracking-wider font-semibold px-2">
         <Folder className="h-3 w-3" /> Project Structure
      </div>
      {tree.length === 0 ? (
          <div className="text-center py-8 text-zinc-600 text-xs italic">
              Waiting for files...
          </div>
      ) : tree.map(n => renderNode(n, 0))}
    </div>
  )
}

// --- GENERATION STEP ICONS (matching the reference UI) ---
// Using lucide-react icons for a modern, clean look

/** Small inline step indicator — shows 1 step at a time with typing + slide-out animation */
const StepIndicator = ({ phase, progress, currentFile }: {
  phase: GenerationPhase
  progress: { percent: number; done: number; total: number }
  currentFile?: string
}) => {
  const [displayedPhase, setDisplayedPhase] = useState<string | null>(null)
  const [exiting, setExiting] = useState(false)
  const prevPhaseRef = useRef<string | null>(null)

  const phaseConfig: Record<string, { icon: React.ReactNode; label: string }> = {
    planning:    { icon: <Brain className="h-4 w-4" />,    label: "Thinking..." },
    searching:   { icon: <Globe className="h-4 w-4" />,    label: "Searching web..." },
    clarifying:  { icon: <Info className="h-4 w-4" />,     label: "Asking a question..." },
    structuring: { icon: <Layout className="h-4 w-4" />,   label: "Creating sitemap..." },
    integrating: { icon: <Database className="h-4 w-4" />, label: "Integrating services..." },
    building:    { icon: <Code className="h-4 w-4" />,     label: "Building..." },
    deploying:   { icon: <Rocket className="h-4 w-4" />,   label: "Deploying..." },
  }

  useEffect(() => {
    const displayable = ["planning", "searching", "clarifying", "structuring", "integrating", "building", "deploying"]
    if (!displayable.includes(phase)) {
      if (displayedPhase) {
        setExiting(true)
        const t = setTimeout(() => { setDisplayedPhase(null); setExiting(false) }, 350)
        return () => clearTimeout(t)
      }
      return
    }

    if (phase !== prevPhaseRef.current) {
      if (prevPhaseRef.current && displayedPhase) {
        // Slide old step out first
        setExiting(true)
        const t = setTimeout(() => {
          setExiting(false)
          setDisplayedPhase(phase)
          prevPhaseRef.current = phase
        }, 350)
        return () => clearTimeout(t)
      } else {
        setDisplayedPhase(phase)
        prevPhaseRef.current = phase
      }
    }
  }, [phase, displayedPhase])

  if (!displayedPhase) return null
  const config = phaseConfig[displayedPhase]
  if (!config) return null

  return (
    <div className="py-3">
      <div className={cn("flex items-center gap-2.5", exiting ? "step-exit" : "step-enter")}>
        <div className="h-7 w-7 rounded-lg bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-zinc-400 shrink-0">
          {config.icon}
        </div>
        <span className={cn("text-sm text-zinc-400", !exiting && "step-typewriter")}>{config.label}</span>
      </div>
      {displayedPhase === "building" && progress.total > 0 && !exiting && (
        <div className="ml-9 mt-2 space-y-1.5 max-w-xs step-enter">
          {currentFile && (
            <p className="text-xs text-zinc-500 font-mono truncate">{currentFile}</p>
          )}
          <div className="flex items-center justify-between text-[10px] text-zinc-600">
            <span>{progress.done}/{progress.total} files</span>
            <span>{progress.percent}%</span>
          </div>
          <div className="h-1 w-full bg-zinc-800/80 rounded-full overflow-hidden">
            <div className="h-full bg-zinc-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${progress.percent}%` }} />
          </div>
        </div>
      )}
    </div>
  )
}

// --- SITEMAP COMPONENT ---

interface SitemapNode {
  page: string
  path: string
  leadsTo?: string[]
  description?: string
}

const SitemapVisualizer = ({ nodes }: { nodes: SitemapNode[] }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 })

  if (!nodes || nodes.length === 0) return null

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true)
    setStartPos({ x: e.clientX, y: e.clientY })
    if (containerRef.current) {
      setScrollStart({ x: containerRef.current.scrollLeft, y: containerRef.current.scrollTop })
    }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !containerRef.current) return
    const dx = e.clientX - startPos.x
    const dy = e.clientY - startPos.y
    containerRef.current.scrollLeft = scrollStart.x - dx
    containerRef.current.scrollTop = scrollStart.y - dy
  }

  const handlePointerUp = () => {
    setIsDragging(false)
  }

  // Layout constants for the sitemap grid
  const TILE_WIDTH = 170
  const TILE_GAP = 32
  const CONTAINER_PADDING = 48
  const TILE_HEIGHT = 80
  const ROW_GAP = 24

  // Arrange nodes in a visual layout
  const cols = Math.min(nodes.length, 3)
  const rows = Math.ceil(nodes.length / cols)

  // SVG line calculation constants
  const COL_SPACING = TILE_WIDTH + TILE_GAP  // 202px per column
  const TILE_CENTER_X = Math.floor(TILE_WIDTH / 2) + 15  // horizontal center offset (85+24 padding)
  const TILE_CENTER_Y = Math.floor(TILE_HEIGHT / 2) + CONTAINER_PADDING / 2  // vertical center offset (40+24 padding)
  const ROW_SPACING = TILE_HEIGHT + ROW_GAP  // 104px per row

  return (
    <div className="mt-4 mb-2 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold mb-2 flex items-center gap-1.5 px-1">
        <Layout className="h-3 w-3" /> Sitemap
      </div>
      <div
        ref={containerRef}
        className={cn(
          "rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-white/[0.06] overflow-auto custom-scrollbar select-none",
          "max-h-[260px] sm:max-h-[320px]",
          isDragging ? "cursor-grabbing" : "cursor-grab"
        )}
        style={{ touchAction: 'none' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        <div
          className="relative p-4 sm:p-6"
          style={{
            minWidth: `${cols * TILE_WIDTH + (cols - 1) * TILE_GAP + CONTAINER_PADDING}px`,
            minHeight: `${rows * TILE_HEIGHT + (rows - 1) * ROW_GAP + CONTAINER_PADDING}px`,
          }}
        >
          {/* Connecting lines via SVG */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
            {nodes.map((node, i) => {
              if (i === 0) return null
              const prevCol = (i - 1) % cols
              const prevRow = Math.floor((i - 1) / cols)
              const curCol = i % cols
              const curRow = Math.floor(i / cols)
              const x1 = prevCol * COL_SPACING + TILE_CENTER_X
              const y1 = prevRow * ROW_SPACING + TILE_CENTER_Y
              const x2 = curCol * COL_SPACING + TILE_CENTER_X
              const y2 = curRow * ROW_SPACING + TILE_CENTER_Y
              return (
                <line
                  key={`line-${i}`}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              )
            })}
          </svg>

          {/* Node tiles */}
          <div
            className="relative grid gap-4 sm:gap-6"
            style={{
              gridTemplateColumns: `repeat(${cols}, 1fr)`,
              zIndex: 1,
            }}
          >
            {nodes.map((node, i) => (
              <div
                key={i}
                className="group flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.07] hover:border-white/[0.1] transition-all min-w-[140px]"
              >
                <div className="h-8 w-8 rounded-lg bg-white/[0.06] border border-white/[0.06] flex items-center justify-center group-hover:bg-white/[0.08] transition-colors">
                  <Globe className="h-3.5 w-3.5 text-zinc-400" />
                </div>
                <p className="text-[11px] font-medium text-zinc-300 text-center truncate w-full">{node.page}</p>
                <p className="text-[9px] text-zinc-600 text-center truncate w-full">{node.path}</p>
                {node.leadsTo && node.leadsTo.length > 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <ArrowRight className="h-2.5 w-2.5 text-zinc-600" />
                    <span className="text-[8px] text-zinc-600 truncate max-w-[80px]">{node.leadsTo.join(", ")}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// --- ENV VAR / INTEGRATION COMPONENTS ---

interface EnvVar {
  key: string
  value: string
  integration?: string | null
}

const INTEGRATION_OPTIONS = [
  {
    id: "mongodb",
    name: "MongoDB",
    envKey: "MONGODB_URI",
    placeholder: "mongodb+srv://user:pass@cluster.mongodb.net/db",
    logo: "https://www.mongodb.com/assets/images/global/favicon.ico",
    color: "#00684A",
    description: "NoSQL document database",
  },
  {
    id: "supabase",
    name: "Supabase",
    envKey: "SUPABASE_URL",
    placeholder: "https://abc.supabase.co",
    logo: "https://supabase.com/favicon/favicon-32x32.png",
    color: "#3ECF8E",
    description: "Open source Firebase alternative",
  },
  {
    id: "stripe",
    name: "Stripe",
    envKey: "STRIPE_SECRET_KEY",
    placeholder: "sk_live_...",
    logo: "https://stripe.com/favicon.ico",
    color: "#635BFF",
    description: "Payment processing",
  },
  {
    id: "firebase",
    name: "Firebase",
    envKey: "FIREBASE_API_KEY",
    placeholder: "AIzaSy...",
    logo: "https://www.gstatic.com/devrel-devsite/prod/v0e0f589edd85502a40d78d7d0825db8ea5ef3b99ab4070381ee86977c9168730/firebase/images/favicon.png",
    color: "#FFCA28",
    description: "Google cloud platform for apps",
  },
]

const GeminiIcon = ({ className }: { className?: string }) => (
    <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <path
            d="M12 2C13.5 6.5 17.5 10.5 22 12C17.5 13.5 13.5 17.5 12 22C10.5 17.5 6.5 13.5 2 12C6.5 10.5 10.5 6.5 12 2Z"
            fill="url(#gemini-gradient)"
        />
        <defs>
            <linearGradient id="gemini-gradient" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4facfe" />
                <stop offset="50%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#4facfe" />
            </linearGradient>
        </defs>
    </svg>
)

const GeminiBadge = () => (
    <div className="absolute top-0 left-0 right-0 flex items-center justify-center animate-in fade-in zoom-in duration-700 delay-100 z-50 pt-6">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 shadow-sm transition-all hover:bg-zinc-800/80 cursor-default">
            <GeminiIcon className="h-4 w-4" />
            <span className="text-xs font-medium text-zinc-300">State of the Art</span>
            <Info className="h-3 w-3 text-zinc-600 ml-1" />
        </div>
    </div>
)

const InputBar = ({
  input, setInput, onSend, disabled,
  selectedModel, setSelectedModel,
}: {
  input: string; setInput: (v: string) => void; onSend: () => void; disabled: boolean
  selectedModel: ModelOption; setSelectedModel: (m: ModelOption) => void
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (taRef.current) {
      taRef.current.style.height = "auto"
      taRef.current.style.height = Math.min(taRef.current.scrollHeight, 200) + "px"
    }
  }, [input])

  return (
    <div className="w-full max-w-2xl mx-auto px-3 sm:px-4 pb-4 sm:pb-6 md:pb-10 z-50 fixed bottom-0 left-0 right-0 md:static">
      <div className={cn(
        "rounded-[1.25rem] sm:rounded-[1.5rem] p-2.5 sm:p-3 relative transition-all duration-300 frosted-input flex flex-col gap-1.5",
        disabled ? "opacity-70 pointer-events-none" : ""
      )}>
        {/* Multiline textarea */}
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend() } }}
          placeholder="Describe the website you want"
          rows={1}
          className="w-full border-none bg-transparent resize-none text-[15px] sm:text-base text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-0 px-2 pt-1 min-h-[40px] max-h-[200px]"
          disabled={disabled}
          autoFocus={!disabled}
        />

        {/* Bottom row: + button | model pill | send */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-9 sm:w-9 rounded-full text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all shrink-0" disabled={disabled}>
              <span className="text-base sm:text-lg leading-none">+</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 sm:h-8 rounded-full text-[10px] sm:text-[11px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 px-2.5 sm:px-3 gap-1 sm:gap-1.5 border border-white/[0.06]">
                  {selectedModel.fast ? <Zap className="h-3 w-3 text-yellow-500" /> : <Sparkles className="h-3 w-3 text-zinc-600" />}
                  <span className="max-w-[80px] sm:max-w-none truncate">{selectedModel.name}</span>
                  <ChevronDown className="h-3 w-3 ml-0.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="bg-[#1c1c1c] border-white/10 min-w-[220px]">
                {MODELS.map(m => (
                  <DropdownMenuItem
                    key={m.id}
                    onClick={() => setSelectedModel(m)}
                    className={cn("text-xs", selectedModel.id === m.id ? "text-white bg-white/10" : "text-zinc-400")}
                  >
                    <span className="flex items-center gap-2">
                      {m.fast ? <Zap className="h-3 w-3 text-yellow-500" /> : <Sparkles className="h-3 w-3 text-zinc-600" />}
                      {m.name}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Button
            size="icon"
            className={cn(
              "h-9 w-9 sm:h-10 sm:w-10 rounded-xl transition-all active:scale-95 shrink-0 flex items-center justify-center shadow-none",
              input.trim() && !disabled ? "bg-zinc-700 text-white hover:bg-zinc-600" : "bg-zinc-800/50 text-zinc-700 hover:bg-zinc-800/50"
            )}
            onClick={onSend}
            disabled={!input.trim() || disabled}
          >
            {disabled ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin text-zinc-700" /> : <Send className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ThinkingCard, ProgressCard, SavingCard replaced by StepIndicator above


const WebsitePreviewCardSkeleton = () => {
    return (
        <div className="w-full aspect-video rounded-2xl bg-[#1c1c1c] border border-white/5 shadow-2xl overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-700 backdrop-blur-xl flex flex-col items-center justify-center">
            {/* Browser Header */}
            <div className="w-full h-8 bg-[#2c2c2e] border-b border-white/5 flex items-center px-4 gap-1.5 shrink-0 absolute top-0 left-0 right-0">
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/50" />
                <div className="w-2.5 h-2.5 rounded-full bg-zinc-600/50" />
            </div>
            {/* Inner rounded rectangle similar to the image */}
            <div className="w-[85%] h-[65%] mt-8 rounded-xl bg-[#2a2a2a] border border-white/5 flex items-center justify-center relative overflow-hidden">
            </div>
        </div>
    )
}

const HexagonIcon = ({ className }: { className?: string }) => (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
        <path d="M12 2L20.6603 7V17L12 22L3.33975 17V7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="12" cy="12" r="4" fill="currentColor"/>
    </svg>
)

const MongoDBConnectionCard = ({
    projectId,
    onConnect,
}: {
    projectId: string
    onConnect: () => void
}) => {
    const [isConnecting, setIsConnecting] = useState(false)
    const [connectError, setConnectError] = useState<string | null>(null)
    const [endpoint, setEndpoint] = useState("")
    const [dataSource, setDataSource] = useState("")
    const [databaseName, setDatabaseName] = useState("")
    const [apiKey, setApiKey] = useState("")

    const handleConnect = async () => {
        if (!endpoint.trim() || !dataSource.trim() || !databaseName.trim() || !apiKey.trim()) {
            setConnectError("All fields are required for MongoDB Atlas Data API")
            return
        }
        setIsConnecting(true)
        setConnectError(null)
        try {
            const res = await fetch(`/api/projects/${projectId}/database`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    mongoEndpoint: endpoint.trim(),
                    mongoDataSource: dataSource.trim(),
                    mongoDatabase: databaseName.trim(),
                    mongoApiKey: apiKey.trim(),
                }),
            })

            if (!res.ok) {
                const data = await res.json()
                throw new Error(data.message || "Failed to save MongoDB connection")
            }

            onConnect()
        } catch (err: unknown) {
            const error = err as { message?: string }
            setConnectError(error?.message || "Connection failed. Please try again.")
        } finally {
            setIsConnecting(false)
        }
    }

    return (
        <div className="flex flex-col items-center justify-center py-6 gap-5 animate-in fade-in slide-in-from-bottom-2 duration-700">
            <div className="flex items-center gap-3 mb-2">
                <Database className="h-5 w-5 text-[#13AA52]" />
                <h3 className="text-base font-medium text-zinc-100">Connect to MongoDB Atlas</h3>
            </div>
            <p className="text-xs text-zinc-500 text-center max-w-xs -mt-2">
                This project needs a backend to store data. Connect your MongoDB Atlas Data API to enable database functionality.
            </p>

            <div className="flex flex-col gap-3 p-4 rounded-2xl bg-[#1c1c1c] border border-white/5 w-full max-w-sm">
                <div className="flex items-center gap-3 mb-1">
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="24" height="24" rx="4" fill="#13AA52"/>
                        <path d="M12 4c-4.418 0-8 3.582-8 8s3.582 8 8 8 8-3.582 8-8-3.582-8-8-8zm-1.5 12h-2v-4h2v4zm4 0h-2V8h2v8z" fill="white"/>
                    </svg>
                    <span className="font-semibold text-white">MongoDB Atlas</span>
                </div>

                <input
                    type="text"
                    placeholder="Data API Endpoint"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
                <input
                    type="text"
                    placeholder="Data Source (e.g. Cluster0)"
                    value={dataSource}
                    onChange={(e) => setDataSource(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
                <input
                    type="text"
                    placeholder="Database Name (e.g. myapp_db)"
                    value={databaseName}
                    onChange={(e) => setDatabaseName(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                />
                <input
                    type="password"
                    placeholder="Data API Key"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="w-full h-9 rounded-lg border border-white/10 bg-white/5 px-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-white/20"
                />

                <Button
                    onClick={handleConnect}
                    disabled={isConnecting || !endpoint.trim() || !dataSource.trim() || !databaseName.trim() || !apiKey.trim()}
                    className="w-full bg-[#13AA52] text-white hover:bg-[#0f8c42] rounded-full px-6 py-2 h-9 font-medium border-none mt-1"
                >
                    {isConnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect"}
                </Button>
            </div>

            {connectError && (
                <p className="text-xs text-red-400 text-center max-w-xs">{connectError}</p>
            )}

            <p className="text-[10px] text-zinc-600 text-center max-w-xs">
                Learn more at{" "}
                <a href="https://database.io/docs" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-400">
                    database.io/docs
                </a>
            </p>
        </div>
    )
}

interface AIWebsiteBuilderProps {
  projectId: string
  generatedPages: GeneratedPage[]
  setGeneratedPages: React.Dispatch<React.SetStateAction<GeneratedPage[]>>
  autoFixLogs?: string[] | null
}

const AIWebsiteBuilder = ({ projectId, generatedPages, setGeneratedPages, autoFixLogs }: AIWebsiteBuilderProps) => {
  const { data: session } = useSession()
  const userName = session?.user?.name?.split(' ')[0] || "there"

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [step, setStep] = useState<GenerationPhase>("idle")
  const [currentPlan, setCurrentPlan] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [messagesLoaded, setMessagesLoaded] = useState(false)

  const [activeFile, setActiveFile] = useState<string | undefined>(undefined)
  const [activeFileUsedFor, setActiveFileUsedFor] = useState<string | undefined>(undefined)

  const [isDeploying, setIsDeploying] = useState(false)
  const [deploySuccess, setDeploySuccess] = useState(false)
  const [deployResult, setDeployResult] = useState<{ url?: string; githubUrl?: string } | null>(null)

  const [instruction, setInstruction] = useState<string>("")
  const [selectedModel, setSelectedModel] = useState<ModelOption>(MODELS.find(m => m.id === DEFAULT_MODEL_ID) || MODELS[0])

  const [fixHistory, setFixHistory] = useState<any[]>([])

  // Sitemap — parsed from the generation plan
  const [sitemap, setSitemap] = useState<SitemapNode[]>([])

  // Per-message feedback: 'like' | 'dislike' | 'report' | null
  const [messageFeedback, setMessageFeedback] = useState<Record<string, 'like' | 'dislike' | 'report' | null>>({})

  // Whether auto-deploy has been triggered for this generation
  const [autoDeployTriggered, setAutoDeployTriggered] = useState(false)

  // Load saved messages on mount
  useEffect(() => {
    if (!projectId || messagesLoaded) return
    fetch(`/api/ai/messages?projectId=${projectId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data.messages) && data.messages.length > 0) {
          const restored: Message[] = data.messages.map((m: any) => ({
            id: m.id || Date.now().toString(),
            role: m.role as "user" | "assistant" | "system",
            content: m.content || "",
            pageName: m.pageName,
          }))
          setMessages(restored)
          // Show chat state if there are messages
          if (restored.length > 0) setStep("done")
        }
        setMessagesLoaded(true)
      })
      .catch(() => setMessagesLoaded(true))
  }, [projectId, messagesLoaded])

  // Save messages when they change (debounced)
  useEffect(() => {
    if (!messagesLoaded || messages.length === 0 || !projectId) return
    const timer = setTimeout(() => {
      fetch("/api/ai/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: messages.slice(-50).map(m => ({
            id: m.id,
            role: m.role,
            content: m.content,
            pageName: m.pageName,
            timestamp: new Date().toISOString(),
          })),
        }),
      }).catch(() => {})
    }, 2000)
    return () => clearTimeout(timer)
  }, [messages, messagesLoaded, projectId])

  // Save messages immediately on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (messages.length === 0 || !projectId) return
      const payload = JSON.stringify({
        projectId,
        messages: messages.slice(-50).map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          pageName: m.pageName,
          timestamp: new Date().toISOString(),
        })),
      })
      navigator.sendBeacon("/api/ai/messages", new Blob([payload], { type: "application/json" }))
    }
    window.addEventListener("beforeunload", handleBeforeUnload)
    return () => window.removeEventListener("beforeunload", handleBeforeUnload)
  }, [messages, projectId])

  /** Parse sitemap nodes from the plan instruction text */
  const parseSitemap = (planText: string) => {
    const nodes: SitemapNode[] = []
    // Look for page structure section
    const pageSection = planText.match(/## 4\. Page Structure([\s\S]*?)(?:## 5|$)/i)
    if (pageSection) {
      const lines = pageSection[1].split('\n')
      for (const line of lines) {
        const match = line.match(/[-*]\s*\*\*([^*]+)\*\*\/?:?\s*(.*)/)
        if (match) {
          const pageName = match[1].replace(/\/$/, '').trim()
          const desc = match[2].trim()
          const path = '/' + pageName.toLowerCase().replace(/\s+/g, '-')
          // Extract navigation links mentioned in description
          const linkMatches = desc.match(/(?:link|lead|navigate|redirect|go)\s+to\s+([^.,]+)/gi) || []
          const leadsTo = linkMatches.map(l => l.replace(/.*to\s+/i, '').trim())
          nodes.push({ page: pageName, path, description: desc, leadsTo })
        }
      }
    }
    // Fallback: extract from [N] file markers that look like pages
    if (nodes.length === 0) {
      const fileMatches = planText.matchAll(/\[\d+\]\s*(src\/components\/[\w-]+\.ts)\s*:\s*\[usedfor\](.*?)\[usedfor\]/g)
      for (const m of fileMatches) {
        const name = m[1].replace('src/components/', '').replace('.ts', '')
        const desc = m[2]
        if (name !== 'header' && name !== 'footer') {
          nodes.push({ page: name.charAt(0).toUpperCase() + name.slice(1), path: '/' + name, description: desc })
        }
      }
    }
    setSitemap(nodes)
  }

  const giveFeedback = (msgId: string, kind: 'like' | 'dislike' | 'report') => {
    setMessageFeedback(prev => ({
      ...prev,
      [msgId]: prev[msgId] === kind ? null : kind,
    }))
  }


  // Compute file-level progress from instruction
  const getProgress = () => {
    if (!instruction) return { done: 0, total: 0, percent: 0 }
    const totalMatch = instruction.match(/\[\d+\]/g) || []
    const doneMatch = instruction.match(/\[Done\]/gi) || []
    const total = totalMatch.length + doneMatch.length
    const done = doneMatch.length
    const percent = total > 0 ? Math.round((done / total) * 100) : 0
    return { done, total, percent }
  }

  const progress = getProgress()

  // Ref for auto-scrolling to the bottom of the chat
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (step !== 'idle') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages.length, step])

  useEffect(() => {
    if (autoFixLogs && autoFixLogs.length > 0 && step === 'idle') {
      startAutoFixSession(autoFixLogs)
    }
  }, [autoFixLogs])

  const startAutoFixSession = async (logs: string[]) => {
    setStep("fixing")
    setCurrentPlan("Analyzing logs...")
    setFixHistory([])

    const logMessage: Message = {
      id: Date.now().toString(),
      role: "system",
      content: "Deployment failed. Starting automated diagnosis and repair session.",
      isErrorLog: true
    }

    const visibleLogs = logs.slice(-20).join('\n')
    const logsDisplayMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "user",
      content: `Logs:\n\`\`\`\n${visibleLogs}\n\`\`\``
    }

    setMessages(prev => [...prev, logMessage, logsDisplayMessage])

    await processAutoFix(logs, [], 0)
  }

  const processAutoFix = async (logs: string[], history: any[], iteration: number) => {
    if (iteration >= 15) {
       setStep("idle")
       setMessages(prev => [...prev, {
         id: Date.now().toString(),
         role: "system",
         content: "Auto-fix session stopped after maximum attempts. Please review manually."
       }])
       return
    }

    try {
       const fileStructure = generatedPages.map(p => p.name).join('\n')
       let fileContent = null
       let lastAction = null

       if (history.length > 0) {
         const lastItem = history[history.length - 1]
         lastAction = lastItem.action === 'read' ? 'take a look' : null
         if (lastItem.action === 'read' && lastItem.result && lastItem.result.code) {
           fileContent = {
             filename: lastItem.target,
             code: lastItem.result.code
           }
         }
       }

       const fixedFiles = history
          .filter(h => h.action === 'write' || h.action === 'fix')
          .map(h => h.target)
          .filter((v, i, a) => a.indexOf(v) === i)

       const response = await fetch('/api/ai/auto-fix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            logs,
            fileStructure,
            fileContent,
            lastAction,
            history: history.map(h => ({
                action: h.action,
                target: h.target,
                result: h.action === 'read' ? 'read_success' : (h.result.status || 'done'),
                summary: h.summary
            })),
            fixedFiles
          })
       })

       if (!response.ok) throw new Error("AI Fix request failed")
       const result = await response.json()

       if (result.explanation) {
         setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: result.explanation
         }])
       }

       if (result.action === 'done') {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: "I have fixed the issues. Deploying automatically..."
          }])
          // Auto-deploy after fix
          setStep("deploying")
          try {
            const res = await fetch("/api/deploy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId })
            })
            const deployData = await res.json()
            if (deployData.success) {
              setDeploySuccess(true)
              setDeployResult(deployData)
              if (deployData.repoId) {
                setTimeout(() => checkDeployLogs(deployData.repoId), DEPLOY_LOG_CHECK_DELAY_MS)
              }
            }
          } catch { /* deploy error is non-blocking */ }
          setStep("done")
          return
       }

       let actionResult: any = { status: 'success' }
       let actionSummary = ""

       // Helper function to handle file updates
       const updateFile = async (name: string, code: string, usedFor: string) => {
            setGeneratedPages(prev => {
                const exists = prev.find(p => p.name === name)
                if (exists) {
                    return prev.map(p => p.name === name ? { ...p, code, timestamp: Date.now() } : p)
                } else {
                    return [...prev, { name, code, timestamp: Date.now(), usedFor }]
                }
            })
            await fetch(`/api/projects/${projectId}/pages`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, content: code, usedFor })
            })
       }

       if (result.action === 'read') {
          setCurrentPlan(`Reading ${result.targetFile}...`)
          const page = generatedPages.find(p => p.name === result.targetFile)
          if (page) {
             actionResult = { status: 'success', code: page.code }
             actionSummary = `Read ${result.targetFile} (${page.code.length} bytes)`
          } else {
             actionResult = { status: 'error', message: 'File not found' }
             actionSummary = `Failed to read ${result.targetFile}`
             setMessages(prev => [...prev, {
               id: Date.now().toString(),
               role: "system",
               content: `Could not find file: ${result.targetFile}`
             }])
          }
       }
       else if (result.action === 'move') {
          setCurrentPlan(`Moving ${result.targetFile}...`)
          const page = generatedPages.find(p => p.name === result.targetFile)
          if (page) {
             const newName = result.newPath
             await updateFile(newName, page.code, page.usedFor || '')
             await fetch(`/api/projects/${projectId}/pages?name=${encodeURIComponent(result.targetFile)}`, { method: "DELETE" })
             setGeneratedPages(prev => prev.filter(p => p.name !== result.targetFile))

             setMessages(prev => [...prev, {
               id: Date.now().toString(),
               role: "assistant",
               content: `Moved ${result.targetFile} to ${result.newPath}`
             }])
             actionSummary = `Moved ${result.targetFile} to ${result.newPath}`
          } else {
             actionResult = { status: 'error', message: 'File not found' }
          }
       }
       else if (result.action === 'delete') {
          setCurrentPlan(`Deleting ${result.targetFile}...`)
          setGeneratedPages(prev => prev.filter(p => p.name !== result.targetFile))
          await fetch(`/api/projects/${projectId}/pages?name=${encodeURIComponent(result.targetFile)}`, { method: "DELETE" })
          setMessages(prev => [...prev, {
             id: Date.now().toString(),
             role: "assistant",
             content: `Deleted ${result.targetFile}`
          }])
          actionSummary = `Deleted ${result.targetFile}`
       }
       else if (result.action === 'write') {
          setCurrentPlan(`Fixing ${result.targetFile}...`)
          await updateFile(result.targetFile, result.code, 'Auto-fix')

          setMessages(prev => [...prev, {
             id: Date.now().toString(),
             role: "assistant",
             content: `Updated ${result.targetFile}`,
             code: result.code,
             pageName: result.targetFile
          }])
          actionSummary = `Wrote to ${result.targetFile} (Length: ${result.code.length})`
       }

       const newHistory = [...history, {
          action: result.action,
          target: result.targetFile,
          result: actionResult,
          summary: actionSummary
       }]

       setFixHistory(newHistory)
       await processAutoFix(logs, newHistory, iteration + 1)

    } catch (e: any) {
       console.error("Auto fix loop error", e)
       setError(e.message)
       setStep("idle")
    }
  }

  /** Small delay helper for smooth phase transitions */
  const phaseDelay = (ms = 500) => new Promise<void>(r => setTimeout(r, ms))

  const startGeneration = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages(prev => [...prev, userMessage])
    setError(null)
    setAutoDeployTriggered(false)
    setSitemap([])

    // ── Phase 1: Planning ──
    setStep("planning")
    setCurrentPlan("Architecting solution...")

    try {
      const planResponse = await fetch("/api/ai/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
      })

      if (!planResponse.ok) throw new Error("Failed to generate plan")
      const planData = await planResponse.json()
      const generatedInstruction = planData.instruction

      await phaseDelay()

      // ── Phase 2: Searching ──
      setStep("searching")
      try {
        await fetch("/api/ai/web-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: input.trim(), type: "general" }),
        })
      } catch { /* non-critical */ }

      await phaseDelay()

      // ── Phase 3: Clarifying ──
      const questionMatch = generatedInstruction.match(/\[QUESTION\]\s*(.*)/i)
      if (questionMatch) {
        setStep("clarifying")
        const questionText = questionMatch[1].trim()
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: questionText,
        }])
        setInput("")
        return
      }

      // ── Phase 4: Structuring ──
      setStep("structuring")
      parseSitemap(generatedInstruction)
      setInstruction(generatedInstruction)

      await phaseDelay()

      // ── Phase 5: Integrating ──
      setStep("integrating")
      await phaseDelay(800)

      const planMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: generatedInstruction,
        plan: "Architectural Strategy",
      }
      setMessages(prev => [...prev, planMessage])

      // ── Phase 6: Building (delegated to processNextStep) ──
      processNextStep(generatedInstruction, [...messages, userMessage, planMessage])
    } catch (err: any) {
      setError(err.message || "Planning failed")
      setStep("idle")
    }
  }

  const processNextStep = async (currentInstruction: string, currentHistory: Message[]) => {
    setStep("building")
    setCurrentPlan("Generating next file...")

    const nextFileMatch = /\[\d+\]\s*([^\s:]+)(?:[:\-]?\s*\[usedfor\](.*?)\[usedfor\])?/.exec(currentInstruction)
    if (nextFileMatch) {
      setActiveFile(nextFileMatch[1])
      setActiveFileUsedFor(nextFileMatch[2]?.trim() || undefined)
    }

    const modelId = selectedModel.id

    const attemptGenerate = async (model: string): Promise<any> => {
      const response = await fetch("/api/ai/generate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          messages: currentHistory,
          instruction: currentInstruction,
          model,
          generatedPages: generatedPages.map(p => ({ name: p.name, code: p.code })),
        }),
      })
      if (!response.ok) throw new Error("Generation failed")
      return response.json()
    }

    try {
      let data: any
      try {
        data = await attemptGenerate(modelId)
      } catch (primaryErr: any) {
        // OpenRouter model should NEVER fall back — show error
        if (selectedModel.provider === "OpenRouter") {
          console.error("[AI Builder] OpenRouter model error:", primaryErr)
          setError(`Failed to connect to OpenRouter model (${selectedModel.name}). The service may be temporarily unavailable. Please try again later.`)
          setStep("idle")
          setActiveFile(undefined)
          setActiveFileUsedFor(undefined)
          return
        }
        throw primaryErr
      }

      if (data.isComplete) {
        // ── Phase 7: Auto-Deploy ──
        setStep("deploying")
        setCurrentPlan("All files generated. Deploying...")
        setActiveFile(undefined)
        setActiveFileUsedFor(undefined)
        // Auto-deploy immediately
        if (!autoDeployTriggered) {
          setAutoDeployTriggered(true)
          try {
            const res = await fetch("/api/deploy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId })
            })
            const deployData = await res.json()
            if (deployData.success) {
              setDeploySuccess(true)
              setDeployResult(deployData)
              if (deployData.repoId) {
                setTimeout(() => checkDeployLogs(deployData.repoId), DEPLOY_LOG_CHECK_DELAY_MS)
              }
            }
          } catch { /* deploy error is non-blocking */ }
        }
        await new Promise(r => setTimeout(r, 800))
        setStep("done")
        return
      }

      const assistantMessage: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `Generated ${data.pageName}`,
        code: data.code,
        pageName: data.pageName,
        isIntermediate: true,
      }

      setMessages(prev => [...prev, assistantMessage])

      if (data.code && data.pageName) {
        setGeneratedPages(prev => {
          const filtered = prev.filter(p => p.name !== data.pageName)
          return [...filtered, {
            name: data.pageName,
            code: data.code,
            timestamp: Date.now(),
            usedFor: data.usedFor,
          }]
        })

        await fetch(`/api/projects/${projectId}/pages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: data.pageName,
            content: data.code,
            usedFor: data.usedFor || "",
          }),
        })
      }

      setInstruction(data.updatedInstruction)
      processNextStep(data.updatedInstruction, [...currentHistory, assistantMessage])

    } catch (err: any) {
      setError(err.message)
      setStep("idle")
      setActiveFile(undefined)
      setActiveFileUsedFor(undefined)
    }
  }

  const checkDeployLogs = async (repoId: string, attempt = 0) => {
    // Give up after ~40 seconds (8 attempts × 5 s)
    if (attempt >= 8) return

    try {
      const res = await fetch(`https://micro1.sycord.com/api/logs?project_id=${repoId}`)
      if (!res.ok) {
        setTimeout(() => checkDeployLogs(repoId, attempt + 1), 5000)
        return
      }
      const data = await res.json()
      if (!data.success || !Array.isArray(data.logs) || data.logs.length === 0) {
        setTimeout(() => checkDeployLogs(repoId, attempt + 1), 5000)
        return
      }

      const combinedLower = data.logs.join('\n').toLowerCase()

      const isSuccess = LOG_SUCCESS_PATTERNS.some(p => combinedLower.includes(p))
      if (isSuccess) return // Build was fine

      const hasError = data.logs.some((log: string) => {
        const logLower = log.toLowerCase()
        return LOG_ERROR_PATTERNS.some(p => logLower.includes(p))
      })

      if (hasError) {
        setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'assistant',
          content: 'I detected a build error in the deployment logs. Starting automatic repair…',
        }])
        startAutoFixSession(data.logs)
        return
      }

      // No conclusive result yet — keep polling
      setTimeout(() => checkDeployLogs(repoId, attempt + 1), 5000)
    } catch {
      setTimeout(() => checkDeployLogs(repoId, attempt + 1), 5000)
    }
  }

  const handleDeploy = async () => {
      setIsDeploying(true)
      try {
          const res = await fetch("/api/deploy", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId })
          })
          const data = await res.json()
          if(data.success) {
              setDeploySuccess(true)
              setDeployResult(data)
              // After deploy succeeds, wait for the build then check logs for errors
              if (data.repoId) {
                  setTimeout(() => checkDeployLogs(data.repoId), DEPLOY_LOG_CHECK_DELAY_MS)
              }
          } else {
              setError(data.error)
          }
      } catch(e: any) {
          setError(e.message)
      } finally {
          setIsDeploying(false)
      }
  }

  return (
    <div className="flex flex-col h-full bg-transparent text-zinc-100 font-sans relative">


        {/* Background Accents - idle only */}
        {step === 'idle' && (
            <>
                <div className="absolute top-1/4 left-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-1/4 right-1/4 w-64 sm:w-96 h-64 sm:h-96 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
            </>
        )}

        {/* Scrollable chat area */}
        <div
            className="flex-1 overflow-y-auto custom-scrollbar relative z-10 pb-28 sm:pb-32"
            style={{ WebkitOverflowScrolling: 'touch' }}
        >
            <div className="max-w-2xl mx-auto w-full px-3 sm:px-4 md:px-0 min-h-full flex flex-col">

                {/* IDLE STATE */}
                {step === 'idle' && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-16 sm:py-20 animate-in fade-in slide-in-from-bottom-8 duration-700 relative">
                        <GeminiBadge />
                        <div className="mt-4 space-y-1">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-white">
                                Hi {userName},
                            </h1>
                            <h2 className="text-3xl sm:text-4xl md:text-5xl font-medium tracking-tight text-zinc-500">
                                What are we building?
                            </h2>
                        </div>
                    </div>
                )}

                {/* CHAT / GENERATING STATE */}
                {step !== 'idle' && (
                    <div className="flex flex-col pt-6 sm:pt-8 pb-4">

                        {/* Messages — user messages in rounded pill */}
                        {messages
                            .filter(m => m.role === 'user' || (m.role === 'assistant' && !m.plan && !m.isIntermediate))
                            .map((msg, i) => (
                                <div
                                    key={msg.id || i}
                                    className={cn(
                                        "py-2 sm:py-2.5",
                                        msg.role === 'user' ? "flex justify-end" : "flex flex-col items-start"
                                    )}
                                >
                                    {msg.role === 'user' ? (
                                        <div className="bg-white/[0.08] rounded-[1.25rem] sm:rounded-[1.5rem] px-4 sm:px-5 py-2.5 sm:py-3 max-w-[88%] sm:max-w-[82%]">
                                            <p className="text-sm leading-relaxed text-zinc-200">{msg.content}</p>
                                        </div>
                                    ) : (
                                        <p className="text-sm leading-relaxed max-w-[88%] sm:max-w-[82%] text-zinc-400">{msg.content}</p>
                                    )}

                                    {msg.role === 'user' && (
                                        <p className="text-[10px] sm:text-[11px] text-zinc-600 mt-1.5 text-right w-full">
                                            {new Date(parseInt(msg.id) || Date.now()).toISOString().split('T')[0].replace(/-/g, '.')}
                                        </p>
                                    )}

                                    {msg.role === 'assistant' && (
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <button
                                                onClick={() => giveFeedback(msg.id, 'like')}
                                                title="Like"
                                                className={cn(
                                                    "transition-colors",
                                                    messageFeedback[msg.id] === 'like'
                                                        ? "text-zinc-200"
                                                        : "text-zinc-700 hover:text-zinc-400"
                                                )}
                                            >
                                                <ThumbsUp className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => giveFeedback(msg.id, 'dislike')}
                                                title="Dislike"
                                                className={cn(
                                                    "transition-colors",
                                                    messageFeedback[msg.id] === 'dislike'
                                                        ? "text-zinc-200"
                                                        : "text-zinc-700 hover:text-zinc-400"
                                                )}
                                            >
                                                <ThumbsDown className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                onClick={() => giveFeedback(msg.id, 'report')}
                                                title="Report problem"
                                                className={cn(
                                                    "transition-colors",
                                                    messageFeedback[msg.id] === 'report'
                                                        ? "text-red-400"
                                                        : "text-zinc-700 hover:text-zinc-400"
                                                )}
                                            >
                                                <Flag className="h-3.5 w-3.5" />
                                            </button>
                                            {messageFeedback[msg.id] === 'report' && (
                                                <span className="text-[11px] text-zinc-600">Reported</span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        }

                        {/* ── Small inline step indicator (1 at a time) ── */}
                        <StepIndicator phase={step} progress={progress} currentFile={activeFile} />

                        {/* Sitemap visualization (parsed from plan) */}
                        {sitemap.length > 0 && (step === 'building' || step === 'done') && (
                            <SitemapVisualizer nodes={sitemap} />
                        )}

                        {step === 'done' && (
                            <div className="py-3 mt-2 flex items-center gap-2.5 step-enter">
                                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                                <span className="text-sm text-zinc-300">
                                  {deploySuccess ? "Website deployed!" : "Website ready"}
                                </span>
                                {deployResult?.url && (
                                  <a href={deployResult.url} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-500 hover:text-zinc-300 underline underline-offset-2 ml-1 truncate max-w-[200px]">
                                    {deployResult.url.replace(/^https?:\/\//, '')}
                                  </a>
                                )}
                            </div>
                        )}

                        {/* Done Actions — no deploy button, just "Create Another" */}
                        {step === 'done' && (
                            <div className="mt-4 sm:mt-6 step-enter">
                                <Button
                                    size="lg"
                                    variant="outline"
                                    className="w-full sm:w-auto h-10 sm:h-12 text-sm font-medium bg-transparent border-zinc-800 text-zinc-400 hover:bg-zinc-800/50 hover:text-white rounded-xl px-8"
                                    onClick={() => {
                                        setStep('idle')
                                        setInput("")
                                        setMessages([])
                                        setAutoDeployTriggered(false)
                                    }}
                                >
                                    Create Another
                                </Button>
                            </div>
                        )}

                        {/* Error Display */}
                        {error && (
                            <div className="mt-4 flex items-start gap-2.5">
                                <Bug className="h-4 w-4 shrink-0 text-red-400 mt-0.5" />
                                <div>
                                    <p className="text-sm text-red-400">{error}</p>
                                    <button
                                        className="text-xs text-red-500/60 hover:text-red-400 mt-1 underline-offset-2 underline"
                                        onClick={() => setStep('idle')}
                                    >
                                        Reset
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Scroll anchor */}
                        <div ref={chatBottomRef} />
                    </div>
                )}
            </div>
        </div>

        {/* Input Bar — always at bottom */}
        <div className="w-full relative z-20">
            <InputBar
                input={input}
                setInput={setInput}
                onSend={startGeneration}
                disabled={step !== 'idle' && step !== 'clarifying'}
                selectedModel={selectedModel}
                setSelectedModel={setSelectedModel}
            />
        </div>
    </div>
  )
}

export default AIWebsiteBuilder
