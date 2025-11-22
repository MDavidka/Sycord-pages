"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import {
  AlertCircle,
  Users,
  Zap,
  Globe,
  Trash2,
  Calendar,
  Mail,
  Search,
  LayoutDashboard,
  Menu,
  X,
  ArrowLeft,
  Settings,
  Shield,
  LogOut,
  BarChart3
} from "lucide-react"

interface User {
  userId: string
  email: string
  name: string
  projectCount: number
  isPremium: boolean
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
  const [activeTab, setActiveTab] = useState<"overview" | "users">("overview")

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  if (!session?.user?.email?.includes("dmarton336@gmail.com")) {
    return null
  }

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
              onClick={() => { setActiveTab("overview"); setIsSidebarOpen(false); }}
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
              onClick={() => { setActiveTab("users"); setIsSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 group ${
                activeTab === "users"
                  ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              }`}
            >
              <Users className="h-5 w-5" />
              <span className="font-medium text-sm">User Management</span>
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
                    <div className="text-2xl font-bold">
                      {users.reduce((acc, u) => acc + u.projectCount, 0)}
                    </div>
                    <p className="text-xs text-muted-foreground">Total created</p>
                  </CardContent>
                </Card>

                <Card className="border-border shadow-sm">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Free Plan</CardTitle>
                    <Users className="h-4 w-4 text-green-500" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{users.filter((u) => !u.isPremium).length}</div>
                    <p className="text-xs text-muted-foreground">Standard users</p>
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
                      <Card
                        key={user.userId}
                        className="border-border hover:border-primary/30 transition-colors shadow-sm"
                      >
                        <CardContent className="p-6">
                          <div className="flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-4">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h3 className="font-bold text-lg text-foreground">{user.name}</h3>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Mail className="h-3.5 w-3.5" />
                                    <span>{user.email}</span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                   {user.isPremium ? (
                                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
                                      <Zap className="h-3 w-3 mr-1" /> Premium
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-muted-foreground">Free</Badge>
                                  )}
                                  <span className="text-xs text-muted-foreground font-mono">{user.userId.substring(0,8)}...</span>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                                <div className="bg-muted/30 p-2 rounded-lg">
                                  <p className="text-xs text-muted-foreground">Projects</p>
                                  <p className="font-medium">{user.projectCount}</p>
                                </div>
                                <div className="bg-muted/30 p-2 rounded-lg">
                                  <p className="text-xs text-muted-foreground">Joined</p>
                                  <p className="font-medium">{formatDate(user.createdAt)}</p>
                                </div>
                                <div className="bg-muted/30 p-2 rounded-lg col-span-2">
                                   <p className="text-xs text-muted-foreground">IP Address</p>
                                   <p className="font-mono text-xs">{user.ip}</p>
                                </div>
                              </div>

                               {user.websites.length > 0 && (
                                <div className="pt-2">
                                  <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">Websites</p>
                                  <div className="flex flex-wrap gap-2">
                                    {user.websites.map((website) => (
                                      <a
                                        key={website.id}
                                        href={`https://${website.subdomain}.ltpd.xyz`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 bg-secondary/50 hover:bg-secondary border border-border rounded-md px-3 py-1.5 text-xs transition-colors"
                                      >
                                        <Globe className="h-3 w-3 text-muted-foreground" />
                                        <span className="font-medium">{website.businessName}</span>
                                        <span className="text-muted-foreground opacity-50">({website.subdomain})</span>
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex md:flex-col justify-end gap-2 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 min-w-[140px]">
                              <Button
                                size="sm"
                                variant={user.isPremium ? "outline" : "default"}
                                onClick={() => togglePremium(user.userId, user.isPremium)}
                                disabled={updatingUser === user.userId}
                                className="w-full"
                              >
                                {user.isPremium ? "Downgrade" : "Upgrade"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => deleteUser(user.userId, user.name)}
                                disabled={updatingUser === user.userId}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
             </div>
          )}

        </div>
      </main>
    </div>
  )
}
