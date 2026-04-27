"use client"

import { useState, useCallback } from "react"
import { BuilderTopBar } from "./builder-top-bar"
import { ChatPanel } from "./chat-panel"
import { PreviewCanvas } from "./preview-canvas"
import { InspectorPanel } from "./inspector-panel"
import type { PipelineEvent, GeneratedProject, GeneratedFile } from "@/lib/builder/types"

interface ChatMessage {
  id: string
  role: "user" | "system"
  content: string
}

const DEFAULT_MODEL = {
  id: "gemini-3.1-flash-preview",
  provider: "Google",
  name: "Gemini 3.1 Flash",
  fast: true,
}

export function AIBuilder() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [events, setEvents] = useState<PipelineEvent[]>([])
  const [project, setProject] = useState<GeneratedProject | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [currentPhase, setCurrentPhase] = useState("")
  const [currentRoute, setCurrentRoute] = useState("/")

  const routes = project?.manifest.pages.map(p => p.route) ?? ["/"]
  const files = project?.files ?? []
  const projectName = project?.name ?? ""

  const handleSubmit = useCallback(async (prompt: string) => {
    if (isRunning) return

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: prompt,
    }
    setMessages(prev => [...prev, userMsg])
    setIsRunning(true)
    setEvents([])
    setProject(null)
    setCurrentPhase("Starting pipeline...")

    try {
      const res = await fetch("/api/ai/generate-website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, model: DEFAULT_MODEL }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Generation failed" }))
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: errData.message || "Generation failed. Please try again.",
        }])
        setIsRunning(false)
        return
      }

      const reader = res.body?.getReader()
      if (!reader) {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: "system",
          content: "No response stream available.",
        }])
        setIsRunning(false)
        return
      }

      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() ?? ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const jsonStr = line.slice(6).trim()
          if (jsonStr === "[DONE]") continue

          try {
            const event: PipelineEvent = JSON.parse(jsonStr)
            setEvents(prev => [...prev, event])

            if (event.phase) setCurrentPhase(event.message ?? event.phase)
            if (event.type === "complete" && event.project) {
              const proj = event.project
              setProject(proj)
              setMessages(prev => [...prev, {
                id: (Date.now() + 2).toString(),
                role: "system",
                content: `Your website is ready! Generated ${proj.files.length} files with ${proj.manifest.pages.length} pages.`,
              }])
            }
            if (event.type === "error") {
              setMessages(prev => [...prev, {
                id: (Date.now() + 3).toString(),
                role: "system",
                content: event.error ?? event.message ?? "An error occurred.",
              }])
            }
          } catch {
            // skip malformed events
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: (Date.now() + 4).toString(),
        role: "system",
        content: `Error: ${err instanceof Error ? err.message : "Generation failed"}`,
      }])
    } finally {
      setIsRunning(false)
      setCurrentPhase("")
    }
  }, [isRunning])

  const handleExport = useCallback(() => {
    if (!project) return
    // Create a downloadable JSON blob with all files
    const blob = new Blob(
      [JSON.stringify(project.files.map(f => ({ path: f.path, content: f.content })), null, 2)],
      { type: "application/json" }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${project.name || "generated-site"}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }, [project])

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <BuilderTopBar
        projectName={projectName}
        modelName={DEFAULT_MODEL.name!}
        phase={currentPhase}
        fileCount={files.length}
        isRunning={isRunning}
        onExport={handleExport}
      />

      {/* Desktop: 3-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat + Pipeline */}
        <div className="w-full md:w-[320px] lg:w-[360px] border-r border-border flex flex-col shrink-0 md:max-w-[360px]">
          <ChatPanel
            messages={messages}
            events={events}
            isRunning={isRunning}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Center: Preview (hidden on mobile, shown on md+) */}
        <div className="hidden md:flex flex-1 flex-col min-w-0">
          <PreviewCanvas
            files={files}
            currentRoute={currentRoute}
            onRouteChange={setCurrentRoute}
            routes={routes}
          />
        </div>

        {/* Right: Inspector (hidden on mobile, shown on lg+) */}
        <div className="hidden lg:flex w-[280px] xl:w-[320px] border-l border-border flex-col shrink-0">
          <InspectorPanel
            project={project}
            events={events}
          />
        </div>
      </div>

      {/* Mobile: Tabs for preview/inspector (shown only on mobile/tablet) */}
      <div className="md:hidden">
        {project && (
          <div className="border-t border-border">
            <div className="flex overflow-x-auto gap-1 p-1 bg-muted/30">
              <button
                onClick={() => setCurrentRoute("/")}
                className="px-3 py-1.5 text-xs rounded-md bg-background border border-border whitespace-nowrap"
              >
                Preview
              </button>
              <button className="px-3 py-1.5 text-xs rounded-md bg-background border border-border whitespace-nowrap">
                Files ({files.length})
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
