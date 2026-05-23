// Preview Route — renders generated project pages with error isolation.
// Sections are loaded via client-side fetch from the manifest, not dynamic imports.

"use client"

import { useState, useEffect, Component, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"
import type { ManifestAST, ManifestSection } from "@/lib/syra"

class ErrorBoundary extends Component<{ children: ReactNode; sectionId: string }, { hasError: boolean }> {
  constructor(props: { children: ReactNode; sectionId: string }) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  render() {
    if (this.state.hasError) {
      return (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Adjusting Layout</AlertTitle>
              <AlertDescription>Section `{this.props.sectionId}` is being rebuilt.</AlertDescription>
            </Alert>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}

function SectionPreview({ section }: { section: ManifestSection }) {
  const layoutClass = (() => {
    switch (section.layout) {
      case "centered": return "flex flex-col items-center text-center max-w-4xl mx-auto"
      case "split": return "grid grid-cols-1 lg:grid-cols-2 gap-8 items-center"
      case "grid-2": return "grid grid-cols-1 sm:grid-cols-2 gap-6"
      case "grid-3": return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      case "grid-4": return "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6"
      case "asymmetric": return "grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8"
      case "bento": return "grid grid-cols-1 md:grid-cols-3 gap-4"
      default: return "flex flex-col items-center text-center max-w-4xl mx-auto"
    }
  })()

  const bgClass = section.bg === "muted" ? "bg-muted/50" : section.bg === "primary/5" ? "bg-primary/5" : ""

  return (
    <ErrorBoundary sectionId={section.id}>
      <section id={section.id} className={`py-16 px-4 ${bgClass}`}>
        <div className="container mx-auto">
          <div className={layoutClass}>
            {section.elements.map((el) => {
              const Tag = el.type as keyof HTMLElementTagNameMap
              const isHeading = el.type === "label" || el.type === "heading"
              const isButton = el.type === "button"
              const isBadge = el.type === "badge"

              if (isHeading) {
                const size = el.className?.includes("text-5xl") ? "text-5xl" :
                  el.className?.includes("text-4xl") ? "text-4xl" :
                  el.className?.includes("text-3xl") ? "text-3xl" :
                  el.className?.includes("text-2xl") ? "text-2xl" :
                  el.className?.includes("text-xl") ? "text-xl" : "text-base"
                return <p key={el.id} className={`${size} font-bold tracking-tight`}>{el.content}</p>
              }

              if (isBadge) {
                return <span key={el.id} className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors border-transparent bg-secondary text-secondary-foreground mb-4">{el.content}</span>
              }

              if (isButton) {
                return (
                  <Button key={el.id} variant={el.variant as "default" | "secondary" | "outline" | "ghost" | "link" | "destructive"} size={(el.size as "sm" | "default" | "lg" | "icon") || "default"} className={el.className}>
                    {el.content}
                  </Button>
                )
              }

              return <div key={el.id} className="border rounded-xl p-6 bg-card">{el.content || el.type}</div>
            })}
          </div>
        </div>
      </section>
    </ErrorBoundary>
  )
}

interface PageProps {
  params: Promise<{ projectId: string; slug: string }>
}

export default async function PreviewPage({ params }: PageProps) {
  const { projectId, slug } = await params

  // Fetch manifest from API
  let manifest: ManifestAST | null = null
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || ""
    const res = await fetch(`${baseUrl}/api/syra/generate?projectId=${projectId}&slug=${slug}`)
    if (res.ok) {
      const data = await res.json()
      manifest = data.manifest || null
    }
  } catch { /* fallback to empty */ }

  const sections = manifest?.pages?.find((p) => p.path === `/${slug}` || p.path === slug)?.sections ||
    manifest?.pages?.[0]?.sections || []

  const bgClass = manifest?.colorScheme === "dark" ? "bg-zinc-950 text-zinc-100" : "bg-background text-foreground"

  return (
    <PreviewClient projectId={projectId} slug={slug} sections={sections} bgClass={bgClass} />
  )
}

function PreviewClient({ projectId, slug, sections, bgClass }: { projectId: string; slug: string; sections: ManifestSection[]; bgClass: string }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  if (sections.length === 0) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 p-8">
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No sections found</AlertTitle>
          <AlertDescription>This preview has no content yet. Generate a website first.</AlertDescription>
        </Alert>
        <Button onClick={() => router.refresh()} variant="outline" size="sm" className="gap-2">
          <RefreshCw className="h-3 w-3" /> Retry
        </Button>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${bgClass}`}>
      {sections.map((section) => (
        <SectionPreview key={section.id} section={section} />
      ))}
    </div>
  )
}
