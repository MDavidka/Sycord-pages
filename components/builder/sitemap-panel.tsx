"use client"

import { Badge } from "@/components/ui/badge"
import type { GeneratedProject } from "@/lib/builder/types"

interface SitemapPanelProps {
  project: GeneratedProject | null
}

export function SitemapPanel({ project }: SitemapPanelProps) {
  if (!project) {
    return (
      <div className="p-4 text-xs text-muted-foreground">
        Sitemap will appear after generation.
      </div>
    )
  }

  const { manifest } = project

  return (
    <div className="p-3 space-y-3">
      <div>
        <h3 className="text-xs font-semibold mb-1">Project</h3>
        <p className="text-xs text-muted-foreground">{manifest.projectName}</p>
      </div>

      <div>
        <h3 className="text-xs font-semibold mb-1">Design</h3>
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-[10px]">{manifest.design.visualStyle}</Badge>
          <Badge variant="outline" className="text-[10px]">{manifest.chrome.navVariant} nav</Badge>
          <Badge variant="outline" className="text-[10px]">{manifest.design.motionLevel} motion</Badge>
        </div>
      </div>

      <div>
        <h3 className="text-xs font-semibold mb-2">Pages ({manifest.pages.length})</h3>
        <div className="space-y-2">
          {manifest.pages.map((page) => (
            <div
              key={page.route}
              className="px-2.5 py-2 rounded-md border border-border bg-muted/30"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{page.title}</span>
                <span className="text-[10px] text-muted-foreground font-mono">{page.route}</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{page.description}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {page.features.slice(0, 3).map((f, i) => (
                  <Badge key={i} variant="secondary" className="text-[9px] h-4 px-1.5">{f}</Badge>
                ))}
                {page.features.length > 3 && (
                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">+{page.features.length - 3}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
