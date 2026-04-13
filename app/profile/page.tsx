"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  Trash2,
  Database,
  Key,
  Copy,
  CheckCircle2,
  Loader2,
  Bell,
  LogOut,
  ExternalLink,
  AlertCircle,
} from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export default function ProfileSettingsPage() {
  const router = useRouter()
  const { data: session, status } = useSession()
  const [activeSection, setActiveSection] = useState("account")
  const [isLoading, setIsLoading] = useState(true)
  const [userStatus, setUserStatus] = useState<any>(null)
  const [copiedId, setCopiedId] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")

  // Email preferences
  const [emailPrefs, setEmailPrefs] = useState({
    marketing: true,
    deployNotifications: true,
    weeklyReport: false,
    securityAlerts: true,
  })

  // Integrations
  const [integrations, setIntegrations] = useState<{ name: string; connected: boolean; connectedAt?: string }[]>([])

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  useEffect(() => {
    if (status !== "authenticated") return
    Promise.all([
      fetch("/api/user/status").then(r => r.json()).catch(() => null),
    ]).then(([statusData]) => {
      if (statusData) setUserStatus(statusData)
      setIsLoading(false)
    })
  }, [status])

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (status === "unauthenticated") return null

  const userInitials = session?.user?.name?.split(" ").map(n => n[0]).join("").toUpperCase() || "U"
  const accountId = session?.user?.id || "N/A"

  const copyAccountId = () => {
    navigator.clipboard.writeText(accountId)
    setCopiedId(true)
    setTimeout(() => setCopiedId(false), 2000)
  }

  const sections = [
    { id: "account", label: "Account", icon: User },
    { id: "email", label: "Email Preferences", icon: Bell },
    { id: "integrations", label: "Integrations", icon: Database },
    { id: "security", label: "Security", icon: Shield },
    { id: "danger", label: "Danger Zone", icon: AlertCircle },
  ]

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-white/10 bg-background/50 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center h-14 px-4 md:px-6">
          <Button variant="ghost" size="icon" onClick={() => router.push("/dashboard")} className="-ml-2 mr-3">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-base font-semibold">Profile Settings</h1>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 md:px-6 py-6 md:py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar navigation */}
          <nav className="md:w-56 shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible pb-2 md:pb-0" style={{ scrollbarWidth: "none" }}>
              {sections.map(s => {
                const Icon = s.icon
                return (
                  <button
                    key={s.id}
                    onClick={() => setActiveSection(s.id)}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors",
                      activeSection === s.id
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {s.label}
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Content */}
          <div className="flex-1 space-y-6">
            {/* Account Section */}
            {activeSection === "account" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="bg-card/50 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Your account information</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar and name */}
                    <div className="flex items-center gap-4">
                      <Avatar className="h-16 w-16">
                        <AvatarImage src={session?.user?.image || ""} alt={session?.user?.name || ""} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xl">{userInitials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-lg font-semibold">{session?.user?.name}</p>
                        <p className="text-sm text-muted-foreground">{session?.user?.email}</p>
                      </div>
                    </div>

                    {/* Account ID */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Account ID</Label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/20 border border-white/10">
                        <Key className="h-4 w-4 text-muted-foreground shrink-0" />
                        <code className="text-sm font-mono text-muted-foreground flex-1 truncate">{accountId}</code>
                        <button onClick={copyAccountId} className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                          {copiedId ? <CheckCircle2 className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Subscription */}
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Subscription</Label>
                      <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/20 border border-white/10">
                        <Shield className="h-4 w-4 text-primary shrink-0" />
                        <span className="text-sm font-medium">{userStatus?.subscription || "Free"}</span>
                        {userStatus?.isPremium && (
                          <span className="text-[10px] font-semibold bg-primary/20 text-primary px-2 py-0.5 rounded-full">Premium</span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Email Preferences */}
            {activeSection === "email" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="bg-card/50 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <CardTitle>Email Preferences</CardTitle>
                    <CardDescription>Manage which emails you receive</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {[
                      { key: "securityAlerts", label: "Security Alerts", description: "Critical security notifications" },
                      { key: "deployNotifications", label: "Deploy Notifications", description: "Notify when deployments succeed or fail" },
                      { key: "marketing", label: "Marketing", description: "Product updates and offers" },
                      { key: "weeklyReport", label: "Weekly Report", description: "Weekly summary of your projects" },
                    ].map(pref => (
                      <div key={pref.key} className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/10">
                        <div className="space-y-0.5">
                          <p className="text-sm font-medium">{pref.label}</p>
                          <p className="text-xs text-muted-foreground">{pref.description}</p>
                        </div>
                        <Switch
                          checked={(emailPrefs as any)[pref.key]}
                          onCheckedChange={(val) => setEmailPrefs(prev => ({ ...prev, [pref.key]: val }))}
                        />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Integrations */}
            {activeSection === "integrations" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="bg-card/50 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <CardTitle>Connected Integrations</CardTitle>
                    <CardDescription>Manage third-party connections</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      { name: "Google", icon: "🔗", description: "Sign-in via Google OAuth", connected: !!session?.user },
                      { name: "GitHub", icon: "🐙", description: "Repository deployments", connected: false },
                    ].map(integration => (
                      <div key={integration.name} className="flex items-center gap-3 p-3 rounded-lg bg-black/20 border border-white/10">
                        <span className="text-xl">{integration.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{integration.name}</p>
                          <p className="text-xs text-muted-foreground">{integration.description}</p>
                        </div>
                        {integration.connected ? (
                          <span className="flex items-center gap-1 text-xs text-emerald-400 font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Connected
                          </span>
                        ) : (
                          <Button size="sm" variant="outline" className="h-7 text-xs">
                            Connect
                          </Button>
                        )}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Security */}
            {activeSection === "security" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="bg-card/50 backdrop-blur-sm border-white/10">
                  <CardHeader>
                    <CardTitle>Security</CardTitle>
                    <CardDescription>Manage your account security</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between p-3 rounded-lg bg-black/20 border border-white/10">
                      <div>
                        <p className="text-sm font-medium">Active Sessions</p>
                        <p className="text-xs text-muted-foreground">Manage devices where you're signed in</p>
                      </div>
                      <Button size="sm" variant="outline" className="text-xs h-8" onClick={() => signOut({ callbackUrl: "/" })}>
                        <LogOut className="h-3.5 w-3.5 mr-1.5" /> Sign out everywhere
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Danger Zone */}
            {activeSection === "danger" && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="bg-card/50 backdrop-blur-sm border-destructive/30">
                  <CardHeader>
                    <CardTitle className="text-destructive">Danger Zone</CardTitle>
                    <CardDescription>Irreversible actions for your account</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20 space-y-3">
                      <div>
                        <p className="text-sm font-medium text-destructive">Delete Account</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Permanently delete your account and all associated data. This action cannot be undone.
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                          Type <strong className="text-foreground">DELETE</strong> to confirm
                        </Label>
                        <Input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder="DELETE"
                          className="bg-black/20 max-w-xs"
                        />
                      </div>
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteConfirmText !== "DELETE" || isDeleting}
                        onClick={async () => {
                          if (deleteConfirmText !== "DELETE") return
                          setIsDeleting(true)
                          try {
                            // Account deletion would be implemented server-side
                            await signOut({ callbackUrl: "/" })
                          } catch {
                            setIsDeleting(false)
                          }
                        }}
                      >
                        {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        Delete my account
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
