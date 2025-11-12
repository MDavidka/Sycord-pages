"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { AlertCircle, Users, Zap, Globe, Trash2, Calendar, Mail } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"

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

  if (!session?.user?.email?.includes("dmarton336@gmail.com")) {
    return null
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  return (
    <div className="min-h-screen bg-background font-sans">
      <header className="border-b border-border sticky top-0 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary/60 rounded-lg flex items-center justify-center text-primary-foreground font-bold text-lg">
              ⚙️
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">User Management & Subscription Control</p>
            </div>
          </Link>
          <Button
            variant="outline"
            onClick={() => {
              signOut({ callbackUrl: "/" })
            }}
          >
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
          <Card className="bg-gradient-to-br from-card to-card/60 border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Total Users</CardTitle>
              <Users className="h-3 w-3 text-primary" />
            </CardHeader>
            <CardContent className="p-2">
              <div className="text-lg font-bold text-foreground">{users.length}</div>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/60 border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Premium</CardTitle>
              <Zap className="h-3 w-3 text-yellow-500" />
            </CardHeader>
            <CardContent className="p-2">
              <div className="text-lg font-bold text-foreground">{users.filter((u) => u.isPremium).length}</div>
              <p className="text-xs text-muted-foreground">Subscribed</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/60 border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Websites</CardTitle>
              <Globe className="h-3 w-3 text-blue-500" />
            </CardHeader>
            <CardContent className="p-2">
              <div className="text-lg font-bold text-foreground">
                {users.reduce((acc, u) => acc + u.projectCount, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Total</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-card to-card/60 border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1">
              <CardTitle className="text-xs font-medium text-muted-foreground">Free</CardTitle>
              <Users className="h-3 w-3 text-green-500" />
            </CardHeader>
            <CardContent className="p-2">
              <div className="text-lg font-bold text-foreground">{users.filter((u) => !u.isPremium).length}</div>
              <p className="text-xs text-muted-foreground">Plan</p>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, name, or user ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-10 bg-card border-border font-sans"
            />
          </div>
          {searchQuery && (
            <p className="text-xs text-muted-foreground mt-2">
              Found {filteredUsers.length} of {users.length} users
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto mb-4"></div>
            <p className="text-muted-foreground font-sans">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-sans">
              {searchQuery ? "No users match your search" : "No users found"}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {filteredUsers.map((user) => (
              <Card
                key={user.userId}
                className="bg-card border-border hover:border-foreground/30 transition-colors overflow-hidden"
              >
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-foreground mb-1 font-sans">{user.name}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                          <Mail className="h-4 w-4" />
                          <span className="break-all font-sans">{user.email}</span>
                        </div>
                        <div className="flex gap-2 flex-wrap">
                          {user.isPremium ? (
                            <Badge className="bg-yellow-500/20 text-yellow-700 border border-yellow-500/30">
                              <Zap className="h-3 w-3 mr-1" />
                              Premium
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-secondary text-secondary-foreground">
                              Free Plan
                            </Badge>
                          )}
                          <Badge variant="outline" className="bg-blue-500/10 text-blue-700 border border-blue-500/20">
                            {user.projectCount} Website{user.projectCount !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                      </div>

                      {/* Stats Column */}
                      <div className="text-right space-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                          <p className="text-sm font-mono bg-secondary/50 px-2 py-1 rounded">{user.ip}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">Joined</p>
                          <p className="text-sm flex items-center justify-end gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDate(user.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Websites Section */}
                    {user.websites.length > 0 && (
                      <div className="pt-4 border-t border-border">
                        <p className="text-xs font-semibold text-muted-foreground mb-3">
                          Websites ({user.websites.length}):
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                          {user.websites.map((website) => (
                            <div
                              key={website.id}
                              className="bg-secondary/30 border border-border rounded-lg p-3 hover:bg-secondary/50 transition-colors"
                            >
                              <p className="font-medium text-sm text-foreground truncate font-sans">
                                {website.businessName}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {website.subdomain}.ltpd.xyz
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="pt-4 border-t border-border flex gap-2 justify-end flex-wrap">
                      <Button
                        size="sm"
                        variant={user.isPremium ? "destructive" : "default"}
                        onClick={() => togglePremium(user.userId, user.isPremium)}
                        disabled={updatingUser === user.userId}
                      >
                        {updatingUser === user.userId
                          ? "Updating..."
                          : user.isPremium
                            ? "Remove Premium"
                            : "Add Premium"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-destructive text-destructive hover:bg-destructive/10 bg-transparent"
                        onClick={() => deleteUser(user.userId, user.name)}
                        disabled={updatingUser === user.userId}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete User
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
