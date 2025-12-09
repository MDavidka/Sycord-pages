"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle, Loader2, ExternalLink, Rocket, Info, Settings, RefreshCw } from "lucide-react"
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Rocket className="h-5 w-5" />
          Deploy to Cloudflare Pages
        </CardTitle>
        <CardDescription>
          Deploy your website to Cloudflare Pages with global CDN and automatic HTTPS
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Configuration Section */}
        {!isAuthenticated && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You need to configure your Cloudflare API credentials before deploying.
              <Button
                variant="link"
                className="ml-2 p-0 h-auto"
                onClick={() => setShowConfig(!showConfig)}
              >
                {showConfig ? "Hide" : "Show"} configuration
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {showConfig && (
          <div className="space-y-4 border rounded-lg p-4 bg-muted/20">
            <div className="space-y-2">
              <Label htmlFor="apiToken">Cloudflare API Token</Label>
              <Input
                id="apiToken"
                type="password"
                placeholder="Enter your Cloudflare API token"
                value={apiToken}
                onChange={(e) => setApiToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Requires "Pages: Edit" permission.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountId">Account ID</Label>
              <Input
                id="accountId"
                placeholder="Enter your Cloudflare Account ID"
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleSaveCredentials}
                disabled={isConfiguring || !apiToken || !accountId}
                size="sm"
              >
                {isConfiguring ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Settings className="mr-2 h-4 w-4" />
                    Save Credentials
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setShowConfig(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Status Display */}
        {isAuthenticated && debugInfo && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span>Ready to deploy</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveCredentials}
                className="h-auto p-0 text-xs text-muted-foreground hover:text-destructive"
              >
                Unlink Cloudflare
              </Button>
            </div>
            {debugInfo.project?.cloudflareUrl && (
              <div className="flex items-center gap-2 text-sm">
                <ExternalLink className="h-4 w-4 text-primary" />
                <span>Live Site: </span>
                <a
                  href={debugInfo.project.cloudflareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline font-medium"
                >
                  {debugInfo.project.cloudflareUrl}
                </a>
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        {/* Empty State Warning */}
        {isAuthenticated && debugInfo && debugInfo.project?.pagesCount === 0 && (
          <Alert className="border-blue-200 bg-blue-50">
             <Info className="h-4 w-4 text-blue-600" />
             <AlertDescription className="text-blue-800">
                No custom pages found. Deploying will publish the default "Start Imagining" placeholder site.
             </AlertDescription>
          </Alert>
        )}

        {/* Deploy Button */}
        <div className="flex gap-2">
          <Button
            onClick={handleDeploy}
            disabled={isDeploying || !isAuthenticated}
            className="w-full relative"
            size="lg"
          >
            {isDeploying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deploying to Cloudflare...
              </>
            ) : (
              <>
                <Rocket className="mr-2 h-4 w-4" />
                {debugInfo?.project?.cloudflareUrl ? "Redeploy to Cloudflare" : "Deploy to Cloudflare"}
              </>
            )}
          </Button>
        </div>

        {/* Deployment Status */}
        {deploymentStatus === "success" && deploymentUrl && (
          <Alert className="border-green-500 bg-green-50 mt-4">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800 font-medium">
              Deployment Successful! <br />
              <a
                href={deploymentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline mt-1 inline-block"
              >
                Visit {deploymentUrl}
              </a>
            </AlertDescription>
          </Alert>
        )}

        {/* Deployment Logs */}
        {deploymentLogs.length > 0 && (
          <div className="space-y-2 mt-4">
            <div className="flex items-center justify-between">
                <Label>Deployment Logs</Label>
                {isDeploying && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            <div className="rounded-lg bg-slate-950 p-4 max-h-60 overflow-y-auto font-mono text-xs shadow-inner">
              {deploymentLogs.map((log, i) => (
                <div key={i} className={`py-0.5 border-b border-white/5 last:border-0 ${
                    log.type === 'error' ? 'text-red-400 font-bold' :
                    log.type === 'success' ? 'text-green-400 font-bold' :
                    'text-slate-300'
                }`}>
                  <span className="opacity-40 mr-2 text-slate-500">[{log.timestamp}]</span>
                  {log.message}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Debug Info (Collapsed) */}
        {debugInfo && (
          <div className="pt-2 border-t">
            <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground flex items-center gap-1">
                    <Info className="h-3 w-3" /> Debug Information
                </summary>
                <div className="mt-2 p-2 bg-muted rounded border overflow-x-auto">
                    <pre>{JSON.stringify({
                        project: debugInfo.project?.name,
                        id: debugInfo.project?.id,
                        url: debugInfo.project?.cloudflareUrl
                    }, null, 2)}</pre>
                </div>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
