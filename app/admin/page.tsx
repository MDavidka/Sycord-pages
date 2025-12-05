"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  AlertCircle,
  Users,
  Zap,
  Globe,
  Search,
  Menu,
  X,
  ArrowLeft,
  Shield,
  LogOut,
  BarChart3,
  Server,
  Key,
  Triangle,
  Copy,
} from "lucide-react"
import { UserCard } from "@/components/admin/user-card"

interface User {
  userId: string
  email: string
  name: string
  projectCount: number
  isPremium: boolean
  hasVercelLinked: boolean
  vercelAccessToken: string | null
  ip: string
  createdAt: string
  websites: Array<{ id: string; businessName: string; subdomain: string }>
}

export default function AdminPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [users, setUsers] = useState<User[]>([])
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "env">("overview")

  useEffect(() => {
    if (session?.user?.email !== "dmarton336@gmail.com") {
      router.push("/dashboard")
      return
    }

    fetchUsers()
  }, [session, router])

  useEffect(() => {
    const query = searchQuery.toLowerCase()
    const filtered = users.filter(
      (user) =>
        user.email.toLowerCase().includes(query) ||
        user.name.toLowerCase().includes(query) ||
        user.userId.toLowerCase().includes(query),
    )
    setFilteredUsers(filtered)
  }, [searchQuery, users])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/admin/users")
      if (!response.ok) throw new Error("Failed to fetch users")
      const data = await response.json()
      setUsers(data)
    } catch (error) {
      console.error("[v0] Error fetching users:", error)
    } finally {
      setLoading(false)
    }
  }

  const togglePremium = async (userId: string, isPremium: boolean) => {
    try {
      setUpdatingUser(userId)
      const response = await fetch(`/api/admin/users/${userId}/premium`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPremium: !isPremium }),
      })

      if (!response.ok) throw new Error("Failed to update premium status")

      setUsers(users.map((user) => (user.userId === userId ? { ...user, isPremium: !isPremium } : user)))

      console.log("[v0] Premium status updated for user:", userId)
    } catch (error) {
      console.error("[v0] Error updating premium:", error)
    } finally {
      setUpdatingUser(null)
    }
  }

  const deleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName} and all their websites? This cannot be undone.`)) {
      return
    }

    try {
      setUpdatingUser(userId)
      const response = await fetch(`/api/admin/users/${userId}/delete`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete user")

      setUsers(users.filter((user) => user.userId !== userId))
      console.log("[v0] User deleted:", userId)
    } catch (error) {
      console.error("[v0] Error deleting user:", error)
      alert("Failed to delete user")
    } finally {
      setUpdatingUser(null)
    }
  }

  const removeToken = async (userId: string) => {
    if (!confirm("Remove Vercel token for this user?")) {
      return
    }

    try {
      setUpdatingUser(userId)
      const response = await fetch(`/api/admin/users/${userId}/remove-token`, {
        method: "POST",
      })

      if (!response.ok) throw new Error("Failed to remove token")

      setUsers(users.map((user) => (user.userId === userId ? { ...user, vercelAccessToken: null } : user)))
      console.log("[v0] Token removed for user:", userId)
    } catch (error) {
      console.error("[v0] Error removing token:", error)
      alert("Failed to remove token")
    } finally {
      setUpdatingUser(null)
    }
  }

  if (!session?.user?.email?.includes("dmarton336@gmail.com")) {
    return null
  }

  const currentAppUrl = "https://ltpd.xyz"
  const callbackUrl = `${currentAppUrl}/api/auth/callback/vercel`

  return (
    <div className="min-h-screen bg-background relative">
      {/* Mobile Navigation Controls */}
      <div className="fixed top-4 left-4 z-30 md:hidden">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => router.push("/dashboard")}
          className="shadow-lg bg-background/60 backdrop-blur-md border border-border text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
      </div>

      <div className="fixed top-4 right-4 z-50 md:hidden">
        <Button
          variant="secondary"
          size="icon"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="shadow-lg bg-background/60 backdrop-blur-md border border-border text-foreground hover:bg-accent hover:text-accent-foreground"
        >
          {isSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-56 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } backdrop-blur-xl bg-sidebar border-r border-sidebar-border flex flex-col`}
      >
        <div className="p-6 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-8 text-sidebar-foreground">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-lg truncate">Admin Panel</span>
          </div>

          <nav className="flex-1 space-y-2">
            <button
              onClick={() => {
                setActiveTab("overview")
                setIsSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                activeTab === "overview"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <BarChart3 className="h-5 w-5" />
              <span className="font-medium text-sm">Overview</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("users")
                setIsSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                activeTab === "users"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="font-medium text-sm">User Management</span>
            </button>
            <button
              onClick={() => {
                setActiveTab("env")
                setIsSidebarOpen(false)
              }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                activeTab === "env"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Key className="h-5 w-5" />
              <span className="font-medium text-sm">Env Setup</span>
            </button>
          </nav>

          <div className="mt-auto pt-6 border-t border-sidebar-border space-y-2">
            <Button
              variant="ghost"
              className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent gap-3 px-4"
              onClick={() => router.push("/dashboard")}
            >
              <ArrowLeft className="h-5 w-5" />
              <span className="font-medium text-sm">Back to Dashboard</span>
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start text-destructive/70 hover:text-destructive hover:bg-destructive/10 gap-3 px-4"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              <LogOut className="h-5 w-5" />
              <span className="font-medium text-sm">Sign Out</span>
            </Button>
          </div>
        </div>
      </aside>

      <main className="transition-all duration-300 md:ml-56 min-h-screen flex flex-col">
        <div className="container mx-auto px-4 py-8 max-w-7xl">
          {/* Header Card */}
          <div className="relative rounded-xl overflow-hidden bg-card border border-border shadow-sm group mb-8">
            <div className="h-32 bg-gradient-to-r from-primary/20 to-purple-600/20 w-full" />
            <div className="absolute top-20 left-6">
              <div className="w-24 h-24 rounded-full border-4 border-background bg-muted overflow-hidden flex items-center justify-center">
                <Shield className="h-10 w-10 text-primary" />
              </div>
            </div>
            <div className="pt-14 pb-6 px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div className="mt-2">
                <h2 className="text-2xl font-bold">Admin Dashboard</h2>
                <p className="text-muted-foreground text-sm">Manage users, subscriptions, and platform health</p>
              </div>
              <div className="flex gap-2">
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 px-3 py-1">
                  v1.0.0
                </Badge>
              </div>
            </div>
          </div>

          {/* Overview Tab */}
          {activeTab === "overview" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
                    <Users className="h-4 w-4 text-primary" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.length}</div>
                    <p className="text-xs text-muted-foreground">Registered accounts</p>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Premium</CardTitle>
                    <Zap className="h-4 w-4 text-yellow-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.filter((u) => u.isPremium).length}</div>
                    <p className="text-xs text-muted-foreground">Active subscriptions</p>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Websites</CardTitle>
                    <Globe className="h-4 w-4 text-blue-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.reduce((acc, u) => acc + u.projectCount, 0)}</div>
                    <p className="text-xs text-muted-foreground">Total created</p>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Vercel Connected</CardTitle>
                    <Triangle className="h-4 w-4 text-black fill-black" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.filter((u) => u.hasVercelLinked).length}</div>
                    <p className="text-xs text-muted-foreground">Users with Vercel linked</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Users Tab */}
          {activeTab === "users" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by email, name, or user ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-12 bg-card border-border rounded-xl"
                />
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mb-4"></div>
                  <p className="text-muted-foreground">Fetching user data...</p>
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium">No users found</p>
                  <p className="text-muted-foreground">Try adjusting your search criteria</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredUsers.map((user) => (
                    <UserCard
                      key={user.userId}
                      user={user}
                      onDelete={deleteUser}
                      onTogglePremium={togglePremium}
                      onRemoveToken={removeToken}
                      updatingUser={updatingUser}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Environment Variables Guide Tab */}
          {activeTab === "env" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    Vercel Integration Setup
                  </CardTitle>
                  <CardDescription>
                    To enable Vercel login and automatic project deployment, you must configure the following
                    environment variables in your Vercel project settings.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <p className="font-semibold mb-1">Common Error: "The app ID is invalid"</p>
                    <p>
                      This error usually means the <strong>Redirect URL</strong> configured in the Vercel Integration
                      Console does not match the URL of your deployed application exactly.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="p-4 bg-muted rounded-lg border border-border">
                      <h3 className="font-medium mb-2 flex items-center gap-2">
                        <Key className="h-4 w-4" /> Required Environment Variables
                      </h3>
                      <div className="space-y-3 font-mono text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground select-all">VERCEL_CLIENT_ID</span>
                          <div className="bg-background border rounded px-3 py-2 text-xs text-muted-foreground">
                            Client ID from your Vercel Integration (OAuth App)
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <span className="text-muted-foreground select-all">VERCEL_CLIENT_SECRET</span>
                          <div className="bg-background border rounded px-3 py-2 text-xs text-muted-foreground">
                            Client Secret from your Vercel Integration (OAuth App)
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <h3 className="font-semibold text-sm">Setup Instructions</h3>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>
                          Go to{" "}
                          <a
                            href="https://vercel.com/dashboard/integrations/console"
                            target="_blank"
                            className="text-primary hover:underline"
                            rel="noreferrer"
                          >
                            Vercel Integrations Console
                          </a>
                          .
                        </li>
                        <li>Create a new Integration (e.g., "Sycord Pages").</li>
                        <li>
                          Set the <strong>Redirect URL</strong> to EXACTLY this value:
                          <div className="mt-1 bg-black text-white px-2 py-1 rounded font-mono select-all flex items-center justify-between group">
                            <span className="truncate">{callbackUrl}</span>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-white hover:text-white/80 hover:bg-white/10"
                              onClick={() => {
                                navigator.clipboard.writeText(callbackUrl)
                                alert("Copied Redirect URL!")
                              }}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </li>
                        <li>
                          Copy the <strong>Client ID</strong> and <strong>Client Secret</strong>.
                        </li>
                        <li>
                          Add these variables to your Vercel Project Settings (Settings &rarr; Environment Variables).
                        </li>
                        <li>Redeploy your application.</li>
                      </ol>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
