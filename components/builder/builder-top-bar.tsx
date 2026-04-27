"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Rocket, Loader2 } from "lucide-react"

interface BuilderTopBarProps {
  projectName: string
  modelName: string
  phase: string
  fileCount: number
  isRunning: boolean
  onExport: () => void
}

export function BuilderTopBar({
  projectName,
  modelName,
  phase,
  fileCount,
  isRunning,
  onExport,
}: BuilderTopBarProps) {
  return (
    <header className="h-12 sm:h-14 border-b border-border bg-background/95 backdrop-blur flex items-center px-3 sm:px-4 lg:px-6 gap-2 sm:gap-4 shrink-0">
      <div className="flex items-center gap-2 min-w-0">
        <Rocket className="h-4 w-4 sm:h-5 sm:w-5 text-primary shrink-0" />
        <span className="text-sm sm:text-base font-semibold truncate max-w-[120px] sm:max-w-[200px]">
          {projectName || "AI Builder"}
        </span>
      </div>

      <Badge variant="outline" className="hidden sm:inline-flex text-[10px] shrink-0">
        {modelName}
      </Badge>

      <div className="flex-1 min-w-0">
        {isRunning && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin shrink-0" />
            <span className="truncate">{phase}</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {fileCount > 0 && (
          <Badge variant="secondary" className="text-[10px]">
            {fileCount} files
          </Badge>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={onExport}
          disabled={fileCount === 0}
          className="h-7 sm:h-8 text-xs gap-1"
        >
          <Download className="h-3 w-3" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>
    </header>
  )
}
