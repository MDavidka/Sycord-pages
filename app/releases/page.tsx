"use client"

import { useEffect, useState, useCallback } from "react"
import Image from "next/image"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { ArrowLeft, Plus, Trash2, X } from "lucide-react"
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Release = {
  _id?: string
  _tid?: string
  id?: string
  title: string
  version: string
  image: string
  createdAt: string
}

const ADMIN_EMAIL = "dmarton336@gmail.com"

export default function ReleasesPage() {
  const { data: session } = useSession()
  const [releases, setReleases] = useState<Release[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [title, setTitle] = useState("")
  const [version, setVersion] = useState("")
  const [image, setImage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const isAdmin = session?.user?.email === ADMIN_EMAIL

  const fetchReleases = useCallback(async () => {
    try {
      const res = await fetch("/api/releases")
      const data = await res.json()
      setReleases(data.releases || [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchReleases() }, [fetchReleases])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !version.trim()) return
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/releases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), version: version.trim(), image: image.trim() }),
      })
      if (!res.ok) throw new Error("Failed")
      setTitle("")
      setVersion("")
      setImage("")
      setShowForm(false)
      await fetchReleases()
    } catch {
      setError("Failed to create release. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(release: Release) {
    const id = release._id || release._tid || release.id
    if (!id) return
    try {
      await fetch(`/api/releases/${id}`, { method: "DELETE" })
      await fetchReleases()
    } catch {
      // silent
    }
  }

  return (
    <main
      className="min-h-screen w-full text-white"
      style={{ fontFamily: "'Inter', sans-serif", backgroundColor: "#181818" }}
    >
      <header className="mx-auto flex w-full max-w-4xl items-center justify-between px-5 pt-6 sm:px-8 sm:pt-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <Image src="/logo.png" alt="Sycord" width={36} height={36} priority className="h-8 w-8 opacity-90" />
          <span className="text-sm font-semibold tracking-tight text-white">sycord</span>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-[#2a2c30] bg-[#181818] px-4 py-2 text-xs font-medium text-[#A7AAB0] transition-colors hover:bg-[#212327] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back
        </Link>
      </header>

      <div className="mx-auto w-full max-w-4xl px-5 pb-20 pt-12 sm:px-8 sm:pt-20">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-white sm:text-5xl" style={{ letterSpacing: "-0.02em", lineHeight: 1.1 }}>
            Release Notes
          </h1>
          <p className="mt-3 text-base text-[#A7AAB0]">Track every version, every update, and every improvement.</p>
        </div>

        {isAdmin && (
          <div className="mt-8 text-center">
            <Button
              onClick={() => setShowForm(!showForm)}
              variant="outline"
              className="rounded-full border-[#2a2c30] bg-transparent text-white hover:bg-[#212327] hover:text-white"
            >
              {showForm ? <X className="mr-1.5 h-4 w-4" /> : <Plus className="mr-1.5 h-4 w-4" />}
              {showForm ? "Cancel" : "New Release"}
            </Button>
          </div>
        )}

        {showForm && (
          <form onSubmit={handleSubmit} className="mx-auto mt-6 max-w-md rounded-2xl border border-[#2a2c30] bg-[#181818] p-5 sm:p-6">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#A7AAB0]">Image URL</label>
                <input
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  placeholder="https://..."
                  className="h-11 w-full rounded-xl border border-[#2a2c30] bg-[#111213] px-4 text-sm text-white placeholder-[#3a3c40] outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#A7AAB0]">Version</label>
                <input
                  required
                  value={version}
                  onChange={e => setVersion(e.target.value)}
                  placeholder="e.g. v0.2.0"
                  className="h-11 w-full rounded-xl border border-[#2a2c30] bg-[#111213] px-4 text-sm font-mono text-white placeholder-[#3a3c40] outline-none focus:border-white/30"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#A7AAB0]">Title</label>
                <input
                  required
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="What's new?"
                  className="h-11 w-full rounded-xl border border-[#2a2c30] bg-[#111213] px-4 text-sm text-white placeholder-[#3a3c40] outline-none focus:border-white/30"
                />
              </div>
              {error && <p className="text-xs text-red-400">{error}</p>}
              <Button
                type="submit"
                disabled={submitting}
                className="h-11 w-full rounded-xl bg-white text-sm font-semibold text-black hover:bg-white/90"
              >
                {submitting ? "Publishing..." : "Publish Release"}
              </Button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="mt-12 space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse rounded-2xl border border-[#2a2c30] bg-[#181818] p-5 sm:p-6">
                <div className="h-48 w-full rounded-xl bg-[#111213]" />
                <div className="mt-4 h-5 w-32 rounded-full bg-[#111213]" />
                <div className="mt-2 h-4 w-48 rounded-full bg-[#111213]" />
              </div>
            ))}
          </div>
        ) : releases.length === 0 ? (
          <div className="mt-16 text-center">
            <p className="text-[#A7AAB0]">No releases yet. Check back soon.</p>
          </div>
        ) : (
          <div className="mt-12 space-y-6">
            {releases.map((r, i) => {
              const releaseId = r._id || r._tid || r.id
              return (
                <Card key={releaseId || i} className="overflow-hidden rounded-2xl border-[#2a2c30] bg-[#181818]">
                  {r.image && (
                    <div className="relative aspect-video w-full overflow-hidden">
                      <Image
                        src={r.image}
                        alt={r.title}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 100vw, 800px"
                      />
                    </div>
                  )}
                  <CardHeader className="flex flex-row items-start justify-between pb-2">
                    <div>
                      <CardDescription className="text-xs font-mono tracking-wider text-[#7C6FF5]">
                        {r.version}
                      </CardDescription>
                      <CardTitle className="mt-1 text-lg font-semibold text-white">{r.title}</CardTitle>
                      <CardDescription className="mt-1 text-xs text-[#6B6F78]">
                        {new Date(r.createdAt).toLocaleDateString("en-US", {
                          year: "numeric", month: "long", day: "numeric",
                        })}
                      </CardDescription>
                    </div>
                    {isAdmin && (
                      <button
                        onClick={() => handleDelete(r)}
                        className="rounded-lg p-1.5 text-[#4B4F58] transition-colors hover:bg-red-500/10 hover:text-red-400"
                        title="Delete release"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </CardHeader>
                  <CardContent />
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </main>
  )
}
