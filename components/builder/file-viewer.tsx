"use client"

import { Button } from "@/components/ui/button"
import { ArrowLeft, Copy, Check } from "lucide-react"
import { useState } from "react"
import type { GeneratedFile } from "@/lib/builder/types"

interface FileViewerProps {
  file: GeneratedFile
  onBack: () => void
}

export function FileViewer({ file, onBack }: FileViewerProps) {
  const [copied, setCopied] = useState(false)

  const copyFile = async () => {
    await navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border shrink-0">
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-xs font-mono text-muted-foreground truncate flex-1">{file.path}</span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyFile}>
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto">
        <pre className="p-3 text-[11px] leading-relaxed font-mono text-foreground whitespace-pre-wrap break-words">
          {file.content}
        </pre>
      </div>
    </div>
  )
}
