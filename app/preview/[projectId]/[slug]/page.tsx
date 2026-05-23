// Dynamic Preview Route — lazy-loads generated sections using next/dynamic.
// Catches hydration/runtime errors with React Error Boundary.
// Tailwind watches components/generated/** for style synthesis.

"use client"

import dynamic from "next/dynamic"
import { notFound } from "next/navigation"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle } from "lucide-react"
import { Component, type ReactNode } from "react"

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-20 space-y-12">
        <Skeleton className="h-12 w-48 mx-auto" />
        <Skeleton className="h-8 w-96 mx-auto" />
        <Skeleton className="h-64 w-full max-w-3xl mx-auto" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    </div>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode; sectionId: string }, { hasError: boolean; error: Error | null }> {
  constructor(props: { children: ReactNode; sectionId: string }) { super(props); this.state = { hasError: false, error: null } }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  render() {
    if (this.state.hasError) {
      return (
        <section className="py-12">
          <div className="container mx-auto px-4">
            <Alert variant="default">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Adjusting Layout</AlertTitle>
              <AlertDescription>Section `{this.props.sectionId}` is being rebuilt. The rest of the page remains interactive.</AlertDescription>
            </Alert>
          </div>
        </section>
      )
    }
    return this.props.children
  }
}

interface PageProps {
  params: Promise<{ projectId: string; slug: string }>
  searchParams: Promise<{ sections?: string }>
}

export default async function PreviewPage({ params, searchParams }: PageProps) {
  const { projectId, slug } = await params
  const resolvedSearch = await searchParams
  const sections = resolvedSearch.sections
  const sectionIds = sections ? sections.split(",") : await fetchSectionIds(projectId, slug)

  if (!sectionIds || sectionIds.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Alert variant="default" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>No sections found</AlertTitle>
          <AlertDescription>This preview has no content yet. Generate a website first.</AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {sectionIds.map((sectionId: string) => {
        const compPath = `@/components/generated/${projectId}/${sectionId}`
        try {
          const DynamicSection = dynamic(() => import(/* @vite-ignore */ compPath).catch(() => {
            return { default: () => <div /> }
          }), { loading: () => <Skeleton className="h-32 w-full" />, ssr: false })

          return (
            <ErrorBoundary key={sectionId} sectionId={sectionId}>
              <DynamicSection />
            </ErrorBoundary>
          )
        } catch {
          return (
            <section key={sectionId} className="py-12">
              <div className="container mx-auto px-4 text-center text-muted-foreground">
                Section not available
              </div>
            </section>
          )
        }
      })}
    </div>
  )
}

async function fetchSectionIds(projectId: string, slug: string): Promise<string[]> {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ""}/api/syra/sections?projectId=${projectId}&slug=${slug}`)
    if (!res.ok) return []
    const data = await res.json()
    return data.sections || []
  } catch {
    return []
  }
}
