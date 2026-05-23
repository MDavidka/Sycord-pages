// Syra Deployment Registry — authoritative allowlist derived from the host project.
// Teaches the AI exactly what packages, components, icons, and configs are available.
// Generated code is validated against this registry to prevent deployment errors.

import fs from "fs"
import path from "path"

// ── Dependencies (from package.json) ─────────────────────────────

const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"))
const allDeps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) }

// Packages whose APIs may be imported in generated code
export const IMPORTABLE_PACKAGES = new Set([
  "next",
  "react",
  "react-dom",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "date-fns",
  "recharts",
  "react-hook-form",
  "@hookform/resolvers",
  "zod",
  "sonner",
  "next-themes",
  "embla-carousel-react",
  "react-day-picker",
  "react-resizable-panels",
  "cmdk",
  "input-otp",
  "vaul",
])

// Allowed import path prefixes — any import source must match one of these
export const ALLOWED_PATH_PREFIXES = [
  "next/navigation",
  "next/link",
  "next/image",
  "next/dynamic",
  "next/headers",
  "react",
  "@/components/ui/",
  "@/components/generated/",
  "@/lib/",
  "@/hooks/",
  "lucide-react",
  "clsx",
  "tailwind-merge",
  "class-variance-authority",
  "date-fns",
  "recharts",
  "react-hook-form",
  "@hookform/resolvers/zod",
  "zod",
  "sonner",
  "next-themes",
  "embla-carousel-react",
  "react-day-picker",
  "react-resizable-panels",
  "cmdk",
  "input-otp",
  "vaul",
]

// Packages allowed in generated package.json dependencies
export const ALLOWED_GENERATED_DEPS = new Set([
  "next",
  "react",
  "react-dom",
  "@radix-ui/react-accordion",
  "@radix-ui/react-alert-dialog",
  "@radix-ui/react-avatar",
  "@radix-ui/react-checkbox",
  "@radix-ui/react-collapsible",
  "@radix-ui/react-dialog",
  "@radix-ui/react-dropdown-menu",
  "@radix-ui/react-hover-card",
  "@radix-ui/react-label",
  "@radix-ui/react-navigation-menu",
  "@radix-ui/react-popover",
  "@radix-ui/react-progress",
  "@radix-ui/react-radio-group",
  "@radix-ui/react-scroll-area",
  "@radix-ui/react-select",
  "@radix-ui/react-separator",
  "@radix-ui/react-slider",
  "@radix-ui/react-slot",
  "@radix-ui/react-switch",
  "@radix-ui/react-tabs",
  "@radix-ui/react-toggle",
  "@radix-ui/react-toggle-group",
  "@radix-ui/react-tooltip",
  "class-variance-authority",
  "clsx",
  "tailwind-merge",
  "tailwindcss-animate",
  "lucide-react",
  "date-fns",
  "recharts",
  "react-hook-form",
  "@hookform/resolvers",
  "zod",
  "sonner",
  "next-themes",
  "embla-carousel-react",
  "react-day-picker",
  "react-resizable-panels",
  "cmdk",
  "input-otp",
  "vaul",
])

// ── shadcn/ui Component Registry ─────────────────────────────────

const uiDir = path.resolve(process.cwd(), "components/ui")
export const INSTALLED_SHADCN: string[] = []

try {
  const files = fs.readdirSync(uiDir)
  for (const f of files) {
    if (f.endsWith(".tsx")) {
      const name = f.replace(".tsx", "")
      // Read exports from the file
      const content = fs.readFileSync(path.join(uiDir, f), "utf-8")
      const exports = content.match(/export\s+(?:function|const|class)\s+(\w+)/g)
      if (exports) {
        for (const exp of exports) {
          const match = exp.match(/export\s+(?:function|const|class)\s+(\w+)/)
          if (match) INSTALLED_SHADCN.push(match[1])
        }
      }
    }
  }
} catch {
  // No ui directory — empty project
}

// Deduplicate
const uniqueShadcn = [...new Set(INSTALLED_SHADCN)].sort()
export const SHADCN_EXPORTS = new Set(uniqueShadcn)

// ── Lucide Icons (static allowlist) ──────────────────────────────

export const LUCIDE_ICONS = new Set([
  "Sparkles", "Rocket", "ShieldCheck", "Zap", "Star", "Heart", "Check",
  "ChevronRight", "ArrowRight", "ArrowUpRight", "Crown", "Compass", "Target",
  "Flame", "Layers", "LineChart", "BarChart3", "Wand2", "Brush", "Code2",
  "Palette", "Globe", "Map", "MapPin", "Mail", "Phone", "MessageCircle",
  "Users", "User", "UserCircle", "UserCheck", "Settings", "Settings2",
  "Home", "Search", "Menu", "X", "Plus", "Minus", "Trash2", "Edit",
  "Copy", "Clipboard", "ExternalLink", "Link", "Unlink", "RefreshCw",
  "Loader2", "AlertCircle", "AlertTriangle", "CheckCircle2", "Info",
  "HelpCircle", "BookOpen", "Bookmark", "FileText", "File", "Folder",
  "FolderOpen", "Image", "Upload", "Download", "Send", "Share2",
  "ThumbsUp", "ThumbsDown", "Flag", "Tag", "Hash", "AtSign", "Calendar",
  "Clock", "Timer", "Bell", "BellOff", "Eye", "EyeOff", "Lock", "Unlock",
  "Key", "Shield", "CreditCard", "DollarSign", "Banknote", "ShoppingCart",
  "ShoppingBag", "Gift", "Package", "Truck", "Store", "Building",
  "Briefcase", "Award", "Trophy", "Medal", "BadgeCheck", "Verified",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ChevronLeft", "ChevronDown",
  "ChevronUp", "PanelLeft", "PanelRight", "PanelTop", "PanelBottom",
  "LayoutDashboard", "LayoutList", "LayoutGrid", "Columns", "Rows",
  "Table", "List", "ListOrdered", "ListChecks", "ListFilter",
  "Filter", "SortAsc", "SortDesc", "GripVertical", "GripHorizontal",
  "Play", "Pause", "StopCircle", "SkipForward", "SkipBack",
  "Monitor", "Smartphone", "Tablet", "Laptop", "MousePointer",
  "Wifi", "WifiOff", "Bluetooth", "Radio", "Antenna",
  "Sun", "Moon", "Cloud", "CloudRain", "CloudSnow", "Wind",
  "ToggleLeft", "ToggleRight", "SwatchBook", "Droplets", "Database",
  "Server", "Terminal", "Code", "Braces", "Binary", "Bug",
  "Github", "GitBranch", "GitCommit", "GitPullRequest", "GitMerge",
  "Rss", "Twitter", "Facebook", "Instagram", "Youtube", "Linkedin",
  "MessageSquare", "MessagesSquare", "Inbox", "SendHorizonal",
  "Mic", "MicOff", "Video", "VideoOff", "Camera", "CameraOff",
  "Volume", "Volume1", "Volume2", "VolumeX", "Music",
  "Pencil", "PenTool", "Eraser", "Highlighter", "Paintbrush",
  "Puzzle", "Gamepad2", "Dice5", "Chess", "Crosshair",
  "Calculator", "GraduationCap", "School", "Library", "Languages",
  "Globe2", "Navigation", "Compass", "MapPinned", "Route",
  "Car", "Bus", "Plane", "Ship", "Train", "Bike",
  "Component", "Container", "Box", "BoxSelect", "Blocks",
  "Workflow", "GitBranchPlus", "Network", "Router", "Plug",
  "Printer", "HardDrive", "Cpu", "MemoryStick", "Usb",
  "Sliders", "SlidersHorizontal", "Equal", "AspectRatio",
  "Maximize", "Minimize", "Maximize2", "Minimize2",
  "Move", "MoveDiagonal", "MoveDiagonal2", "MoveHorizontal",
  "MoveVertical", "RotateCw", "RotateCcw", "FlipHorizontal",
  "FlipVertical", "Crop", "Scissors", "StretchVertical",
  "AlignLeft", "AlignCenter", "AlignRight", "AlignJustify",
  "Bold", "Italic", "Underline", "Strikethrough",
  "Superscript", "Subscript", "Type", "Quote",
  "Heading1", "Heading2", "Heading3", "Heading4", "Pilcrow",
  "Circle", "Square", "Triangle", "Diamond", "Hexagon", "Octagon",
])

// ── Next.js Config Snapshot ──────────────────────────────────────

export const NEXT_CONFIG_BASE = {
  scripts: {
    dev: "next dev",
    build: "next build",
    start: "next start",
  },
  nextVersion: pkg.dependencies?.next ?? "16.0.0",
  reactVersion: pkg.dependencies?.react ?? "19.0.0",
  tailwindVersion: pkg.devDependencies?.tailwindcss ?? "4.0.0",
  hasServerExternalPackages: ["ssh2", "node-ssh"],
  hasTypescript: true,
  moduleResolution: "bundler" as const,
  pathAliases: { "@/*": ["./*"] },
}

// ── Forbidden Import Patterns ────────────────────────────────────

export const FORBIDDEN_IMPORT_PATTERNS = [
  /^\.\/\.env/,
  /process\.env\.(?![A-Z][A-Z0-9_]*$)/,
  /require\(/,
  /import\(['"][.][.]/,
  /fs\./,
  /child_process/,
  /eval\(/,
  /Function\(/,
  /__proto__/,
]

// ── Forbidden Env Var Patterns ───────────────────────────────────

export const FORBIDDEN_ENV = [
  /DATABASE_URL/,
  /TURSO_AUTH_TOKEN/,
  /STRIPE_SECRET/,
  /OPENAI_API_KEY/,
  /RESEND_API_KEY/,
  /NEXTAUTH_SECRET/,
  /MONGODB_URI/,
  /FIREBASE_PRIVATE/,
  /GITHUB_TOKEN/,
  /AWS_SECRET/,
  /GCP_CREDENTIALS/,
  /API_KEY$/,
  /_SECRET$/,
  /_TOKEN$/,
]

// ── Functions ────────────────────────────────────────────────────

export function isImportAllowed(source: string): boolean {
  return ALLOWED_PATH_PREFIXES.some((prefix) => source.startsWith(prefix))
}

export function isShadcnExport(name: string): boolean {
  return SHADCN_EXPORTS.has(name)
}

export function isLucideIcon(name: string): boolean {
  return LUCIDE_ICONS.has(name)
}

export function isGeneratedDepAllowed(name: string): boolean {
  return ALLOWED_GENERATED_DEPS.has(name)
}
