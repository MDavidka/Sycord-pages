"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  AlertCircle,
  CheckCircle,
  Loader2,
  ExternalLink,
  Rocket,
  Info,
  Settings,
  RefreshCw,
  Globe,
  Clock,
  Hash,
  Terminal
} from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CloudflareDeploymentProps {
  projectId: string
  projectName: string
}

interface DebugInfo {
  project?: {
    id: string
    name: string
    hasPages: boolean
    pagesCount: number
    cloudflareProjectName: string | null
    cloudflareUrl: string | null
    cloudflareDeployedAt: string | null
    cloudflareDeploymentId: string | null
  }
  authentication?: {
    isAuthenticated: boolean
    hasApiToken: boolean
    hasAccountId: boolean
    tokenCreatedAt: string | null
    tokenUpdatedAt: string | null
  }
  pages?: Array<{ name: string; size: number }>
  recommendations?: string[]
}

interface LogEntry {
  message: string
  type: 'info' | 'success' | 'error'
  timestamp: string
}

export function CloudflareDeployment({ projectId, projectName }: CloudflareDeploymentProps) {
  const [isConfiguring, setIsConfiguring] = useState(false)
  const [isDeploying, setIsDeploying] = useState(false)
  const [deploymentStatus, setDeploymentStatus] = useState<string | null>(null)
  const [deploymentUrl, setDeploymentUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [deploymentLogs, setDeploymentLogs] = useState<LogEntry[]>([])
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showConfig, setShowConfig] = useState(false)
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null)
  const [loadingDebug, setLoadingDebug] = useState(false)

  // Configuration form state
  const [apiToken, setApiToken] = useState("")
  const [accountId, setAccountId] = useState("")

  const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString()
    setDeploymentLogs((prev) => [...prev, { message, type, timestamp }])
  }

  const fetchDebugInfo = async () => {
    setLoadingDebug(true)
    try {
      const response = await fetch(`/api/cloudflare/status?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        setDebugInfo(data)
        setIsAuthenticated(!!data?.authentication?.isAuthenticated)

        if (data?.project?.cloudflareUrl) {
          setDeploymentUrl(data.project.cloudflareUrl)
        }
      }
    } catch (err) {
      console.error("[Cloudflare] Failed to fetch debug info:", err)
    } finally {
      setLoadingDebug(false)
    }
  }

  // Fetch status on mount
  useEffect(() => {
    fetchDebugInfo()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSaveCredentials = async () => {
    if (!apiToken || !accountId) {
      setError("Please provide both API token and Account ID")
      return
    }

    setIsConfiguring(true)
    setError(null)

    try {
      addLog("🔐 Validating Cloudflare credentials...", "info")

      const response = await fetch("/api/cloudflare/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          apiToken,
          accountId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to validate credentials")
      }

      addLog("✅ Credentials validated and saved!", "success")
      setIsAuthenticated(true)
      setShowConfig(false)
      setApiToken("")
      setAccountId("")
      await fetchDebugInfo()
    } catch (err: any) {
      console.error("[Cloudflare] Config error:", err)
      setError(err.message || "Failed to save credentials")
      addLog(`❌ Error: ${err.message}`, "error")
    } finally {
      setIsConfiguring(false)
    }
  }

  const handleDeploy = async () => {
    if (!isAuthenticated) {
      setError("Please configure your Cloudflare credentials first")
      return
    }

    setIsDeploying(true)
    setError(null)
    setDeploymentStatus("deploying")
    setDeploymentLogs([]) // Clear previous logs

    try {
      addLog("🚀 Starting deployment to Cloudflare Pages...", "info")

      // Step 1: Check connectivity
      addLog("📡 Checking Cloudflare connectivity...", "info")

      const response = await fetch("/api/cloudflare/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      })

      if (!response.ok) {
        const errorData = await response.json()

        // Handle specific error cases
        if (response.status === 404 && errorData.error?.includes("Local project")) {
           addLog("❌ Error: Local project ID mismatch.", "error")
        } else if (response.status === 500 && errorData.error?.includes("Cloudflare Access Denied")) {
           addLog("❌ Error: Cloudflare authentication failed.", "error")
        } else {
           addLog(`❌ Error: ${errorData.error || response.statusText}`, "error")
        }

        throw new Error(errorData.error || "Deployment failed")
      }

      const result = await response.json()

      addLog("✅ Deployment successful!", "success")
      addLog(`🌐 Your site is live at: ${result.url}`, "success")

      setDeploymentStatus("success")
      setDeploymentUrl(result.url)
      await fetchDebugInfo()
    } catch (err: any) {
      console.error("[Cloudflare] Deploy error:", err)
      setError(err.message || "Deployment failed")
      setDeploymentStatus("error")
      addLog(`❌ Deployment failed: ${err.message}`, "error")
    } finally {
      setIsDeploying(false)
    }
  }

  const handleRemoveCredentials = async () => {
    if (!confirm("Are you sure you want to remove your Cloudflare credentials?")) {
      return
    }

    try {
      await fetch(`/api/cloudflare/auth?projectId=${projectId}`, {
        method: "DELETE",
      })

      setIsAuthenticated(false)
      addLog("🗑️ Credentials removed", "info")
      await fetchDebugInfo()
    } catch (err) {
      console.error("[Cloudflare] Failed to remove credentials:", err)
    }
  }

  const getStatusColor = () => {
    if (isDeploying) return "bg-yellow-500"
    if (deploymentStatus === "success" || debugInfo?.project?.cloudflareUrl) return "bg-green-500"
    if (deploymentStatus === "error" || error) return "bg-red-500"
    return "bg-gray-300"
  }

  const getStatusText = () => {
    if (isDeploying) return "Deploying..."
    if (deploymentStatus === "success" || debugInfo?.project?.cloudflareUrl) return "Live"
    if (deploymentStatus === "error" || error) return "Error"
    return "Not Deployed"
  }

  return (
    <Card className="overflow-hidden">
      {!isAuthenticated ? (
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="p-3 bg-muted rounded-full">
              <Rocket className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
               <h3 className="font-semibold text-lg">Connect Cloudflare</h3>
               <p className="text-sm text-muted-foreground max-w-sm">
                  Deploy your website globally with Cloudflare Workers. Configure your API token to get started.
               </p>
            </div>
            <Button onClick={() => setShowConfig(!showConfig)}>
               {showConfig ? "Hide Configuration" : "Configure Deployment"}
            </Button>

            {showConfig && (
              <div className="w-full max-w-md space-y-4 border rounded-lg p-4 bg-muted/20 text-left animate-in slide-in-from-top-2">
                <div className="space-y-2">
                  <Label htmlFor="apiToken">Cloudflare API Token</Label>
                  <Input
                    id="apiToken"
                    type="password"
                    placeholder="Token with 'Pages: Edit' permission"
                    value={apiToken}
                    onChange={(e) => setApiToken(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountId">Account ID</Label>
                  <Input
                    id="accountId"
                    placeholder="Your Cloudflare Account ID"
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    onClick={handleSaveCredentials}
                    disabled={isConfiguring || !apiToken || !accountId}
                  >
                    {isConfiguring ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Save & Connect"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      ) : (
        <div className="divide-y divide-border">
          {/* Header Section: Domain & Status */}
          <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
               <div className="flex items-center gap-3">
                  <h3 className="text-xl font-bold truncate">
                    {debugInfo?.project?.cloudflareUrl
                      ? debugInfo.project.cloudflareUrl.replace(/^https?:\/\//, '')
                      : projectName}
                  </h3>
                  <div
                    className={`h-3 w-3 rounded-full ${getStatusColor()} shadow-sm ring-2 ring-background`}
                    title={getStatusText()}
                  />
               </div>
               {deploymentUrl && (
                 <a
                   href={deploymentUrl}
                   target="_blank"
                   rel="noopener noreferrer"
                   className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                 >
                    {deploymentUrl} <ExternalLink className="h-3 w-3" />
                 </a>
               )}
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
               {/* Change Domain Button - Scrolls to Domain Manager if present on page */}
               <Button
                 variant="outline"
                 onClick={() => {
                   const el = document.querySelector('.cloudflare-domain-manager');
                   if (el) el.scrollIntoView({ behavior: 'smooth' });
                 }}
               >
                 Change Domain
               </Button>

               <Button
                 onClick={handleDeploy}
                 disabled={isDeploying}
                 className="min-w-[100px]"
               >
                 {isDeploying ? (
                   <>
                     <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                     ...
                   </>
                 ) : (
                   <>
                     <RefreshCw className="mr-2 h-4 w-4" />
                     Redeploy
                   </>
                 )}
               </Button>
            </div>
          </div>

          {/* Last Build Info */}
          <div className="p-6 bg-muted/10 grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-background border rounded-md shadow-sm">
                   <Rocket className="h-5 w-5 text-primary" />
                </div>
                <div>
                   <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</p>
                   <p className="font-medium text-sm">{getStatusText()}</p>
                </div>
             </div>

             <div className="flex items-center gap-3">
                <div className="p-2 bg-background border rounded-md shadow-sm">
                   <Clock className="h-5 w-5 text-primary" />
                </div>
                <div>
                   <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Last Build</p>
                   <p className="font-medium text-sm">
                     {debugInfo?.project?.cloudflareDeployedAt
                       ? new Date(debugInfo.project.cloudflareDeployedAt).toLocaleString()
                       : "Never"}
                   </p>
                </div>
             </div>

             <div className="flex items-center gap-3">
                <div className="p-2 bg-background border rounded-md shadow-sm">
                   <Hash className="h-5 w-5 text-primary" />
                </div>
                <div>
                   <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Build ID</p>
                   <p className="font-mono text-xs truncate max-w-[120px]" title={debugInfo?.project?.cloudflareDeploymentId || "N/A"}>
                     {debugInfo?.project?.cloudflareDeploymentId?.substring(0, 8) || "N/A"}
                   </p>
                </div>
             </div>
          </div>

          {/* Collapsible Logs & Settings */}
          <div className="bg-muted/5">
             <details className="group">
                <summary className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/20 transition-colors">
                   <span className="text-sm font-medium flex items-center gap-2">
                     <Terminal className="h-4 w-4 text-muted-foreground" />
                     Deployment Logs & Settings
                   </span>
                   <Settings className="h-4 w-4 text-muted-foreground group-open:rotate-90 transition-transform" />
                </summary>

                <div className="p-4 border-t border-border/50 space-y-4">
                    {deploymentLogs.length > 0 ? (
                        <div className="rounded-md bg-black/90 p-3 max-h-48 overflow-y-auto font-mono text-xs text-white">
                          {deploymentLogs.map((log, i) => (
                            <div key={i} className={`py-0.5 border-b border-white/10 last:border-0 ${
                                log.type === 'error' ? 'text-red-400' :
                                log.type === 'success' ? 'text-green-400' :
                                'text-gray-300'
                            }`}>
                              <span className="opacity-50 mr-2">[{log.timestamp}]</span>
                              {log.message}
                            </div>
                          ))}
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground text-center py-4 italic">
                           No logs available for this session.
                        </div>
                    )}

                    <div className="flex justify-end pt-2">
                       <Button variant="destructive" size="sm" onClick={handleRemoveCredentials}>
                          Disconnect Cloudflare
                       </Button>
                    </div>
                </div>
             </details>
          </div>
        </div>
      )}
    </Card>
  )
}
