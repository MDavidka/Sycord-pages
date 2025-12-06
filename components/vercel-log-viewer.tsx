"use client"

import { useState, useEffect } from "react"
import { AlertCircle, Terminal } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Button } from "@/components/ui/button"

interface VercelLogViewerProps {
  logs: string[]
  error?: string | null
  isLoading?: boolean
}

export function VercelLogViewer({ logs, error, isLoading }: VercelLogViewerProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Auto-open if there's an error
  useEffect(() => {
    if (error) {
      setIsOpen(true)
    }
  }, [error])

  if (!logs.length && !error) return null

  return (
    <div className="mt-4 space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="break-all">{error}</AlertDescription>
        </Alert>
      )}

      <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full space-y-2">
        <div className="flex items-center justify-between px-4">
          <h4 className="text-sm font-semibold">Deployment Logs</h4>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-9 p-0">
              <Terminal className="h-4 w-4" />
              <span className="sr-only">Toggle logs</span>
            </Button>
          </CollapsibleTrigger>
        </div>

        <CollapsibleContent>
          <div className="rounded-md border bg-muted p-4 font-mono text-xs max-h-[300px] overflow-y-auto">
            {logs.map((log, index) => (
              <div key={index} className="border-b border-border/50 py-1 last:border-0">
                <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                {log}
              </div>
            ))}
            {isLoading && (
              <div className="animate-pulse py-1 text-muted-foreground">... processing ...</div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}
