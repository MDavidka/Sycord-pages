"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Rocket,
  ExternalLink,
  RefreshCw,
  Globe,
  Clock,
  Hash,
  Upload,
  Store,
  Loader2,
  CheckCircle,
  AlertCircle
} from "lucide-react"
import { CloudflareDomainManager } from "@/components/cloudflare-domain-manager"

interface ServerCardProps {
  project: any
  deployment: any
  deploymentLogs: any[]
  isDeploying: boolean
  onDeploy: () => void
  settings: any
  profileImage: string
  onProfileImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onSettingsUpdate: () => void
  isSaving: boolean
  siteUrl: string
}

export function ServerCard({
  project,
  deployment,
  deploymentLogs,
  isDeploying,
  onDeploy,
  settings,
  profileImage,
  onProfileImageChange,
  onSettingsUpdate,
  isSaving,
  siteUrl
}: ServerCardProps) {
  const [showDomainManager, setShowDomainManager] = useState(false)

  const getStatusColor = () => {
    if (isDeploying) return "bg-yellow-500"
    if (project?.cloudflareUrl) return "bg-green-500"
    return "bg-gray-300"
  }

  const getStatusText = () => {
    if (isDeploying) return "Deploying..."
    if (project?.cloudflareUrl) return "Live"
    return "Not Deployed"
  }

  return (
    <div className="rounded-xl overflow-hidden bg-card border border-border shadow-sm group">
      {/* Banner */}
      <div className="h-32 bg-gradient-to-r from-blue-600/20 to-purple-600/20 w-full" />

      {/* Header Info */}
      <div className="px-6 pb-6 relative">
        {/* Profile Circle */}
        <div className="absolute -top-12 left-6">
           <div className="relative">
            <div className="w-24 h-24 rounded-full border-4 border-background bg-muted overflow-hidden">
              {profileImage ? (
                 <img src={profileImage} alt="Shop Profile" className="w-full h-full object-cover" />
              ) : (
                 <div className="w-full h-full flex items-center justify-center bg-muted">
                   <Store className="h-8 w-8 text-muted-foreground/50" />
                 </div>
              )}
            </div>
            <label htmlFor="card-profile-upload" className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-lg hover:bg-primary/90 transition-colors">
              <Upload className="h-4 w-4" />
              <input type="file" id="card-profile-upload" className="hidden" accept="image/*" onChange={onProfileImageChange} />
            </label>
           </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex justify-end pt-4 gap-2">
           <Button variant="outline" onClick={() => setShowDomainManager(!showDomainManager)}>
             <Globe className="h-4 w-4 mr-2" />
             {showDomainManager ? "Hide Domains" : "Manage Domains"}
           </Button>
           <Button onClick={onSettingsUpdate} disabled={isSaving}>
             {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
             Save Changes
           </Button>
        </div>

        {/* Main Info */}
        <div className="mt-4 flex flex-col md:flex-row gap-6 justify-between items-end">
           <div className="space-y-1">
              <h2 className="text-2xl font-bold">{settings?.shopName || project?.businessName || "My Awesome Shop"}</h2>
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                 <a href={project?.cloudflareUrl || siteUrl} target="_blank" rel="noopener noreferrer" className="hover:underline flex items-center gap-1">
                    {project?.cloudflareUrl ? project.cloudflareUrl.replace(/^https?:\/\//, '') : siteUrl}
                    <ExternalLink className="h-3 w-3" />
                 </a>
                 <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted text-xs font-medium">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
                    {getStatusText()}
                 </span>
              </div>
           </div>

           <div className="flex gap-2 w-full md:w-auto">
              <Button
                 onClick={onDeploy}
                 disabled={isDeploying}
                 className="w-full md:w-auto"
                 variant={project?.cloudflareUrl ? "secondary" : "default"}
              >
                 {isDeploying ? (
                    <>
                       <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                       Deploying...
                    </>
                 ) : (
                    <>
                       {project?.cloudflareUrl ? <RefreshCw className="mr-2 h-4 w-4" /> : <Rocket className="mr-2 h-4 w-4" />}
                       {project?.cloudflareUrl ? "Redeploy" : "Deploy Site"}
                    </>
                 )}
              </Button>
           </div>
        </div>

        {/* Domain Manager Expandable */}
        {showDomainManager && (
           <div className="mt-6 border-t pt-6 animate-in slide-in-from-top-2">
              <CloudflareDomainManager projectId={project._id} />
           </div>
        )}

        {/* Deployment Details & History */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-t border-border/50">
           <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="p-2 bg-background border rounded-md">
                 <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                 <p className="text-xs text-muted-foreground uppercase font-semibold">Last Build</p>
                 <p className="text-sm font-medium truncate">
                    {project?.cloudflareDeployedAt ? new Date(project.cloudflareDeployedAt).toLocaleString() : "Never"}
                 </p>
              </div>
           </div>

           <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="p-2 bg-background border rounded-md">
                 <Hash className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                 <p className="text-xs text-muted-foreground uppercase font-semibold">Deployment ID</p>
                 <p className="text-sm font-medium font-mono truncate w-32">
                    {project?.cloudflareDeploymentId || "N/A"}
                 </p>
              </div>
           </div>

           <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <div className="p-2 bg-background border rounded-md">
                 <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                 <p className="text-xs text-muted-foreground uppercase font-semibold">Environment</p>
                 <p className="text-sm font-medium">Production</p>
              </div>
           </div>
        </div>
      </div>
    </div>
  )
}
