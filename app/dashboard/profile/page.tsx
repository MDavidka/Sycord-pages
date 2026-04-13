"use client"

import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { ArrowLeft, User, Mail, Database, Trash2, Key, Loader2, Copy, Check } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

export default function ProfilePage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  // Fake settings state
  const [emailPrefs, setEmailPrefs] = useState({
    marketing: false,
    updates: true,
    security: true
  })

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/login")
    }
  }, [status, router])

  if (status === "loading" || !session) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const handleCopyId = () => {
    if (session?.user?.id) {
      navigator.clipboard.writeText(session.user.id)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
      toast.success("Account ID copied to clipboard")
    }
  }

  const handleDeleteAccount = () => {
    if (confirm("Are you completely sure you want to delete your account? This action is irreversible.")) {
      // In a real app, this would call an API route to delete the user
      toast.success("Account deletion request submitted")
      setTimeout(() => signOut({ callbackUrl: "/" }), 1000)
    }
  }

  return (
    <div className="container max-w-4xl mx-auto p-4 md:p-8 space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors mb-2">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account preferences and integrations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-1 hidden md:block">
          <Button variant="secondary" className="w-full justify-start font-medium bg-white/10 hover:bg-white/20">
            <User className="h-4 w-4 mr-2" /> General
          </Button>
          <Button variant="ghost" className="w-full justify-start font-normal text-muted-foreground hover:text-foreground">
            <Mail className="h-4 w-4 mr-2" /> Preferences
          </Button>
          <Button variant="ghost" className="w-full justify-start font-normal text-muted-foreground hover:text-foreground">
            <Database className="h-4 w-4 mr-2" /> Integrations
          </Button>
          <Button variant="ghost" className="w-full justify-start font-normal text-muted-foreground hover:text-foreground">
            <Key className="h-4 w-4 mr-2" /> Security
          </Button>
        </div>

        <div className="md:col-span-3 space-y-6">
          <Card className="bg-card/50 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Personal Information</CardTitle>
              <CardDescription>Your basic account details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" defaultValue={session?.user?.name || ""} disabled className="bg-black/20" />
                <p className="text-xs text-muted-foreground">Contact support to change your registered name.</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" defaultValue={session?.user?.email || ""} disabled className="bg-black/20" />
              </div>

              <div className="grid gap-2 mt-4 pt-4 border-t border-white/5">
                <Label>Account ID</Label>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-black/40 px-3 py-2 rounded-md flex-1 overflow-x-auto border border-white/10">
                    {session?.user?.id || "unknown-id"}
                  </code>
                  <Button variant="outline" size="icon" onClick={handleCopyId} className="h-8 w-8 shrink-0">
                    {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle>Email Preferences</CardTitle>
              <CardDescription>Manage what emails you receive from us</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Product Updates</Label>
                  <p className="text-sm text-muted-foreground">Receive news about new features and improvements.</p>
                </div>
                <Switch
                  checked={emailPrefs.updates}
                  onCheckedChange={c => setEmailPrefs({...emailPrefs, updates: c})}
                />
              </div>
              <Separator className="bg-white/5" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Marketing Emails</Label>
                  <p className="text-sm text-muted-foreground">Receive promotional offers and discounts.</p>
                </div>
                <Switch
                  checked={emailPrefs.marketing}
                  onCheckedChange={c => setEmailPrefs({...emailPrefs, marketing: c})}
                />
              </div>
              <Separator className="bg-white/5" />
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Security Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified about important security events.</p>
                </div>
                <Switch
                  checked={emailPrefs.security}
                  onCheckedChange={c => setEmailPrefs({...emailPrefs, security: c})}
                  disabled
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card/50 border-white/10 backdrop-blur-sm border-red-500/20">
            <CardHeader>
              <CardTitle className="text-red-400 flex items-center gap-2">
                <Trash2 className="h-5 w-5" /> Danger Zone
              </CardTitle>
              <CardDescription>Permanently delete your account and all associated data</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Once you delete your account, there is no going back. Please be certain. All your projects, files, and domains will be permanently destroyed.
              </p>
              <Button variant="destructive" onClick={handleDeleteAccount}>
                Delete Account
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
