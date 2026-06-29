"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  ArrowLeft,
  Brain,
  User,
  Save,
  Plus,
  Trash2,
  Tag,
  AlertTriangle,
  CheckCircle,
  Lightbulb,
  FileCode,
  Heart,
  Wrench,
  LayoutDashboard,
  LogOut,
  Settings,
  CreditCard,
} from "lucide-react"
import type { DeepMemoryEntry, DeepMemoryProfile, DeepMemoryEntryKind } from "@/lib/types"

const KIND_ICONS: Record<DeepMemoryEntryKind, typeof Brain> = {
  "build-failure": AlertTriangle,
  "deployment-failure": AlertTriangle,
  "import-error": AlertTriangle,
  lesson: Lightbulb,
  "project-state": FileCode,
  decision: CheckCircle,
  "user-preference": Heart,
  fix: Wrench,
}

const KIND_LABELS: Record<DeepMemoryEntryKind, string> = {
  "build-failure": "Build Failure",
  "deployment-failure": "Deployment Failure",
  "import-error": "Import Error",
  lesson: "Lesson",
  "project-state": "Project State",
  decision: "Decision",
  "user-preference": "Preference",
  fix: "Fix",
}

const KIND_COLORS: Record<DeepMemoryEntryKind, string> = {
  "build-failure": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "deployment-failure": "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  "import-error": "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
  lesson: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  "project-state": "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  decision: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  "user-preference": "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  fix: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<DeepMemoryProfile | null>(null)
  const [originalProfile, setOriginalProfile] = useState<DeepMemoryProfile | null>(null)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<DeepMemoryEntry | null>(null)

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
      return
    }
    if (status === "authenticated") {
      fetch("/api/user/deep-memory")
        .then((res) => res.json())
        .then((data) => {
          const deepMemory: DeepMemoryProfile = data.deepMemory || {
            summary: "",
            architectureNotes: "",
            recurringIssues: [],
            trustedPatterns: [],
            entries: [],
            lastUpdatedAt: new Date().toISOString(),
          }
          setProfile(deepMemory)
          setOriginalProfile(JSON.parse(JSON.stringify(deepMemory)))
        })
        .catch((err) => console.error("Failed to load deep memory:", err))
        .finally(() => setLoading(false))
    }
  }, [status, router])

  const hasChanges = JSON.stringify(profile) !== JSON.stringify(originalProfile)

  async function saveProfile() {
    if (!profile) return
    setSaving(true)
    try {
      const res = await fetch("/api/user/deep-memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      })
      const data = await res.json()
      if (data.deepMemory) {
        setProfile(data.deepMemory)
        setOriginalProfile(JSON.parse(JSON.stringify(data.deepMemory)))
      }
    } catch (err) {
      console.error("Failed to save deep memory:", err)
    } finally {
      setSaving(false)
    }
  }

  function updateField<K extends keyof DeepMemoryProfile>(field: K, value: DeepMemoryProfile[K]) {
    setProfile((prev) => (prev ? { ...prev, [field]: value } : prev))
  }

  function updateListField(field: "recurringIssues" | "trustedPatterns", index: number, value: string) {
    setProfile((prev) => {
      if (!prev) return prev
      const next = [...prev[field]]
      next[index] = value
      return { ...prev, [field]: next }
    })
  }

  function addListField(field: "recurringIssues" | "trustedPatterns") {
    setProfile((prev) => (prev ? { ...prev, [field]: [...prev[field], ""] } : prev))
  }

  function removeListField(field: "recurringIssues" | "trustedPatterns", index: number) {
    setProfile((prev) => {
      if (!prev) return prev
      const next = [...prev[field]]
      next.splice(index, 1)
      return { ...prev, [field]: next }
    })
  }

  function openNewEntry() {
    setEditingEntry({
      id: generateId(),
      kind: "lesson",
      title: "",
      content: "",
      tags: [],
      createdAt: new Date().toISOString(),
    })
    setDialogOpen(true)
  }

  function openEditEntry(entry: DeepMemoryEntry) {
    setEditingEntry({ ...entry })
    setDialogOpen(true)
  }

  function saveEntry() {
    if (!editingEntry || !profile) return
    const entry = { ...editingEntry, updatedAt: new Date().toISOString() }
    const exists = profile.entries.find((e) => e.id === entry.id)
    const nextEntries = exists
      ? profile.entries.map((e) => (e.id === entry.id ? entry : e))
      : [entry, ...profile.entries]
    setProfile({ ...profile, entries: nextEntries })
    setDialogOpen(false)
    setEditingEntry(null)
  }

  function deleteEntry(id: string) {
    if (!profile) return
    setProfile({ ...profile, entries: profile.entries.filter((e) => e.id !== id) })
  }

  if (status === "loading" || loading) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-10 w-10 rounded-full" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-10 w-64 mb-6" />
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

  const userInitials =
    session?.user?.name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase() || "U"

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <Link href="/dashboard" className="flex items-center gap-2">
              <Image src="/logo.png" alt="Logo" width={32} height={32} />
              <span className="text-xl font-semibold text-foreground">Syra</span>
            </Link>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                  <AvatarFallback className="bg-primary text-primary-foreground">{userInitials}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{session?.user?.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{session?.user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/dashboard")}>
                <LayoutDashboard className="mr-2 h-4 w-4" />
                <span>Dashboard</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/subscriptions")}>
                <CreditCard className="mr-2 h-4 w-4" />
                <span>Plans</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/dashboard/profile")}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => router.push("/api/auth/signout")} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 pb-24">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Profile & Deep Memory</h1>
              <p className="text-muted-foreground text-sm">
                Persistent project knowledge, recurring issues, and trusted patterns Syra uses to avoid repeated mistakes.
              </p>
            </div>
          </div>
          <Button onClick={saveProfile} disabled={!hasChanges || saving} className="w-full md:w-auto">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
          </Button>
        </div>

        <Tabs defaultValue="deep-memory" className="space-y-6">
          <TabsList className="w-full md:w-auto">
            <TabsTrigger value="deep-memory" className="gap-2">
              <Brain className="h-4 w-4" />
              Deep Memory
            </TabsTrigger>
            <TabsTrigger value="account" className="gap-2">
              <User className="h-4 w-4" />
              Account
            </TabsTrigger>
          </TabsList>

          <TabsContent value="deep-memory" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Memory Summary
                  </CardTitle>
                  <CardDescription>
                    High-level context Syra reads before every build. Describe your stack preferences, brand voice, and non-negotiable rules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Project Summary</label>
                    <Textarea
                      placeholder="e.g. We build Next.js 14 marketing sites with shadcn/ui, Tailwind, and Framer Motion. All pages must be mobile-first and WCAG AA."
                      value={profile?.summary || ""}
                      onChange={(e) => updateField("summary", e.target.value)}
                      rows={4}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Architecture Notes</label>
                    <Textarea
                      placeholder="e.g. Use App Router, Server Components by default, Zustand only for client global state, Supabase for auth/database."
                      value={profile?.architectureNotes || ""}
                      onChange={(e) => updateField("architectureNotes", e.target.value)}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      Recurring Issues
                    </CardTitle>
                    <CardDescription>One per line. Syra will actively avoid these.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {profile?.recurringIssues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={issue}
                          onChange={(e) => updateListField("recurringIssues", i, e.target.value)}
                          placeholder="e.g. Missing @/components/ui/* imports cause build failure"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeListField("recurringIssues", i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addListField("recurringIssues")} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Issue
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-emerald-600" />
                      Trusted Patterns
                    </CardTitle>
                    <CardDescription>Rules and patterns that consistently work.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {profile?.trustedPatterns.map((pattern, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Input
                          value={pattern}
                          onChange={(e) => updateListField("trustedPatterns", i, e.target.value)}
                          placeholder="e.g. Always call listShadcnComponents() before importing a UI component"
                        />
                        <Button variant="ghost" size="icon" onClick={() => removeListField("trustedPatterns", i)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                    <Button variant="outline" size="sm" onClick={() => addListField("trustedPatterns")} className="w-full">
                      <Plus className="mr-2 h-4 w-4" />
                      Add Pattern
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-primary" />
                    Memory Entries
                  </CardTitle>
                  <CardDescription>
                    {profile?.entries.length || 0} recorded entries. Syra reads the most relevant ones before generating code.
                  </CardDescription>
                </div>
                <Button onClick={openNewEntry}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Entry
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  {profile && profile.entries.length === 0 && (
                    <div className="text-center py-12 border border-dashed border-border rounded-lg">
                      <Brain className="h-10 w-10 text-muted-foreground mx-auto mb-4" />
                      <h3 className="font-medium text-foreground mb-1">No entries yet</h3>
                      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-4">
                        Add lessons from failed builds, deployment gotchas, or project-specific rules. Syra will use them to improve future builds.
                      </p>
                      <Button variant="outline" onClick={openNewEntry}>
                        <Plus className="mr-2 h-4 w-4" />
                        First Entry
                      </Button>
                    </div>
                  )}
                  <div className="space-y-4">
                    {profile?.entries.map((entry) => {
                      const Icon = KIND_ICONS[entry.kind] || Brain
                      return (
                        <div key={entry.id} className="border border-border rounded-lg p-4 hover:border-primary/30 transition-colors">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`h-9 w-9 rounded-md flex items-center justify-center shrink-0 ${KIND_COLORS[entry.kind] || ""}`}>
                                <Icon className="h-5 w-5" />
                              </div>
                              <div>
                                <h4 className="font-medium text-foreground">{entry.title}</h4>
                                <div className="flex flex-wrap items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-xs">
                                    {KIND_LABELS[entry.kind] || entry.kind}
                                  </Badge>
                                  {entry.projectName && (
                                    <Badge variant="outline" className="text-xs">
                                      {entry.projectName}
                                    </Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEditEntry(entry)}>
                                <Settings className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => deleteEntry(entry.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground mt-3 whitespace-pre-wrap">{entry.content}</p>
                          {entry.tags && entry.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                              {entry.tags.map((tag) => (
                                <span key={tag} className="inline-flex items-center text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                                  <Tag className="mr-1 h-3 w-3" />
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <Card className="max-w-2xl">
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>Your Sycord account details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xl">{userInitials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{session?.user?.name}</h3>
                    <p className="text-muted-foreground">{session?.user?.email}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Name</label>
                    <p className="text-foreground">{session?.user?.name || "—"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Email</label>
                    <p className="text-foreground">{session?.user?.email || "—"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingEntry && profile?.entries.some((e) => e.id === editingEntry.id) ? "Edit Entry" : "New Memory Entry"}</DialogTitle>
            <DialogDescription>Record something Syra should remember about your projects.</DialogDescription>
          </DialogHeader>
          {editingEntry && (
            <div className="space-y-4 py-2">
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  value={editingEntry.title}
                  onChange={(e) => setEditingEntry({ ...editingEntry, title: e.target.value })}
                  placeholder="e.g. Build fails when importing uninstalled shadcn Dialog"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Kind</label>
                <Select
                  value={editingEntry.kind}
                  onValueChange={(value: DeepMemoryEntryKind) => setEditingEntry({ ...editingEntry, kind: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(KIND_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Content</label>
                <Textarea
                  value={editingEntry.content}
                  onChange={(e) => setEditingEntry({ ...editingEntry, content: e.target.value })}
                  placeholder="Describe what happened, why, and how to avoid it next time."
                  rows={5}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Tags (comma separated)</label>
                <Input
                  value={editingEntry.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingEntry({
                      ...editingEntry,
                      tags: e.target.value
                        .split(",")
                        .map((t) => t.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="imports, docker, nextjs, ..."
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={saveEntry} disabled={!editingEntry?.title || !editingEntry?.content}>
              Save Entry
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
