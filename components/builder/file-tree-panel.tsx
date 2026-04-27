"use client"

import { File, Folder } from "lucide-react"
import { cn } from "@/lib/utils"
import type { GeneratedFile } from "@/lib/builder/types"

interface FileTreePanelProps {
  files: GeneratedFile[]
  onSelectFile: (path: string) => void
}

interface TreeNode {
  name: string
  path?: string
  children: TreeNode[]
  file?: GeneratedFile
}

function buildTree(files: GeneratedFile[]): TreeNode {
  const root: TreeNode = { name: ".", children: [] }

  for (const file of files) {
    const parts = file.path.split("/")
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      let child = current.children.find(c => c.name === part)
      if (!child) {
        child = {
          name: part,
          path: isLast ? file.path : undefined,
          children: [],
          file: isLast ? file : undefined,
        }
        current.children.push(child)
      }
      current = child
    }
  }

  // Sort: folders first, then alphabetically
  function sortTree(node: TreeNode) {
    node.children.sort((a, b) => {
      if (a.children.length > 0 && b.children.length === 0) return -1
      if (a.children.length === 0 && b.children.length > 0) return 1
      return a.name.localeCompare(b.name)
    })
    node.children.forEach(sortTree)
  }
  sortTree(root)

  return root
}

function TreeItem({ node, depth, onSelectFile }: { node: TreeNode; depth: number; onSelectFile: (path: string) => void }) {
  const isFile = !!node.file
  const pad = depth * 12

  if (isFile) {
    return (
      <button
        onClick={() => onSelectFile(node.path!)}
        className={cn(
          "flex items-center gap-1.5 w-full px-2 py-1 text-xs hover:bg-muted/50 rounded-sm text-left",
          node.file?.status === "warning" && "text-yellow-600",
          node.file?.status === "error" && "text-destructive",
        )}
        style={{ paddingLeft: `${pad + 8}px` }}
      >
        <File className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate">{node.name}</span>
      </button>
    )
  }

  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground font-medium"
        style={{ paddingLeft: `${pad + 8}px` }}
      >
        <Folder className="h-3 w-3 shrink-0" />
        <span>{node.name}</span>
      </div>
      {node.children.map((child, i) => (
        <TreeItem key={i} node={child} depth={depth + 1} onSelectFile={onSelectFile} />
      ))}
    </div>
  )
}

export function FileTreePanel({ files, onSelectFile }: FileTreePanelProps) {
  if (files.length === 0) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        No files generated yet.
      </div>
    )
  }

  const tree = buildTree(files)

  return (
    <div className="py-1">
      {tree.children.map((child, i) => (
        <TreeItem key={i} node={child} depth={0} onSelectFile={onSelectFile} />
      ))}
    </div>
  )
}
