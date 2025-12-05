"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Mail, Zap, Triangle, Key, Copy, Check, Trash2, Search, Shield } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"

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

interface UserCardProps {
  user: User
  onDelete: (userId: string, userName: string) => Promise<void>
  onTogglePremium: (userId: string, isPremium: boolean) => Promise<void>
  onRemoveToken: (userId: string) => Promise<void>
  updatingUser: string | null
}

export function UserCard({ user, onDelete, onTogglePremium, onRemoveToken, updatingUser }: UserCardProps) {
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [showInvestigate, setShowInvestigate] = useState(false)
  const [investigateData, setInvestigateData] = useState<any>(null)
  const [investigateLoading, setInvestigateLoading] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopiedToken(user.userId)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const handleInvestigate = async () => {
    setInvestigateLoading(true)
    try {
      const response = await fetch(`/api/admin/users/${user.userId}/investigate`)
      const data = await response.json()
      setInvestigateData(data)
      setShowInvestigate(true)
    } catch (error) {
      console.error("[v0] Error investigating user:", error)
      alert("Failed to investigate user")
    } finally {
      setInvestigateLoading(false)
    }
  }

  return (
    <>
      <Card className="border-border hover:border-primary/30 transition-colors shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-lg text-foreground">{user.name}</h3>
                  {user.hasVercelLinked && (
                    <Badge
                      variant="secondary"
                      className="bg-black text-white hover:bg-black/90 gap-1 h-5 text-[10px] px-1.5 border-none"
                    >
                      <Triangle className="h-2 w-2 fill-white" /> Vercel
                    </Badge>
                  )}
                  {user.isPremium && (
                    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20 hover:bg-yellow-500/20">
                      <Zap className="h-3 w-3 mr-1" /> Premium
                    </Badge>
                  )}
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded">
                {user.userId.substring(0, 8)}...
              </span>
            </div>

            {/* Profile Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Email */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Mail className="h-3.5 w-3.5" /> Email
                </div>
                <p className="text-sm font-mono break-all">{user.email}</p>
              </div>

              {/* IP Address */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  <Shield className="h-3.5 w-3.5" /> IP Address
                </div>
                <p className="text-sm font-mono">{user.ip}</p>
              </div>

              {/* Joined Date */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  📅 Joined
                </div>
                <p className="text-sm font-medium">{formatDate(user.createdAt)}</p>
              </div>

              {/* Projects */}
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  🌐 Projects
                </div>
                <p className="text-sm font-medium">{user.projectCount}</p>
              </div>
            </div>

            {/* Vercel Status */}
            <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Triangle className="h-4 w-4 text-black fill-black" />
                  <span className="text-sm font-semibold text-foreground">Vercel Integration</span>
                </div>
                <Badge variant={user.hasVercelLinked ? "default" : "secondary"}>
                  {user.hasVercelLinked ? "Connected" : "Not Connected"}
                </Badge>
              </div>

              {/* Token Display */}
              {user.hasVercelLinked && user.vercelAccessToken && (
                <div className="mt-3 space-y-2">
                  <div className="bg-background/50 border border-border rounded p-2 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider flex items-center gap-1">
                        <Key className="h-3 w-3" /> Access Token
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5"
                        onClick={() => copyToClipboard(user.vercelAccessToken!)}
                      >
                        {copiedToken === user.userId ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    <code className="text-[9px] break-all font-mono text-muted-foreground bg-muted/50 p-1.5 rounded block border border-border/30">
                      {user.vercelAccessToken.substring(0, 20)}...
                      {user.vercelAccessToken.substring(user.vercelAccessToken.length - 20)}
                    </code>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="w-full text-red-600 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs h-7"
                    onClick={() => onRemoveToken(user.userId)}
                    disabled={updatingUser === user.userId}
                  >
                    Remove Vercel Token
                  </Button>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <Button
                size="sm"
                variant={user.isPremium ? "outline" : "default"}
                onClick={() => onTogglePremium(user.userId, user.isPremium)}
                disabled={updatingUser === user.userId}
                className="text-xs"
              >
                {user.isPremium ? "Downgrade" : "Upgrade"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleInvestigate}
                disabled={updatingUser === user.userId || investigateLoading}
                className="text-xs bg-transparent"
              >
                {investigateLoading ? "Checking..." : "Investigate"}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(user.userId, user.name)}
                disabled={updatingUser === user.userId}
                className="text-xs"
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Investigate Modal */}
      <Dialog open={showInvestigate} onOpenChange={setShowInvestigate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              IP Investigation
            </DialogTitle>
            <DialogDescription>Accounts using the same IP address</DialogDescription>
          </DialogHeader>

          {investigateData && (
            <div className="space-y-4">
              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Target User</p>
                <p className="font-semibold">{investigateData.targetUser.name}</p>
                <p className="text-sm text-muted-foreground">{investigateData.targetUser.email}</p>
              </div>

              <div className="bg-muted/50 border border-border rounded-lg p-3">
                <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">IP Address</p>
                <p className="font-mono text-sm">{investigateData.ip}</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-semibold">Accounts with Same IP</p>
                  <Badge>{investigateData.duplicateCount}</Badge>
                </div>
                {investigateData.duplicateUsers.length > 1 ? (
                  <div className="space-y-2">
                    {investigateData.duplicateUsers.map((dup: any) => (
                      <div key={dup.id} className="border border-border rounded-lg p-2">
                        <p className="font-medium text-sm">{dup.name}</p>
                        <p className="text-xs text-muted-foreground">{dup.email}</p>
                        <p className="text-xs text-muted-foreground mt-1">Created: {formatDate(dup.createdAt)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground bg-green-50/50 dark:bg-green-950/20 border border-green-200/50 dark:border-green-800/30 rounded p-2">
                    <Check className="h-4 w-4 text-green-600" />
                    No duplicate accounts found
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
