"use client"

import React, { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { toast } from "sonner"
import {
  Database,
  Search,
  Users,
  FolderGit2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react"

interface DatabaseInspectModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  databaseName?: string
}

export function DatabaseInspectModal({
  open,
  onOpenChange,
  databaseName = "Turso Master",
}: DatabaseInspectModalProps) {
  const [collection, setCollection] = useState<"users" | "projects">("users")
  const [records, setRecords] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  useEffect(() => {
    if (open) {
      fetchRecords(1, search, collection)
    }
  }, [open, collection])

  const fetchRecords = async (targetPage = page, query = search, targetCollection = collection) => {
    setLoading(true)
    try {
      const res = await fetch(
        `/api/moderator/databases/records?collection=${targetCollection}&page=${targetPage}&limit=15&search=${encodeURIComponent(
          query
        )}`
      )
      const data = await res.json()
      if (data.ok) {
        setRecords(data.records || [])
        setTotalPages(data.totalPages || 1)
        setTotal(data.total || 0)
        setPage(data.page || 1)
      } else {
        toast.error(data.error || "Failed to load database records")
      }
    } catch {
      toast.error("Failed to fetch database records")
    } finally {
      setLoading(false)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    fetchRecords(1, search, collection)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col bg-[var(--surface-raised)] border border-[var(--border-strong)] text-[var(--foreground)] rounded-[var(--radius-panel)] p-6 shadow-[var(--shadow-overlay)]">
        <DialogHeader className="shrink-0 pb-3 border-b border-[var(--border)]">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-[var(--radius-inner)] bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center">
                <Database className="w-4 h-4 text-[var(--foreground)]" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Record Explorer — {databaseName}
                </DialogTitle>
                <DialogDescription className="text-xs text-[var(--text-muted)]">
                  Live read-only record inspection with credentials stripped for safety.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-[var(--surface-muted)] p-1 rounded-[var(--radius-control)] border border-[var(--border)]">
              <button
                type="button"
                onClick={() => {
                  setCollection("users")
                  setPage(1)
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-inner)] text-xs font-medium transition-colors ${
                  collection === "users"
                    ? "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Users ({collection === "users" ? total : "—"})</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCollection("projects")
                  setPage(1)
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-[var(--radius-inner)] text-xs font-medium transition-colors ${
                  collection === "projects"
                    ? "bg-[var(--surface-raised)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--text-muted)] hover:text-[var(--foreground)]"
                }`}
              >
                <FolderGit2 className="w-3.5 h-3.5" />
                <span>Projects ({collection === "projects" ? total : "—"})</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Toolbar: Search & Refresh */}
        <div className="shrink-0 flex items-center gap-2 py-3 border-b border-[var(--border-subtle)]">
          <form onSubmit={handleSearchSubmit} className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${collection} by email, name, id...`}
              className="pl-8 h-8 text-xs bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] rounded-[var(--radius-control)]"
            />
          </form>
          <Button
            size="sm"
            variant="outline"
            onClick={() => fetchRecords(page, search, collection)}
            className="h-8 px-2.5 text-xs border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:text-[var(--foreground)] rounded-[var(--radius-control)] gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-auto custom-scrollbar my-2">
          {loading ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)] flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Querying Turso LibSQL records...</span>
            </div>
          ) : records.length === 0 ? (
            <div className="p-12 text-center text-xs text-[var(--text-muted)]">
              No {collection} records found matching the query.
            </div>
          ) : collection === "users" ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-secondary)] sticky top-0 font-medium">
                <tr>
                  <th className="py-2 px-3">User</th>
                  <th className="py-2 px-3">Email</th>
                  <th className="py-2 px-2 text-center">Plan</th>
                  <th className="py-2 px-3 text-right">Credits</th>
                  <th className="py-2 px-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {records.map((u, i) => {
                  const initials = (u.name || u.email || "U")
                    .slice(0, 2)
                    .toUpperCase()
                  return (
                    <tr key={u.id || u._id || i} className="hover:bg-[var(--surface)]/50 transition-colors">
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-6 h-6 rounded-full border border-[var(--border)]">
                            <AvatarImage src={u.image || u.avatar || ""} />
                            <AvatarFallback className="text-[10px] bg-[var(--surface-muted)] text-[var(--foreground)]">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-[var(--foreground)] truncate max-w-[140px]">
                            {u.name || "Unnamed"}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[180px]">
                        {u.email}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] font-mono px-1.5 py-0 rounded-[var(--radius-inner)] ${
                            u.isPremium || u.plan === "pro"
                              ? "bg-[var(--foreground)] text-[var(--background)] font-medium"
                              : "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]"
                          }`}
                        >
                          {u.isPremium || u.plan === "pro" ? "PRO" : "FREE"}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[var(--foreground)]">
                        {u.credits ?? 0}
                      </td>
                      <td className="py-2.5 px-3 text-right text-[11px] text-[var(--text-muted)] font-mono">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs">
              <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)] text-[var(--text-secondary)] sticky top-0 font-medium">
                <tr>
                  <th className="py-2 px-3">Project Title</th>
                  <th className="py-2 px-3">User ID</th>
                  <th className="py-2 px-3 text-center">Published</th>
                  <th className="py-2 px-3 text-right">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {records.map((p, i) => (
                  <tr key={p.id || p._id || i} className="hover:bg-[var(--surface)]/50 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-[var(--foreground)] truncate max-w-[200px]">
                      {p.name || p.title || p.prompt?.slice(0, 30) || "Untitled Project"}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-[var(--text-secondary)] truncate max-w-[150px]">
                      {p.userId || p.userEmail || "—"}
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <Badge
                        variant="outline"
                        className={`text-[10px] font-mono px-1.5 py-0 rounded-[var(--radius-inner)] ${
                          p.published || p.isPublished
                            ? "bg-[var(--success-muted)] text-[var(--success)] border-[var(--success)]/20"
                            : "bg-[var(--surface-muted)] text-[var(--text-muted)] border-[var(--border)]"
                        }`}
                      >
                        {p.published || p.isPublished ? "YES" : "NO"}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-right text-[11px] text-[var(--text-muted)] font-mono">
                      {p.updatedAt ? new Date(p.updatedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer: Pagination & Security Notice */}
        <div className="shrink-0 flex items-center justify-between pt-3 border-t border-[var(--border-subtle)] text-xs">
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
            <ShieldCheck className="w-3.5 h-3.5 text-[var(--success)]" />
            <span>Credentials, password hashes, and API keys redacted</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-[var(--text-secondary)] font-mono">
              Page {page} of {totalPages || 1}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchRecords(page - 1, search, collection)}
              disabled={page <= 1 || loading}
              className="h-7 w-7 p-0 rounded-[var(--radius-control)]"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => fetchRecords(page + 1, search, collection)}
              disabled={page >= totalPages || loading}
              className="h-7 w-7 p-0 rounded-[var(--radius-control)]"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
