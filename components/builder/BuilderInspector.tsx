"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  FileCode,
  Folder,
  FolderOpen,
  ChevronRight,
  Code as CodeIcon,
  Globe,
  Hammer,
  Terminal,
  Layout as LayoutIcon,
  AlertTriangle,
  Loader2,
  Check,
} from "lucide-react"
import { PipelineTimeline } from "./PipelineTimeline"
import type { BuilderState, GeneratedPage, InspectorTab } from "./types"

interface BuilderInspectorProps {
  state: BuilderState
  setActiveFile: (name: string | null) => void
  setInspectorTab: (t: InspectorTab) => void
}

const TABS: { id: InspectorTab; label: string; icon: typeof FileCode }[] = [
  { id: "sitemap", label: "Sitemap", icon: LayoutIcon },
  { id: "files",   label: "Files",   icon: FileCode },
  { id: "json",    label: "JSON",    icon: CodeIcon },
  { id: "logic",   label: "Logic",   icon: Globe },
  { id: "build",   label: "Build",   icon: Hammer },
  { id: "logs",    label: "Logs",    icon: Terminal },
]

export function BuilderInspector({ state, setActiveFile, setInspectorTab }: BuilderInspectorProps) {
  return (
    <div className="flex h-full flex-col bg-card/40">
      <div className="flex items-center gap-1 border-b border-border bg-card/60 px-1">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = state.inspectorTab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setInspectorTab(t.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-2 text-xs font-medium border-b-2 transition-colors",
                active
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
              type="button"
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {state.inspectorTab === "sitemap" && <SitemapTab state={state} />}
        {state.inspectorTab === "files" && <FilesTab state={state} setActiveFile={setActiveFile} />}
        {state.inspectorTab === "json" && <JsonTab state={state} />}
        {state.inspectorTab === "logic" && <LogicTab state={state} setActiveFile={setActiveFile} />}
        {state.inspectorTab === "build" && <BuildTab state={state} />}
        {state.inspectorTab === "logs" && <LogsTab state={state} />}
      </div>
    </div>
  )
}

function SitemapTab({ state }: { state: BuilderState }) {
  if (!state.manifest) {
    return (
      <Empty>
        Sitemap appears here once the architect finishes planning.
      </Empty>
    )
  }
  return (
    <div className="p-3 flex flex-col gap-3">
      {state.manifest.chrome && (
        <Section title="Chrome">
          <Kv label="brand" value={state.manifest.chrome.brandName} />
          <Kv label="navVariant" value={state.manifest.chrome.navVariant} />
          <Kv label="header" value={state.manifest.chrome.headerLayout} />
          <Kv label="footer" value={state.manifest.chrome.footerVariant} />
          <Kv label="cta" value={`${state.manifest.chrome.ctaLabel} → ${state.manifest.chrome.ctaHref}`} />
        </Section>
      )}
      {state.manifest.design && (
        <Section title="Design genome">
          <Kv label="visualStyle" value={state.manifest.design.visualStyle} />
          <Kv label="rhythm" value={state.manifest.design.sectionRhythm} />
          <Kv label="card" value={state.manifest.design.cardTreatment} />
          <Kv label="hero" value={state.manifest.design.heroTreatment} />
          <Kv label="type" value={state.manifest.design.typographyScale} />
        </Section>
      )}
      <Section title={`Pages (${state.manifest.pages.length})`}>
        <ul className="flex flex-col gap-1.5">
          {state.manifest.pages.map((p) => (
            <li
              key={p.route}
              className="flex flex-col gap-0.5 rounded-md border border-border/60 bg-background/40 p-2 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono">{p.route}</span>
                <span className="rounded bg-muted/40 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {p.layoutSignature ?? p.layoutHint ?? "—"}
                </span>
              </div>
              <span className="text-muted-foreground">{p.pageTitle}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function FilesTab({ state, setActiveFile }: { state: BuilderState; setActiveFile: (name: string | null) => void }) {
  if (state.files.length === 0) {
    return <Empty>No files yet — they appear as the orchestrator emits them.</Empty>
  }
  return (
    <div className="p-2">
      <FileTree
        files={state.files}
        activeFile={state.activeFile ?? undefined}
        onSelect={(name) => setActiveFile(name)}
      />
    </div>
  )
}

function JsonTab({ state }: { state: BuilderState }) {
  if (!state.manifest) {
    return <Empty>Manifest JSON appears once the architect runs.</Empty>
  }
  return (
    <pre className="m-0 whitespace-pre-wrap break-all p-3 text-[11px] leading-relaxed font-mono text-zinc-300">
      {JSON.stringify(state.manifest, null, 2)}
    </pre>
  )
}

function LogicTab({ state, setActiveFile }: { state: BuilderState; setActiveFile: (name: string | null) => void }) {
  const logicFiles = state.files.filter((f) => f.name.includes("/lib/") && f.name.endsWith("-logic.ts"))
  if (logicFiles.length === 0) {
    return <Empty>Per-page logic handlers appear here.</Empty>
  }
  const active = state.activeFile && logicFiles.find((f) => f.name === state.activeFile)
  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap gap-1 border-b border-border p-2">
        {logicFiles.map((f) => (
          <Button
            key={f.name}
            size="sm"
            variant={state.activeFile === f.name ? "secondary" : "ghost"}
            className="h-7 px-2 text-[11px]"
            onClick={() => setActiveFile(f.name)}
          >
            {f.name.split("/").slice(-1)[0]}
          </Button>
        ))}
      </div>
      <pre className="flex-1 overflow-auto p-3 text-[11px] leading-relaxed font-mono text-zinc-300">
        {active ? active.code : "Select a logic file to view its source."}
      </pre>
    </div>
  )
}

function BuildTab({ state }: { state: BuilderState }) {
  return (
    <div className="p-3 flex flex-col gap-3">
      <Section title="Pipeline">
        <PipelineTimeline state={state} compact />
      </Section>
      {state.warnings.length > 0 && (
        <Section title={`Warnings (${state.warnings.length})`}>
          <ul className="flex flex-col gap-1 text-xs">
            {state.warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 px-2 py-1.5 text-amber-200"
              >
                <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                <span className="font-mono text-[11px]">{w}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {state.deploy?.url && (
        <Section title="Deploy">
          <Kv label="url" value={state.deploy.url} />
          {state.deploy.githubUrl && <Kv label="repo" value={state.deploy.githubUrl} />}
          {state.deploy.repoId && <Kv label="repoId" value={state.deploy.repoId} />}
        </Section>
      )}
    </div>
  )
}

function LogsTab({ state }: { state: BuilderState }) {
  if (state.logs.length === 0) {
    return <Empty>Logs appear here as the pipeline runs.</Empty>
  }
  return (
    <ul className="flex flex-col p-2 gap-0.5 font-mono text-[11px]">
      {state.logs.map((l) => (
        <li
          key={l.id}
          className={cn(
            "flex gap-2 rounded px-2 py-1",
            l.level === "warn" && "bg-amber-500/10 text-amber-200",
            l.level === "error" && "bg-destructive/10 text-destructive",
            l.level === "info" && "text-zinc-300",
          )}
        >
          <span className="w-16 shrink-0 text-zinc-500 uppercase tracking-wider text-[9px] pt-0.5">
            {l.phase}
          </span>
          <span className="flex-1 break-words">{l.message}</span>
        </li>
      ))}
    </ul>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-xs text-muted-foreground">
      {children}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-background/40">
      <div className="border-b border-border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div className="p-3 flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

function Kv({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="w-20 shrink-0 text-muted-foreground">{label}</span>
      <span className="flex-1 font-mono text-foreground break-all">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// File tree (Files + Logic tabs)
// ---------------------------------------------------------------------------
interface FileTreeNode {
  name: string
  path: string
  type: "file" | "folder"
  children?: FileTreeNode[]
  status?: "pending" | "active" | "done"
}

function buildTree(files: GeneratedPage[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  for (const f of files) {
    const parts = f.name.split("/")
    let current = root
    let path = ""
    parts.forEach((part, i) => {
      path = path ? `${path}/${part}` : part
      const isFile = i === parts.length - 1
      let node = current.find((n) => n.name === part)
      if (!node) {
        node = { name: part, path, type: isFile ? "file" : "folder", children: isFile ? undefined : [], status: "done" }
        current.push(node)
      }
      if (!isFile && node.children) current = node.children
    })
  }
  const sort = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => (a.type !== b.type ? (a.type === "folder" ? -1 : 1) : a.name.localeCompare(b.name)))
    nodes.forEach((n) => n.children && sort(n.children))
  }
  sort(root)
  return root
}

function FileTree({
  files,
  activeFile,
  onSelect,
}: {
  files: GeneratedPage[]
  activeFile?: string
  onSelect: (name: string) => void
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ src: true, "src/pages": true, "src/lib": true, "src/components": true })
  const tree = buildTree(files)

  const renderNode = (node: FileTreeNode, depth: number): React.ReactNode => {
    const isOpen = expanded[node.path] ?? true
    if (node.type === "folder") {
      return (
        <div key={node.path}>
          <button
            type="button"
            onClick={() => setExpanded((p) => ({ ...p, [node.path]: !isOpen }))}
            className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-muted/30"
            style={{ paddingLeft: depth * 12 + 6 }}
          >
            <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
            {isOpen ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" /> : <Folder className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="text-muted-foreground font-mono">{node.name}</span>
          </button>
          {isOpen && node.children?.map((c) => renderNode(c, depth + 1))}
        </div>
      )
    }
    const isActive = activeFile === files.find((f) => f.name === node.path)?.name
    return (
      <button
        key={node.path}
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] hover:bg-muted/30",
          isActive && "bg-muted/50",
        )}
        style={{ paddingLeft: depth * 12 + 6 }}
      >
        <span className="w-3" />
        <FileCode className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="font-mono text-foreground/90 truncate">{node.name}</span>
      </button>
    )
  }

  return <div>{tree.map((n) => renderNode(n, 0))}</div>
}

// Re-export for callers that want a tree without depending on Builder state.
export { FileTree as BuilderFileTree }
// Useful icon visible on completion (re-exported for top-bar reuse).
export const DoneIcon = Check
export const SpinnerIcon = Loader2
