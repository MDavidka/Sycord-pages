"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, Users, Zap, Globe } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

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
  const [loading, setLoading] = useState(true)
  const [updatingUser, setUpdatingUser] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user?.email !== "dmarton338@gmail.com") {
      router.push("/dashboard")
      return
    }

    fetchUsers()
  }, [session, router])

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

  if (!session?.user?.email?.includes("dmarton338@gmail.com")) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border sticky top-0 bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold">
              A
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">User Management</p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              fetch("/api/auth/signout").then(() => router.push("/"))
            }}
          >
            Sign Out
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Premium Users</CardTitle>
              <Zap className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter((u) => u.isPremium).length}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Websites</CardTitle>
              <Globe className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.reduce((acc, u) => acc + u.projectCount, 0)}</div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading users...</p>
          </div>
        ) : users.length === 0 ? (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>No users found</AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <Card key={user.userId} className="bg-card border-border overflow-hidden">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-start">
                    <div className="md:col-span-2">
                      <h3 className="font-semibold text-foreground mb-1">{user.name}</h3>
                      <p className="text-sm text-muted-foreground break-all">{user.email}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">IP Address</p>
                      <p className="text-sm font-mono text-foreground">{user.ip}</p>
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Websites</p>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="bg-secondary text-secondary-foreground">
                          {user.projectCount}/2 {!user.isPremium && "free"}
                        </Badge>
                        {user.isPremium && <Badge className="bg-primary text-primary-foreground">Premium</Badge>}
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant={user.isPremium ? "destructive" : "default"}
                        onClick={() => togglePremium(user.userId, user.isPremium)}
                        disabled={updatingUser === user.userId}
                        className="w-full md:w-auto"
                      >
                        {updatingUser === user.userId
                          ? "Updating..."
                          : user.isPremium
                            ? "Remove Premium"
                            : "Add Premium"}
                      </Button>
                    </div>
                  </div>

                  {user.websites.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground mb-2">Websites:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {user.websites.map((website) => (
                          <div key={website.id} className="text-sm bg-secondary/30 rounded p-2">
                            <p className="font-medium text-foreground">{website.businessName}</p>
                            <p className="text-xs text-muted-foreground">{website.subdomain}.ltpd.xyz</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
