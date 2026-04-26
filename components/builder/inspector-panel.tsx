"use client"

import { useState } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import type { GeneratedFile, GeneratedProject, PipelineEvent, BuildIssue } from "@/lib/builder/types"
import { FileTreePanel } from "./file-tree-panel"
import { FileViewer } from "./file-viewer"
import { SitemapPanel } from "./sitemap-panel"
import { BuildPanel } from "./build-panel"
import { LogsPanel } from "./logs-panel"

interface InspectorPanelProps {
  project: GeneratedProject | null
  events: PipelineEvent[]
  className?: string
}

export function InspectorPanel({ project, events, className }: InspectorPanelProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const files = project?.files ?? []
  const file = selectedFile ? files.find(f => f.path === selectedFile) : null

  const buildEvents = events.filter(e => e.type === "build")
  const lastBuild = buildEvents[buildEvents.length - 1]
  const buildIssues = lastBuild?.buildIssues ?? []
  const buildLogs = lastBuild?.buildLogs ?? []

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <Tabs defaultValue="sitemap" className="flex flex-col h-full">
        <TabsList className="w-full justify-start rounded-none border-b border-border bg-background h-9 px-1 shrink-0 overflow-x-auto">
          <TabsTrigger value="sitemap" className="text-xs h-7 px-2">Sitemap</TabsTrigger>
          <TabsTrigger value="files" className="text-xs h-7 px-2">Files</TabsTrigger>
          <TabsTrigger value="build" className="text-xs h-7 px-2">
            Build
            {buildIssues.length > 0 && (
              <span className="ml-1 h-4 min-w-4 px-1 rounded-full bg-yellow-500/20 text-yellow-600 text-[10px] inline-flex items-center justify-center">
                {buildIssues.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="logs" className="text-xs h-7 px-2">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="sitemap" className="flex-1 overflow-auto mt-0">
          <SitemapPanel project={project} />
        </TabsContent>

        <TabsContent value="files" className="flex-1 overflow-auto mt-0">
          {selectedFile && file ? (
            <FileViewer file={file} onBack={() => setSelectedFile(null)} />
          ) : (
            <FileTreePanel files={files} onSelectFile={setSelectedFile} />
          )}
        </TabsContent>

        <TabsContent value="build" className="flex-1 overflow-auto mt-0">
          <BuildPanel issues={buildIssues} logs={buildLogs} />
        </TabsContent>

        <TabsContent value="logs" className="flex-1 overflow-auto mt-0">
          <LogsPanel events={events} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
